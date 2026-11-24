import { root, $, escape as h, fmt, fold, urlFor, link, errorMessage, api } from './dom.js';
import { appendFilters, filtersFromUrl, setupFilters } from './filters.js';
import { showPerformance, showNotices } from './reports.js';
import { showGuestSession, hideGuestSession, recordGuestAnswer } from './guest-session.js';

const letters = 'ABCDEFGHIJ';
const views = {
  estudar: 'Resolva questões de concursos anteriores e confira a correção após responder.',
  desempenho: 'Acompanhe seus acertos, as disciplinas que precisam de revisão e o histórico de tentativas.',
  editais: 'Consulte os conteúdos de cada cargo e as fontes das provas do acervo.',
};
const state = {
  mode: null, profileId: null, catalog: null, exams: new Map(), view: '', filters: {}, record: null, index: 0,
  selection: null, feedback: null, retry: null, eliminated: new Set(), removed: false, newlyAnswered: false,
  generation: 0, seq: 0, request: null, pendingWrite: null, routedHref: '',
};
const filterUI = setupFilters(changeFilters);
let welcomeGuestPath = null;

function readSetting(storageName, key) {
  try { return window[storageName].getItem(key); } catch { return null; }
}
function storeSetting(storageName, key, value) {
  try {
    if (value === null) window[storageName].removeItem(key);
    else window[storageName].setItem(key, value);
  } catch { /* The current tab still works with storage disabled. */ }
}

function setTheme(name) {
  const theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const button = $('#theme');
  button.firstElementChild.textContent = theme === 'dark' ? '☀' : '☾';
  button.title = button.ariaLabel = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro';
  window.dispatchEvent(new Event('tae-theme'));
}
setTheme(document.documentElement.dataset.theme);
$('#theme').addEventListener('click', () => {
  const name = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  storeSetting('localStorage', 'tae-theme', name);
  setTheme(name);
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
  if (!readSetting('localStorage', 'tae-theme')) setTheme(event.matches ? 'dark' : 'light');
});
window.addEventListener('storage', event => {
  if (event.key === 'tae-theme') {
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(event.newValue || system);
  }
});

function accessMessage(selector, message) {
  const element = $(selector);
  element.textContent = message;
  element.hidden = !message;
}
function studyLocation({ account = false, filters = {}, id, notice, hash = '' } = {}) {
  const params = new URLSearchParams();
  if (account) params.set('mode', 'conta');
  appendFilters(params, filters);
  if (id) params.set('questao', id);
  if (notice) params.set('edital', notice);
  // Even an unfiltered study view needs a server-visible URL, distinct from the public entrance.
  if (!params.size) params.set('mode', 'visitante');
  return location.pathname + '?' + params + hash;
}
function currentLocation(account, allowPersonal = account) {
  const params = new URLSearchParams(location.search);
  return studyLocation({
    account, filters: filtersFromUrl(params, allowPersonal), id: params.get('questao'),
    notice: params.get('edital'), hash: !account && location.hash === '#desempenho' ? '#estudar' : location.hash,
  });
}
function syncPageMetadata() {
  const publicUrl = document.documentElement.dataset.publicEntry;
  const indexable = publicUrl && !state.mode && !location.href.split('#', 1)[0].includes('?') &&
    !Object.hasOwn(views, location.hash.slice(1));
  document.querySelector('meta[name=robots]').content = indexable ? 'index,follow' : 'noindex,nofollow';
  let canonical = document.querySelector('link[rel=canonical]');
  if (!indexable) canonical?.remove();
  else if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = publicUrl;
    document.head.append(canonical);
  }
}
function writeLocation(path, push = false) {
  if (location.href.slice(location.origin.length) !== path) {
    if (push) history.pushState(null, '', path);
    else history.replaceState(history.state, '', path);
  }
  state.routedHref = location.href;
  syncPageMetadata();
}
function syncSignIn(path = currentLocation(true)) {
  $('#signin').href = '/signin-with-chatgpt?return_to=' + encodeURIComponent(path);
}
function cancelLoad() {
  if (state.request) state.request.abort();
  state.request = null;
  $('#question').setAttribute('aria-busy', 'false');
  $('#question').inert = false;
}
function showWelcome(message = '', entry = false, push = false) {
  const account = state.mode === 'account' || new URLSearchParams(location.search).get('mode') === 'conta';
  const signInPath = currentLocation(true);
  welcomeGuestPath = entry && push ? currentLocation(false) : null;
  ++state.generation;
  ++state.seq;
  cancelLoad();
  hideGuestSession();
  storeSetting('sessionStorage', 'tae-access-mode', null);
  Object.assign(state, {
    mode: null, profileId: null, catalog: null, exams: new Map(), view: '', filters: {},
    record: null, index: 0, feedback: null, selection: null, retry: null, pendingWrite: null,
  });
  $('#app').hidden = true;
  $('#main-nav').hidden = true;
  $('#logout').hidden = true;
  $('#access-options').hidden = true;
  $('#welcome').hidden = false;
  if ($('#original-dialog').open) $('#original-dialog').close();
  for (const selector of ['#question', '#pager', '#filter-fields', '#active-filters', '#performance-view', '#notices-view']) {
    $(selector).replaceChildren();
  }
  writeLocation(entry ? location.pathname : currentLocation(account, true), push);
  syncSignIn(signInPath);
  errorMessage('');
  accessMessage('#achievement-status', '');
  accessMessage('#access-status', '');
  accessMessage('#access-error', message);
  $('#start-guest').disabled = false;
  $('#start-guest').focus();
}

async function studyApi(path, body, signal) {
  const generation = state.generation;
  const guest = state.mode === 'guest';
  try { return await api(path, body, { guest, profileId: state.profileId, signal }); }
  catch (error) {
    if (!guest && generation === state.generation && (error.status === 401 || error.status === 409)) showWelcome(error.message);
    throw error;
  }
}
function showProgress(progress) {
  const button = $('#hero-progress');
  button.hidden = state.mode !== 'account' || !progress;
  if (!button.hidden) {
    button.textContent = 'Nível ' + fmt(progress.level) + ' · ' + fmt(progress.xp) + ' XP';
    button.setAttribute('aria-label', button.textContent + '. Ver meu desempenho');
  }
}
async function enter(mode, session, signal) {
  const generation = ++state.generation;
  const account = mode === 'account';
  state.mode = mode;
  state.profileId = account ? session.profileId : null;
  const catalog = await studyApi('catalog', undefined, signal);
  if (generation !== state.generation) return;
  if (account) await studyApi('enter', {}, signal);
  if (generation !== state.generation) return;
  state.catalog = catalog;
  state.exams = new Map(catalog.exams.map(exam => [exam.id, exam]));
  if (account) delete document.documentElement.dataset.publicEntry;
  storeSetting('sessionStorage', 'tae-access-mode', mode);
  welcomeGuestPath = null;
  writeLocation(currentLocation(account));
  filterUI.mount(account, state.exams);
  $('#welcome').hidden = true;
  // The current query marks the session. Native fragment links retain filters, Back and keyboard navigation.
  for (const anchor of document.querySelectorAll('#main-nav [data-view]')) anchor.setAttribute('href', '#' + anchor.dataset.view);
  $('#hero-progress').setAttribute('href', '#desempenho');
  $('#main-nav').hidden = false;
  $('[data-view="desempenho"]').hidden = !account;
  $('#logout').hidden = !account;
  $('#access-options').hidden = false;
  $('#app').hidden = false;
  $('#hero-user').textContent = account ? session.displayName || 'Conta ChatGPT' : 'Sessão sem login';
  $('#hero-total').textContent = fmt(catalog.summary.questions) + ' questões · ' + fmt(catalog.summary.exams) + ' provas';
  $('#resume-study').hidden = !account || !catalog.resume;
  $('#shortcut-save').hidden = !account;
  showProgress(catalog.progress);
  if (account) hideGuestSession();
  else showGuestSession();
  accessMessage('#achievement-status', '');
  accessMessage('#access-status', '');
  $('#principal').focus({ preventScroll: true });
  await navigate();
}

async function enterGuest(path = currentLocation(false), push = false) {
  const button = $('#start-guest');
  if (button.disabled) return;
  button.disabled = true;
  writeLocation(path, push);
  accessMessage('#access-status', 'Abrindo o caderno…');
  accessMessage('#access-error', '');
  try { await enter('guest'); }
  catch (error) { showWelcome(error.message); }
  finally { button.disabled = false; }
}
$('#start-guest').addEventListener('click', () => enterGuest(welcomeGuestPath || currentLocation(false), true));
for (const anchor of [$('#start-edital'), $('#start-notices')]) {
  anchor.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const url = new URL(anchor.href);
    enterGuest(url.pathname + url.search + url.hash, true);
  });
}
$('#access-options').addEventListener('click', () => showWelcome('', true, true));
$('#logout').addEventListener('click', () => storeSetting('sessionStorage', 'tae-access-mode', null));

async function navigate() {
  if (!state.catalog) return;
  const params = new URLSearchParams(location.search);
  const hash = location.hash.slice(1);
  const view = Object.hasOwn(views, hash) && (hash !== 'desempenho' || state.mode === 'account') ? hash : 'estudar';
  state.routedHref = location.href;
  state.view = view;
  state.filters = filtersFromUrl(params, state.mode === 'account');
  state.index = 0;
  const seq = ++state.seq;
  cancelLoad();
  errorMessage('');
  $('#hero-copy').textContent = views[view];
  for (const [name, id] of [['estudar', 'study-view'], ['desempenho', 'performance-view'], ['editais', 'notices-view']]) {
    $('#' + id).hidden = view !== name;
  }
  for (const anchor of document.querySelectorAll('[data-view]')) {
    if (anchor.dataset.view === view) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  }
  try {
    if (view === 'estudar') {
      filterUI.sync(state.filters, true);
      const id = params.get('questao');
      await loadQuestion(id ? { id } : {});
    } else if (view === 'desempenho') {
      if (state.pendingWrite) await state.pendingWrite.catch(() => {});
      if (seq !== state.seq) return;
      await showPerformance($('#performance-view'), openQuestion, () => seq === state.seq, studyApi, showProgress);
    } else {
      showNotices($('#notices-view'), state.catalog, applyPlan, params.get('edital'));
    }
  } catch (error) { if (seq === state.seq) errorMessage(error.message); }
}
function onLocationChange() {
  // Native fragment navigation and history traversal can fire both events.
  if (location.href === state.routedHref) return;
  if (!location.search && !Object.hasOwn(views, location.hash.slice(1)) && state.mode) {
    showWelcome('', true);
    return;
  }
  if (location.hash === '#principal') { state.routedHref = location.href; return; }
  if (state.catalog) {
    writeLocation(currentLocation(state.mode === 'account'));
    navigate();
  }
  else start();
}
window.addEventListener('hashchange', onLocationChange);
window.addEventListener('popstate', onLocationChange);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || state.mode !== 'account' || state.view !== 'estudar') return;
  if (state.request || state.pendingWrite || $('#original-dialog').open || state.newlyAnswered || (state.selection && !state.feedback)) return;
  if (!new URLSearchParams(location.search).has('questao')) {
    state.index = 0;
    loadQuestion();
  }
});
function removeDirect() {
  if (new URLSearchParams(location.search).has('questao')) {
    writeLocation(studyLocation({ account: state.mode === 'account', filters: state.filters, hash: '#estudar' }));
  }
}
function openQuestion(id) {
  writeLocation(studyLocation({ account: state.mode === 'account', id, hash: '#estudar' }), true);
  navigate();
  $('#app').scrollIntoView({ block: 'start' });
}
$('#resume-study').addEventListener('click', () => {
  if (state.catalog?.resume) openQuestion(state.catalog.resume);
});
function applyPlan(filters) {
  writeLocation(studyLocation({ account: state.mode === 'account', filters, hash: '#estudar' }), true);
  navigate();
  $('#study-view').scrollIntoView({ block: 'start' });
}
function changeFilters(filters, resetDrafts = false) {
  state.filters = filters;
  state.index = 0;
  filterUI.sync(filters, resetDrafts);
  writeLocation(studyLocation({ account: state.mode === 'account', filters, hash: '#estudar' }), true);
  loadQuestion();
}
async function loadQuestion(extra = {}, focus = false) {
  const seq = ++state.seq;
  cancelLoad();
  const controller = new AbortController();
  state.request = controller;
  const target = $('#question');
  const query = new URLSearchParams({ ...state.filters, index: String(state.index), ...extra });
  target.setAttribute('aria-busy', 'true');
  target.inert = true;
  errorMessage('');
  try {
    // A filter or tab may change while the last answer is being committed.
    if (state.pendingWrite) await state.pendingWrite.catch(() => {});
    if (controller.signal.aborted) return;
    const guest = state.mode === 'guest';
    const data = await studyApi(guest ? 'practice' : 'practice?' + query, guest ? { query: query.toString() } : undefined, controller.signal);
    if (state.seq !== seq || state.view !== 'estudar') return;
    state.record = data;
    state.index = data.index ?? 0;
    state.selection = data.previous?.choice ?? null;
    state.feedback = data.previous ?? null;
    state.retry = null;
    state.eliminated.clear();
    state.removed = false;
    state.newlyAnswered = false;
    accessMessage('#achievement-status', '');
    filterUI.renderFacets(data.facets);
    renderQuestion();
    target.inert = false;
    if (focus) target.focus();
  } catch (error) {
    if (seq === state.seq && !controller.signal.aborted) {
      errorMessage(error.message);
      state.record = null;
      target.innerHTML = '<div class="empty"><h2>Não foi possível abrir a questão</h2><button class="quiet" type="button" data-action="reload">Tentar carregar</button> <button class="link-button" type="button" data-action="reset">Ver todo o caderno</button></div>';
      $('#found-count').textContent = '';
      $('#pager').replaceChildren();
      $('#random').disabled = true;
    }
  } finally {
    if (state.request === controller) {
      state.request = null;
      target.setAttribute('aria-busy', 'false');
      target.inert = false;
    }
  }
}
$('#random').addEventListener('click', () => {
  removeDirect();
  loadQuestion({ random: '1', ...(state.record?.question ? { id: state.record.question.id } : {}) }, true);
});
function pagesFor(q){
  const first=Number(q.page)||1,last=Math.min(first+12,Number(q.lastPage||q.endPage)||first);
  return [...new Set([...(q.contextPages||[]),...(q.pages||[]),...Array.from({length:Math.max(1,last-first+1)},(_,i)=>first+i)].map(Number).filter(n=>Number.isInteger(n)&&n>0))].sort((a,b)=>a-b);
}
function feedbackBox(f,e){
  const title=f.result==='correct'?'Você acertou.':f.result==='wrong'?'Resposta incorreta.':f.keyStatus==='annulled'?'A banca anulou esta questão.':'A correção desta questão está pendente.';
  const kind=f.keyStatus==='proposed'?'A resolução de estudo':f.keyStatus==='preliminary'?'O gabarito preliminar':'O gabarito oficial';
  const correction=f.answers.length?kind+' indica '+(f.answers.length>1?'as alternativas ':'a alternativa ')+f.answers.join(' ou ')+'.'
    :state.mode==='account'?'A tentativa fica no histórico e é excluída do percentual de acertos.':'Esta questão fica sem pontuação.';
  return `<div class="feedback ${h(f.result)}" role="status"><strong>${h(title)}</strong><p>${h(correction)} ${f.keyStatus==='official'?'Correção da prova de '+h(e.year)+'.':''}</p>${f.explanation?'<p>'+h(f.explanation)+'</p>':''}${f.sourceNote&&f.sourceNote!==f.explanation?'<p>'+h(f.sourceNote)+'</p>':''}${f.printedKey&&!f.sourceNote?'<p>A letra impressa no gabarito da banca é '+h(f.printedKey)+'.</p>':''}<div class="source-links">${link(f.keyPdf,'Abrir gabarito em PDF',f.keyPage)}${link(f.keyUrl,'Fonte da correção')}${link(f.correction,'Retificação',f.correctionPage)}${link(f.referenceUrl,'Referência da resolução')}</div></div>`;
}
function originalSupport(q, context) {
  const text = fold(q.stem);
  const citesPassage = /\b(?:texto|autor(?:a)?|paragrafos?|versos?|lacunas?|trecho)\b/.test(text);
  const citesLine = /\b(?:linhas?\s*(?:n[ºo°.]?\s*)?|l\.\s*)\d{1,3}\b(?!\s*(?:v|kv|ma|mm)\b)/.test(text);
  const citesFormat = /\b(?:sublinhad[oa]s?|grifad[oa]s?|em negrito|(?:palavra|termo|expressao)s? destacad[oa]s?)\b/.test(text);
  const visual = '(?:figur(?:a|as)|imagens?|imagem|grafico[s]?|tabela[s]?|diagrama[s]?|mapa[s]?|quadro[s]?|charge[s]?|tirinha[s]?|esquema[s]?|ilustrac(?:ao|oes)|quadrinhos?)';
  const citesVisual = new RegExp('\\b' + visual + '\\s+(?:a seguir|abaixo|acima|apresentad\\w*|mostrad\\w*|ilustra\\w*|\\d+\\b)').test(text) ||
    new RegExp('\\b(?:observe|observando|analise|considere|conforme|segundo|de acordo com|com base n[ao]|a partir d[ao])\\s+(?:[ao]s?\\s+)?' + visual + '\\b').test(text);
  const placeholder = /\b(?:caderno|documento) original contem\b/.test(fold(context));
  const language = /\bportugues(?:a)?\b/.test(fold(q.subject));
  // With no transcription, distinguish a cited reading from self-contained exercises about a law or a text editor.
  const needsPassage = placeholder && citesPassage || language &&
    /\b(?:do texto|no texto|pelo texto|segundo o autor|segundo a autora|(?:o autor|a autora|o narrador) (?:afirma|defende|menciona)|texto (?:base|anterior|acima)|(?:primeiro|segundo|terceiro|ultimo) paragrafo)\b/.test(text);
  return {
    text: Boolean(context && (q.needsOriginal || citesPassage || citesLine || citesFormat)),
    figures: Boolean(q.needsOriginal || citesVisual || (!context || placeholder) && (needsPassage || citesLine || citesFormat)),
  };
}
function imgGuide(q, exam, needed) {
  const sources = (q.assets || []).map(urlFor).filter(Boolean);
  if (!sources.length && needed && exam.pdf && q.page && exam.pageCount >= q.page) {
    const page = Number(q.contextPages?.[0] || q.page);
    sources.push(root + 'api/page-image?exam=' + encodeURIComponent(exam.id) + '&page=' + page);
  }
  if (!sources.length) return '';
  const images = sources.map((url, index) =>
    '<a href="' + h(url) + '" target="_blank" rel="noreferrer"><img class="question-image" loading="lazy" src="' + h(url) +
    '" alt="Trecho ' + (index + 1) + ' da prova, questão ' + h(q.number) + '. Abrir em tamanho completo."></a>').join('');
  return '<details class="figure-details"' + (needed ? ' open' : '') + '><summary>Ver figuras e trechos da prova (' + sources.length + ')</summary>' + images + '</details>';
}
function noLongerMatches(data) {
  const mode = state.filters.mode;
  return (mode === 'new' && Boolean(data.previous)) || (mode === 'wrong' && data.previous?.result !== 'wrong') ||
    (mode === 'saved' && !data.saved);
}
function renderOption(choice, index) {
  const letter = letters[index];
  const feedback = state.feedback;
  const eliminated = !feedback && state.eliminated.has(letter);
  const classes = ['option'];
  if (feedback?.answers.includes(letter)) classes.push('correct');
  if (feedback?.choice === letter && feedback.result === 'wrong') classes.push('wrong');
  if (eliminated) classes.push('eliminated');
  const action = (eliminated ? 'Restaurar' : 'Riscar') + ' alternativa ' + letter;
  return '<div class="option-row"><label class="' + classes.join(' ') + '"><input type="radio" name="alternativa" value="' +
    letter + '"' + (state.selection === letter ? ' checked' : '') + (feedback || eliminated ? ' disabled' : '') +
    '><b aria-hidden="true">' + letter + '</b><span><span class="sr">Alternativa ' + letter + '. </span>' + h(choice) +
    '</span></label>' + (feedback ? '' : '<button class="eliminate" type="button" data-eliminate="' + letter +
    '" aria-label="' + action + '" title="' + action + '" aria-pressed="' + eliminated + '"><span aria-hidden="true">' +
    (eliminated ? '↶' : '−') + '</span></button>') + '</div>';
}
function renderPager(data, remaining) {
  const pager = $('#pager');
  if (state.removed && !remaining) {
    pager.innerHTML = '<button type="button" class="page-button" data-clear>Escolher outras questões</button>';
    return;
  }
  const id = new URLSearchParams(location.search).get('questao');
  const resumesQueue = state.mode === 'account' && Boolean(id && data.previous && data.unanswered);
  const movesToEnd = state.newlyAnswered && data.total > 1;
  const last = !state.removed && !movesToEnd && !resumesQueue && state.index >= data.total - 1;
  const position = state.removed ? '' : fmt(state.index + 1) + ' de ' + fmt(data.total);
  pager.innerHTML = '<button type="button" data-step="-1" class="page-button"' + (state.index === 0 ? ' disabled' : '') +
    '>← Anterior</button><span class="page-position">' + position + '</span>' +
    '<button type="button" data-step="1" class="page-button"' + (last ? ' disabled' : '') + '>' +
    (state.removed ? 'Continuar' : 'Próxima') + ' →</button>' +
    '<form class="pager-jump"><label for="jump-position">Ir para questão nº</label>' +
    '<input id="jump-position" type="number" inputmode="numeric" min="1" step="1" max="' + remaining +
    '" required><button class="quiet small" type="submit">Ir</button></form>';
}
function renderQuestion(sameQuestion = false) {
  const data = state.record;
  const target = $('#question');
  const remaining = Math.max(0, (data?.total || 0) - (state.removed ? 1 : 0));
  $('#found-count').textContent = remaining ? fmt(remaining) + (remaining === 1 ? ' questão' : ' questões') + ' nesta seleção' :
    state.removed ? 'Você concluiu esta seleção.' : 'Nenhuma questão nesta seleção';
  $('#random').disabled = !remaining;
  if (!data?.question) {
    target.innerHTML = '<div class="empty"><h2>Nenhuma questão encontrada</h2><p>Experimente retirar um filtro ou buscar outra expressão.</p><button type="button" class="link-button" data-action="reset">Limpar filtros</button></div>';
    $('#pager').replaceChildren();
    return;
  }
  const q = data.question;
  const exam = state.exams.get(q.examId);
  const number = String(q.number).padStart(2, '0');
  if (!sameQuestion) {
    const context = typeof q.context === 'string' ? q.context : Array.isArray(q.context) ? q.context.join('\n') : '';
    const support = originalSupport(q, context);
    const favorite = state.mode === 'account' ? '<button class="quiet small" type="button" data-action="save"></button>' : '';
    target.innerHTML = `<div class="question-head"><div><p class="eyebrow">${h(exam.institute)} · ${h(exam.year)} · ${h(exam.board)}</p><h2>Questão ${h(number)}</h2></div>${favorite}</div>
      <div class="metadata"><span>${h(exam.role)}</span><span>${h(q.subject)}</span>${q.topic ? '<span title="' + h(q.topicSource || 'Assunto da questão') + '">' + h(q.topic) + '</span>' : ''}</div>
      <p class="queue-note" hidden></p>
      ${context ? '<details class="support"' + (support.text ? ' open' : '') + '><summary>Texto de apoio</summary><div class="support-text">' + h(context) + '</div></details>' : ''}
      <p class="stem">${h(q.stem)}</p>${q.transcriptionNote ? '<p class="source-note">' + h(q.transcriptionNote) + '</p>' : ''}${imgGuide(q, exam, support.figures)}
      <div class="original">${exam.pdf && q.page ? '<button type="button" class="link-button" data-action="original">Consultar a página da questão</button>' : ''}${link(exam.pdf || exam.sourceUrl, 'Abrir prova original', q.page)}</div>
      <div data-resolution></div>`;
  }
  const save = target.querySelector('[data-action=save]');
  if (save) {
    save.disabled = false;
    save.setAttribute('aria-pressed', String(data.saved));
    save.textContent = data.saved ? '★ Salva' : '☆ Salvar';
    let note = data.previous && !state.newlyAnswered ? 'Já respondida neste perfil.' : '';
    if (data.unanswered > 0) {
      note += (note ? ' ' : '') + (data.unanswered === 1 ? '1 questão ainda não respondida' :
        fmt(data.unanswered) + ' questões ainda não respondidas') + ' nesta seleção.';
    } else if (!note && data.unanswered === 0) note = 'Todas as questões desta seleção já foram respondidas.';
    accessMessage('.queue-note', note);
  }
  // Reuse the stem and facsimiles when grading, saving or crossing out a choice.
  target.querySelector('[data-resolution]').innerHTML = `<fieldset><legend class="sr">Alternativas da questão ${h(number)}</legend>${q.choices.map(renderOption).join('')}</fieldset>
    ${state.feedback ? feedbackBox(state.feedback, exam) : ''}
    <div class="question-actions">${state.feedback ? '<button class="quiet" type="button" data-action="retry">Tentar novamente</button>' :
      '<button class="primary" type="button" data-action="answer"' + (state.selection ? '' : ' disabled') + '>Conferir resposta</button>'}
      <button class="link-button" type="button" data-action="copy">Copiar link da questão</button><span id="copy-feedback" class="subtext" role="status"></span></div>`;
  renderPager(data, remaining);
}

function selectChoice(letter) {
  if (state.feedback || state.pendingWrite || state.request || state.eliminated.has(letter)) return;
  const input = $('#question input[name="alternativa"][value="' + letter + '"]');
  if (!input || input.disabled) return;
  input.checked = true;
  if (state.selection !== letter) state.retry = null;
  state.selection = letter;
  $('#question [data-action=answer]').disabled = false;
  return input;
}
$('#question').addEventListener('change', event => {
  if (event.target.name === 'alternativa') selectChoice(event.target.value);
});
function toggleElimination(letter) {
  if (state.feedback || state.pendingWrite || state.request) return;
  if (state.eliminated.has(letter)) state.eliminated.delete(letter);
  else {
    state.eliminated.add(letter);
    if (state.selection === letter) { state.selection = null; state.retry = null; }
  }
  renderQuestion(true);
  $('#question [data-eliminate="' + letter + '"]').focus({ preventScroll: true });
}
$('#question').addEventListener('contextmenu', event => {
  const radio = event.target.closest('label.option')?.querySelector('input');
  if (!radio || state.feedback || state.pendingWrite) return;
  event.preventDefault();
  toggleElimination(radio.value);
});
$('#pager').addEventListener('click', event => {
  if (event.target.closest('[data-clear]')) { changeFilters({}, true); return; }
  const button = event.target.closest('[data-step]');
  if (!button || button.disabled || state.request || state.pendingWrite || !state.record?.question) return;
  const step = Number(button.dataset.step);
  const id = state.record.question.id;
  const wasDirect = new URLSearchParams(location.search).has('questao');
  let extra = {};
  if (step > 0 && state.newlyAnswered) extra = { afterAnswer: id };
  else if (step > 0 && wasDirect && state.mode === 'account' && state.record.previous && state.record.unanswered) state.index = 0;
  else state.index = Math.max(0, state.index + (step > 0 && state.removed ? 0 : step));
  removeDirect();
  loadQuestion(extra, true);
});
$('#pager').addEventListener('submit', event => {
  event.preventDefault();
  if (state.request || state.pendingWrite) return;
  const input = $('#jump-position');
  if (!input.reportValidity()) return;
  state.index = input.valueAsNumber - 1;
  removeDirect();
  loadQuestion({}, true);
});

async function copyQuestion(id) {
  const url = new URL(studyLocation({ id }), location.origin).href;
  const status = $('#copy-feedback');
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = 'Link copiado.';
    return;
  } catch { /* Some local previews and browsers restrict the Clipboard API. */ }
  if (!status.isConnected) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = url;
  input.readOnly = true;
  input.setAttribute('aria-label', 'Endereço da questão');
  status.replaceChildren(input);
  input.focus({ preventScroll: true });
  input.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { /* Leave the selected URL available. */ }
  if (copied) {
    status.textContent = 'Link copiado.';
    $('#question [data-action=copy]').focus({ preventScroll: true });
  } else status.prepend('Copie o endereço selecionado. ');
}
async function writeAnswerOrSave(path, form) {
  const pending = studyApi(path, form);
  state.pendingWrite = pending;
  try { return await pending; }
  finally { if (state.pendingWrite === pending) state.pendingWrite = null; }
}

$('#question').addEventListener('click', async event => {
  const eliminate = event.target.closest('[data-eliminate]');
  if (eliminate) { toggleElimination(eliminate.dataset.eliminate); return; }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'reset') { changeFilters({}, true); return; }
  if (action === 'reload') { navigate(); return; }
  const data = state.record;
  const q = data?.question;
  if (!q) return;
  const seq = state.seq;
  const generation = state.generation;
  try {
    if (action === 'original') { originalDialog(q, state.exams.get(q.examId)); return; }
    if (action === 'copy') { await copyQuestion(q.id); return; }
    if (state.pendingWrite) return;
    if (action === 'save' && state.mode === 'account') {
      button.disabled = true;
      const saved = await writeAnswerOrSave('save', { id: q.id, saved: !data.saved });
      if (state.seq !== seq) return;
      data.saved = saved.saved;
      state.removed = noLongerMatches(data);
      renderQuestion(true);
      $('#question [data-action=save]').focus({ preventScroll: true });
      return;
    }
    if (action === 'retry') {
      state.feedback = null;
      state.selection = null;
      state.retry = null;
      state.eliminated.clear();
      renderQuestion(true);
      $('#question input[type=radio]')?.focus({ preventScroll: true });
      return;
    }
    if (action === 'answer' && state.selection && !state.feedback) {
      button.disabled = true;
      $('#question fieldset').disabled = true;
      const account = state.mode === 'account';
      const answer = { id: q.id, choice: state.selection };
      if (account) { state.retry ??= crypto.randomUUID(); answer.request = state.retry; }
      const feedback = await writeAnswerOrSave(account ? 'answer' : 'check', answer);
      if (state.generation !== generation) return;
      if (account) {
        state.catalog.resume = q.id;
        $('#resume-study').hidden = false;
        showProgress(feedback.progress);
        if (feedback.unlocked) {
          const goal = feedback.unlocked === 1 ? 'Primeira questão resolvida' : fmt(feedback.unlocked) + ' questões resolvidas';
          accessMessage('#achievement-status', 'Medalha desbloqueada · ' + goal + '.');
        }
      } else recordGuestAnswer(q.id, feedback.result);
      if (state.seq !== seq) return;
      if (account && !data.previous) {
        state.newlyAnswered = true;
        data.unanswered = Math.max(0, data.unanswered - 1);
      }
      state.feedback = feedback;
      data.previous = feedback;
      state.removed = noLongerMatches(data);
      renderQuestion(true);
      const box = $('#question .feedback');
      box.setAttribute('tabindex', '-1');
      box.focus({ preventScroll: true });
    }
  } catch (error) {
    if (state.seq === seq) {
      errorMessage(error.message);
      button.disabled = false;
      $('#question fieldset').disabled = false;
    }
  }
});

const shortcuts = $('#shortcuts-toggle');
shortcuts.checked = readSetting('localStorage', 'tae-shortcuts') !== 'off';
shortcuts.addEventListener('change', () => storeSetting('localStorage', 'tae-shortcuts', shortcuts.checked ? 'on' : 'off'));
document.addEventListener('keydown', event => {
  if (!shortcuts.checked || state.view !== 'estudar' || !state.record?.question || state.request || state.pendingWrite ||
      event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || $('#original-dialog').open) return;
  const target = event.target;
  if (target.isContentEditable || target.closest('textarea,select,input:not([type=radio]),[role=textbox]')) return;
  const key = event.key.toLowerCase();
  if (/^[a-e]$/.test(key) && !state.feedback && !state.eliminated.has(key.toUpperCase())) {
    const radio = selectChoice(key.toUpperCase());
    if (radio) {
      radio.focus({ preventScroll: true });
      event.preventDefault();
    }
    return;
  }
  if (key === 'enter' && target.closest('a,button,summary')) return;
  const selectors = { enter: '[data-action=answer]', arrowleft: '[data-step="-1"]', arrowright: '[data-step="1"]', r: '#random', s: '[data-action=save]' };
  const selector = selectors[key];
  if (!selector) return;
  const control = $(selector);
  if (control) {
    event.preventDefault();
    if (!control.disabled) control.click();
  }
});
function originalDialog(q,e){
  const dialog=$('#original-dialog'),cited=pagesFor(q);
  const pages=e.pageCount?Array.from({length:e.pageCount},(_,i)=>i+1):cited;
  const start=pages.indexOf(Number(q.page));let i=Math.max(start,0);
  function render(){
    const page=pages[i];$('#dialog-title').textContent='Prova original · página '+page;
    const related=cited.length>1?'<div class="source-links dialog-related">Páginas desta questão '+cited.filter(n=>pages.includes(n)).map(n=>'<button type="button" class="link-button" data-goto="'+n+'"'+(n===page?' disabled':'')+'>'+n+'</button>').join('')+'</div>':'';
    $('#dialog-content').innerHTML=`<div class="dialog-pagination"><button class="quiet small" data-delta="-1"${i===0?' disabled':''}>← Anterior</button>${link(e.pdf,'Abrir PDF',page)}<button class="quiet small" data-delta="1"${i>=pages.length-1?' disabled':''}>Seguinte →</button></div>${related}<img src="${root}api/page-image?exam=${encodeURIComponent(e.id)}&amp;page=${page}" alt="Página ${page} da prova de ${h(e.role)}">`;
    $('#dialog-content').querySelectorAll('[data-delta]').forEach(b=>b.addEventListener('click',()=>{i+=Number(b.dataset.delta);render();}));
    $('#dialog-content').querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>{i=pages.indexOf(Number(b.dataset.goto));render();}));
    $('#dialog-content img').addEventListener('error',event=>{event.target.hidden=true;const p=document.createElement('p');p.textContent='Use o link Abrir PDF para consultar esta página.';event.target.after(p);});
  }
  render();dialog.showModal();
}
$('#close-dialog').addEventListener('click',()=>$('#original-dialog').close());
$('#original-dialog').addEventListener('close',()=>$('#dialog-content').replaceChildren());
async function start() {
  state.routedHref = location.href;
  syncPageMetadata();
  syncSignIn();
  const params = new URLSearchParams(location.search);
  const remembered = readSetting('sessionStorage', 'tae-access-mode');
  const mode = params.get('mode');
  const account = mode === 'conta' || location.hash === '#desempenho' || mode !== 'visitante' && remembered === 'account';
  if (!account) {
    const publicSelection = Object.keys(filtersFromUrl(params, false)).length > 0;
    if (mode === 'visitante' || remembered === 'guest' || publicSelection || params.has('questao') || params.has('edital') ||
        location.hash === '#estudar' || location.hash === '#editais') await enterGuest();
    return;
  }
  writeLocation(currentLocation(true));
  const button = $('#start-guest');
  button.disabled = true;
  accessMessage('#access-status', 'Verificando sua conta do ChatGPT…');
  try {
    const signal = AbortSignal.timeout(12000);
    const session = await api('session', undefined, { signal });
    if (session.authenticated && session.profileId) await enter('account', session, signal);
    else showWelcome('Entre com o ChatGPT para retomar o progresso salvo.');
  } catch (error) { showWelcome(error.message); }
  finally { button.disabled = false; }
}
start();

