import type { Metadata } from 'next';
import Link from 'next/link';
import ThemeToggle from '../theme-toggle';
import EnemStudy from './study';
import styles from './study.module.css';

export const metadata: Metadata = {
  title: 'Física no ENEM · 2011–2025 | Fernando Coelho',
  description: 'Estude Física com questões do ENEM de 2011 a 2025, recortes das provas oficiais, filtros por conteúdo e dificuldade e correção com explicação.',
  alternates: { canonical: '/enem/' },
  openGraph: {
    type: 'website',
    title: 'Física no ENEM · 2011–2025',
    description: 'Questões das provas oficiais para praticar Física, com correção e explicação.',
    url: '/enem/',
  },
};

export default function EnemPage() {
  return (
    <>
      <a className="skip-link" href="#estudar">Pular para as questões</a>
      <header className={`site-header ${styles.header}`}>
        <Link className="brand" href="/" aria-label="Página de Fernando Coelho">
          <span className="brand-mark" aria-hidden="true">FC</span>
          <span>Fernando Coelho</span>
        </Link>
        <nav aria-label="Navegação principal">
          <Link href="/#projetos">Todos os projetos <span aria-hidden="true">↗</span></Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className={styles.main} id="estudar">
        <div className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>Banco de questões · 2011–2025</p>
            <h1>Física no <span>ENEM</span></h1>
          </div>
          <p>Escolha o que estudar, resolva no seu ritmo e confira a explicação após responder.</p>
        </div>
        <EnemStudy />
      </main>
      <div className={styles.footer}>
        <span>Fernando Coelho · Recursos para estudar Física</span>
        <Link href="/">Voltar à página inicial <span aria-hidden="true">↗</span></Link>
      </div>
    </>
  );
}
