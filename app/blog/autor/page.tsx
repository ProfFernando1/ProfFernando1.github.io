import type { Metadata } from 'next';
import BlogShell from '../blog-shell';
import AuthorClient from './author-client';

export const metadata: Metadata = { title: 'Área do autor | Fernando Coelho', robots: { index: false, follow: false }, alternates: { canonical: 'https://fernando-coelho.proffernando.chatgpt.site/blog/autor/' } };
export default function Author() { return <BlogShell><AuthorClient /></BlogShell>; }
