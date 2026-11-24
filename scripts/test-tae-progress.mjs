import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

// Load the actual Worker code against isolated SQLite and R2 fixtures, without a build or network access.
function load(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const compiled = { exports: {} };
  const requireLocal = name => {
    assert.ok(Object.hasOwn(dependencies, name), 'Unexpected test dependency: ' + name);
    return dependencies[name];
  };
  compileFunction(source, ['require', 'module', 'exports'], { filename: file })(requireLocal, compiled, compiled.exports);
  return compiled.exports;
}

const index = JSON.parse(readFileSync('lib/tae/bank-index.json', 'utf8'));
const { groups, facets, catalog } = index;
const first = groups[0], exam = catalog.exams[first[0]].id;
const idOf = (group, row) => row[7] ?? catalog.exams[group[0]].id + group[3] + String(row[0]).padStart(2, '0');
const ids = first[5].map(row => idOf(first, row));
const otherId = idOf(groups[1], groups[1][5][0]);
// Exercise multiple accepted alternatives and pending keys even when absent from the current release.
first[5][0][4] = ['A', 'B'];
first[5].at(-1)[3] = facets[7].includes('pending') ? facets[7].indexOf('pending') : facets[7].push('pending') - 1;
const pendingId = ids.at(-1);
const all = groups.flatMap(group => group[5].map(row => ({ id: idOf(group, row), row })));
const annulledId = all.find(({ row }) => facets[7][row[3]] === 'annulled').id;

const storage = load('lib/tae/storage.ts');
const identity = load('lib/study-identity.ts');
const bank = load('lib/tae/bank.ts', { './storage': storage, './bank-index.json': index });
const report = load('lib/tae/performance.ts', { './bank': bank });
const profiles = load('lib/tae/profiles.ts', { './bank': bank, './performance': report });
const { handleStudy } = load('lib/tae/service.ts', {
  '../study-identity': identity, './bank': bank, './storage': storage, './performance': report, './profiles': profiles,
});

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON');
for (const file of readdirSync('drizzle').filter(file => file.endsWith('.sql')).sort()) {
  sqlite.exec(readFileSync('drizzle/' + file, 'utf8'));
}
const db = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      first() { return statement.get(...args) ?? null; },
      all() { return { results: statement.all(...args) }; },
      run() { return statement.run(...args); },
    };
  },
  batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = statements.map(statement => statement.all());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
};
const searchHits = new Set([ids[0], ids[2], ids[3], otherId]);
const bucket = {
  get(key) {
    const path = key.replace(/^tae-v1\/bank\//, '').replace(/\.json$/, '');
    const [kind, name] = path.split('/');
    if (kind === 'exams') {
      const group = groups.find(g => catalog.exams[g[0]].id === name);
      return { json: () => group[5].map(row => [{
        id: idOf(group, row), examId: name, number: row[0], stem: 'Questão de teste',
        subject: 'Rótulo de origem', topic: 'Assunto de origem', choices: Array(row[5]).fill('Alternativa'),
      }, { explanation: '', sourceNote: '', printedKey: '' }]) };
    }
    assert.equal(kind, 'search');
    const texts = [];
    for (const group of groups.filter(g => g[1] === Number(name))) {
      group[5].forEach((row, offset) => { texts[group[2] + offset] = searchHits.has(idOf(group, row)) ? 'amostra' : ''; });
    }
    return { json: () => texts };
  },
};

const origin = 'https://test.example';
const firstUser = 'historical-fixture';
let requests = 0;
async function call(path, { user = firstUser, body, expected = 200, profile } = {}) {
  const headers = { origin };
  if (user) {
    headers['oai-authenticated-user-id'] = user;
    headers['X-Study-Profile'] = profile ?? await identity.studyProfileKey(user);
  }
  if (body) headers['Content-Type'] = 'application/json';
  const response = await handleStudy(new Request(origin + '/concursos-tae/api/' + path, {
    headers, method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
  }), { DB: db, BUCKET: bucket });
  assert.equal(response.status, expected, path);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  requests++;
  return response.json();
}
const practice = (params = {}, options) => call('practice?' + new URLSearchParams(params), options);
const answer = (id, choice, user, request = crypto.randomUUID()) => call('answer', { user, body: { id, choice, request } });
const insert = sqlite.prepare('INSERT INTO study_tae_attempts (profile, question, choice, ts, request_key) VALUES (?, ?, ?, ?, ?)');
const date = value => Date.parse(value) / 1000;
const getProfile = async user => {
  await call('enter', { user, body: {} });
  return sqlite.prepare('SELECT id FROM study_accounts WHERE subject = ?').get(await identity.studyProfileKey(user)).id;
};

// A migrated history has repeated attempts, neutral answers, and a São Paulo midnight
// during daylight saving time. Both sides of that midnight fall on the very same UTC date.
assert.equal((await call('catalog')).progress.xp, 0);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM study_accounts').get().n, 0);
const uid = await getProfile(firstUser);
insert.run(uid, ids[0], 'B', date('2018-01-10T01:59:59Z'), 'old-1');
insert.run(uid, ids[0], 'E', date('2018-01-10T02:00:00Z'), 'old-2');
const wrongLetter = id => 'ABCDE'.split('').find(letter => bank.grade(id, letter).result === 'wrong');
insert.run(uid, ids[2], wrongLetter(ids[2]), date('2018-01-10T03:00:00Z'), 'old-3');
insert.run(uid, otherId, wrongLetter(otherId), date('2018-01-10T03:10:00Z'), 'old-4');
const originalRows = sqlite.prepare("SELECT * FROM study_tae_attempts WHERE request_key LIKE 'old-%' ORDER BY id");
const original = originalRows.all();
const initial = await call('catalog');
assert.equal(initial.resume, otherId);
assert.deepEqual(initial.progress, {
  xp: 41, level: 1, levelFloor: 0, nextLevelXp: 250, unique: 3, mastered: 1, studyDays: 2,
  milestones: [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000], rules: { unique: 10, correct: 5, day: 3, level: 250 },
});
const initialReport = await call('performance');
assert.deepEqual(initialReport.progress, initial.progress);
assert.equal(initialReport.attempts, 4);
assert.equal(initialReport.correct, 0);
assert.equal(initialReport.wrong, 3);
assert.equal(initialReport.recent.length, 4);

// Compare every position against the natural order within each block.
const ordered = [...ids.filter(id => id !== ids[0] && id !== ids[2]), ids[0], ids[2]];
for (const [i, id] of ordered.entries()) {
  const selection = await practice({ exam, index: i });
  assert.equal(selection.question.id, id);
  assert.equal(selection.index, i);
  assert.equal(selection.unanswered, ids.length - 2);
  assert.equal(Boolean(selection.previous), i >= ids.length - 2);
}
assert.equal((await practice({ exam, id: ids[2] })).index, 2);
assert.equal((await practice({ exam, mode: 'wrong', index: 1 })).question.id, ids[2]);
assert.equal((await practice({ exam, mode: 'new' })).total, ids.length - 2);
const searched = await practice({ q: 'amostra' });
assert.equal(searched.question.id, ids[3]);
assert.equal(searched.unanswered, 1);
assert.equal((await practice({ q: 'amostra', index: 3 })).question.id, otherId);
const canonicalRole = catalog.exams[groups[1][0]].role;
const canonicalSearch = await practice({ exam: catalog.exams[groups[1][0]].id, q: canonicalRole });
assert.equal(canonicalSearch.total, groups[1][5].length);
assert.equal(canonicalSearch.question.subject, bank.questionMeta(canonicalSearch.question.id).subject);
assert.notEqual(canonicalSearch.question.topic, 'Assunto de origem');
await call('save', { body: { id: ids[0], saved: true } });
await call('save', { body: { id: ids[1], saved: true } });
assert.equal((await practice({ mode: 'saved' })).question.id, ids[1]);
assert.equal((await practice({ mode: 'saved', index: 1 })).question.id, ids[0]);
assert.equal((await practice({ q: 'amostra', random: '1', id: ids[0] })).question.id, ids[3]);
assert.notEqual((await practice({ q: 'amostra', random: '1', id: ids[3] })).question.id, ids[3]);
assert.equal((await practice({ exam, index: -15 })).index, 0);
assert.equal((await practice({ exam, index: 99999 })).index, ids.length - 1);

// A guest cannot see or modify the signed-in history even if identity headers are present.
assert.equal((await call('catalog?guest=1', { user: null })).progress, undefined);
const visitor = await call('practice?guest=1', { profile: '', body: { query: 'exam=' + exam } });
assert.equal(visitor.question.id, ids[0]);
assert.equal(visitor.previous, null);
assert.equal((await call('check?guest=1', { user: null, body: { id: ids[1], choice: 'A' } })).progress, undefined);
await call('performance', { user: null, expected: 401 });
await call('practice', { body: { query: '' }, profile: 'another-profile', expected: 409 });
const independent = await practice({ exam }, { user: 'another-account' });
assert.equal(independent.question.id, ids[0]);
assert.equal(independent.unanswered, ids.length);
const viaPost = await call('practice', { body: { query: 'exam=' + exam } });
assert.equal(viaPost.question.id, ids[1]);

await answer(ids[1], 'A', firstUser);
assert.equal((await practice({ exam })).question.id, ids[3]);
assert.equal((await practice({ exam, index: 0, afterAnswer: ids[1] })).question.id, ids[3]);
assert.equal((await practice({ exam, mode: 'new', index: 0, afterAnswer: ids[1] })).question.id, ids[3]);
assert.equal((await practice({ exam, mode: 'new', index: ids.length - 3, afterAnswer: ids[1] })).index, 0);
assert.equal((await practice({ mode: 'saved', index: 0, afterAnswer: ids[1] })).question.id, ids[0]);
assert.equal((await practice({ exam, index: ids.length - 1, afterAnswer: ids[1] })).index, 0);
assert.deepEqual(originalRows.all(), original);
const historyPage = await call('performance?offset=1');
assert.equal(historyPage.recent.length, 4);
assert.equal(historyPage.recent[0].question, otherId);

// Same request, a fresh request on the same question, and a later error cannot farm
// a second medal or withdraw a first-correct bonus. Neither neutral status enters accuracy.
const newUser = 'achievement-fixture';
const token = crypto.randomUUID();
const one = await answer(ids[0], 'B', newUser, token);
assert.equal(one.unlocked, 1);
assert.equal(one.progress.xp, 18);
const replay = await answer(ids[0], 'B', newUser, token);
assert.deepEqual(replay.progress, one.progress);
assert.equal(replay.unlocked, null);
await call('answer', { user: newUser, body: { id: ids[0], choice: 'A', request: token }, expected: 400 });
const retake = await answer(ids[0], 'E', newUser);
assert.deepEqual(retake.progress, one.progress);
assert.equal(retake.unlocked, null);
const pending = await answer(pendingId, 'C', newUser);
const annulled = await answer(annulledId, 'B', newUser);
assert.equal(pending.result, 'neutral');
assert.equal(annulled.result, 'neutral');
const neutralReport = await call('performance', { user: newUser });
assert.equal(neutralReport.graded, 1);
assert.equal(neutralReport.neutral, 2);
assert.equal(neutralReport.attempts, 4);
assert.equal(neutralReport.progress.xp, 38);
assert.equal(neutralReport.progress.mastered, 1);

// Seed nine unique rows, then let two different writes race at the tenth milestone.
const raceUser = 'shared-tabs-fixture', raceUid = await getProfile(raceUser);
for (const id of ids.slice(0, 9)) insert.run(raceUid, id, 'A', 1, 'seed-' + id);
const racing = await Promise.all([answer(ids[9], 'A', raceUser), answer(ids[10], 'A', raceUser)]);
assert.deepEqual(racing.map(r => r.unlocked).filter(Boolean), [10]);
assert.equal((await call('catalog', { user: raceUser })).progress.unique, 11);

const levelUser = 'level-fixture', levelUid = await getProfile(levelUser);
const graded = all.filter(({ id }) => bank.grade(id, '').accepted.length > 0);
const levelRows = graded.slice(0, 20);
for (const [i, { id }] of levelRows.entries()) {
  const choice = i < 7 ? bank.grade(id, '').accepted[0] : wrongLetter(id);
  insert.run(levelUid, id, choice, date('2026-02-01T12:00:00Z') + i % 5 * 86400, 'level-' + i);
}
const level = (await call('catalog', { user: levelUser })).progress;
assert.equal(level.xp, 250);
assert.equal(level.level, 2);
assert.equal(level.levelFloor, 250);
assert.equal(level.nextLevelXp, 500);

// A large existing profile crosses the highest advertised milestone without a migration.
const largeUser = 'large-fixture', largeUid = await getProfile(largeUser);
sqlite.exec('BEGIN');
for (const { id } of all.slice(0, 4999)) insert.run(largeUid, id, 'A', 1, 'large-' + id);
sqlite.exec('COMMIT');
const last = await answer(all[4999].id, 'A', largeUser);
assert.equal(last.unlocked, 5000);
assert.equal(last.progress.unique, 5000);
assert.equal((await practice({}, { user: largeUser })).question.id, all[5000].id);
assert.equal((await call('performance', { user: largeUser })).recent.length, 24);
sqlite.close();
console.log(`TAE: ${requests} HTTP assertions passed with local SQLite, including historical XP, medal retries and a 5,000-question profile.`);
