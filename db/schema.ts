import { index, integer, primaryKey, uniqueIndex, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('blog_posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  summary: text('summary').notNull().default(''),
  content: text('content').notNull(),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  publishedAt: text('published_at'),
}, t => [index('idx_blog_posts_status_date').on(t.status, t.publishedAt)]);

export const comments = sqliteTable('blog_comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [index('idx_blog_comments_post_date').on(t.postId, t.createdAt)]);

export const reactions = sqliteTable('blog_reactions', {
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  visitorId: text('visitor_id').notNull(),
  value: integer('value').notNull(),
}, t => [primaryKey({ columns: [t.postId, t.visitorId] })]);

export const limits = sqliteTable('blog_limits', {
  id: text('id').primaryKey(),
  window: integer('window').notNull(),
  hits: integer('hits').notNull(),
});

export const taeProfiles = sqliteTable('tae_profiles', {
  id: integer('id').primaryKey(),
  username: text('username').notNull().unique(),
  display: text('display').notNull(),
  created: integer('created').notNull(),
});

export const taeSessions = sqliteTable('tae_sessions', {
  digest: text('digest').notNull().primaryKey(),
  profile: integer('profile').notNull().references(() => taeProfiles.id, { onDelete: 'cascade' }),
  expires: integer('expires').notNull(),
}, t => [
  index('idx_tae_sessions_expires').on(t.expires),
  index('idx_tae_sessions_profile').on(t.profile),
]);

export const taeAttempts = sqliteTable('tae_attempts', {
  id: integer('id').primaryKey(),
  profile: integer('profile').notNull().references(() => taeProfiles.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  choice: text('choice').notNull(),
  ts: integer('ts').notNull(),
  requestKey: text('request_key').notNull(),
}, t => [
  uniqueIndex('idx_tae_attempts_profile_request').on(t.profile, t.requestKey),
  index('idx_tae_attempts_profile_question').on(t.profile, t.question, t.id),
  index('idx_tae_attempts_profile_recent').on(t.profile, t.id),
  index('idx_tae_attempts_profile_time').on(t.profile, t.ts),
]);

export const taeSaved = sqliteTable('tae_saved', {
  profile: integer('profile').notNull().references(() => taeProfiles.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
}, t => [primaryKey({ columns: [t.profile, t.question] })]);

export const taeLoginLimits = sqliteTable('tae_login_limits', {
  client: text('client').notNull().primaryKey(),
  failures: integer('failures').notNull(),
  expires: integer('expires').notNull(),
}, t => [index('idx_tae_login_limits_expires').on(t.expires)]);

export const studyAccounts = sqliteTable('study_accounts', {
  id: integer('id').primaryKey(),
  subject: text('subject').notNull().unique(),
  displayName: text('display_name'),
  created: integer('created').notNull(),
});

export const studyBankVisits = sqliteTable('study_bank_visits', {
  profile: integer('profile').notNull().references(() => studyAccounts.id, { onDelete: 'cascade' }),
  bank: text('bank', { enum: ['tae', 'enem', 'pss'] }).notNull(),
  opened: integer('opened').notNull(),
}, t => [
  primaryKey({ columns: [t.profile, t.bank] }),
  index('idx_study_bank_visits_bank_profile').on(t.bank, t.profile),
]);

export const studyAttempts = sqliteTable('study_attempts', {
  id: integer('id').primaryKey(),
  bank: text('bank', { enum: ['enem', 'pss'] }).notNull(),
  profile: integer('profile').notNull().references(() => studyAccounts.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  choice: text('choice').notNull(),
  correct: integer('correct').notNull(),
  ts: integer('ts').notNull(),
  requestKey: text('request_key').notNull(),
  active: integer('active').notNull().default(1),
}, t => [
  uniqueIndex('idx_study_attempts_profile_bank_request').on(t.profile, t.bank, t.requestKey),
  index('idx_study_attempts_profile_bank_question').on(t.profile, t.bank, t.question, t.id),
]);

export const studyFavorites = sqliteTable('study_favorites', {
  profile: integer('profile').notNull().references(() => studyAccounts.id, { onDelete: 'cascade' }),
  bank: text('bank', { enum: ['enem', 'pss'] }).notNull(),
  question: text('question').notNull(),
}, t => [primaryKey({ columns: [t.profile, t.bank, t.question] })]);

export const studyCursors = sqliteTable('study_cursors', {
  profile: integer('profile').notNull().references(() => studyAccounts.id, { onDelete: 'cascade' }),
  bank: text('bank', { enum: ['enem', 'pss'] }).notNull(),
  question: text('question'),
  filters: text('filters'),
}, t => [primaryKey({ columns: [t.profile, t.bank] })]);

export const studyTaeAttempts = sqliteTable('study_tae_attempts', {
  id: integer('id').primaryKey(),
  profile: integer('profile').notNull().references(() => studyAccounts.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  choice: text('choice').notNull(),
  ts: integer('ts').notNull(),
  requestKey: text('request_key').notNull(),
}, t => [
  uniqueIndex('idx_study_tae_attempts_profile_request').on(t.profile, t.requestKey),
  index('idx_study_tae_attempts_profile_question').on(t.profile, t.question, t.id),
  index('idx_study_tae_attempts_profile_recent').on(t.profile, t.id),
  index('idx_study_tae_attempts_profile_time').on(t.profile, t.ts),
]);

export const studyTaeSaved = sqliteTable('study_tae_saved', {
  profile: integer('profile').notNull().references(() => studyAccounts.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
}, t => [primaryKey({ columns: [t.profile, t.question] })]);
