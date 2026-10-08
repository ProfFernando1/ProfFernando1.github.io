'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTHOR_URL } from '@/lib/blog-config';
import { api, date, errorText, visitorId, type Post, type Detail } from './blog-api';

export function TextContent({ content }: { content: string }) {
  return <div className="blog-prose">{content.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>;
}

export default function BlogClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [owner, setOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState('');
  const [editing, setEditing] = useState('');
  const [editText, setEditText] = useState('');
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError(''); setDetail(null);
    try {
      const id = new URLSearchParams(window.location.search).get('texto');
      if (id) {
        const result = await api<Detail>(`posts/${encodeURIComponent(id)}?visitor=${visitorId()}`);
        if (current === generation.current) setDetail(result);
      } else {
        const result = await api<{ posts: Post[] }>('posts');
        if (current === generation.current) setPosts(result.posts);
      }
      const session = await api<{ owner: boolean }>('session');
      if (current === generation.current) setOwner(session.owner);
    } catch (error) { if (current === generation.current) setError(errorText(error)); }
    finally { if (current === generation.current) setLoading(false); }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
    window.addEventListener('popstate', load);
    return () => window.removeEventListener('popstate', load);
  }, [load]);

  async function navigate(id?: string) {
    window.history.pushState({}, '', id ? `/blog/?texto=${encodeURIComponent(id)}` : '/blog/');
    setNotice(''); setComment(''); setEditing(''); await load(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function react(value: number) {
    if (!detail) return; setBusy(true); setError('');
    try {
      const result = await api<{ reactions: Detail['reactions']; myReaction: number }>(`posts/${detail.post.id}/reaction`, 'POST', { value: detail.myReaction === value ? 0 : value, visitorId: visitorId() });
      setDetail(current => current?.post.id === detail.post.id ? { ...current, ...result } : current);
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }

  async function sendComment(event: React.FormEvent) {
    event.preventDefault(); if (!detail) return; setBusy(true); setError(''); setNotice('');
    try {
      await api(`posts/${detail.post.id}/comments`, 'POST', { name, content: comment, website, visitorId: visitorId() });
      setComment(''); setNotice('Comentário publicado.'); await load();
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }

  async function moderate(id: string, method: 'DELETE' | 'PATCH') {
    if (method === 'DELETE' && !window.confirm('Excluir este comentário?')) return;
    setBusy(true); setError('');
    try { await api(`admin/comments/${id}`, method, method === 'PATCH' ? { content: editText } : undefined); setEditing(''); await load(); setNotice(method === 'DELETE' ? 'Comentário excluído.' : 'Comentário atualizado.'); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }

  return <>
    <div className="blog-heading"><p className="eyebrow">Fernando Coelho · Escrita pessoal</p><h1>Blog</h1><p>Textos e ideias para compartilhar e conversar.</p>{owner && <a className="blog-button" href={AUTHOR_URL}>Gerenciar meus textos ↗</a>}</div>
    {error && <div className="blog-message blog-error" role="alert">{error} <button onClick={load} type="button">Tentar novamente</button></div>}
    {notice && <p className="blog-message" role="status">{notice}</p>}
    {loading && <p role="status" className="blog-muted">Carregando textos…</p>}
    {!loading && !error && !detail && (posts.length ? <div className="blog-feed">{posts.map(post => <article key={post.id} className="blog-entry"><time dateTime={post.published_at || ''}>{date(post.published_at)}</time><h2><a href={`?texto=${post.id}`} onClick={e => { e.preventDefault(); void navigate(post.id); }}>{post.title}</a></h2>{post.summary && <p>{post.summary}</p>}<a className="text-link" href={`?texto=${post.id}`} onClick={e => { e.preventDefault(); void navigate(post.id); }}>Ler texto <span aria-hidden="true">→</span></a></article>)}</div> : <div className="blog-empty"><span aria-hidden="true">✎</span><h2>Nenhum texto publicado ainda.</h2><p>As próximas publicações de Fernando aparecerão aqui.</p></div>)}
    {!loading && detail && <>
      <button className="blog-back" disabled={busy} onClick={() => navigate()} type="button">← Todos os textos</button>
      <article className="blog-article"><header><time dateTime={detail.post.published_at || ''}>{date(detail.post.published_at)}</time><h2>{detail.post.title}</h2><p className="blog-byline">Por Fernando Coelho</p>{detail.post.summary && <p className="blog-summary">{detail.post.summary}</p>}</header><TextContent content={detail.post.content} />
        <div className="blog-reactions" aria-label="Reagir ao texto"><button disabled={busy} type="button" aria-pressed={detail.myReaction === 1} onClick={() => react(1)}>Curtir <span>{detail.reactions.likes}</span></button><button disabled={busy} type="button" aria-pressed={detail.myReaction === -1} onClick={() => react(-1)}>Descurtir <span>{detail.reactions.dislikes}</span></button></div>
      </article>
      <section className="blog-comments" aria-labelledby="comments-title"><h2 id="comments-title">Comentários <span className="blog-muted">({detail.comments.length})</span></h2>
        {detail.comments.length === 0 && <p className="blog-muted">Seja a primeira pessoa a comentar.</p>}
        <ol>{detail.comments.map(item => <li key={item.id}><div className="blog-comment-meta"><strong>{item.name}</strong><time dateTime={item.created_at}>{date(item.created_at)}</time></div>{editing === item.id ? <form onSubmit={e => { e.preventDefault(); void moderate(item.id, 'PATCH'); }}><label htmlFor={`edit-${item.id}`}>Editar comentário</label><textarea id={`edit-${item.id}`} required maxLength={3000} value={editText} onChange={e => setEditText(e.target.value)} /><div className="blog-actions"><button disabled={busy} type="submit">Salvar alteração</button><button type="button" onClick={() => setEditing('')}>Cancelar</button></div></form> : <p className="blog-comment-text">{item.content}</p>}{item.updated_at !== item.created_at && <small className="blog-muted">Editado pelo autor do blog</small>}{owner && editing !== item.id && <div className="blog-actions"><button type="button" disabled={busy} onClick={() => { setEditing(item.id); setEditText(item.content); }}>Editar</button><button type="button" className="blog-danger" disabled={busy} onClick={() => moderate(item.id, 'DELETE')}>Excluir</button></div>}</li>)}</ol>
        <form className="blog-comment-form" onSubmit={sendComment}><h3>Deixe seu comentário</h3><p className="blog-muted">Seu nome e comentário ficarão públicos. O autor pode editar ou excluir comentários.</p><label htmlFor="comment-name">Seu nome</label><input id="comment-name" autoComplete="name" maxLength={100} required value={name} onChange={e => setName(e.target.value)} /><label htmlFor="comment-content">Comentário</label><textarea id="comment-content" maxLength={3000} required rows={5} value={comment} onChange={e => setComment(e.target.value)} /><div className="blog-honeypot" aria-hidden="true"><label htmlFor="comment-website">Website</label><input id="comment-website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></div><button className="blog-button" disabled={busy} type="submit">{busy ? 'Enviando…' : 'Publicar comentário'}</button></form>
      </section>
    </>}
  </>;
}
