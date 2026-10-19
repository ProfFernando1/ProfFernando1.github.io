# Banco de Física do PSS da UFSM

A rota `/pss/` usa `public/pss-data/questions.json`, recortes WebP das provas e um inventário CSV. O catálogo `public/pss-data/sources.json` identifica cada caderno, a página oficial que o disponibiliza, o gabarito e as impressões SHA-256 dos arquivos originais. As questões são atribuídas à UFSM/COPERVES. Este recurso de estudo é uma compilação independente de Fernando Coelho.

## Organização

- `year` é o ano da edição. Não indica o começo do ciclo de três provas nem o ano de ingresso.
- `stage` é a etapa correspondente ao 1º, 2º ou 3º ano do ensino médio.
- `editionLabel` distingue janeiro/dezembro de 2011 e as duas aplicações da etapa 3 de 2015.
- `program` distingue PSS e PEIES; `era` separa o PSS atual do acervo histórico.
- `topic` e `subtopic` são classificações editoriais por conteúdo, atribuídas a cada item, sem presumir que um assunto pertença sempre à mesma etapa em diferentes programas.
- `difficulty` é uma estimativa editorial: aplicação direta de um conceito (Fácil), interpretação ou combinação de etapas (Média), articulação de vários conceitos e representações (Difícil). Não há dados estatísticos de desempenho nem classificação oficial de dificuldade.
- As cinco repetições entre variantes da etapa 3 de 2015 mantêm numeração e fontes de cada aplicação, com `duplicateOf` na ocorrência repetida.
- Itens anulados conservam o enunciado, `answer: null` e `answerStatus: annulled`, sem correção de acerto ou erro.

## Cobertura e seleção

O PSS atual inclui os seis cadernos disponíveis das edições 2024 (etapa 1), 2025 (etapas 1 e 2) e 2026 (etapas 1, 2 e 3). Os itens de Física foram selecionados após a leitura de todas as questões de conhecimentos gerais e a conferência dos seis gabaritos definitivos.

O histórico inclui os cadernos seriados encontrados nas fontes oficiais de 2011 a 2016 e o PEIES de 2006 a 2011. A distribuição por disciplina dos gabaritos antigos orienta a seleção. Em janeiro de 2011, as provas exclusivamente da seleção Único foram excluídas; os registros dessas fontes mantêm `included: false` e a justificativa. A existência de um ano no banco não significa que todas as três etapas tenham sido oferecidas naquele ano. Não se afirma cobertura integral de toda a história da seleção.

As explicações são editoriais e o gabarito permanece o oficial. Divergências conceituais do material original são sinalizadas em `reviewNote` ou na explicação, sem alterar silenciosamente enunciados ou respostas oficiais. Os recortes preservam gráficos, fórmulas e contextos compartilhados. O texto auxiliar de extração/OCR serve à consulta e à busca, podendo perder símbolos ou ordem de leitura; o recorte original é a referência para resolver o item.

## Manutenção reproduzível

`curation.json` conserva somente os itens selecionados, com classificação, explicação, resposta e coordenadas dos recortes. Os originais ficam em `work/pss/originals/`, fora da publicação. Os scripts Python usam PyMuPDF e Pillow, disponíveis no ambiente de trabalho.

```powershell
python -X utf8 scripts/fetch-pss-sources.py
python -X utf8 scripts/build-pss-bank.py
node scripts/check-pss-bank.mjs
npm run lint
npm run build
npm run build:pages
```

O primeiro comando baixa apenas fontes oficiais e exige os hashes preservados; não sobrescreve um original divergente. Antes de incorporar nova edição ou arquivo alterado, confronte a página oficial, a prova, o gabarito final e a curadoria. A regeneração dos recortes exige conferir visualmente as alternativas finais e as continuações entre páginas ou colunas.

`scripts/check-pss-keys.py` registra uma segunda leitura dos gabaritos históricos por coordenadas, com OCR quando necessário. Para repetir essa auditoria em uma estação nova, o diretório de trabalho original deve acompanhar a curadoria. Os relatórios de auditoria e imagens de revisão permanecem locais.

Testes locais não publicam. A configuração Sites, as rotas do blog e a exportação do GitHub Pages devem ser preservadas. O push de `main` no remoto `github` aciona a publicação pelo workflow existente.
