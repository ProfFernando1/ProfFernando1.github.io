import { BLOG_API } from '@/lib/blog-config';

export type Post = { id: string; title: string; summary: string; content: string; status: 'draft' | 'published'; published_at: string | null; updated_at: string };
export type PostSummary = Pick<Post, 'id' | 'title' | 'summary' | 'published_at' | 'updated_at'>;
export type Comment = { id: string; name: string; content: string; created_at: string; updated_at: string };
export type Detail = { post: Post; comments: Comment[]; reactions: { likes: number; dislikes: number }; myReaction: number };

function apiBase() {
  return window.location.hostname === 'localhost' ? '/api/blog' : BLOG_API;
}

export function usesSameOriginApi() {
  return new URL(apiBase(), window.location.origin).origin === window.location.origin;
}

export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const base = apiBase();
  const response = await fetch(`${base}/${path}`, {
    method, credentials: 'same-origin', headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir. Tente novamente.');
  return result as T;
}

let transientVisitor: string | undefined;
export function visitorId() {
  try {
    const saved = localStorage.getItem('fernando-blog-visitor');
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    const id = crypto.randomUUID(); localStorage.setItem('fernando-blog-visitor', id); return id;
  } catch { return transientVisitor ??= crypto.randomUUID(); }
}

export function date(value: string | null) {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : '';
}

export function errorText(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.'; }
