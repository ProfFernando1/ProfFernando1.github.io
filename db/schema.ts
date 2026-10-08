import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
