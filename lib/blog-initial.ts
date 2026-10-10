import { get } from 'node:https';
import type { Post, PostSummary } from '@/app/blog/blog-api';
import { BLOG_API } from '@/lib/blog-config';

// Pages takes a public snapshot at build time. HTTPS bypasses Next's fetch cache.
export const runtimeBlog = false;

const timeoutMs = 20_000;
const maximumBytes = 4 * 1024 * 1024;
let initialPosts: Promise<PostSummary[]> | undefined;
const initialPost = new Map<string, Promise<Post | null>>();

function readPublicJson(path: string, missingIsNull = false): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BLOG_API}/${path}`);
    let settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const request = get(url, { headers: { Accept: 'application/json' } }, response => {
      const status = response.statusCode || 0;
      if (status === 404 && missingIsNull) {
        response.resume(); finish(undefined, null); return;
      }
      if (status < 200 || status >= 300) {
        response.resume(); finish(new Error(`Blog snapshot failed: HTTP ${status} for ${path}.`)); return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maximumBytes) {
          request.destroy(new Error(`Blog snapshot exceeded the response limit for ${path}.`));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        try { finish(undefined, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { finish(new Error(`Blog snapshot received invalid JSON for ${path}.`)); }
      });
      response.on('error', error => finish(error));
      response.on('aborted', () => finish(new Error(`Blog snapshot response was interrupted for ${path}.`)));
    });
    const timer = setTimeout(() => {
      request.destroy(new Error(`Blog snapshot timed out after ${timeoutMs / 1000}s for ${path}.`));
    }, timeoutMs);
    request.on('error', error => finish(error));
  });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Blog snapshot received an invalid public record.');
  }
  return value as Record<string, unknown>;
}

function summary(value: unknown): PostSummary {
  const post = record(value);
  if (typeof post.id !== 'string' || !post.id || typeof post.title !== 'string' ||
    typeof post.summary !== 'string' || typeof post.updated_at !== 'string' ||
    !(post.published_at === null || typeof post.published_at === 'string') ||
    ('status' in post && post.status !== 'published')) {
    throw new Error('Blog snapshot received an invalid published post.');
  }
  return {
    id: post.id, title: post.title, summary: post.summary,
    published_at: post.published_at, updated_at: post.updated_at,
  };
}

export async function getInitialPosts(): Promise<PostSummary[]> {
  return initialPosts ??= readPublicJson('posts').then(value => {
    const result = record(value);
    if (!Array.isArray(result.posts)) throw new Error('Blog snapshot received an invalid post list.');
    return result.posts.map(summary);
  });
}

export async function getInitialPost(id: string): Promise<Post | null> {
  const saved = initialPost.get(id);
  if (saved) return saved;
  const pending = readPublicJson(`posts/${encodeURIComponent(id)}`, true).then(value => {
    if (value === null) return null;
    const post = record(record(value).post);
    if (post.status !== 'published') return null;
    if (post.id !== id || typeof post.content !== 'string') {
      throw new Error('Blog snapshot received an invalid published article.');
    }
    return { ...summary(post), content: post.content, status: 'published' as const };
  });
  initialPost.set(id, pending);
  return pending;
}

export async function getStaticPostParams(): Promise<{ id: string }[]> {
  return (await getInitialPosts()).map(post => ({ id: post.id }));
}
