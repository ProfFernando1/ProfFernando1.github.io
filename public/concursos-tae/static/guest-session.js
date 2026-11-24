import { $, fmt } from './dom.js';

const storageKey = 'tae-guest-session-v1';
const results = new Set(['correct', 'wrong', 'neutral']);
const answers = new Map();
let elapsed = 0;
let startedAt = null;
let interval;

try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey));
  if (Array.isArray(saved?.answers)) {
    for (const [id, result] of saved.answers) {
      if (typeof id === 'string' && results.has(result)) answers.set(id, result);
    }
  }
  if (Number.isSafeInteger(saved?.elapsed) && saved.elapsed >= 0) elapsed = saved.elapsed;
  if (Number.isSafeInteger(saved?.startedAt) && saved.startedAt > 0) startedAt = saved.startedAt;
} catch { /* A guest can also study entirely in memory. */ }

function persist() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ answers: [...answers], elapsed, startedAt }));
  } catch { /* The running session is still available in this tab. */ }
}

function drawScore() {
  let correct = 0;
  let graded = 0;
  for (const result of answers.values()) {
    if (result === 'correct') correct++;
    if (result !== 'neutral') graded++;
  }
  const efficiency = graded ? fmt(Math.round(100 * correct / graded)) + '% de aproveitamento' : 'Aproveitamento —';
  $('#guest-score').textContent = [
    fmt(answers.size) + (answers.size === 1 ? ' respondida' : ' respondidas'),
    fmt(correct) + (correct === 1 ? ' acerto' : ' acertos'), efficiency,
  ].join(' · ');
  $('#guest-score').title = 'Última resposta a cada questão nesta aba. O percentual considera as questões com correção.';
}

function totalTime() {
  return elapsed + (startedAt === null ? 0 : Math.max(0, Date.now() - startedAt));
}

function drawClock() {
  const seconds = Math.floor(totalTime() / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const parts = [String(minutes).padStart(2, '0'), String(seconds % 60).padStart(2, '0')];
  if (hours) parts.unshift(String(hours));
  $('#guest-clock').textContent = parts.join(':');
}

function syncClock() {
  clearInterval(interval);
  drawClock();
  const running = startedAt !== null;
  $('#guest-clock-toggle').textContent = running ? 'Pausar cronômetro' : elapsed ? 'Retomar cronômetro' : 'Iniciar cronômetro';
  if (running) interval = window.setInterval(drawClock, 1000);
}

$('#guest-clock-toggle').addEventListener('click', () => {
  elapsed = totalTime();
  startedAt = startedAt === null ? Date.now() : null;
  persist();
  syncClock();
});

export function showGuestSession() {
  $('#guest-session').hidden = false;
  drawScore();
  syncClock();
}

export function recordGuestAnswer(id, result) {
  if (!results.has(result)) return;
  answers.set(id, result);
  persist();
  drawScore();
}

export function hideGuestSession() {
  $('#guest-session').hidden = true;
  if (startedAt !== null) {
    elapsed = totalTime();
    startedAt = null;
    persist();
  }
  clearInterval(interval);
}
