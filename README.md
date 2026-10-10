# Página pessoal de Fernando Coelho

Hub profissional com currículo, redes, contato institucional e acesso aos projetos digitais de ensino de Física.

Página pública: [proffernando1.github.io](https://proffernando1.github.io/)

O retrato profissional aparece em tamanho discreto ao lado da apresentação inicial. O blog público também inclui a foto e a biografia fornecida por Fernando em “Sobre o autor”, depois do conteúdo de leitura. As cópias WebP locais usam tamanhos responsivos, sem depender de processamento de imagem no servidor. Preserve o arquivo original da fotografia.

## Blog pessoal

O [blog público](https://proffernando1.github.io/blog/) usa o backend do Sites para guardar textos, comentários e reações no D1. A [área do autor](https://fernando-coelho.proffernando.chatgpt.site/blog/autor/) exige login com a conta ChatGPT proprietária; a variável de servidor `BLOG_OWNER_EMAIL` determina a autorização em cada operação. `BLOG_RATE_SALT` protege os identificadores usados no limite de envio. Ambas são segredos de execução configurados no Sites e não entram no repositório.

Na área do autor, crie um texto, salve como rascunho ou publique. Para moderar comentários, abra a publicação pela área do autor; os controles de editar e excluir aparecem depois do login. Reações representam a escolha de cada navegador, com uma opção ativa por texto. Os nomes dos comentários são informados pelos visitantes.

Os botões 👍 e 👎 mantêm os totais de reações e os rótulos acessíveis. O rodapé público do blog usa o contador Hits com a chave `proffernando1.github.io/blog`, compartilhada entre Sites e GitHub Pages e separada do contador da página inicial. A contagem começa na ativação; a área do autor e a prévia local não carregam o contador.

No Sites, a lista e os artigos publicados chegam no HTML inicial, lidos diretamente do D1 a cada acesso. Os artigos usam `/blog/textos/ID/`; links antigos com `?texto=ID` continuam funcionando. O GitHub Pages inclui a lista pública no build, atualiza essa lista pela API ao abrir a página e aponta a leitura para os artigos no Sites, sem congelar o corpo dos textos. Edições e retirada de publicação têm efeito nas páginas dos artigos sem novo build.

O texto permanece visível enquanto a API carrega reações e comentários. A consulta da sessão do autor ocorre separadamente e somente quando a página e a API têm a mesma origem. A conexão ao Sites é antecipada, e comentários e reações são consultados em paralelo após confirmar que o texto está publicado. Falhas de sessão não bloqueiam a leitura.

As rotas `route.site.ts` e `page.site.ts` funcionam apenas no Sites. `next.config.ts` exclui essa extensão na exportação do GitHub Pages; o conteúdo público acessa a mesma API por HTTPS. Alterações de esquema ficam em `db/schema.ts`, com migrations geradas por `npm exec drizzle-kit generate`. O teste `node scripts/test-blog.mjs` exercita o serviço e o SQL em SQLite isolado, sem escrever na produção. Não altere migrations já aplicadas.

## Banco de Física do ENEM

A rota `/enem/`, acessível pelos projetos da página inicial, permite selecionar ano, conteúdo, tópico e dificuldade, responder às alternativas e consultar a explicação e as fontes oficiais. As respostas permanecem apenas na sessão do navegador.

O acervo de 2011–2025 e seu banco SQLite ficam no projeto local `AULAS INTEGRADO/ENEM`. A consolidação desse projeto gera `public/enem-data/questions.json` e os recortes usados aqui. A dificuldade é uma estimativa pedagógica; os gabaritos são oficiais. Os dados públicos contêm somente questões e referências, sem informações de estudantes. Preserve as fontes e execute a consolidação completa antes de publicar atualizações do acervo.

## Desenvolvimento local

Requer Node.js 22.13.0 ou superior. O arquivo `package-lock.json` fixa as dependências; use `npm ci` em instalações novas.

```bash
npm ci
npm run dev
```

Antes de publicar:

```bash
npm run lint
npm run build
npm run build:pages
```

O GitHub Actions publica automaticamente a versão validada no GitHub Pages quando há uma atualização na branch `main`.

`npm run build` mantém a saída de execução do Sites. `npm run build:pages` gera a exportação estática `out/` usada pelo GitHub Pages. Preserve as duas rotas e a configuração `.openai/hosting.json`; esses comandos locais não publicam o site.
