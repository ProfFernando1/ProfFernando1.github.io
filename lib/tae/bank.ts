import generated from "./bank-index.json";
import { readJson, type StorageBucket } from "./storage";

export const keyLabels = generated.catalog.keyLabels;
type KeyStatus = keyof typeof keyLabels;
type Result = "correct" | "wrong" | "neutral";

type Exam = {
  id: string;
  institute: string;
  year: number;
  board: string;
  role: string;
  title: string;
  pageCount: number;
  pdf?: string;
  keyPdf?: string;
};

export type QuestionMeta = {
  id: string;
  number: number;
  examId: string;
  year: number;
  institute: string;
  role: string;
  examTitle: string;
  subject: string;
  keyStatus: KeyStatus;
  answer: string | null;
  answers: string[];
  choiceCount: number;
};

export type Question = {
  id: string;
  examId: string;
  number: number;
  subject: string;
  topic: string;
  stem: string;
  choices: string[];
  keyStatus: KeyStatus;
  [field: string]: unknown;
};

export type Grade = {
  result: Result;
  answers: string[];
  accepted: string[];
  keyStatus: KeyStatus;
};

type FeedbackSources = {
  explanation: string;
  sourceNote: string;
  printedKey: string;
  keyUrl: string | null;
  referenceUrl: string | null;
  keyPdf: string | null;
  keyPage: number | null;
  correction: string | null;
  correctionPage: number | null;
};

type Feedback = Omit<Grade, "accepted"> & FeedbackSources & { choice: string };

type QuestionRow = [
  number: number,
  subject: number,
  topic: number,
  status: number,
  answers: string | string[],
  choiceCount: number,
  printedAnswer?: string | null,
  customId?: string,
];

type ExamGroup = [
  examIndex: number,
  searchShard: number,
  offsetInShard: number,
  idDelimiter: string,
  facetCodes: number[],
  rows: QuestionRow[],
];

type Location = { group: ExamGroup; offset: number };
type StoredQuestion = [Question, FeedbackSources];
type Candidates = { group: ExamGroup; offsets: number[] };

const facetNames = ["institute", "role", "board", "year", "exam", "subject", "topic", "status"] as const;
type Facets = Record<(typeof facetNames)[number], string[]>;

export const bankSummary = generated.catalog.summary;
const { catalog, facets: facetValues, unicode } = generated;
const exams: Exam[] = catalog.exams;
const groups = generated.groups as ExamGroup[];
const examsById = new Map(exams.map((exam) => [exam.id, exam]));
const groupsById = new Map<string, ExamGroup>();
const customLocations = new Map<string, Location>();
const statuses = facetValues[7] as KeyStatus[];
const casefold = unicode.casefold as Record<string, string>;
const combiningMarks = new RegExp("[" + unicode.combining + "]", "gu");
const pythonWhitespace = /[\p{White_Space}\u001c-\u001f]+/u;
const digits = Array.from(unicode.decimal);
const letters = "ABCDEFGHIJ";

for (const group of groups) {
  groupsById.set(exams[group[0]].id, group);
  group[5].forEach((row, offset) => {
    if (row[7] !== undefined) customLocations.set(row[7], { group, offset });
  });
}

export class BankProblem extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function examFor(id: string): Exam | undefined {
  return examsById.get(id);
}

export function catalogFor(resume: string | null) {
  return { ...catalog, resume: resume && hasQuestion(resume) ? resume : null };
}

function questionId(group: ExamGroup, row: QuestionRow): string {
  return row[7] ?? (exams[group[0]].id + group[3] + String(row[0]).padStart(2, "0"));
}

function locate(id: string): Location | undefined {
  const custom = customLocations.get(id);
  if (custom) return custom;
  const parts = /^(.+?)(-q?)([0-9]{2,})$/.exec(id);
  if (!parts) return;
  const group = groupsById.get(parts[1]);
  if (!group || group[3] !== parts[2]) return;
  const number = Number(parts[3]);
  const offset = group[5].findIndex((row) => row[0] === number && questionId(group, row) === id);
  if (offset !== -1) return { group, offset };
}

function answersFor(row: QuestionRow): string[] {
  const answers = row[4];
  return typeof answers === "string" ? (answers ? [answers] : []) : answers;
}

export function hasQuestion(id: string): boolean {
  return locate(id) !== undefined;
}

export function questionMeta(id: string): QuestionMeta | undefined {
  const found = locate(id);
  if (!found) return;
  const { group, offset } = found;
  const exam = exams[group[0]];
  const row = group[5][offset];
  const answers = answersFor(row);
  return {
    id, number: row[0], examId: exam.id, year: exam.year, institute: exam.institute,
    role: exam.role, examTitle: exam.title, subject: facetValues[5][row[1]],
    keyStatus: statuses[row[3]], answer: row[6] === undefined ? answers[0] ?? null : row[6],
    answers, choiceCount: row[5],
  };
}

export function validChoice(id: string, choice: unknown): choice is string {
  const found = locate(id);
  if (!found || typeof choice !== "string" || choice.length !== 1) return false;
  return letters.slice(0, found.group[5][found.offset][5]).includes(choice);
}

function gradeRow(row: QuestionRow, choice: string): Grade {
  const keyStatus = statuses[row[3]];
  const answers = keyStatus === "annulled" || keyStatus === "pending" ? [] : answersFor(row);
  const result = answers.length === 0 ? "neutral" : answers.includes(choice) ? "correct" : "wrong";
  return { result, answers, accepted: answers, keyStatus };
}

export function grade(id: string, choice: string): Grade | undefined {
  const found = locate(id);
  if (found) return gradeRow(found.group[5][found.offset], choice);
}

let answerKeyJson: string | undefined;

// Keep the dashboard's SQL grading aligned with the correction shown in the caderno.
export function taeAnswerKeyJson(): string {
  if (answerKeyJson === undefined) {
    const answerKey = Object.create(null) as Record<string, string>;
    for (const group of groups) {
      for (const row of group[5]) {
        const { accepted } = gradeRow(row, "");
        if (accepted.length > 0) answerKey[questionId(group, row)] = accepted.join("");
      }
    }
    answerKeyJson = JSON.stringify(answerKey);
  }
  return answerKeyJson;
}

async function storedQuestion(bucket: StorageBucket, { group, offset }: Location): Promise<StoredQuestion> {
  const exam = exams[group[0]];
  const content = await readJson<StoredQuestion[]>(bucket, "bank/exams/" + exam.id + ".json");
  const item = content[offset];
  const row = group[5][offset];
  if (!item || item[0].id !== questionId(group, row)) {
    throw new Error("Índice de questões incompatível com o acervo.");
  }
  // The release in R2 keeps its source labels; show the same editorial labels as the filters.
  return [{ ...item[0], subject: facetValues[5][row[1]], topic: facetValues[6][row[2]] }, item[1]];
}

export async function getQuestion(bucket: StorageBucket, id: string): Promise<Question | undefined> {
  const found = locate(id);
  if (found) return (await storedQuestion(bucket, found))[0];
}

function feedbackFor(row: QuestionRow, sources: FeedbackSources, choice: string): Feedback {
  const { result, answers, keyStatus } = gradeRow(row, choice);
  return { choice, result, answers, keyStatus, ...sources };
}

export async function feedback(bucket: StorageBucket, id: string, choice: string): Promise<Feedback | undefined> {
  const found = locate(id);
  if (found) return feedbackFor(found.group[5][found.offset], (await storedQuestion(bucket, found))[1], choice);
}

function parameter(params: URLSearchParams, name: string): string {
  const raw = params.getAll(name).find(Boolean) ?? "";
  return raw.length <= 320 ? raw : Array.from(raw).slice(0, 320).join("");
}

function termsFor(text: string): string[] {
  const normalized = Array.from(text.normalize("NFKD"), (char) => casefold[char] ?? char.toLowerCase()).join("");
  return normalized.replace(combiningMarks, "").split(pythonWhitespace).filter(Boolean);
}

// R2 search shards retain the release's original wording. New editorial facet labels are
// searchable alongside those texts, so a rename takes effect without rewriting the archive.
const [searchRoles, searchSubjects, searchTopics] = [facetValues[1], facetValues[5], facetValues[6]]
  .map(labels => labels.map(label => termsFor(label).join(" ")));

function requestedIndex(params: URLSearchParams, total: number): number {
  const raw = parameter(params, "index").split(pythonWhitespace).filter(Boolean);
  if (raw.length !== 1) return 0;
  const integer = raw[0].replace(/\p{Decimal_Number}/gu, (char) => String(digits.indexOf(char) % 10));
  if (!/^[+-]?[0-9](?:_?[0-9])*$/.test(integer)) return 0;
  return Math.max(0, Math.min(Number(integer.replaceAll("_", "")), total - 1));
}

function modeRows(mode: string, latest: Map<string, string>, favorites: Set<string>): Set<QuestionRow> {
  const rows = new Set<QuestionRow>();
  if (!["new", "wrong", "saved"].includes(mode)) return rows;
  const ids = mode === "saved" ? favorites : latest.keys();
  for (const id of ids) {
    const found = locate(id);
    if (!found) continue;
    const row = found.group[5][found.offset];
    if (mode !== "wrong" || gradeRow(row, latest.get(id) ?? "").result === "wrong") rows.add(row);
  }
  return rows;
}

// -1 means all active filters match. -2 means more than one filter differs,
// so this record can't supply even an alternative value in the facets.
function mismatchedField(
  active: number[], values: readonly unknown[], start: number, end: number, valueOffset: number, mismatch = -1,
): number {
  for (let i = start; i < end; i++) {
    if (active[i] !== -1 && active[i] !== values[i - valueOffset]) {
      if (mismatch >= 0) return -2;
      mismatch = i;
    }
  }
  return mismatch;
}

function selectMetadata(
  params: URLSearchParams, latest: Map<string, string>, favorites: Set<string>,
): { candidates: Candidates[]; facets: Facets } {
  const active = facetNames.map((key, i) => {
    const value = parameter(params, key);
    if (!value) return -1;
    const code = facetValues[i].indexOf(value);
    // An unknown value differs from every row.
    return code === -1 ? -2 : code;
  });
  const present = facetValues.map((values) => new Uint8Array(values.length));
  const mode = parameter(params, "mode");
  const remembered = modeRows(mode, latest, favorites);
  const candidates: Candidates[] = [];
  for (const group of groups) {
    const examCodes = group[4];
    const examMismatch = mismatchedField(active, examCodes, 0, 5, 0);
    if (examMismatch === -2) continue;
    let canMarkExam = false;
    const offsets: number[] = [];
    for (let offset = 0; offset < group[5].length; offset++) {
      const row = group[5][offset];
      const mismatch = mismatchedField(active, row, 5, 8, 4, examMismatch);
      if (mismatch === -2) continue;
      if (mismatch < 5) canMarkExam = true;
      if (mismatch === -1) {
        present[5][row[1]] = present[6][row[2]] = present[7][row[3]] = 1;
        if (mode === "new" && remembered.has(row)) continue;
        if ((mode === "wrong" || mode === "saved") && !remembered.has(row)) continue;
        offsets.push(offset);
      } else if (mismatch >= 5) {
        present[mismatch][row[mismatch - 4] as number] = 1;
      }
    }
    if (canMarkExam) {
      for (let i = 0; i < examCodes.length; i++) {
        if (examMismatch < 0 || examMismatch === i) present[i][examCodes[i]] = 1;
      }
    }
    if (offsets.length) candidates.push({ group, offsets });
  }
  const facets = Object.fromEntries(facetNames.map((key, i) => [
    key, facetValues[i].filter((value, index) => value && present[i][index]),
  ])) as Facets;
  return { candidates, facets };
}

async function matchSearch(bucket: StorageBucket, candidates: Candidates[], terms: string[]) {
  const shards = new Map<number, Candidates[]>();
  for (const candidate of candidates) {
    const shard = candidate.group[1];
    const entries = shards.get(shard);
    if (entries) entries.push(candidate);
    else shards.set(shard, [candidate]);
  }
  const entries = [...shards];
  // Bound simultaneous R2 operations and discard each shard after its comparisons.
  for (let first = 0; first < entries.length; first += 4) {
    await Promise.all(entries.slice(first, first + 4).map(async ([shard, shardCandidates]) => {
      const texts = await readJson<string[]>(bucket, "bank/search/" + shard + ".json");
      for (const candidate of shardCandidates) {
        const { group } = candidate;
        const role = searchRoles[group[4][1]];
        candidate.offsets = candidate.offsets.filter(offset => {
          const row = group[5][offset];
          const original = texts[group[2] + offset];
          return terms.every(term => original.includes(term) || role.includes(term) ||
            searchSubjects[row[1]].includes(term) || searchTopics[row[2]].includes(term));
        });
      }
    }));
  }
}

function orderedSelection(candidates: Candidates[], latest: Map<string, string>, prioritize: boolean) {
  const total = candidates.reduce((count, candidate) => count + candidate.offsets.length, 0);
  if (!latest.size) return { ordered: candidates, total, unanswered: total };

  const pending: Candidates[] = [];
  const review: Candidates[] = [];
  let unanswered = total;
  for (const { group, offsets } of candidates) {
    const fresh: number[] = [], seen: number[] = [];
    for (const offset of offsets) {
      if (latest.has(questionId(group, group[5][offset]))) {
        unanswered--;
        if (prioritize) seen.push(offset);
      } else if (prioritize) fresh.push(offset);
    }
    if (fresh.length) pending.push({ group, offsets: fresh });
    if (seen.length) review.push({ group, offsets: seen });
  }
  return { ordered: prioritize ? pending.concat(review) : candidates, total, unanswered };
}

function positionOf(ordered: Candidates[], location: Location | undefined) {
  if (!location) return -1;
  let before = 0;
  for (const { group, offsets } of ordered) {
    if (group === location.group) {
      const position = offsets.indexOf(location.offset);
      if (position >= 0) return before + position;
    }
    before += offsets.length;
  }
  return -1;
}

function locationAt(ordered: Candidates[], index: number): Location {
  for (const { group, offsets } of ordered) {
    if (index < offsets.length) return { group, offset: offsets[index] };
    index -= offsets.length;
  }
  throw new Error("Seleção de questões incompatível com o acervo.");
}

export async function practice(
  bucket: StorageBucket, params: URLSearchParams, latest: Map<string, string>, favorites: Set<string>,
) {
  const { candidates, facets } = selectMetadata(params, latest, favorites);
  const terms = termsFor(parameter(params, "q"));
  if (terms.length) await matchSearch(bucket, candidates, terms);
  const random = parameter(params, "random") === "1";
  const requested = parameter(params, "id");
  const prioritize = latest.size > 0 && (!requested || random) && parameter(params, "mode") !== "wrong";
  const { ordered, total, unanswered } = orderedSelection(candidates, latest, prioritize);
  if (!total) return { total, unanswered, facets, question: null };

  let index = requestedIndex(params, total);
  const afterAnswer = parameter(params, "afterAnswer");
  const position = positionOf(ordered, locate(requested || afterAnswer));
  if (random) {
    // A random draw also prefers unseen questions. Always offer a different card when possible.
    const pool = prioritize && unanswered && !(unanswered === 1 && position === 0) ? unanswered : total;
    const draw = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    index = position >= 0 && position < pool && pool > 1
      ? (position + 1 + Math.floor(draw * (pool - 1))) % pool
      : Math.floor(draw * pool);
  } else if (requested) {
    if (position < 0) throw new BankProblem(404, "A questão não faz parte desta seleção.");
    index = position;
  } else if (prioritize && latest.has(afterAnswer)) {
    // The displayed card just left its slot. Its successor now occupies that slot.
    // At the end of the fresh block, wrap to remaining unseen work or start the review.
    if (unanswered) {
      const nextSlot = requestedIndex(params, unanswered + 1);
      index = nextSlot < unanswered ? nextSlot : 0;
    } else index = position === 0 && total > 1 ? 1 : 0;
  }

  const location = locationAt(ordered, index);
  const [question, sources] = await storedQuestion(bucket, location);
  const last = latest.get(question.id);
  return {
    total, unanswered, index, facets, question, saved: favorites.has(question.id),
    previous: last === undefined ? null : feedbackFor(location.group[5][location.offset], sources, last),
  };
}
