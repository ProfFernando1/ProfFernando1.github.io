'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './study.module.css';

type Letter = 'A' | 'B' | 'C' | 'D' | 'E';
type Question = {
  id: string;
  year: number;
  editionLabel?: string;
  era?: 'atual' | 'historico' | 'histórico' | 'current' | 'historical';
  stage: 1 | 2 | 3;
  number: number;
  program: 'PSS' | 'PEIES';
  topic: string;
  subtopic?: string;
  difficulty: 'Fácil' | 'Média' | 'Difícil';
  text: string;
  contextText?: string;
  textReview?: string;
  reviewNote?: string;
  duplicateOf?: string;
  images: string[];
  options?: { letter: string; text: string }[];
  answer: string | null;
  answerStatus?: 'valid' | 'annulled' | 'unavailable';
  explanation?: string;
  sourceUrl: string;
  keyUrl?: string;
  sourcePages?: number[];
};
type Bank = { questions: Question[]; coverage?: { note?: string; difficultyNote?: string } };
const letters: Letter[] = ['A', 'B', 'C', 'D', 'E'];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const edition = (question: Question) => (question.editionLabel || String(question.year)).replace(/^(?:PSS|PEIES)\s+/i, '');
const eraOf = (question: Question) => question.era === 'atual' || question.era === 'current' ? 'current' : ['historico', 'histórico', 'historical'].includes(question.era ?? '') ? 'historical' : 'unknown';

function readBank(value: unknown): Bank {
  if (!value || typeof value !== 'object' || !('questions' in value) || !Array.isArray(value.questions)) throw new Error('Banco inválido.');
  const bank = value as Bank;
  if (bank.questions.some((question) => !question.id || ![1, 2, 3].includes(question.stage) || !Array.isArray(question.images) || typeof question.topic !== 'string' || typeof question.text !== 'string')) throw new Error('Questão inválida.');
  return bank;
}

export default function PssStudy() {
  const [bank, setBank] = useState<Bank | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [stage, setStage] = useState('all');
  const [year, setYear] = useState('all');
  const [program, setProgram] = useState('all');
  const [era, setEra] = useState('all');
  const [topic, setTopic] = useState('all');
  const [subtopic, setSubtopic] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Letter>>({});
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/pss-data/questions.json', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Falha ao carregar.'); return response.json(); })
      .then((value: unknown) => { setBank(readBank(value)); setLoadError(false); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setLoadError(true); });
    return () => controller.abort();
  }, [loadAttempt]);

  const questions = useMemo(() => [...(bank?.questions ?? [])].sort((a, b) => b.year - a.year || a.stage - b.stage || a.number - b.number || a.id.localeCompare(b.id)), [bank]);
  const editions = useMemo(() => [...new Map(questions.map((item) => [edition(item), { label: edition(item), year: item.year }])).values()].sort((a, b) => b.year - a.year || a.label.localeCompare(b.label, 'pt-BR')), [questions]);
  const programs = useMemo(() => [...new Set(questions.map((item) => item.program))], [questions]);
  const topics = useMemo(() => [...new Set(questions.filter((item) => stage === 'all' || item.stage === Number(stage)).map((item) => item.topic))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [questions, stage]);
  const subtopics = useMemo(() => [...new Set(questions.filter((item) => item.topic === topic && (stage === 'all' || item.stage === Number(stage))).map((item) => item.subtopic).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [questions, topic, stage]);
  const filtered = useMemo(() => questions.filter((item) =>
    (stage === 'all' || item.stage === Number(stage)) &&
    (year === 'all' || edition(item) === year) &&
    (program === 'all' || item.program === program) &&
    (era === 'all' || eraOf(item) === era) &&
    (topic === 'all' || item.topic === topic) &&
    (subtopic === 'all' || item.subtopic === subtopic) &&
    (difficulty === 'all' || item.difficulty === difficulty) &&
    (!search.trim() || normalize(`${item.text} ${item.topic} ${item.subtopic ?? ''} ${edition(item)} ${item.year} ${item.program} ${item.number} ${(item.options ?? []).map((option) => option.text).join(' ')}`).includes(normalize(search.trim())))
  ), [questions, stage, year, program, era, topic, subtopic, difficulty, search]);
  const currentIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const question = filtered[currentIndex];
  const selected = question ? answers[question.id] : undefined;
  const key = question?.answer?.trim().toUpperCase() ?? '';
  const annulled = question?.answerStatus === 'annulled' || ['ANULADA', 'ANULADO', '*', 'X'].includes(key);
  const canCorrect = !annulled && question?.answerStatus !== 'unavailable' && letters.includes(key as Letter);
  const isCorrect = canCorrect && selected === key;
  const answeredCount = filtered.filter((item) => answers[item.id]).length;
  const hasFilters = [stage, year, program, era, topic, subtopic, difficulty].some((value) => value !== 'all') || Boolean(search);

  function changeFilter(setter: (value: string) => void, value: string) { setter(value); setIndex(0); }
  function clearFilters() { setStage('all'); setYear('all'); setProgram('all'); setEra('all'); setTopic('all'); setSubtopic('all'); setDifficulty('all'); setSearch(''); setIndex(0); }
  function navigate(nextIndex: number) {
    imageDialog.current?.close();
    setIndex(nextIndex);
    requestAnimationFrame(() => {
      questionHeading.current?.focus({ preventScroll: true });
      questionHeading.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  function randomQuestion() {
    if (filtered.length < 2) return;
    const offset = 1 + Math.floor(Math.random() * (filtered.length - 1));
    navigate((currentIndex + offset) % filtered.length);
  }
  function answer(letter: Letter) {
    if (!question || selected || !canCorrect) return;
    setAnswers((previous) => ({ ...previous, [question.id]: letter }));
  }
  function retry() {
    if (!question) return;
    setAnswers((previous) => { const next = { ...previous }; delete next[question.id]; return next; });
  }
  const renderImages = (zoom = false) => question?.images.map((src, imageIndex) => (
    // Preserve the official document fragments, including diagrams and mathematical notation.
    // eslint-disable-next-line @next/next/no-img-element
    <img key={`${src}-${imageIndex}`} src={src} alt={`Recorte oficial da questão ${question.number}, ${question.program} ${edition(question)}, etapa ${question.stage}${question.images.length > 1 ? `, parte ${imageIndex + 1}` : ''}. A transcrição textual está disponível abaixo.`} loading={zoom || imageIndex > 0 ? 'lazy' : 'eager'} decoding="async" />
  ));

  return (
    <>
      <div className={styles.stageOverview} aria-label="Escolher a etapa do ensino médio">
        {[1, 2, 3].map((value) => <button key={value} type="button" disabled={!bank} aria-pressed={stage === String(value)} onClick={() => { changeFilter(setStage, stage === String(value) ? 'all' : String(value)); setTopic('all'); setSubtopic('all'); }}>
          <span className={styles.stageNumber}>{value}</span>
          <span><strong>{value}º ano do ensino médio</strong><small>Etapa {value} · {bank ? questions.filter((item) => item.stage === value).length : '—'} questões</small></span>
          <span className={styles.stageArrow} aria-hidden="true">↗</span>
        </button>)}
      </div>
      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-labelledby="filter-heading">
          <div className={styles.filterTop}><h2 id="filter-heading">Seu estudo</h2><a className={styles.jumpToStudy} href="#pss-questions">Ir às questões ↓</a><span className={styles.filterIcon} aria-hidden="true">≡</span></div>
          <div className={styles.filters}>
            <div className={styles.filterField}>
              <label htmlFor="pss-search">Buscar nas questões</label>
              <input type="search" id="pss-search" placeholder="Ex.: energia, calor…" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} disabled={!bank} />
            </div>
            <div className={styles.filterField}>
              <label htmlFor="pss-stage">Etapa do ensino médio</label>
              <select id="pss-stage" value={stage} onChange={(event) => { changeFilter(setStage, event.target.value); setTopic('all'); setSubtopic('all'); }} disabled={!bank}>
                <option value="all">Todos os anos escolares</option>
                {[1, 2, 3].map((value) => <option value={value} key={value}>{value}º ano · Etapa {value}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="pss-year">Edição da prova</label>
              <select id="pss-year" value={year} onChange={(event) => changeFilter(setYear, event.target.value)} disabled={!bank}>
                <option value="all">Todas as edições</option>{editions.map(({ label }) => <option value={label} key={label}>{label}</option>)}
              </select>
              <p className={styles.filterNote}>A edição identifica a prova, e a etapa indica o ano do ensino médio.</p>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="pss-program">Programa</label>
              <select id="pss-program" value={program} onChange={(event) => changeFilter(setProgram, event.target.value)} disabled={!bank}>
                <option value="all">Todos os programas</option>{programs.map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="pss-era">Formato do processo</label>
              <select id="pss-era" value={era} onChange={(event) => changeFilter(setEra, event.target.value)} disabled={!bank}>
                <option value="all">Todos os formatos</option><option value="current">PSS atual</option><option value="historical">Acervo histórico</option>{questions.some((item) => eraOf(item) === 'unknown') && <option value="unknown">Não informado</option>}
              </select>
              <p className={styles.filterNote}>O PSS atual e os processos históricos têm estruturas e programas próprios.</p>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="pss-topic">Conteúdo</label>
              <select id="pss-topic" value={topic} onChange={(event) => { changeFilter(setTopic, event.target.value); setSubtopic('all'); }} disabled={!bank}>
                <option value="all">Todos os conteúdos</option>{topics.map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            {topic !== 'all' && subtopics.length > 0 && <div className={styles.filterField}>
              <label htmlFor="pss-subtopic">Tópico específico</label>
              <select id="pss-subtopic" value={subtopic} onChange={(event) => changeFilter(setSubtopic, event.target.value)}><option value="all">Todos os tópicos</option>{subtopics.map((value) => <option key={value}>{value}</option>)}</select>
            </div>}
            <div className={styles.filterField}>
              <label htmlFor="pss-difficulty">Dificuldade</label>
              <select id="pss-difficulty" value={difficulty} onChange={(event) => changeFilter(setDifficulty, event.target.value)} disabled={!bank}>
                <option value="all">Todas as dificuldades</option>{['Fácil', 'Média', 'Difícil'].map((value) => <option key={value}>{value}</option>)}
              </select>
              <p className={styles.filterNote}>Estimativa editorial, sem dados estatísticos de desempenho.</p>
            </div>
          </div>
          {hasFilters && <button className={styles.clear} type="button" onClick={clearFilters}>Limpar filtros <span aria-hidden="true">×</span></button>}
          <div className={styles.collection} aria-live="polite"><strong>{bank ? filtered.length : '—'}</strong><span>{filtered.length === 1 ? 'questão disponível' : 'questões disponíveis'}</span>{bank && <p>{answeredCount} {answeredCount === 1 ? 'respondida' : 'respondidas'} nesta seleção</p>}</div>
          <details className={styles.method}>
            <summary>Acervo e critérios</summary>
            <p>Questões de Física das provas oficiais disponíveis da UFSM. Os links da prova e do gabarito acompanham cada questão.</p>
            <p>O acervo reúne edições do PSS e, quando identificado, o programa histórico PEIES. As denominações e a distribuição dos conteúdos podem mudar entre as edições. Provas antigas são material de estudo e não definem o programa atual.</p>
            {typeof bank?.coverage?.note === 'string' && <p>{bank.coverage.note}</p>}
            <p>{bank?.coverage?.difficultyNote ?? 'A dificuldade considera a quantidade de etapas de raciocínio, a interpretação e os conhecimentos exigidos. É uma estimativa editorial, e não uma classificação da UFSM.'}</p>
            <p>Suas respostas ficam nesta sessão. Recarregar a página reinicia o estudo.</p>
            <p><a href="/pss-data/sources.json" target="_blank" rel="noreferrer">Consultar catálogo de fontes</a> · <a href="/pss-data/inventory.csv" download>Baixar inventário das questões</a></p>
          </details>
        </aside>

        <section className={styles.study} id="pss-questions" aria-label="Questões de Física da UFSM">
          {!bank && !loadError && <div className={styles.empty} role="status"><span className={styles.loadingDot} aria-hidden="true" /><h2>Carregando as questões…</h2><p>Preparando seu espaço de estudo.</p></div>}
          {loadError && <div className={styles.empty} role="alert"><h2>Não foi possível carregar as questões.</h2><p>Confira sua conexão e tente novamente.</p><button className={styles.action} onClick={() => { setLoadError(false); setLoadAttempt((value) => value + 1); }}>Tentar novamente</button></div>}
          {bank && !loadError && !question && <div className={styles.empty}><h2>Nenhuma questão nesta seleção.</h2><p>Experimente outro conteúdo, etapa ou edição.</p><button className={styles.action} type="button" onClick={clearFilters}>Ver todas as questões</button></div>}
          {question && !loadError && <>
            <div className={styles.navigation}>
              <span className={styles.position}>Questão <strong>{currentIndex + 1}</strong> de {filtered.length}</span>
              <div className={styles.navigationActions}><button className={styles.random} type="button" onClick={randomQuestion} disabled={filtered.length < 2}>Aleatória <span aria-hidden="true">⤨</span></button><div className={styles.arrows}><button type="button" onClick={() => navigate(currentIndex - 1)} disabled={currentIndex === 0} aria-label="Questão anterior">←</button><button type="button" onClick={() => navigate(currentIndex + 1)} disabled={currentIndex === filtered.length - 1} aria-label="Próxima questão">→</button></div></div>
            </div>
            <article className={styles.question} key={question.id}>
              <header className={styles.questionHeader}><div><p className={styles.questionKicker}>UFSM · {question.program} {edition(question)} <span aria-hidden="true">/</span> Etapa {question.stage} · {question.stage}º ano do ensino médio</p><h2 ref={questionHeading} tabIndex={-1}>Questão {question.number}</h2></div><span className={styles.difficulty} title="Dificuldade estimada editorialmente">{question.difficulty}</span></header>
              <div className={styles.tags}><span>{question.topic}</span>{question.subtopic && <span>{question.subtopic}</span>}{eraOf(question) === 'historical' && <span>Acervo histórico · {question.program}</span>}{eraOf(question) === 'current' && <span>PSS atual</span>}</div>
              {question.contextText && <p className={styles.context}>{question.contextText}</p>}
              {question.duplicateOf && <p className={styles.context}>Esta questão também aparece no outro caderno da etapa 3 de 2015, com numeração diferente.</p>}
              {question.images.length > 0 ? <>
                <div className={styles.original}>{renderImages()}</div>
                <div className={styles.imageTools}><button type="button" aria-haspopup="dialog" onClick={() => imageDialog.current?.showModal()}>Ampliar questão <span aria-hidden="true">⤢</span></button></div>
                <dialog className={styles.zoom} ref={imageDialog} aria-labelledby="pss-zoom-title"><div className={styles.zoomHeader}><h2 id="pss-zoom-title">{question.program} {edition(question)} · Etapa {question.stage} · Questão {question.number}</h2><button type="button" onClick={() => imageDialog.current?.close()} aria-label="Fechar questão ampliada">Fechar <span aria-hidden="true">×</span></button></div><div className={styles.zoomBody}><p>Role para explorar o recorte em tamanho original.</p>{renderImages(true)}</div></dialog>
                {question.text && <details className={styles.transcript}><summary>{question.textReview === 'ocr' ? 'Consultar texto obtido por OCR' : 'Consultar texto da questão'}</summary><p>O texto auxilia a busca e pode perder símbolos, fórmulas ou a ordem de leitura. Confira o recorte original, que preserva o enunciado e as figuras.</p><div>{question.text}</div>{question.options && <div>{question.options.map((option) => <p key={option.letter}>{option.letter}) {option.text}</p>)}</div>}</details>}
              </> : <div className={styles.questionText}>{question.text}</div>}
              <div className={styles.responseArea}>
                <fieldset className={styles.answerGroup} disabled={Boolean(selected) || !canCorrect}>
                  <legend>{selected ? 'Sua resposta' : canCorrect ? 'Qual é a sua resposta?' : 'Alternativas da questão'}</legend>
                  <div className={`${styles.options} ${question.options?.some((option) => option.text) ? styles.textOptions : ''}`}>
                    {letters.map((letter) => {
                      const correct = Boolean(selected && canCorrect && letter === key);
                      const wrong = Boolean(selected && canCorrect && letter === selected && !isCorrect);
                      const optionText = question.options?.find((option) => option.letter.toUpperCase() === letter)?.text;
                      return <button key={letter} type="button" aria-pressed={selected === letter} aria-label={`Alternativa ${letter}${optionText ? `: ${optionText}` : ''}${correct ? ', gabarito correto' : wrong ? ', sua resposta, incorreta' : ''}`} className={`${styles.option} ${correct ? styles.correctOption : ''} ${wrong ? styles.wrongOption : ''}`} onClick={() => answer(letter)}><span className={styles.optionLetter}>{letter}</span>{optionText && <span className={styles.optionText}>{optionText}</span>}{correct ? <span aria-hidden="true">✓</span> : wrong ? <span aria-hidden="true">×</span> : null}</button>;
                    })}
                  </div>
                </fieldset>
                <div aria-live="polite" aria-atomic="true">
                  {(selected || !canCorrect) && question.reviewNote && <p><strong>Nota de revisão:</strong> {question.reviewNote}</p>}
                  {selected && canCorrect && <div className={`${styles.feedback} ${isCorrect ? styles.correctFeedback : styles.wrongFeedback}`}><strong>{isCorrect ? 'Você acertou!' : `Resposta incorreta. Gabarito: ${key}.`}</strong>{isCorrect && <span className={styles.keyAnswer}>Alternativa {key}</span>}{question.explanation && <p>{question.explanation}</p>}<button type="button" className={styles.retry} onClick={retry}>Tentar esta questão novamente <span aria-hidden="true">↺</span></button></div>}
                  {!canCorrect && <div className={styles.neutralFeedback}><strong>{annulled ? 'Questão anulada no gabarito oficial.' : 'Gabarito indisponível para correção.'}</strong><p>{annulled ? 'Estude a questão sem contabilizar acerto ou erro.' : 'Consulte a prova e as fontes disponíveis. Esta questão não recebe correção automática.'}</p>{question.explanation && <p>{question.explanation}</p>}</div>}
                </div>
              </div>
              <div className={styles.sources}><span>Fontes oficiais · UFSM</span>{question.sourceUrl && <a href={`${question.sourceUrl}${question.sourcePages?.[0] && !question.sourceUrl.includes('#') ? `#page=${question.sourcePages[0]}` : ''}`} target="_blank" rel="noreferrer">Prova <span aria-hidden="true">↗</span><span className="sr-only"> (abre em nova aba)</span></a>}{question.keyUrl && <a href={question.keyUrl} target="_blank" rel="noreferrer">Gabarito <span aria-hidden="true">↗</span><span className="sr-only"> (abre em nova aba)</span></a>}</div>
            </article>
            <div className={styles.bottomNavigation}><label htmlFor="pss-jump">Ir para uma questão desta seleção</label><select id="pss-jump" value={currentIndex} onChange={(event) => navigate(Number(event.target.value))}>{filtered.map((item, position) => <option key={item.id} value={position}>{position + 1}. {item.program} {edition(item)} · {item.stage}º ano · Q{item.number}{answers[item.id] ? ' · Respondida' : ''}</option>)}</select><button className={styles.action} type="button" onClick={() => navigate(currentIndex + 1)} disabled={currentIndex === filtered.length - 1}>Próxima questão <span aria-hidden="true">→</span></button></div>
          </>}
        </section>
      </div>
    </>
  );
}
