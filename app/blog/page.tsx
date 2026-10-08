import type { Metadata } from 'next';
import BlogShell from './blog-shell';
import BlogClient from './blog-client';

export const metadata: Metadata = {
  title: 'Blog | Fernando Coelho',
  description: 'Textos de Fernando Coelho. Um espaço de escrita e conversa.',
  alternates: { canonical: '/blog/' },
  openGraph: { type: 'website', title: 'Blog | Fernando Coelho', url: '/blog/', description: 'Textos de Fernando Coelho. Um espaço de escrita e conversa.' },
};
export default function Blog() { return <BlogShell><BlogClient /></BlogShell>; }
