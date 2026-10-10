import type { Metadata } from 'next';
import BlogShell from './blog-shell';
import BlogClient from './blog-client';
import { getInitialPosts, getInitialPost, runtimeBlog } from '../../lib/blog-initial';
import { BLOG_ORIGIN } from '@/lib/blog-config';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Blog | Fernando Coelho',
  description: 'Textos de Fernando Coelho. Um espaço de escrita e conversa.',
  alternates: { canonical: '/blog/' },
  openGraph: { type: 'website', title: 'Blog | Fernando Coelho', url: '/blog/', description: 'Textos de Fernando Coelho. Um espaço de escrita e conversa.' },
};
export default async function Blog({ searchParams }: { searchParams: Promise<{ texto?: string | string[] }> }) {
  if (runtimeBlog) {
    const query = await searchParams;
    const id = typeof query.texto === 'string' ? query.texto : undefined;
    if (id) {
      const post = await getInitialPost(id);
      if (!post) notFound();
      return <BlogShell showVisitCounter><BlogClient initialPost={post} /></BlogShell>;
    }
  }
  const posts = await getInitialPosts();
  return <BlogShell showVisitCounter><BlogClient initialPosts={posts} articleBase={runtimeBlog ? '/blog/textos/' : `${BLOG_ORIGIN}/blog/textos/`} /></BlogShell>;
}
