import type { D1Database } from '@cloudflare/workers-types';
import { grade, questionMeta } from './bank';

const SECONDS_PER_DAY = 24 * 60 * 60;
const REPORT_DAYS = 14;
const PAGE_SIZE = 24;
const rules = { unique: 10, correct: 5, day: 3, level: 250 };
const milestones = [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const saoPaulo = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

type Result = NonNullable<ReturnType<typeof grade>>['result'];
type Counts = Record<Result, number>;
type Breakdown = Map<string, Counts>;
type ChoiceRow = { question: string; choice: string };
export type HistoryRow = ChoiceRow & { total: number; id: number; choices: string };
export type UtcDayRow = { first: number; last: number };
type SavedRow = { saved: number };
type DailyRow = ChoiceRow & { day: number; total: number };
type RecentRow = ChoiceRow & { ts: number };

function emptyCounts(): Counts {
  return { correct: 0, wrong: 0, neutral: 0 };
}

function addToBreakdown(breakdown: Breakdown, name: string, result: Result) {
  const counts = breakdown.get(name) ?? emptyCounts();
  counts[result]++;
  breakdown.set(name, counts);
}

function total(counts: Counts) {
  return counts.correct + counts.wrong + counts.neutral;
}

function ranked(breakdown: Breakdown) {
  return Array.from(breakdown, ([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => total(b) - total(a) || (a.name < b.name ? -1 : Number(a.name > b.name)));
}

function localDate(seconds: number) {
  const parts = saoPaulo.formatToParts(seconds * 1000);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function progressStatements(db: D1Database, uid: number) {
  return [
    db.prepare(`
      WITH latest AS (
        SELECT MAX(id) AS id, COUNT(*) AS total, GROUP_CONCAT(DISTINCT choice) AS choices
        FROM study_tae_attempts WHERE profile = ? GROUP BY question
      )
      SELECT a.id, a.question, a.choice, latest.total, latest.choices
      FROM latest JOIN study_tae_attempts a ON a.id = latest.id
    `).bind(uid),
    // In São Paulo one UTC date can contain two local dates. Its earliest and latest
    // attempts identify both, including historical changes in the UTC offset.
    db.prepare(`
      SELECT MIN(ts) AS first, MAX(ts) AS last FROM study_tae_attempts
      WHERE profile = ? GROUP BY CAST(ts / 86400 AS INTEGER)
    `).bind(uid),
  ];
}

export function summarizeProgress(questions: HistoryRow[], utcDays: UtcDayRow[]) {
  const unique = questions.length;
  let mastered = 0;
  for (const row of questions) {
    const accepted = grade(row.question, '')?.accepted;
    if (accepted?.length && row.choices.split(',').some(choice => accepted.includes(choice))) mastered++;
  }
  const days = new Set<string>();
  for (const { first, last } of utcDays) {
    days.add(localDate(first));
    if (last !== first) days.add(localDate(last));
  }
  const studyDays = days.size;
  const xp = unique * rules.unique + mastered * rules.correct + studyDays * rules.day;
  const level = 1 + Math.floor(xp / rules.level);
  return { unique, mastered, studyDays, xp, level, levelFloor: (level - 1) * rules.level,
    nextLevelXp: level * rules.level, milestones, rules };
}

function localDayStart(utcMidnight: number) {
  const wanted = new Date(utcMidnight * 1000).toISOString().slice(0, 10);
  const standardMidnight = utcMidnight + 3 * 60 * 60;
  if (localDate(standardMidnight) === wanted && localDate(standardMidnight - 1) < wanted) {
    return standardMidnight;
  }
  // A historical daylight-saving transition can skip midnight in São Paulo.
  let low = utcMidnight - SECONDS_PER_DAY;
  let high = utcMidnight + SECONDS_PER_DAY;
  while (high > low) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(middle) < wanted) low = middle + 1;
    else high = middle;
  }
  return low;
}

function reportDates() {
  const today = Date.parse(localDate(Date.now() / 1000) + 'T00:00:00Z') / 1000;
  const dates = Array.from({ length: REPORT_DAYS + 1 }, (_, index) => {
    const midnight = today + (index - REPORT_DAYS + 1) * SECONDS_PER_DAY;
    return localDayStart(midnight);
  });
  return {
    days: dates.slice(0, -1).map(start => ({ day: localDate(start), ...emptyCounts() })),
    ranges: dates.slice(0, -1).map((start, index) => [start, dates[index + 1]]),
  };
}

export async function performance(db: D1Database, uid: number | null, offset = 0) {
  const reportOffset = Number.isFinite(offset) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(offset))) : 0;
  const { days, ranges } = reportDates();
  if (uid === null) return {
    unique: 0, attempts: 0, graded: 0, ...emptyCounts(), saved: 0, days,
    progress: summarizeProgress([], []),
    subjects: [], institutes: [], roles: [], recent: [], hasMore: false,
  };
  const [latest, activity, favorites] = await db.batch([
    ...progressStatements(db, uid),
    db.prepare('SELECT COUNT(*) AS saved FROM study_tae_saved WHERE profile = ?').bind(uid),
  ]);
  const questions = latest.results as HistoryRow[];
  const progress = summarizeProgress(questions, activity.results as UtcDayRow[]);
  let lastId = 0;
  let attempts = 0;
  let unique = 0;
  const unavailable = [];
  const counts = emptyCounts();
  const subjects: Breakdown = new Map();
  const institutes: Breakdown = new Map();
  const roles: Breakdown = new Map();
  for (const row of questions) {
    lastId = Math.max(lastId, row.id);
    const q = questionMeta(row.question);
    const feedback = grade(row.question, row.choice);
    if (!q || !feedback) {
      unavailable.push(row.question);
      continue;
    }
    attempts += row.total;
    unique++;
    counts[feedback.result]++;
    addToBreakdown(subjects, q.subject, feedback.result);
    addToBreakdown(institutes, q.institute, feedback.result);
    addToBreakdown(roles, q.role, feedback.result);
  }

  // Both follow-up queries stay within the history read by the first batch.
  const [daily, history] = await Promise.all([
    db.prepare(`
      WITH days AS (
        SELECT key AS day, json_extract(value, '$[0]') AS starts, json_extract(value, '$[1]') AS ends
        FROM json_each(?)
      )
      SELECT d.day, a.question, a.choice, COUNT(*) AS total
      FROM days d CROSS JOIN study_tae_attempts a
      WHERE a.profile = ? AND a.ts >= d.starts AND a.ts < d.ends AND a.id <= ?
      GROUP BY d.day, a.question, a.choice
    `).bind(JSON.stringify(ranges), uid, lastId).all<DailyRow>(),
    db.prepare(`
      SELECT question, choice, ts FROM study_tae_attempts
      WHERE profile = ? AND id <= ? AND question NOT IN (SELECT value FROM json_each(?))
      ORDER BY id DESC LIMIT ? OFFSET ?
    `).bind(uid, lastId, JSON.stringify(unavailable), PAGE_SIZE, reportOffset).all<RecentRow>(),
  ]);

  for (const row of daily.results) {
    const feedback = grade(row.question, row.choice);
    if (feedback) days[row.day][feedback.result] += row.total;
  }

  const recent = history.results.flatMap(row => {
    const q = questionMeta(row.question);
    const feedback = grade(row.question, row.choice);
    if (!q || !feedback) return [];
    return [{
      question: q.id, number: q.number, exam: q.examTitle, institute: q.institute, year: q.year,
      role: q.role, subject: q.subject, when: row.ts, choice: row.choice,
      result: feedback.result, keyStatus: feedback.keyStatus,
    }];
  });
  const saved = favorites.results[0] as SavedRow;
  return {
    unique, attempts, graded: counts.correct + counts.wrong, ...counts, saved: saved.saved, progress,
    days, subjects: ranked(subjects), institutes: ranked(institutes), roles: ranked(roles),
    recent, hasMore: reportOffset + recent.length < attempts,
  };
}
