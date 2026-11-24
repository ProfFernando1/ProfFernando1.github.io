// Run without arguments to check the tracked bank. For a label-only rebuild,
// --baseline <previous-index.json> also checks every ID, correction and R2 offset.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { subjectPractice, topicPractice } from '../public/concursos-tae/static/programas.js';
import { examLabel } from '../public/concursos-tae/static/dom.js';

const { values } = parseArgs({ options: { baseline: { type: 'string' } } });
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const bank = read(new URL('../lib/tae/bank-index.json', import.meta.url));
const { catalog, groups, facets } = bank;
const seen = new Set();
const recounted = {};
const statuses = {};
for (const facet of facets) assert.equal(new Set(facet).size, facet.length, 'Duplicated filter option');
for (const [examIndex, , , delimiter, codes, rows] of groups) {
  const exam = catalog.exams[examIndex];
  const fields = [exam.institute, exam.role, exam.board, String(exam.year), exam.id];
  assert.deepEqual(codes.map((code, field) => facets[field][code]), fields);
  assert.equal(exam.count, rows.length);
  const subjects = (recounted[exam.institute] ??= {})[exam.role] ??= {};
  for (const [number, subjectCode, topicCode, statusCode, , , , customId] of rows) {
    const id = customId ?? exam.id + delimiter + String(number).padStart(2, '0');
    assert(!seen.has(id), 'Duplicated question ID: ' + id);
    seen.add(id);
    const subject = facets[5][subjectCode], topic = facets[6][topicCode], status = facets[7][statusCode];
    assert(exam.studySubjects.includes(subject));
    assert.equal(typeof topic, 'string');
    assert(Object.hasOwn(catalog.keyLabels, status));
    const counts = subjects[subject] ??= {};
    counts[topic] = (counts[topic] || 0) + 1;
    statuses[status] = (statuses[status] || 0) + 1;
  }
}
assert.equal(seen.size, catalog.summary.questions);
assert.equal(groups.length, catalog.summary.exams);
assert.deepEqual(recounted, catalog.studyIndex);
assert.deepEqual(statuses, catalog.summary.keys);
assert(!catalog.exams.some(exam => /Edital\s+(\d+\/\d{4}).*Edital\s+\1\b/i.test(exam.title)));
for (const exam of catalog.exams) {
  assert(!examLabel(exam).startsWith(exam.year + ' · ' + exam.institute + ' ' + exam.year + ' · '));
}
assert(!facets[1].includes('Bibliotecário-Documentarista'));
assert(!facets[1].includes('Contador – geral'));
assert(!facets[6].includes('Decreto-lei nº 5.296/2004'));
assert(['Médico', 'Médico · Área Clínica', 'Médico-Veterinário'].every(role => facets[1].includes(role)));

const ept = 'Contexto da Educação Profissional e Tecnológica';
const combined = 'Legislação e Contexto Histórico da EPT';
for (const subject of ['Legislação', ept]) {
  const practice = subjectPractice(catalog.studyIndex, 'IFRS', 'Médico · Área Clínica', subject);
  assert.equal(practice[0].filters.subject, subject);
  assert(practice.some(item => item.combined && item.filters.subject === combined));
}
const iffar = subjectPractice(catalog.studyIndex, 'IFFar', 'Médico', 'Legislação');
assert(iffar.every(item => item.filters.institute === 'IFFar' && !item.combined));
const decree = 'Decreto nº 5.296/2004';
const matches = topicPractice([{ filters: { subject: 'Legislação' }, topics: { [decree]: 2 } }],
  'Acessibilidade nos termos do Decreto-lei nº 5.296/2004');
assert.equal(matches[0]?.topic, decree);

if (values.baseline) {
  const baseline = read(values.baseline);
  assert.deepEqual(catalog.exams.map(exam => exam.id), baseline.catalog.exams.map(exam => exam.id));
  const records = index => index.groups.flatMap(([examIndex, shard, start, delimiter, , rows]) => {
    const exam = index.catalog.exams[examIndex].id;
    return rows.map(([n, , , status, accepted, choices, printed, custom], i) => [
      custom ?? exam + delimiter + String(n).padStart(2, '0'),
      shard, start + i, index.facets[7][status], accepted, choices, printed,
    ]);
  });
  assert.deepEqual(records(bank), records(baseline));
}
console.log(`${seen.size} questões em ${groups.length} provas. Índice, programas e filtros conferidos.`);
