import { $, byText, escape as h, examLabel, fold, keyNames, option } from './dom.js';

const definitions = [
  ['institute', 'Instituto', 'Todos os institutos'],
  ['year', 'Ano da prova', 'Todos os anos'],
  ['role', 'Cargo', 'Todos os cargos', 'Filtrar cargos'],
  ['exam', 'Prova', 'Todas as provas', 'Filtrar provas'],
  ['board', 'Banca organizadora', 'Todas as bancas'],
  ['subject', 'Disciplina', 'Todas as disciplinas'],
  ['topic', 'Assunto', 'Todos os assuntos', 'Filtrar assuntos'],
  ['mode', 'Meu caderno', 'Todas as questões'],
  ['status', 'Gabarito', 'Todos os tipos'],
];
const modes = { new: 'Ainda não respondidas', wrong: 'Erros para revisar', saved: 'Questões salvas' };
const labels = new Map(definitions.map(([key, label]) => [key, label]));
labels.set('q', 'Busca');
const dependents = { institute: ['exam', 'role', 'board', 'subject', 'topic'], role: ['exam', 'topic'], board: ['exam'], year: ['exam'], subject: ['topic'] };

// "mode=conta" is reserved for the sign-in return path.
const urlKey = key => key === 'mode' ? 'caderno' : key;

export function filtersFromUrl(params, allowPersonal) {
  const filters = {};
  for (const key of labels.keys()) {
    const value = params.get(urlKey(key))?.trim().slice(0, key === 'q' ? 160 : 320);
    if (value && (key !== 'mode' || allowPersonal && Object.hasOwn(modes, value))) filters[key] = value;
  }
  return filters;
}

export function appendFilters(params, filters) {
  for (const key of labels.keys()) {
    if (filters[key]) params.set(urlKey(key), filters[key]);
  }
}

export function setupFilters(apply) {
  const fields = $('#filter-fields');
  const chips = $('#active-filters');
  const toggle = $('#filter-toggle');
  let selection = {};
  let exams = new Map();
  let facets = {};
  let visible = [];
  let options = new Map();

  function labelFor(key, value) {
    if (key === 'mode') return modes[value] || value;
    if (key === 'status') return keyNames[value] || value;
    const exam = key === 'exam' && exams.get(value);
    return exam ? examLabel(exam) : value;
  }

  function updateChips() {
    const active = [...labels.keys()].filter(key => selection[key]);
    chips.innerHTML = active.map(key => {
      const label = labels.get(key) + ' · ' + labelFor(key, selection[key]);
      return '<button type="button" class="filter-chip" data-remove-filter="' + key + '" aria-label="' +
        h('Remover filtro ' + label) + '">' + h(label) + ' <span aria-hidden="true">×</span></button>';
    }).join('');
    chips.hidden = !active.length;
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.textContent = (open ? 'Recolher filtros' : 'Mostrar filtros') + (active.length ? ' (' + active.length + ')' : '');
  }

  function renderOptions(key) {
    const select = $('#fil-' + key);
    const search = $('#find-' + key);
    const term = fold(search?.value);
    const selected = selection[key] || '';
    const listed = (options.get(key) || []).filter(([value, , folded]) => value === selected || !term || folded.includes(term));
    const placeholder = visible.find(([name]) => name === key)[2];
    select.innerHTML = option('', placeholder, selected) +
      listed.map(([value, label]) => option(value, label, selected)).join('');
    if (search) {
      const message = $('#matches-' + key);
      const count = term ? listed.filter(([, , folded]) => folded.includes(term)).length : 0;
      message.textContent = term ? (count === 1 ? '1 opção encontrada' : count + ' opções encontradas') : '';
    }
  }

  function renderFacets(next) {
    facets = next;
    options = new Map();
    for (const [key] of visible) {
      const values = new Set(key === 'mode' ? Object.keys(modes) : facets[key] || []);
      if (selection[key]) values.add(selection[key]);
      const items = [...values].map(value => {
        const label = labelFor(key, value);
        return [value, label, fold(label)];
      });
      if (key !== 'mode') items.sort((a, b) => key === 'year' ? Number(b[0]) - Number(a[0]) : byText(a[1], b[1]));
      options.set(key, items);
      renderOptions(key);
    }
  }

  function sync(filters, resetDrafts = false) {
    const previous = selection;
    selection = { ...filters };
    if (resetDrafts || previous.q !== selection.q) $('#fil-q').value = selection.q || '';
    if (resetDrafts) {
      for (const input of fields.querySelectorAll('[data-find]')) input.value = '';
    }
    renderFacets(facets);
    updateChips();
  }

  function mount(account, catalogExams) {
    selection = {};
    exams = catalogExams;
    facets = {};
    visible = definitions.filter(([key]) => key !== 'mode' || account);
    fields.innerHTML = visible.map(([key, label, , find]) => {
      const quick = find ? '<input type="search" class="option-search" id="find-' + key + '" data-find="' + key +
        '" placeholder="' + find + '" aria-label="' + find + '" aria-controls="fil-' + key + '" maxlength="160" autocomplete="off">' : '';
      const matches = find ? '<span class="sr" id="matches-' + key + '" role="status"></span>' : '';
      return '<div class="filter-field"><label for="fil-' + key + '">' + label + '</label>' + quick +
        '<select id="fil-' + key + '" data-filter="' + key + '"' + (key === 'year' ? ' aria-describedby="year-help"' : '') + '></select>' +
        matches + (key === 'year' ? '<small id="year-help">Ano em que a prova foi aplicada.</small>' : '') + '</div>';
    }).join('') + '<form id="search-form" class="filter-field"><label for="fil-q">Buscar no enunciado e nas alternativas</label>' +
      '<input id="fil-q" type="search" maxlength="160" placeholder="Palavra ou expressão"><button type="submit" class="quiet small">Buscar</button></form>';
    toggle.closest('.filters').dataset.open = 'false';
    toggle.setAttribute('aria-expanded', 'false');
  }

  fields.addEventListener('input', event => {
    const key = event.target.dataset.find;
    if (key) renderOptions(key);
  });
  fields.addEventListener('change', event => {
    const key = event.target.dataset.filter;
    if (!key) return;
    const next = { ...selection };
    if (event.target.value) {
      next[key] = event.target.value;
      for (const child of dependents[key] || []) delete next[child];
    } else delete next[key];
    apply(next);
  });
  fields.addEventListener('submit', event => {
    event.preventDefault();
    const next = { ...selection };
    const query = $('#fil-q').value.trim();
    if (query) next.q = query;
    else delete next.q;
    apply(next);
  });
  chips.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-filter]');
    if (!button) return;
    const next = { ...selection };
    delete next[button.dataset.removeFilter];
    apply(next);
    const nextFocus = chips.querySelector('button') || (toggle.offsetWidth ? toggle : $('#fil-institute'));
    nextFocus.focus({ preventScroll: true });
  });
  $('#clear-filters').addEventListener('click', () => apply({}, true));
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.closest('.filters').dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    updateChips();
  });
  return { mount, sync, renderFacets };
}
