import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, writeFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

// Exercise the real prepared SQL and authorization rules with an isolated SQLite database.
const folder = mkdtempSync(path.resolve('work', 'blog-test-'));
const compiled = ts.transpileModule(readFileSync('lib/blog-service.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
writeFileSync(path.join(folder, 'service.mjs'), compiled);
const { handleBlog } = await import(pathToFileURL(path.join(folder, 'service.mjs')));
const sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys = ON');
for (const file of readdirSync('drizzle').filter(x => x.endsWith('.sql')).sort()) sqlite.exec(readFileSync(path.join('drizzle', file), 'utf8'));
const DB = { prepare(sql) {
  let values = [];
  const statement = {
    bind(...args) { values = args; return statement; },
    async first() { return sqlite.prepare(sql).get(...values) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; },
    async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; },
  };
  return statement;
} };
const origin = 'https://fernando-coelho.proffernando.chatgpt.site';
const env = { DB, BLOG_OWNER_EMAIL: 'owner@example.test', BLOG_RATE_SALT: 'isolated-test-only' };
let checks = 0;
async function call(endpoint, method = 'GET', data, who = 'anonymous', status = 200, source = origin) {
  const headers = { origin: source };
  if (who !== 'anonymous') { headers['oai-authenticated-user-id'] = who; headers['oai-authenticated-user-email'] = who === 'owner' ? env.BLOG_OWNER_EMAIL : 'other@example.test'; }
  if (data !== undefined) headers['content-type'] = 'application/json';
  const response = await handleBlog(new Request(`${origin}/api/blog/${endpoint}`, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) }), env);
  assert.equal(response.status, status, `${method} ${endpoint}: ${await response.clone().text()}`); checks++;
  return response.json();
}
for (const method of ['POST', 'PATCH', 'DELETE']) for (const target of ['admin/posts', 'admin/posts/missing', 'admin/comments/missing']) {
  await call(target, method, { owner: true }, 'anonymous', 401);
  await call(target, method, {}, 'other', 403);
}
await call('admin/posts', 'POST', {}, 'owner', 403, 'https://proffernando1.github.io');
await call('admin/posts', 'GET', undefined, 'owner', 403, 'https://untrusted.example');
const visitorId = crypto.randomUUID();
const fields = { title: 'Texto temporário de teste', summary: 'Teste isolado', content: 'Parágrafo um.\n\nParágrafo dois.', status: 'draft' };
const { id } = await call('admin/posts', 'POST', fields, 'owner', 201);
assert.equal((await call('posts')).posts.length, 0); checks++;
await call(`posts/${id}`, 'GET', undefined, 'anonymous', 404);
await call(`posts/${id}/comments`, 'POST', { visitorId, name: 'Pessoa', content: 'Comentário' }, 'anonymous', 404);
await call(`posts/${id}/reaction`, 'POST', { visitorId, value: 1 }, 'anonymous', 404);
await call(`admin/posts/${id}`, 'PATCH', { ...fields, status: 'published' }, 'owner');
assert.equal((await call('posts')).posts[0].id, id); checks++;
await call(`posts/${id}/reaction`, 'POST', { visitorId, value: 1 });
let detail = await call(`posts/${id}?visitor=${visitorId}`);
assert.equal(detail.reactions.likes, 1); assert.equal(detail.myReaction, 1); checks += 2;
await call(`posts/${id}/reaction`, 'POST', { visitorId, value: -1 });
detail = await call(`posts/${id}?visitor=${visitorId}`);
assert.deepEqual({ ...detail.reactions }, { likes: 0, dislikes: 1 }); checks++;
await call(`posts/${id}/reaction`, 'POST', { visitorId, value: 0 });
await call(`posts/${id}/reaction`, 'POST', { visitorId, value: 2 }, 'anonymous', 400);
const html = '<script>alert("x")</script>';
const comment = await call(`posts/${id}/comments`, 'POST', { visitorId, name: 'Leitor de teste', content: html }, 'anonymous', 201);
assert.equal((await call(`posts/${id}`)).comments[0].content, html); checks++;
await call(`admin/comments/${comment.id}`, 'PATCH', { content: 'Comentário moderado' }, 'owner');
assert.equal((await call(`posts/${id}`)).comments[0].content, 'Comentário moderado'); checks++;
await call(`admin/comments/${comment.id}`, 'DELETE', undefined, 'owner');
assert.equal((await call(`posts/${id}`)).comments.length, 0); checks++;
await call(`posts/${id}/comments`, 'POST', { visitorId, name: '', content: 'x' }, 'anonymous', 400);
for (let n = 0; n < 4; n++) await call(`posts/${id}/comments`, 'POST', { visitorId, name: 'Teste', content: 'Temporário' }, 'anonymous', 201);
await call(`posts/${id}/comments`, 'POST', { visitorId, name: 'Teste', content: 'Temporário' }, 'anonymous', 429);
await call(`admin/posts/${id}`, 'DELETE', undefined, 'owner');
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM blog_comments').get().n, 0); checks++;
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM blog_reactions').get().n, 0); checks++;
await call(`posts/${id}`, 'GET', undefined, 'anonymous', 404);
sqlite.close();
console.log(`Blog: ${checks} checks passed (authorization, drafts, comments, reactions, rate limits, cascading removal).`);
