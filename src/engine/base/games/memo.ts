/**
 * Мемори формы (036-Р6, Р14): 2 × min(8, форм с футболкой + форма клуба) карт рубашкой вверх, на каждой — клавиша
 * (выученные буквы, при нехватке — цифры, ТЗ-7.8). Нажал клавишу — карта открылась; вторая — ход; одинаковые формы
 * остаются, разные закрываются через `hideMs` или со следующим нажатием. Счёт — ходов (меньше — лучше).
 * Формы с футболкой приходят снаружи: из альбома (К-Е, Т8) — первой форма клуба, дальше формы альбома с выданной футболкой.
 */
import cfg from '../../../content/base.json';
import { createRandom, shuffle } from '../../random';
import type { FunInput } from './input';

const K = cfg.memo;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** Id формы клуба среди карт: остальные — id форм альбома (`kits.json`). */
export const MEMO_CLUB = 'club';

export interface MemoCard {
  key: string;
  kit: string;
  face: 'down' | 'up' | 'done';
}

export interface MemoState {
  cards: MemoCard[];
  /** Индексы открытых, ещё не сложенных карт (0…2). */
  up: number[];
  /** Когда открыта вторая карта несовпавшей пары, мс. */
  shownAt: number;
  moves: number;
  done: boolean;
}

export function startMemo(ctx: { keys: string[]; kits: string[] }, seed: number): MemoState {
  const kits = [...new Set(ctx.kits)].slice(0, K.maxPairs);
  // Сначала выученные буквы, цифры 1…N — по порядку (036-Р14, Э4.32), только когда букв не хватило.
  const letters = shuffle(createRandom(seed), [...new Set(ctx.keys)]);
  const pool = [...letters, ...DIGITS.filter((d) => !letters.includes(d))].slice(0, kits.length * 2);
  const kitsOrder = shuffle(createRandom(seed + 1), [...kits, ...kits]);
  const cards = kitsOrder.map((kit, i): MemoCard => ({ key: pool[i] ?? '', kit, face: 'down' }));
  return { cards, up: [], shownAt: 0, moves: 0, done: cards.length === 0 };
}

function close(s: MemoState): MemoState {
  if (s.up.length < 2) return s;
  return { ...s, up: [], cards: s.cards.map((c, i) => (s.up.includes(i) ? { ...c, face: 'down' } : c)) };
}

export function stepMemo(s: MemoState, input: FunInput, t: number): MemoState {
  if (s.done) return s;
  if (input.kind === 'tick') return s.up.length === 2 && t - s.shownAt >= K.hideMs ? close(s) : s;
  const i = s.cards.findIndex((c) => c.key === input.key);
  const card = s.cards[i];
  if (!card || card.face !== 'down') return s;
  const base = close(s);
  const cards = base.cards.map((c, j) => (j === i ? { ...c, face: 'up' as const } : c));
  const up = [...base.up, i];
  if (up.length < 2) return { ...base, cards, up };
  const first = up[0] as number;
  const moves = base.moves + 1;
  if (cards[first]?.kit !== card.kit) return { ...base, cards, up, moves, shownAt: t };
  const sorted = cards.map((c, j) => (up.includes(j) ? { ...c, face: 'done' as const } : c));
  return { ...base, cards: sorted, up: [], moves, done: sorted.every((c) => c.face === 'done') };
}

export const scoreMemo = (s: MemoState): number => s.moves;
