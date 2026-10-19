import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const bank = JSON.parse(readFileSync('public/pss-data/questions.json', 'utf8'));
const sources = JSON.parse(readFileSync('public/pss-data/sources.json', 'utf8'));
const ids = new Set();
const official = (url) => ['www.ufsm.br', 'ufsm.br', 'www.coperves.ufsm.br', 'coperves.ufsm.br'].includes(new URL(url).hostname);
const sourceMap = new Map(sources.map((source) => [source.id, source]));
for (const q of bank.questions) {
  assert(!ids.has(q.id), `Duplicated question ${q.id}`); ids.add(q.id);
  assert([1, 2, 3].includes(q.stage));
  assert(['Fácil', 'Média', 'Difícil'].includes(q.difficulty));
  assert(q.topic && q.subtopic && q.text.trim().length > 40, q.id);
  assert(q.images.length > 0 && q.sourcePages.length > 0, q.id);
  const source = sourceMap.get(q.sourceId);
  assert(source && source.included !== false, q.id);
  assert.equal(q.year, source.year); assert.equal(q.stage, source.stage);
  assert(official(q.sourceUrl) && official(q.keyUrl));
  assert(!q.sourceUrl.toLowerCase().includes('unico'), `Único source ${q.id}`);
  if (q.answerStatus === 'valid') { assert(/^[A-E]$/.test(q.answer), q.id); assert(q.explanation?.length > 40, q.id); }
  else assert.equal(q.answer, null);
  for (const image of q.images) { assert(image.startsWith('/pss-data/images/')); assert(existsSync(path.join('public', image)), image); }
}
for (const source of sources) {
  const questions = bank.questions.filter((q) => q.sourceId === source.id);
  assert.equal(source.questionCount, questions.length, source.id);
  if (source.included !== false) assert(questions.length > 0, `Missing physics ${source.id}`);
  if (source.included !== false && source.physicsNumbers) assert.deepEqual(questions.map((q) => q.number).sort((a,b)=>a-b), [...source.physicsNumbers].sort((a,b)=>a-b), source.id);
  const local = path.join('work/pss/originals', `${source.id}.pdf`);
  if (existsSync(local)) assert.equal(createHash('sha256').update(readFileSync(local)).digest('hex'), source.examSha256);
}
for (const [year, stages] of [[2024,[1]], [2025,[1,2]], [2026,[1,2,3]]]) {
  const modern = bank.questions.filter((q) => q.year === year && q.era === 'atual');
  assert.deepEqual([...new Set(modern.map((q) => q.stage))].sort(), stages);
  for (const stage of stages) assert.equal(modern.filter((q) => q.stage === stage).length, 4, `${year}/${stage}`);
}
assert.equal(bank.coverage.questionCount, bank.questions.length);
assert.equal(bank.coverage.sourceCount, sources.filter((source) => source.questionCount > 0).length);
console.log(`PASS: ${ids.size} unique physics questions, official sources, answer states, image paths, coverage and original hashes.`);
