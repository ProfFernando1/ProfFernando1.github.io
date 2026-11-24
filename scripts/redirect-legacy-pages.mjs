import { lstat, mkdir, writeFile } from 'node:fs/promises';

const origin = 'https://fernando-coelho.proffernando.chatgpt.site';
const routes = ['/', '/blog/', '/blog/autor/', '/enem/', '/pss/'];
const output = new URL('../out/', import.meta.url);
const pages = routes.map(route => ({
  destination: origin + route,
  file: new URL(route.slice(1) + 'index.html', output),
}));

if (!(await lstat(output)).isDirectory()) {
  throw new Error('A saída do GitHub Pages precisa ser um diretório.');
}

for (const { file } of pages) {
  if (!(await lstat(file)).isFile()) {
    throw new Error(`Página ausente na exportação do GitHub Pages: ${file.pathname}`);
  }
}

for (const { destination, file } of pages) {
  await writeFile(file, `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fernando Coelho</title>
  <link rel="canonical" href="${destination}">
  <script>location.replace(${JSON.stringify(destination)} + location.search + location.hash);</script>
</head>
<body>
  <p><a href="${destination}">Abrir a página no novo site de Fernando Coelho</a></p>
</body>
</html>
`, 'utf8');
}

// The TAE entry is a Worker route. Next exports its assets but no HTML at this path.
const taeDirectory = new URL('concursos-tae/', output);
const taeDestination = origin + '/concursos-tae';
await mkdir(taeDirectory, { recursive: true });
await writeFile(new URL('index.html', taeDirectory), `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <title>Concursos TAE no RS · Fernando Coelho</title>
  <link rel="canonical" href="${taeDestination}">
</head>
<body>
  <main>
    <h1>Concursos TAE no RS</h1>
    <p><a id="destino" href="${taeDestination}">Abrir o caderno de concursos TAE no site de Fernando Coelho</a></p>
  </main>
  <script>
    const link = document.getElementById('destino');
    const suffixAt = location.href.search(/[?#]/);
    if (suffixAt >= 0) link.href += location.href.slice(suffixAt);
    location.replace(link.href);
  </script>
</body>
</html>
`, 'utf8');
