// The hosting dispatcher supplies authenticated identity. No client field grants ownership.
export type BlogEnv = {
  DB: D1Database;
  BLOG_OWNER_EMAIL: string;
  BLOG_RATE_SALT: string;
};

const siteOrigin = 'https://fernando-coelho.proffernando.chatgpt.site';
const publicOrigins = new Set([siteOrigin, 'https://proffernando1.github.io']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Post = { id: string; title: string; summary: string; content: string; status: string; published_at: string | null; updated_at: string };
class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function owner(request: Request, env: BlogEnv) {
  return Boolean(env.BLOG_OWNER_EMAIL && request.headers.get('oai-authenticated-user-id') &&
    request.headers.get('oai-authenticated-user-email')?.toLowerCase() === env.BLOG_OWNER_EMAIL.toLowerCase());
}

function field(data: Record<string, unknown>, key: string, max: number, required = true) {
  const value = typeof data[key] === 'string' ? (data[key] as string).trim() : '';
  if ((required && !value) || value.length > max) throw new HttpError(400, `Confira o campo ${key === 'content' ? 'texto' : key === 'name' ? 'nome' : key === 'title' ? 'título' : 'resumo'}.`);
  return value;
}

async function payload(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Envie os dados em JSON.');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 512000) throw new HttpError(413, 'O texto excede o limite de tamanho.');
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch { throw new HttpError(400, 'Dados inválidos.'); }
}

async function digest(value: string) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer), x => x.toString(16).padStart(2, '0')).join('');
}

async function rate(request: Request, env: BlogEnv, visitor: string, kind: string, seconds: number, maximum: number) {
  if (!env.BLOG_RATE_SALT) throw new HttpError(503, 'As interações estão temporariamente indisponíveis.');
  const identity = request.headers.get('cf-connecting-ip') || visitor;
  const id = await digest(`${env.BLOG_RATE_SALT}:${kind}:${identity}`);
  const window = Math.floor(Date.now() / 1000 / seconds);
  const row = await env.DB.prepare(`INSERT INTO blog_limits (id, window, hits) VALUES (?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET hits = CASE WHEN window = excluded.window THEN hits + 1 ELSE 1 END,
    window = excluded.window RETURNING hits`).bind(id, window).first<{ hits: number }>();
  if (row && row.hits > maximum) throw new HttpError(429, 'Aguarde um pouco antes de enviar novamente.');
}

function visitorId(data: Record<string, unknown>) {
  if (typeof data.visitorId !== 'string' || !uuid.test(data.visitorId)) throw new HttpError(400, 'Atualize a página antes de participar.');
  return data.visitorId;
}

async function publicPost(db: D1Database, id: string) {
  const post = await db.prepare("SELECT * FROM blog_posts WHERE id = ? AND status = 'published'").bind(id).first<Post>();
  if (!post) throw new HttpError(404, 'Texto não encontrado.');
  return post;
}

async function counts(db: D1Database, id: string) {
  return await db.prepare('SELECT COALESCE(SUM(value = 1), 0) AS likes, COALESCE(SUM(value = -1), 0) AS dislikes FROM blog_reactions WHERE post_id = ?').bind(id).first();
}

export async function handleBlog(request: Request, env: BlogEnv) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/blog\/?/, '').replace(/\/$/, '').split('/').filter(Boolean);
  const origin = request.headers.get('origin');
  const admin = path[0] === 'admin';
  const isOwner = owner(request, env);
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' });
  if (origin && publicOrigins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });
  try {
    const local = /^http:\/\/localhost:\d+$/.test(url.origin);
    if (origin && !publicOrigins.has(origin) && !(local && origin === url.origin)) throw new HttpError(403, 'Origem não permitida.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (path.join('/') === 'session' && request.method === 'GET') return respond({ owner: isOwner });
    if (admin) {
      if (!isOwner) throw new HttpError(request.headers.get('oai-authenticated-user-id') ? 403 : 401, 'Acesso reservado ao autor.');
      // Author writes are same-origin. CORS alone is not CSRF protection.
      if (request.method !== 'GET' && origin !== siteOrigin && !(local && origin === url.origin)) throw new HttpError(403, 'Abra a área de autoria para continuar.');
    }
    if (!env.DB) throw new HttpError(503, 'O blog está temporariamente indisponível. Tente novamente.');
    const db = env.DB;
    if (path[0] === 'posts' && request.method === 'GET') {
      if (!path[1]) {
        const rows = await db.prepare("SELECT id, title, summary, published_at, updated_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 200").all();
        return respond({ posts: rows.results });
      }
      const post = await publicPost(db, path[1]);
      const comments = await db.prepare('SELECT id, name, content, created_at, updated_at FROM blog_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 500').bind(post.id).all();
      const visitor = url.searchParams.get('visitor');
      const reaction = visitor && uuid.test(visitor) ? await db.prepare('SELECT value FROM blog_reactions WHERE post_id = ? AND visitor_id = ?').bind(post.id, visitor).first<{ value: number }>() : null;
      return respond({ post, comments: comments.results, reactions: await counts(db, post.id), myReaction: reaction?.value || 0 });
    }
    if (path[0] === 'posts' && path[1] && request.method === 'POST') {
      const post = await publicPost(db, path[1]);
      const data = await payload(request);
      const visitor = visitorId(data);
      if (path[2] === 'comments') {
        const name = field(data, 'name', 100);
        const content = field(data, 'content', 3000);
        if (data.website) throw new HttpError(400, 'Não foi possível enviar o comentário.');
        await rate(request, env, visitor, 'comment', 600, 5);
        const id = crypto.randomUUID(); const now = new Date().toISOString();
        await db.prepare('INSERT INTO blog_comments (id, post_id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, post.id, name, content, now, now).run();
        return respond({ id }, 201);
      }
      if (path[2] === 'reaction') {
        if (![1, -1, 0].includes(data.value as number)) throw new HttpError(400, 'Reação inválida.');
        await rate(request, env, visitor, 'reaction', 60, 30);
        if (data.value === 0) await db.prepare('DELETE FROM blog_reactions WHERE post_id = ? AND visitor_id = ?').bind(post.id, visitor).run();
        else await db.prepare('INSERT INTO blog_reactions (post_id, visitor_id, value) VALUES (?, ?, ?) ON CONFLICT(post_id, visitor_id) DO UPDATE SET value = excluded.value').bind(post.id, visitor, data.value).run();
        return respond({ reactions: await counts(db, post.id), myReaction: data.value });
      }
    }
    if (admin && path[1] === 'posts') {
      const id = path[2];
      if (request.method === 'GET') {
        const rows = await db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT 200').all();
        return respond({ posts: rows.results });
      }
      if (request.method === 'POST' || (request.method === 'PATCH' && id)) {
        const data = await payload(request);
        const title = field(data, 'title', 240); const summary = field(data, 'summary', 600, false); const content = field(data, 'content', 200000);
        if (!['draft', 'published'].includes(data.status as string)) throw new HttpError(400, 'Situação inválida.');
        const now = new Date().toISOString();
        if (id) {
          const result = await db.prepare(`UPDATE blog_posts SET title = ?, summary = ?, content = ?, status = ?, updated_at = ?,
            published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END WHERE id = ?`).bind(title, summary, content, data.status, now, data.status, now, id).run();
          if (!result.meta.changes) throw new HttpError(404, 'Texto não encontrado.');
          return respond({ id });
        }
        const newId = crypto.randomUUID();
        await db.prepare('INSERT INTO blog_posts (id, title, summary, content, status, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(newId, title, summary, content, data.status, now, now, data.status === 'published' ? now : null).run();
        return respond({ id: newId }, 201);
      }
      if (id && request.method === 'DELETE') {
        const result = await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
        if (!result.meta.changes) throw new HttpError(404, 'Texto não encontrado.');
        return respond({ deleted: true });
      }
    }
    if (admin && path[1] === 'comments' && path[2]) {
      if (request.method === 'DELETE') {
        const result = await db.prepare('DELETE FROM blog_comments WHERE id = ?').bind(path[2]).run();
        if (!result.meta.changes) throw new HttpError(404, 'Comentário não encontrado.');
        return respond({ deleted: true });
      }
      if (request.method === 'PATCH') {
        const data = await payload(request); const content = field(data, 'content', 3000);
        const result = await db.prepare('UPDATE blog_comments SET content = ?, updated_at = ? WHERE id = ?').bind(content, new Date().toISOString(), path[2]).run();
        if (!result.meta.changes) throw new HttpError(404, 'Comentário não encontrado.');
        return respond({ updated: true });
      }
    }
    throw new HttpError(404, 'Recurso não encontrado.');
  } catch (error) {
    if (error instanceof HttpError) return respond({ error: error.message }, error.status);
    console.error('Blog storage operation failed', error instanceof Error ? error.name : 'UnknownError');
    return respond({ error: 'Não foi possível concluir. Seu texto foi mantido; tente novamente.' }, 503);
  }
}
