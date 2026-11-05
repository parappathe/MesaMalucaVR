// Progresso das mesas (estrelas) e opções, salvos no navegador.
// As funções de regra (starsFor, recordResult, statusOf) não dependem de navegador.
import { TABLES } from './arena.js';

const KEY = 'mesamalucavr.v1';
const DEFAULTS = {
  beaten: 0,          // quantas mesas já venceu (em ordem)
  stars: [],          // melhor nota (0 a 3 estrelas) em cada mesa
  hand: 'right',      // 'right' | 'left'
  assist: 'media',    // 'alta' | 'media' | 'baixa' | 'off'
  angle: 0,           // ângulo da raquete na mão, em graus
  music: true,        // música de fundo
  fps: false,
};

export const ASSIST = { alta: 0.85, media: 0.6, baixa: 0.3, off: 0 };
export const ASSIST_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa', off: 'Desligada' };

// Estrelas: vencer = 1; vencer por 4 pontos ou mais = 2; perder no máximo 1 ponto = 3.
export function starsFor(won, score) {
  if (!won) return 0;
  const [me, them] = score;
  if (them <= 1) return 3;
  if (me - them >= 4) return 2;
  return 1;
}

// Guarda o resultado: melhor nota da mesa e libera a próxima se venceu a mesa da vez.
export function recordResult(state, i, stars) {
  state.stars = state.stars || [];
  state.stars[i] = Math.max(state.stars[i] || 0, stars);
  if (stars > 0 && i === state.beaten) state.beaten = i + 1;
}

export function totalStars(state) { return (state.stars || []).reduce((a, b) => a + (b || 0), 0); }

export function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...s, stars: Array.isArray(s.stars) ? s.stars : [] };
  } catch { return { ...DEFAULTS, stars: [] }; }
}

export function saveState(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem armazenamento: segue sem salvar */ }
}

export function statusOf(state, i) {
  if (i < state.beaten) return 'beaten';
  if (i === state.beaten) return 'next';
  return 'locked';
}

export function nextTable(state) { return Math.min(state.beaten, TABLES.length - 1); }
export function isChampion(state) { return state.beaten >= TABLES.length; }
