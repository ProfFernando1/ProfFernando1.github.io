import type { D1Database } from '@cloudflare/workers-types';
import { questionMeta } from './bank';
import { progressStatements, summarizeProgress, type HistoryRow, type UtcDayRow } from './performance';

export class TaeProblem extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Answer = { question: string; choice: string; firstForQuestion: number };
type SnapshotRow = { kind: 'latest' | 'saved' | 'resume'; question: string; choice: string | null };

export class Profiles {
  constructor(private readonly db: D1Database) {}

  async overview(uid: number | null) {
    if (uid === null) return { resume: null, progress: summarizeProgress([], []) };
    const [history, activity] = await this.db.batch(progressStatements(this.db, uid));
    const questions = history.results as HistoryRow[];
    let latest: HistoryRow | undefined;
    for (const row of questions) {
      if (!latest || row.id > latest.id) latest = row;
    }
    return { resume: latest?.question ?? null, progress: summarizeProgress(questions, activity.results as UtcDayRow[]) };
  }

  async snapshot(uid: number | null) {
    const latest = new Map<string, string>();
    const favorites = new Set<string>();
    let resume: string | null = null;
    if (uid === null) return { latest, favorites, resume };

    const { results } = await this.db.prepare(`
      WITH latest AS (
        SELECT MAX(id) AS id FROM study_tae_attempts WHERE profile = ? GROUP BY question
      ), resume AS (
        SELECT question FROM study_tae_attempts WHERE profile = ? ORDER BY id DESC LIMIT 1
      )
      SELECT 'latest' AS kind, a.question, a.choice FROM latest JOIN study_tae_attempts a ON a.id = latest.id
      UNION ALL
      SELECT 'saved', question, NULL FROM study_tae_saved WHERE profile = ?
      UNION ALL
      SELECT 'resume', question, NULL FROM resume
    `).bind(uid, uid, uid).all<SnapshotRow>();
    for (const row of results) {
      if (row.kind === 'latest' && row.choice !== null) latest.set(row.question, row.choice);
      if (row.kind === 'saved') favorites.add(row.question);
      if (row.kind === 'resume' && questionMeta(row.question)) resume = row.question;
    }
    return { latest, favorites, resume };
  }

  async save(uid: number, question: string, saved: boolean) {
    const statement = saved
      ? 'INSERT INTO study_tae_saved (profile, question) VALUES (?, ?) ON CONFLICT (profile, question) DO NOTHING'
      : 'DELETE FROM study_tae_saved WHERE profile = ? AND question = ?';
    await this.db.prepare(statement).bind(uid, question).run();
    return { saved };
  }

  async record(uid: number, question: string, choice: string, requestKey: string) {
    const key = requestKey.toLowerCase();
    const [inserted, saved, history, activity] = await this.db.batch([
      this.db.prepare(`
        INSERT INTO study_tae_attempts (profile, question, choice, ts, request_key) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (profile, request_key) DO NOTHING RETURNING id
      `).bind(uid, question, choice, Math.floor(Date.now() / 1000), key),
      this.db.prepare(`
        SELECT a.question, a.choice, NOT EXISTS (
          SELECT 1 FROM study_tae_attempts earlier
          WHERE earlier.profile = a.profile AND earlier.question = a.question AND earlier.id < a.id
        ) AS firstForQuestion
        FROM study_tae_attempts a WHERE a.profile = ? AND a.request_key = ?
      `).bind(uid, key),
      ...progressStatements(this.db, uid),
    ]);
    const original = saved.results[0] as Answer;
    if (original.question !== question || original.choice !== choice) {
      throw new TaeProblem(400, 'Essa resposta já foi registrada. Recarregue a questão.');
    }
    const progress = summarizeProgress(history.results as HistoryRow[], activity.results as UtcDayRow[]);
    const unlocked = inserted.results.length && original.firstForQuestion && progress.milestones.includes(progress.unique)
      ? progress.unique : null;
    return { progress, unlocked };
  }
}
