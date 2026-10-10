import { env } from 'cloudflare:workers';
import { cache } from 'react';
import type { Post, PostSummary } from '@/app/blog/blog-api';

export const runtimeBlog = true;

function database() {
  return (env as unknown as { DB: D1Database }).DB;
}

// Read only published content. Identity and visitor interactions stay in the API.
export const getInitialPosts = cache(async (): Promise<PostSummary[]> => {
  const result = await database().prepare("SELECT id, title, summary, published_at, updated_at FROM blog_posts WHERE status='published' ORDER BY published_at DESC LIMIT 200").all<PostSummary>();
  return result.results;
});

export const getInitialPost = cache(async (id: string): Promise<Post | null> => {
  return database().prepare("SELECT id, title, summary, content, status, published_at, updated_at FROM blog_posts WHERE id=? AND status='published'").bind(id).first<Post>();
});
