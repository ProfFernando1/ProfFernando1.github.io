'use client';

import { useCallback, useEffect, useState } from 'react';
import { AUTHOR_URL, BLOG_ORIGIN } from '@/lib/blog-config';
import { api, date, errorText, type Post } from '../blog-api';
import { TextContent } from '../blog-client';

const empty = { id: '', title: '', summary: '', content: '', status: 'draft' as 'draft' | 'published' };

export default function AuthorClient() {
  const [owner, setOwner] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const session = await api<{ owner: boolean }>('session'); setOwner(session.owner);
      if (session.owner) setPosts((await api<{ posts: Post[] }>('admin/posts')).posts);
    } catch (error) { setError(errorText(error)); }
  }, []);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function choose(post?: Post) {
    if (dirty && !window.confirm('Descartar as alterações ainda não salvas?')) return;
    setDraft(post ? { ...post } : { ...empty }); setDirty(false); setPreview(false); setMessage(''); setError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<{ id: string }>(draft.id ? `admin/posts/${draft.id}` : 'admin/posts', draft.id ? 'PATCH' : 'POST', draft);
      setDraft({ ...draft, id: result.id }); setDirty(false); await refresh(); setMessage(draft.status === 'published' ? 'Texto publicado. Já está disponível no blog.' : 'Rascunho salvo. Somente você pode vê-lo.');
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  async function remove(post: Post) {
    if (!window.confirm(`Excluir “${post.title}” e seus comentários e reações?`)) return;
    setBusy(true); setError('');
    try { await api(`admin/posts/${post.id}`, 'DELETE'); if (draft.id === post.id) { setDraft({ ...empty }); setDirty(false); } await refresh(); setMessage('Texto excluído.'); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  function update(key: 'title' | 'summary' | 'content' | 'status', value: string) { setDraft({ ...draft, [key]: value }); setDirty(true); }
  return <>
    <div className="blog-heading"><p className="eyebrow">Blog pessoal</p><h1>Área do autor</h1><p>Escreva, revise e publique seus textos.</p></div>
    {error && <p className="blog-message blog-error" role="alert">{error}</p>}
    {message && <p className="blog-message" role="status">{message}</p>}
    {owner === null && !error && <p role="status">Conferindo acesso…</p>}
    {owner === false && <div className="blog-empty"><h2>Acesso reservado a Fernando.</h2><p>Entre com a conta ChatGPT proprietária desta página para editar textos e moderar comentários.</p><a className="blog-button" href={`${BLOG_ORIGIN}/signin-with-chatgpt?return_to=${encodeURIComponent('/blog/autor/')}`} target="_top">Entrar com ChatGPT ↗</a></div>}
    {owner && <div className="blog-author-grid"><aside className="blog-author-list"><button className="blog-button" disabled={busy} type="button" onClick={() => choose()}>+ Novo texto</button><h2>Meus textos</h2>{!posts.length && <p className="blog-muted">Seus rascunhos e publicações aparecerão aqui.</p>}<ul>{posts.map(post => <li key={post.id}><button className="blog-select" type="button" disabled={busy} aria-pressed={draft.id === post.id} onClick={() => choose(post)}><strong>{post.title}</strong><span>{post.status === 'published' ? 'Publicado' : 'Rascunho'} · {date(post.updated_at)}</span></button>{post.status === 'published' && <a className="text-link" href={`${BLOG_ORIGIN}/blog/?texto=${post.id}`}>Ler e moderar comentários ↗</a>}<button className="blog-danger" disabled={busy} type="button" onClick={() => remove(post)}>Excluir texto</button></li>)}</ul><a className="text-link" href={`${BLOG_ORIGIN}/signout-with-chatgpt?return_to=${encodeURIComponent('/blog/')}`} target="_top">Sair da conta</a></aside>
      <div className="blog-editor"><form onSubmit={save}><fieldset disabled={busy}><h2>{draft.id ? 'Editar texto' : 'Novo texto'}</h2><label htmlFor="post-title">Título</label><input id="post-title" required maxLength={240} value={draft.title} onChange={e => update('title', e.target.value)} /><label htmlFor="post-summary">Resumo <span className="blog-muted">(opcional)</span></label><textarea id="post-summary" rows={3} maxLength={600} value={draft.summary} onChange={e => update('summary', e.target.value)} /><label htmlFor="post-content">Texto</label><p className="blog-muted">Separe os parágrafos com uma linha em branco.</p><textarea className="blog-text-editor" id="post-content" rows={18} required maxLength={200000} value={draft.content} onChange={e => update('content', e.target.value)} /><label htmlFor="post-status">Publicação</label><select id="post-status" value={draft.status} onChange={e => update('status', e.target.value)}><option value="draft">Rascunho — visível só para mim</option><option value="published">Publicado — acesso público</option></select><div className="blog-actions"><button className="blog-button" disabled={busy} type="submit">{busy ? 'Salvando…' : draft.status === 'published' ? 'Salvar e publicar' : 'Salvar rascunho'}</button><button type="button" onClick={() => setPreview(!preview)}>{preview ? 'Fechar prévia' : 'Prévia do texto'}</button></div>{draft.id && draft.status === 'published' && <a className="text-link" href={`${BLOG_ORIGIN}/blog/?texto=${draft.id}`}>Abrir publicação ↗</a>}</fieldset></form>{preview && <article className="blog-preview"><p className="eyebrow">Prévia</p><h2>{draft.title || 'Título do texto'}</h2>{draft.summary && <p className="blog-summary">{draft.summary}</p>}<TextContent content={draft.content} /></article>}</div>
    </div>}
    <p className="blog-muted blog-author-note"><a href={AUTHOR_URL}>Área de autoria</a> · As alterações só ficam salvas depois de acionar o botão de salvar.</p>
  </>;
}
