import { lstat, writeFile } from 'node:fs/promises';

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
