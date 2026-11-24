import type { R2Bucket } from '@cloudflare/workers-types';

export const OBJECT_PREFIX = 'tae-v1/';
export type StorageBucket = R2Bucket;

type Segment = [pack: number, offset: number, length: number];
type Media = { type: 'application/pdf' | 'image/webp'; length: number; segments: Segment[] };
type MediaIndex = { version: number; packs: string[]; files: Record<string, Media>; pages: Record<string, Media[]> };

const indexes = new WeakMap<StorageBucket, Promise<MediaIndex>>();
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex,nofollow',
};

const empty = (status: number, headers?: Record<string, string>) =>
  new Response(null, { status, headers: { ...privateHeaders, ...headers } });

function problem(status: number, error: string, request: Request): Response {
  if (request.method === 'HEAD') return empty(status);
  return Response.json({ error }, { status, headers: privateHeaders });
}

/** Read an internal JSON object under the current release prefix. */
export async function readJson<T>(bucket: StorageBucket, path: string): Promise<T> {
  if (!path.split('/').every(part => /^[a-z0-9_-][a-z0-9._-]*$/i.test(part))) {
    throw new Error('Caminho inválido no armazenamento do caderno.');
  }
  const object = await bucket.get(OBJECT_PREFIX + path);
  if (!object) throw new Error(`Objeto do caderno indisponível: ${path}`);
  return object.json<T>();
}

function mediaIndex(bucket: StorageBucket): Promise<MediaIndex> {
  const cached = indexes.get(bucket);
  if (cached) return cached;
  const pending = readJson<MediaIndex>(bucket, 'media/index.json').then(index => {
    if (index.version !== 1) throw new Error('Índice de mídias incompatível.');
    return index;
  }).catch(error => {
    indexes.delete(bucket);
    throw error;
  });
  indexes.set(bucket, pending);
  return pending;
}

function byteRange(value: string | null, size: number): { start: number; end: number } | null {
  if (!value) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match || (!match[1] && !match[2])) return null;

  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : null;
}

function concatenate(streams: ReadableStream<Uint8Array>[], length: number): ReadableStream<Uint8Array> {
  if (streams.length === 1) return streams[0];

  const remaining = streams.values();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const joined = new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (!reader) {
          const next = remaining.next();
          if (next.done) {
            controller.close();
            return;
          }
          reader = next.value.getReader();
        }
        const chunk = await reader.read();
        if (!chunk.done) {
          controller.enqueue(chunk.value);
          return;
        }
        reader.releaseLock();
        reader = undefined;
      }
    },
    async cancel(reason) {
      const pending = Array.from(remaining, stream => stream.cancel(reason));
      if (reader) pending.push(reader.cancel(reason));
      await Promise.allSettled(pending);
    },
  });
  // Workers use the response body's declared size when writing Content-Length.
  const FixedLength = (globalThis as typeof globalThis & {
    FixedLengthStream?: new (length: number) => TransformStream<Uint8Array, Uint8Array>;
  }).FixedLengthStream;
  return FixedLength ? joined.pipeThrough(new FixedLength(length)) : joined;
}

async function serve(bucket: StorageBucket, index: MediaIndex, media: Media, request: Request): Promise<Response> {
  const header = request.headers.get('range');
  const range = byteRange(header, media.length);
  const headers = { ...privateHeaders, 'Accept-Ranges': 'bytes' };
  if (!range) return empty(416, { ...headers, 'Content-Range': `bytes */${media.length}` });

  const { start, end } = range;
  const length = end - start + 1;
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', media.type);
  responseHeaders.set('Content-Length', String(length));
  if (header) responseHeaders.set('Content-Range', `bytes ${start}-${end}/${media.length}`);
  const init = { status: header ? 206 : 200, headers: responseHeaders };
  if (request.method === 'HEAD') return new Response(null, init);

  const streams: ReadableStream<Uint8Array>[] = [];
  let segmentStart = 0;
  try {
    for (const [pack, offset, segmentLength] of media.segments) {
      const segmentEnd = segmentStart + segmentLength - 1;
      const first = Math.max(start, segmentStart);
      const last = Math.min(end, segmentEnd);
      if (last >= first) {
        const object = await bucket.get(OBJECT_PREFIX + index.packs[pack], {
          range: { offset: offset + first - segmentStart, length: last - first + 1 },
        });
        if (!object) throw new Error('Lote de mídia indisponível.');
        // The Workers and DOM declarations describe the same runtime Web Streams API.
        streams.push(object.body as unknown as ReadableStream<Uint8Array>);
      }
      segmentStart += segmentLength;
    }
    return new Response(concatenate(streams, length), init);
  } catch (error) {
    await Promise.allSettled(streams.map(stream => stream.cancel()));
    throw error;
  }
}

/** Serve an indexed original or question image. */
export async function serveMedia(bucket: StorageBucket, path: string, request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return empty(405, { Allow: 'GET, HEAD' });
  if (!path.startsWith('media/')) return problem(404, 'Documento não encontrado.', request);
  try {
    const index = await mediaIndex(bucket);
    if (!Object.hasOwn(index.files, path)) return problem(404, 'Documento não encontrado.', request);
    return await serve(bucket, index, index.files[path], request);
  } catch {
    return problem(503, 'Documento temporariamente indisponível.', request);
  }
}

/** Serve an indexed page image. */
export async function servePage(bucket: StorageBucket, examId: string, page: number, request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return empty(405, { Allow: 'GET, HEAD' });
  if (!Number.isSafeInteger(page) || page < 1) return problem(404, 'Página não encontrada.', request);
  try {
    const index = await mediaIndex(bucket);
    if (!Object.hasOwn(index.pages, examId)) return problem(404, 'PDF indisponível.', request);
    const media = index.pages[examId][page - 1];
    if (!media) return problem(404, 'Página não encontrada.', request);
    return await serve(bucket, index, media, request);
  } catch {
    return problem(503, 'Página temporariamente indisponível.', request);
  }
}
