import { byText, fold } from './dom.js';

const words = value => fold(value).replace(/[^a-z0-9]+/g, ' ').trim();

const subjectAliases = new Map([
  ['portugues', 'lingua portuguesa'],
  ['conhecimento especifico', 'conhecimentos especificos'],
  ['especificos', 'conhecimentos especificos'],
  ['conhecimentos especificos do cargo', 'conhecimentos especificos'],
]);

const combinedEpt = 'Legislação e Contexto Histórico da EPT';
const separateEptSubjects = new Set(['legislacao', 'contexto da educacao profissional e tecnologica']);

function subjectKey(value) {
  const key = words(value);
  return subjectAliases.get(key) || key;
}

export function isSpecificSubject(name) {
  return /\bespecific[oa]s?\b/.test(subjectKey(name));
}

function matchingSubjects(subjects, name) {
  return Object.entries(subjects || {}).filter(([label, topics]) =>
    subjectKey(label) === subjectKey(name) && Object.values(topics).some(count => count > 0)
  );
}

function matchingRole(roles, studyRole) {
  return Object.keys(roles).find(label => words(label) && words(label) === words(studyRole));
}

function forRole(studyIndex, institute, studyRole, name) {
  const roles = studyIndex[institute] || {};
  const role = matchingRole(roles, studyRole);
  if (!role) return [];
  return matchingSubjects(roles[role], name).map(([subject, topics]) => ({
    filters: { institute, role, subject },
    topics,
  }));
}

function forInstitute(studyIndex, institute, name) {
  const groups = new Map();
  for (const subjects of Object.values(studyIndex[institute] || {})) {
    for (const [subject, topics] of matchingSubjects(subjects, name)) {
      if (!groups.has(subject)) groups.set(subject, new Map());
      const totals = groups.get(subject);
      for (const [topic, count] of Object.entries(topics)) {
        if (count > 0) totals.set(topic, (totals.get(topic) || 0) + count);
      }
    }
  }
  return [...groups].map(([subject, topics]) => ({
    filters: { institute, subject },
    topics: Object.fromEntries(topics),
  }));
}

function practiceForSubject(studyIndex, institute, studyRole, name) {
  const localRole = forRole(studyIndex, institute, studyRole, name);
  if (localRole.length) return localRole;
  if (!isSpecificSubject(name)) return forInstitute(studyIndex, institute, name);
  return Object.keys(studyIndex).filter(other => other !== institute).sort(byText)
    .flatMap(other => forRole(studyIndex, other, studyRole, name));
}

export function subjectPractice(studyIndex, institute, studyRole, name) {
  const exact = practiceForSubject(studyIndex, institute, studyRole, name);
  if (!separateEptSubjects.has(subjectKey(name))) return exact;
  // IFRS 2023 examined the two subjects as a single component. Keep its own filter
  // and flag it for the program links, even when separate components are available.
  const historical = practiceForSubject(studyIndex, institute, studyRole, combinedEpt);
  return exact.concat(historical.map(practice => ({ ...practice, combined: true })));
}

const exactLawTopics = new Map([
  ['regime juridico dos servidores', 'lei:8112:1990'],
  ['processo administrativo federal', 'lei:9784:1999'],
  ['institutos federais', 'lei:11892:2008'],
  ['carreira dos tae', 'lei:11091:2005'],
  ['diretrizes e bases da educacao', 'lei:9394:1996'],
  ['acesso a informacao', 'lei:12527:2011'],
  ['protecao de dados', 'lei:13709:2018'],
]);

const genericTopics = new Set([
  'aspectos gerais', 'conceitos basicos', 'conceitos fundamentais', 'conhecimentos especificos',
  'disposicoes gerais', 'e da outras providencias', 'ensino medio', 'entre outros',
  'nivel superior', 'normas gerais', 'outras providencias', 'principios gerais',
]);

const specificWords = new Set([
  'acentuacao', 'concordancia', 'crase', 'fonologia', 'morfologia', 'ortografia',
  'pontuacao', 'sintaxe', 'libras', 'linux', 'python',
]);

const connectors = new Set(['a', 'ao', 'as', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'no', 'o', 'os', 'para']);
const lawHeading = /^(?:lei|decreto|portaria|resolucao)\s+(?:[a-z]+\s+)*\d+\b/;

function lawReferences(text) {
  const pattern = /\b(lei(?:\s+(?:federal|complementar|estadual|municipal))*|decreto(?:-lei)?|portaria(?:\s+[a-z]{2,12})?|resolucao(?:\s+[a-z]{2,12})?)\s*(?:n\.?\s*[º°o]?\.?\s*)?(\d{1,6}(?:[.]\d{3})*)(?:\s*\/\s*(\d{4}|\d{2})\b|,?\s+de\s+(?:\d{1,2}\s+de\s+[a-z]+\s+de\s+)?(\d{4})\b)/g;
  return [...fold(text).matchAll(pattern)].map(([, kind, number, yearPart, yearLong]) => {
    const year = yearPart || yearLong;
    const fullYear = year.length === 2 ? (Number(year) > 30 ? '19' : '20') + year : year;
    const digits = number.replaceAll('.', '');
    // Some transcriptions call Decreto nº 5.296/2004 a decreto-lei.
    const lawKind = kind === 'decreto-lei' && digits === '5296' && fullYear === '2004'
      ? 'decreto' : kind.replace(' federal', '').trim();
    return [lawKind, digits, fullYear].join(':');
  });
}

function topicScore(label, programKey, programLaws) {
  const labelKey = words(label);
  if (!labelKey || genericTopics.has(labelKey)) return 0;
  const labelLaws = lawReferences(label);
  if (labelLaws.length) return labelLaws.some(law => programLaws.includes(law)) ? 4 : 0;
  // Some document labels end at the first period in a law number.
  if (lawHeading.test(labelKey)) return 0;
  if (programLaws.includes(exactLawTopics.get(labelKey))) return 3;
  const distinctiveWords = labelKey.split(' ').filter(word => !connectors.has(word));
  if (distinctiveWords.length < 2 && !specificWords.has(labelKey)) return 0;
  if (labelKey === programKey) return 5;
  return (' ' + programKey + ' ').includes(' ' + labelKey + ' ') ? 2 : 0;
}

export function topicPractice(practices, text) {
  const program = text.replace(/^\s*\d+(?:[.]\d+)*[.)]?\s+/, '');
  const programKey = words(program);
  const programLaws = lawReferences(program);
  return practices.flatMap(({ filters, topics }) =>
    Object.entries(topics)
      .filter(([, count]) => count > 0)
      .map(([topic, count]) => ({ topic, count, score: topicScore(topic, programKey, programLaws) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || b.count - a.count || byText(a.topic, b.topic))
      .map(({ topic }) => ({ ...filters, topic }))
  );
}

