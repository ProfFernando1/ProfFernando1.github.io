import { bankSummary } from './bank';
import { BLOG_ORIGIN as SITE_ORIGIN } from '../blog-config';

const format = new Intl.NumberFormat('pt-BR');
export const studyCanonical = SITE_ORIGIN + '/concursos-tae';

export function studyShell(anonymous: boolean, indexable: boolean) {
  return `<!doctype html>
<html lang="pt-BR" data-theme="dark"${anonymous ? ' data-public-entry="' + studyCanonical + '"' : ''}>
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark light"><meta name="robots" content="${indexable ? 'index,follow' : 'noindex,nofollow'}">
  ${indexable ? '<link rel="canonical" href="' + studyCanonical + '">' : ''}
  <meta name="description" content="Caderno de estudos para concursos técnico-administrativos dos institutos federais do Rio Grande do Sul.">
  <title>Concursos TAE · Caderno de Fernando Coelho</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <script src="/concursos-tae/static/theme.js"></script>
  <link rel="stylesheet" href="/concursos-tae/static/styles.css">
  <script src="/concursos-tae/static/app.js" type="module"></script>
</head>
<body>
<a class="skip" href="#principal">Pular para o conteúdo</a>
<header class="site-header"><div class="shell header-inner">
  <a class="signature" href="/" aria-label="Voltar à página pessoal de Fernando Coelho"><span class="monogram" aria-hidden="true">Fc</span><span>Fernando Coelho</span></a>
  <nav id="main-nav" hidden aria-label="Navegação do caderno">
    <a href="?mode=visitante#estudar" data-view="estudar">Estudar</a><a href="?mode=conta#desempenho" data-view="desempenho" hidden>Meu desempenho</a><a href="?mode=visitante#editais" data-view="editais">Editais e fontes</a>
  </nav>
  <div class="header-actions">
    <button id="theme" type="button" class="round" aria-label="Ativar tema claro" title="Ativar tema claro"><span aria-hidden="true">☀</span></button>
    <button id="access-options" type="button" class="quiet small" hidden>Opções de acesso</button>
    <a id="logout" class="quiet small" href="/signout-with-chatgpt?return_to=%2Fconcursos-tae" target="_top" rel="nofollow" hidden>Sair</a>
  </div>
</div></header>
<main id="principal" class="shell" tabindex="-1">
  <section id="welcome" class="login-grid" aria-labelledby="welcome-title">
    <div class="login-intro"><p class="eyebrow">Concursos públicos · Rio Grande do Sul</p>
      <h1 id="welcome-title">Concursos <em>TAE</em></h1>
      <p>Prepare-se para os cargos de técnico-administrativo em educação do IFFar, do IFRS e do IFSul com questões de provas anteriores.</p>
      <div class="collection-meta">
        <span><strong>${format.format(bankSummary.questions)}</strong> questões</span>
        <span><strong>${format.format(bankSummary.exams)}</strong> provas</span>
        <span><strong>${format.format(bankSummary.institutes)}</strong> institutos</span>
      </div>
      <nav class="welcome-sources" aria-label="Acesso aos editais">
        <a id="start-edital" href="?edital=iffar-edital-406-2026#editais">Edital IFFar 406/2026 · programa por cargo</a>
        <a id="start-notices" href="?mode=visitante#editais">Todos os editais e fontes</a>
      </nav>
    </div>
    <div class="login-panel">
      <h2>Como você quer estudar?</h2>
      <div class="access-choice">
        <p id="guest-info">Responda, confira a correção e acompanhe seu placar enquanto esta aba estiver aberta.</p>
        <button id="start-guest" class="quiet" type="button" aria-describedby="guest-info">Acessar sem login</button>
      </div>
      <div class="access-choice">
        <p id="account-info">Entre com a sua conta do ChatGPT para guardar suas respostas, acompanhar seu progresso e favoritar questões.</p>
        <a id="signin" class="primary-link" href="/signin-with-chatgpt?return_to=%2Fconcursos-tae%3Fmode%3Dconta" target="_top" rel="nofollow" aria-describedby="account-info">Entrar com ChatGPT</a>
      </div>
      <p id="access-status" class="subtext" role="status" hidden></p>
      <p id="access-error" class="error" role="alert" hidden></p>
    </div>
    <figure class="map"><img src="/concursos-tae/static/mapa-rs.webp" width="840" height="390" alt="Cidades-sede das reitorias no Rio Grande do Sul. IFFar em Santa Maria, IFRS em Bento Gonçalves e IFSul em Pelotas."><figcaption>Cidades-sede das reitorias <span>Base cartográfica · IBGE</span></figcaption></figure>
  </section>
  <div id="app" hidden>
    <section class="study-hero">
      <div><p class="eyebrow">IFFar · IFRS · IFSul</p><h1>Concursos <em>TAE</em></h1><p id="hero-copy"></p></div>
      <div class="hero-summary"><span id="hero-total"></span><span id="hero-user"></span><a id="hero-progress" class="hero-resume" href="?mode=conta#desempenho" hidden></a><button id="resume-study" class="hero-resume" type="button" hidden>Retomar última questão →</button></div>
    </section>
    <section id="study-view" class="view" hidden aria-label="Estudar">
      <section id="guest-session" class="session-strip" aria-label="Sessão de estudo sem login" hidden>
        <div><strong>Nesta aba</strong><span id="guest-score" role="status"></span></div>
        <div class="session-clock"><span id="guest-clock" role="timer" aria-label="Tempo de estudo">00:00</span><button id="guest-clock-toggle" type="button" class="link-button">Iniciar cronômetro</button></div>
      </section>
      <div class="workspace">
        <aside class="filters" aria-label="Filtros do caderno"><div class="filters-head"><h2>Filtros</h2><button id="filter-toggle" class="quiet small" type="button" aria-controls="filters-body" aria-expanded="false">Mostrar filtros</button></div>
          <div id="filters-body"><div id="filter-fields"></div><div class="filter-bottom"><button type="button" class="link-button" id="clear-filters">Limpar filtros</button></div></div>
        </aside>
        <div class="study-column"><div class="study-toolbar"><p id="found-count" role="status"></p><button id="random" type="button" class="quiet">Questão aleatória</button></div>
          <div id="active-filters" class="active-filters" aria-label="Filtros ativos" role="group"></div>
          <article class="question-panel" id="question" aria-busy="false" tabindex="-1"></article>
          <p id="achievement-status" class="achievement-status" role="status"></p>
          <div id="pager" class="pager"></div>
          <details class="shortcuts"><summary>Atalhos de teclado</summary>
            <label><input id="shortcuts-toggle" type="checkbox" checked> Ativar atalhos</label>
            <p><kbd>A</kbd>–<kbd>E</kbd> marcar alternativa · <kbd>Enter</kbd> conferir · <kbd>←</kbd> / <kbd>→</kbd> navegar · <kbd>R</kbd> sortear<span id="shortcut-save"> · <kbd>S</kbd> salvar na conta</span></p>
          </details></div>
      </div>
    </section>
    <section id="performance-view" class="view" hidden aria-label="Meu desempenho"></section>
    <section id="notices-view" class="view" hidden aria-label="Editais e fontes"></section>
  </div>
  <p id="app-error" class="error" role="alert" hidden></p>
</main>
<footer class="footer"><div class="shell"><span>Fernando Coelho</span><span>Caderno de concursos TAE · RS</span></div></footer>
<dialog id="original-dialog" aria-labelledby="dialog-title"><div class="dialog-head"><h2 id="dialog-title">Prova original</h2><button id="close-dialog" type="button" class="quiet">Fechar</button></div><div id="dialog-content"></div></dialog>
</body></html>
`;
}
