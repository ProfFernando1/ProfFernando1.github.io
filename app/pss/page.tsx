import type { Metadata } from 'next';
import Link from 'next/link';
import ThemeToggle from '../theme-toggle';
import PssStudy from './study';
import styles from './study.module.css';

export const metadata: Metadata = {
  title: 'Física no PSS da UFSM | Fernando Coelho',
  description: 'Questões de Física do processo seletivo seriado da UFSM, organizadas por etapa do ensino médio, edição, conteúdo e dificuldade, com provas e gabaritos oficiais.',
  alternates: { canonical: '/pss/' },
  openGraph: {
    type: 'website',
    title: 'Física no PSS da UFSM',
    description: 'Um acervo de estudo com questões oficiais, do primeiro ao terceiro ano do ensino médio.',
    url: '/pss/',
  },
};

export default function PssPage() {
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
            <p className={styles.eyebrow}>UFSM · Processo seletivo seriado</p>
            <h1>Física no <span>PSS</span></h1>
          </div>
          <p>Uma etapa de cada vez. Explore questões oficiais por ano do ensino médio, conteúdo e edição da prova.</p>
        </div>
        <PssStudy />
      </main>
      <div className={styles.footer}>
        <span>Fernando Coelho · Recursos para estudar Física</span>
        <Link href="/enem/">Estudar Física no ENEM <span aria-hidden="true">↗</span></Link>
        <Link href="/">Voltar à página inicial <span aria-hidden="true">↗</span></Link>
      </div>
    </>
  );
}
