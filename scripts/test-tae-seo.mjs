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
const seenNonces = new Set();
const expectedPolicy = "default-src 'self'; script-src 'self' 'nonce-EXPECTED'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
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
    const policy = response.headers.get('Content-Security-Policy');
    const nonce = policy?.match(/'nonce-([A-Za-z0-9+/]+={0,2})'/)?.[1];
    assert.ok(nonce && Buffer.from(nonce, 'base64').length >= 16, 'CSP requires a 128-bit or longer nonce');
    assert.equal(policy.replace("'nonce-" + nonce + "'", "'nonce-EXPECTED'"), expectedPolicy);
    assert.ok(!seenNonces.has(nonce), 'Each GET and HEAD must issue its own nonce');
    seenNonces.add(nonce);
    if (response === html) {
      const scripts = [...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
      const sources = scripts.map(([, attributes, code]) => {
        assert.equal(code.trim(), '', 'The application serves external scripts only');
        assert.equal(attributes.match(/\bnonce="([^"]+)"/)?.[1], nonce);
        return attributes.match(/\bsrc="([^"]+)"/)?.[1];
      });
      assert.deepEqual(sources, ['/concursos-tae/static/theme.js', '/concursos-tae/static/app.js']);
    }
  }
}
const urls = sitemap().map(item => new URL(item.url));
const homeOrigin = urls.find(url => url.pathname === '/')?.origin;
const sitesOrigin = new URL(canonical).origin;
assert.ok([sitesOrigin, 'https://proffernando1.github.io'].includes(homeOrigin), 'Expected a known sitemap origin');
const listed = urls.filter(url => url.pathname.startsWith('/concursos-tae')).map(url => url.href);
assert.deepEqual(listed, homeOrigin === sitesOrigin ? [canonical] : []);

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
