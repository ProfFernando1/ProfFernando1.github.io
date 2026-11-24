import type { D1Database } from '@cloudflare/workers-types';

type RequestHeaders = { get(name: string): string | null };
type StudyBank = 'tae' | 'enem' | 'pss';

export function studySubject(headers: RequestHeaders) {
  // The Sites dispatcher provides a stable, site-scoped ID after sign-in.
  const subject = headers.get('oai-authenticated-user-id')?.trim();
  return subject && subject.length <= 256 ? subject : null;
}

export function isStudyPanelOwner(headers: RequestHeaders, ownerEmail?: string) {
  if (!studySubject(headers)) return false;
  const email = headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  const owner = ownerEmail?.trim().toLowerCase();
  return Boolean(email && owner && email === owner);
}

export function studyDisplayName(headers: RequestHeaders) {
  let name = headers.get('oai-authenticated-user-full-name');
  if (!name) return null;
  if (headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try {
      name = decodeURIComponent(name);
    } catch {
      return null;
    }
  }
  name = name.replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  return Array.from(name).slice(0, 120).join('') || null;
}

export async function studyProfileKey(subject: string) {
  const bytes = new TextEncoder().encode(`study-account\0${subject}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function getStudyAccount(
  db: D1Database,
  subject: string,
  create = false,
  displayName: string | null = null,
) {
  const key = await studyProfileKey(subject);
  if (!create) {
    const row = await db.prepare('SELECT id FROM study_accounts WHERE subject = ?').bind(key).first<{ id: number }>();
    return row?.id ?? null;
  }

  const row = await studyAccountUpsert(db, key, displayName).first<{ id: number }>();
  if (!row) throw new Error('Não foi possível registrar o perfil de estudo.');
  return row.id;
}

function studyAccountUpsert(db: D1Database, key: string, displayName: string | null) {
  return db.prepare(`
    INSERT INTO study_accounts (subject, display_name, created) VALUES (?, ?, ?)
    ON CONFLICT (subject) DO UPDATE SET display_name = COALESCE(excluded.display_name, study_accounts.display_name)
    RETURNING id
  `).bind(key, displayName, Math.floor(Date.now() / 1000));
}

export async function registerStudyBankVisit(
  db: D1Database,
  subject: string,
  bank: StudyBank,
  displayName: string | null = null,
) {
  const key = await studyProfileKey(subject);
  await db.batch([
    studyAccountUpsert(db, key, displayName),
    db.prepare(`
      INSERT INTO study_bank_visits (profile, bank, opened)
      SELECT id, ?, ? FROM study_accounts WHERE subject = ?
      ON CONFLICT(profile, bank) DO NOTHING
    `).bind(bank, Math.floor(Date.now() / 1000), key),
  ]);
}
