import ThemeToggle from '../theme-toggle';
import VisitCounter from '../visit-counter';
import Link from 'next/link';
import { preconnect } from 'react-dom';
import { AUTHOR_URL, BLOG_ORIGIN } from '@/lib/blog-config';
import AuthorProfile from './author-profile';

export default function BlogShell({ children, showVisitCounter = false, showAuthorProfile = false }: { children?: React.ReactNode; showVisitCounter?: boolean; showAuthorProfile?: boolean }) {
  preconnect(BLOG_ORIGIN, { crossOrigin: 'anonymous' });
  return <>
    <a className="skip-link" href="#blog-conteudo">Pular para o conteúdo</a>
    <header className="site-header blog-header">
      <Link className="brand" href="/" aria-label="Página inicial de Fernando Coelho"><span className="brand-mark" aria-hidden="true">FC</span><span>Fernando Coelho</span></Link>
      <nav aria-label="Navegação do blog"><ThemeToggle /><Link href="/">Página inicial</Link><Link href="/blog/">Blog</Link><a className="private-access" href={AUTHOR_URL} title="Área do autor" aria-label="Área do autor"><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></a></nav>
    </header>
    <main className="blog-main" id="blog-conteudo">{children}{showAuthorProfile && <AuthorProfile />}</main>
    <footer><span>Fernando Coelho</span><span>Textos de autoria pessoal</span><Link href="/">Página inicial ↑</Link>{showVisitCounter && <VisitCounter page="blog" />}</footer>
  </>;
}
