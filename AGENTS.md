# Orientações do projeto

Esta é a página pessoal de Fernando, com duas rotas de hospedagem: Sites e GitHub Pages. Preserve ambas e o conteúdo existente ao executar manutenção de configuração.

- Leia `README.md`, `package.json`, `next.config.ts` e `.openai/hosting.json` para resolver a tarefa. A presença do manifesto exige consultar as skills Sites de build/hosting; uma auditoria ou teste local não autoriza publicação.
- Use o `package-lock.json` existente e `npm ci` somente quando a instalação for necessária. Não atualize dependências por novidade.
- `npm run lint` confere o código. `npm run build` valida Sites; `npm run build:pages` valida a exportação `out/` do GitHub Pages. Execute os checks correspondentes ao que mudou.
- O workflow `.github/workflows/deploy-pages.yml` publica após push em `main`. Trate push e dispatch como ações de publicação e use somente a autorização do pedido atual.
- Mantenha credenciais fora dos arquivos versionados e preserve mudanças locais anteriores. Use `work/` para intermediários e não adicione metadados `desktop.ini` ao Git.
