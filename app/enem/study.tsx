'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnswerLetter, DifficultyLevel, EnemQuestion, EnemQuestionBank } from '../../lib/enem-types';
import styles from './study.module.css';

const letters: AnswerLetter[] = ['A', 'B', 'C', 'D', 'E'];
const difficultyLabels: Record<DifficultyLevel, string> = { facil: 'Fácil', media: 'Média', dificil: 'Difícil' };
const sortQuestions = (a: EnemQuestion, b: EnemQuestion) => b.year - a.year || a.number - b.number || a.id.localeCompare(b.id);

function readBank(value: unknown): EnemQuestionBank {
  if (!value || typeof value !== 'object') throw new Error('Formato de dados inválido.');
  const bank = value as EnemQuestionBank;
  if (bank.schemaVersion !== 1 || !bank.coverage || !Array.isArray(bank.questions)) {
    throw new Error('Formato de dados inválido.');
  }
  return bank;
}

export default function EnemStudy() {
  const [bank, setBank] = useState<EnemQuestionBank | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [year, setYear] = useState('all');
  const [topic, setTopic] = useState('all');
  const [subtopic, setSubtopic] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerLetter>>({});
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/enem-data/questions.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível carregar o banco.');
        return response.json();
      })
      .then((value: unknown) => { setBank(readBank(value)); setLoadError(false); })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setLoadError(true);
      });
    return () => controller.abort();
  }, [loadAttempt]);

  const questions = useMemo(() => (bank?.questions ?? []).filter((item) => item.reviewStatus === 'verified').sort(sortQuestions), [bank]);
  const years = useMemo(() => [...new Set(questions.map((item) => item.year))].sort((a, b) => b - a), [questions]);
  const topics = useMemo(() => [...new Set(questions.map((item) => item.topics.primary))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [questions]);
  const subtopics = useMemo(() => [...new Set(questions.filter((item) => item.topics.primary === topic).flatMap((item) => item.topics.secondary))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [questions, topic]);
  const filtered = useMemo(() => questions.filter((item) =>
    (year === 'all' || item.year === Number(year)) &&
    (topic === 'all' || item.topics.primary === topic) &&
    (subtopic === 'all' || item.topics.secondary.includes(subtopic)) &&
    (difficulty === 'all' || item.difficulty.level === difficulty)
  ), [questions, year, topic, subtopic, difficulty]);
  const currentIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const question = filtered[currentIndex];
  const answeredCount = filtered.filter((item) => answers[item.id]).length;
  const selected = question ? answers[question.id] : undefined;
  const canCorrect = question?.answer.status === 'valid' && question.answer.correct !== null;
  const isCorrect = canCorrect && selected === question.answer.correct;
  const hasFilters = year !== 'all' || topic !== 'all' || difficulty !== 'all';

  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setIndex(0);
  }

  function navigate(nextIndex: number) {
    setIndex(nextIndex);
    requestAnimationFrame(() => {
      questionHeading.current?.focus({ preventScroll: true });
      questionHeading.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }

  function answer(letter: AnswerLetter) {
    if (!question || selected || !canCorrect) return;
    setAnswers((previous) => previous[question.id] ? previous : { ...previous, [question.id]: letter });
  }

  function retry() {
    if (!question) return;
    setAnswers((previous) => {
      const next = { ...previous };
      delete next[question.id];
      return next;
    });
  }

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-labelledby="filter-heading">
        <div className={styles.filterTop}>
          <h2 id="filter-heading">Seu estudo</h2>
          <span className={styles.filterIcon} aria-hidden="true">≡</span>
        </div>
        <div className={styles.filters}>
          <div className={styles.filterField}>
          <label htmlFor="enem-year">Ano da prova</label>
          <select id="enem-year" value={year} onChange={(event) => changeFilter(setYear, event.target.value)} disabled={!bank}>
            <option value="all">Todos os anos</option>
            {years.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
          </div>
          <div className={styles.filterField}>
          <label htmlFor="enem-topic">Conteúdo</label>
          <select id="enem-topic" value={topic} onChange={(event) => { changeFilter(setTopic, event.target.value); setSubtopic('all'); }} disabled={!bank}>
            <option value="all">Todos os conteúdos</option>
            {topics.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
          </div>
          {topic !== 'all' && subtopics.length > 0 && <div className={styles.filterField}>
            <label htmlFor="enem-subtopic">Tópico específico</label>
            <select id="enem-subtopic" value={subtopic} onChange={(event) => changeFilter(setSubtopic, event.target.value)}>
              <option value="all">Todos os tópicos</option>
              {subtopics.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </div>}
          <div className={styles.filterField}>
          <label htmlFor="enem-difficulty">Dificuldade</label>
          <select id="enem-difficulty" value={difficulty} onChange={(event) => changeFilter(setDifficulty, event.target.value)} disabled={!bank}>
            <option value="all">Todas as dificuldades</option>
            {Object.entries(difficultyLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <p className={styles.filterNote}>Classificação pedagógica estimada.</p>
          </div>
        </div>
        {hasFilters && <button className={styles.clear} type="button" onClick={() => { setYear('all'); setTopic('all'); setSubtopic('all'); setDifficulty('all'); setIndex(0); }}>Limpar filtros <span aria-hidden="true">×</span></button>}
        <div className={styles.collection} aria-live="polite">
          <strong>{bank ? filtered.length : '—'}</strong>
          <span>{filtered.length === 1 ? 'questão disponível' : 'questões disponíveis'}</span>
          {bank && <p>{answeredCount} {answeredCount === 1 ? 'respondida' : 'respondidas'} nesta seleção</p>}
        </div>
        <details className={styles.method}>
          <summary>Sobre este banco</summary>
          <p>{bank?.coverage.application ?? 'Aplicação regular nacional'}. Cada questão mantém o recorte da prova e os links das fontes oficiais.</p>
          <p>{bank?.coverage.difficultyNote ?? 'A dificuldade é uma classificação pedagógica para orientar o estudo.'}</p>
          <p>As respostas ficam nesta sessão. Ao recarregar a página, o estudo recomeça.</p>
        </details>
      </aside>

      <section className={styles.study} aria-label="Questões de Física">
        {!bank && !loadError && <div className={styles.empty} role="status"><span className={styles.loadingDot} aria-hidden="true" /><h2>Carregando as questões…</h2><p>Preparando seu espaço de estudo.</p></div>}
        {loadError && <div className={styles.empty} role="alert"><h2>Não foi possível carregar as questões.</h2><p>Confira sua conexão e tente novamente.</p><button className={styles.action} onClick={() => { setLoadError(false); setLoadAttempt((value) => value + 1); }}>Tentar novamente</button></div>}
        {bank && !loadError && !question && <div className={styles.empty}><h2>Nenhuma questão nesta seleção.</h2><p>Escolha outro ano, conteúdo ou dificuldade para continuar.</p></div>}
        {question && !loadError && <>
          <div className={styles.navigation}>
            <span className={styles.position}>Questão <strong>{currentIndex + 1}</strong> de {filtered.length}</span>
            <div className={styles.arrows}>
              <button type="button" onClick={() => navigate(currentIndex - 1)} disabled={currentIndex === 0} aria-label="Questão anterior">←</button>
              <button type="button" onClick={() => navigate(currentIndex + 1)} disabled={currentIndex === filtered.length - 1} aria-label="Próxima questão">→</button>
            </div>
          </div>
          <article className={styles.question} key={question.id}>
            <header className={styles.questionHeader}>
              <div>
                <p className={styles.questionKicker}>ENEM {question.year} <span aria-hidden="true">/</span> {question.booklet.day}º dia · Caderno {question.booklet.color}</p>
                <h2 ref={questionHeading} tabIndex={-1}>Questão {question.number}</h2>
              </div>
              <span className={styles.difficulty} title={question.difficulty.rationale}>{difficultyLabels[question.difficulty.level]}</span>
            </header>
            <div className={styles.tags}>
              <span>{question.topics.primary}</span>
              {question.topics.secondary.map((value) => <span key={value}>{value}</span>)}
              {question.interdisciplinary && <span>Interdisciplinar</span>}
            </div>
            <div className={styles.original}>
              {[...question.images].sort((a, b) => a.order - b.order).map((item, imageIndex) => (
                // These are exact document fragments. Keep their own dimensions and white background.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={item.src} src={item.src} width={item.width} height={item.height} alt={item.alt} loading={imageIndex === 0 ? 'eager' : 'lazy'} decoding="async" />
              ))}
            </div>
            <div className={styles.imageTools}>
              <button type="button" aria-haspopup="dialog" onClick={() => imageDialog.current?.showModal()}>Ampliar questão <span aria-hidden="true">⤢</span></button>
            </div>
            <dialog className={styles.zoom} ref={imageDialog} aria-labelledby="enem-zoom-title">
              <div className={styles.zoomHeader}>
                <h2 id="enem-zoom-title">ENEM {question.year} · Questão {question.number}</h2>
                <button type="button" onClick={() => imageDialog.current?.close()} aria-label="Fechar questão ampliada">Fechar <span aria-hidden="true">×</span></button>
              </div>
              <div className={styles.zoomBody}>
                <p>Role para explorar o recorte em tamanho original.</p>
                {[...question.images].sort((a, b) => a.order - b.order).map((item) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={item.src} src={item.src} width={item.width} height={item.height} alt={item.alt} loading="lazy" decoding="async" />
                ))}
              </div>
            </dialog>
            {question.accessibleText && <details className={styles.transcript}>
              <summary>Ler a transcrição da questão</summary>
              <div>{question.accessibleText}</div>
            </details>}
            <div className={styles.responseArea}>
              <fieldset className={styles.answerGroup} disabled={Boolean(selected) || !canCorrect}>
                <legend>{selected ? 'Sua resposta' : canCorrect ? 'Qual é a sua resposta?' : 'Alternativas da questão'}</legend>
                <div className={styles.options}>
                  {letters.map((letter) => {
                    const correct = Boolean(selected && canCorrect && letter === question.answer.correct);
                    const wrong = Boolean(selected && canCorrect && letter === selected && !isCorrect);
                    return <button key={letter} type="button" aria-pressed={selected === letter}
                      aria-label={`Alternativa ${letter}${correct ? ', gabarito correto' : wrong ? ', sua resposta, incorreta' : selected === letter ? ', sua resposta' : ''}`}
                      className={`${styles.option} ${correct ? styles.correctOption : ''} ${wrong ? styles.wrongOption : ''}`}
                      onClick={() => answer(letter)}>
                      <span>{letter}</span>{correct ? <span aria-hidden="true">✓</span> : wrong ? <span aria-hidden="true">×</span> : null}
                    </button>;
                  })}
                </div>
              </fieldset>
              <div aria-live="polite" aria-atomic="true">
                {selected && canCorrect && <div className={`${styles.feedback} ${isCorrect ? styles.correctFeedback : styles.wrongFeedback}`}>
                  <strong>{isCorrect ? 'Você acertou!' : `Resposta incorreta. Gabarito: ${question.answer.correct}.`}</strong>
                  {isCorrect && <span className={styles.keyAnswer}>Alternativa {question.answer.correct}</span>}
                  <p>{question.explanation}</p>
                  <button type="button" className={styles.retry} onClick={retry}>Tentar esta questão novamente <span aria-hidden="true">↺</span></button>
                </div>}
                {!canCorrect && <div className={styles.neutralFeedback}>
                  <strong>{question.answer.status === 'annulled' ? 'Questão anulada pelo INEP.' : 'Gabarito em revisão.'}</strong>
                  <p>{question.answer.status === 'annulled' ? 'Esta questão pode ser estudada, mas não recebe correção de acerto ou erro.' : 'A correção ficará disponível após a conferência do gabarito oficial.'}</p>
                  {question.answer.status === 'annulled' && question.explanation && <p>{question.explanation}</p>}
                </div>}
              </div>
            </div>
            <div className={styles.sources}>
              <span>Fontes oficiais · INEP</span>
              <a href={`${question.source.examPdfUrl}#page=${question.source.examPage}`} target="_blank" rel="noreferrer">Prova <span aria-hidden="true">↗</span><span className="sr-only"> (abre em nova aba)</span></a>
              <a href={`${question.source.keyPdfUrl}#page=${question.source.keyPage}`} target="_blank" rel="noreferrer">Gabarito <span aria-hidden="true">↗</span><span className="sr-only"> (abre em nova aba)</span></a>
            </div>
          </article>
          <div className={styles.bottomNavigation}>
            <label htmlFor="enem-jump">Ir para uma questão</label>
            <select id="enem-jump" value={currentIndex} onChange={(event) => navigate(Number(event.target.value))}>
              {filtered.map((item, position) => <option key={item.id} value={position}>{position + 1}. ENEM {item.year} · Questão {item.number}{answers[item.id] ? ' · Respondida' : ''}</option>)}
            </select>
            <button className={styles.action} type="button" onClick={() => navigate(currentIndex + 1)} disabled={currentIndex === filtered.length - 1}>Próxima questão <span aria-hidden="true">→</span></button>
          </div>
        </>}
      </section>
    </div>
  );
}
