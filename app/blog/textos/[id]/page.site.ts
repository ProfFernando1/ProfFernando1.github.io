import { createElement } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getInitialPost } from '../../../../lib/blog-initial';
import { BLOG_ORIGIN } from '@/lib/blog-config';
import BlogShell from '../../blog-shell';
import BlogClient from '../../blog-client';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getInitialPost(id);
  if (!post) notFound();
  const url = `${BLOG_ORIGIN}/blog/textos/${encodeURIComponent(id)}/`;
  return {
    title: `${post.title} | Fernando Coelho`, description: post.summary,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: post.title, description: post.summary, url },
  };
}

export default async function Article({ params }: Props) {
  const { id } = await params;
  const post = await getInitialPost(id);
  if (!post) notFound();
  return createElement(BlogShell, { showVisitCounter: true }, createElement(BlogClient, { initialPost: post }));
}
