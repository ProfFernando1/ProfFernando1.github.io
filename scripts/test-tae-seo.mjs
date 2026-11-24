import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Exercise the actual route handlers and sitemap in memory, without deployment or remote data.
const bundle = await build({
  stdin: {
    contents: [
      "export { GET, HEAD } from './app/concursos-tae/route.site';",
      "export { default as sitemap } from './app/sitemap';",
      "export { handleStudy } from './lib/tae/service';",
    ].join('\n'),
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const source = Buffer.from(bundle.outputFiles[0].contents).toString('base64');
const { GET, HEAD, sitemap, handleStudy } = await import('data:text/javascript;base64,' + source);
const canonical = 'https://fernando-coelho.proffernando.chatgpt.site/concursos-tae';
const entry = 'http://localhost/concursos-tae';
const user = { 'oai-authenticated-user-id': 'aluno-ficticio' };
for (const [suffix, headers, visible] of [
  ['', {}, true], ['/', {}, true], ['?', {}, false], ['?mode=visitante', {}, false],
  ['?mode=conta', {}, false], ['?questao=exemplo', {}, false], ['?role=Contador', {}, false],
  ['?edital=iffar-edital-406-2026', {}, false], ['?qualquer=valor', {}, false],
  ['', user, false], ['/', user, false], ['?mode=visitante', user, false],
]) {
  const robots = visible ? 'index,follow' : 'noindex,nofollow';
  const req = new Request(entry + suffix, { headers });
  const html = GET(req);
  const body = await html.text();
  assert.ok(body.includes('<meta name="robots" content="' + robots + '">'), req.url);
  assert.equal(body.includes('<link rel="canonical" href="' + canonical + '">'), visible);
  assert.equal(body.includes(' data-public-entry='), !headers['oai-authenticated-user-id']);
  const head = HEAD(new Request(req.url, { headers, method: 'HEAD' }));
  assert.equal(await head.text(), '');
  for (const response of [head, html]) {
    assert.equal(response.headers.get('X-Robots-Tag'), robots);
    assert.equal(response.headers.get('Link'), visible ? '<' + canonical + '>; rel="canonical"' : null);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.match(response.headers.get('Vary'), /oai-authenticated-user-id/i);
    assert.match(response.headers.get('Content-Security-Policy'), /script-src 'self';/);
  }
}
const listed = sitemap().map(item => item.url).filter(url => new URL(url).pathname.startsWith('/concursos-tae'));
// The Pages sitemap lists mirrors on github.io. Only the public Sites entry is indexable.
assert.deepEqual(listed, []);

const media = { type: 'application/pdf', length: 40, segments: [] };
const index = { version: 1, packs: [], files: { 'media/prova.pdf': media }, pages: { teste: [media] } };
const bindings = { BUCKET: { get: async () => ({ json: async () => index }) } };
for (const [path, method, code] of [
  ['/api/health', 'GET', 200], ['/api/nao-existe', 'GET', 404],
  ['/api/page-image?exam=teste&page=1', 'HEAD', 200], ['/media/prova.pdf', 'HEAD', 200], ['/media/ausente.pdf', 'GET', 404],
]) {
  const res = await handleStudy(new Request(entry + path, { method }), bindings);
  assert.equal(res.status, code, path);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex,nofollow', path);
}
console.log('SEO TAE conferido no HTML, em GET/HEAD com e sem identidade, no sitemap e nos recursos internos.');
