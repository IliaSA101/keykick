/**
 * Штрафной через стенку (036-Р6, Э4.34–36): 5 ударов; над воротами слово-мишень только из выученных букв. Набрал слово —
 * мяч через стенку в угол (гол). Неверная буква или время слова `wordMs` вышло — мяч в стенку, удар без гола. Рекорд — голов из
 * 5 и время (при равных голах лучше меньшее время, `records.judge`). Время серии — целые секунды от старта до конца.
 */
import cfg from '../../../content/base.json';
import { typable } from '../../plan/attack';
import { createRandom, shuffle } from '../../random';
import type { FunInput } from './input';

const K = cfg.free;

export interface FreeState {
  /** Слова всех ударов серии. */
  words: string[];
  /** Номер текущего удара, с 0. */
  shot: number;
  /** Сколько букв текущего слова набрано. */
  typed: number;
  goals: number;
  startedAt: number;
  /** Когда начался текущий удар, мс. */
  since: number;
  /** Конец серии, мс; `null` — идёт. */
  endedAt: number | null;
  over: boolean;
}

/** Слова серии — из слов курса (`words`): только из выученных букв, длиной `minWordLen`…`maxWordLen` (как отбор `early` в атаке); не хватает — повторы, слов нет совсем — сами буквы. */
export function wordsFor(keys: string[], seed: number, words: readonly string[]): string[] {
  const known = new Set(keys);
  const line = [...known].join('');
  const pool = words.filter((w) => w.length >= K.minWordLen && w.length <= K.maxWordLen && typable(line, w));
  if (pool.length === 0) pool.push(...known);
  if (pool.length === 0) return [];
  const mix = shuffle(createRandom(seed), pool);
  return Array.from({ length: K.shots }, (_, i) => mix[i % mix.length] as string);
}

/** `ctx.words` — слова курса (из словаря, который держит экран). */
export function startFree(ctx: { keys: string[]; words: readonly string[] }, seed: number, t = 0): FreeState {
  const words = wordsFor(ctx.keys, seed, ctx.words);
  return { words, shot: 0, typed: 0, goals: 0, startedAt: t, since: t, endedAt: words.length === 0 ? t : null, over: words.length === 0 };
}

function next(s: FreeState, goal: boolean, t: number): FreeState {
  const goals = s.goals + (goal ? 1 : 0);
  if (s.shot + 1 >= K.shots) return { ...s, goals, typed: 0, endedAt: t, over: true };
  return { ...s, goals, shot: s.shot + 1, typed: 0, since: t };
}

export function stepFree(s: FreeState, input: FunInput, t: number): FreeState {
  if (s.over) return s;
  const word = s.words[s.shot] ?? '';
  if (t - s.since > K.wordMs) return next(s, false, t);
  if (input.kind === 'tick') return s;
  if (input.key !== word[s.typed]) return next(s, false, t);
  if (s.typed + 1 < word.length) return { ...s, typed: s.typed + 1 };
  return next(s, true, t);
}

export const scoreFree = (s: FreeState): number => s.goals;
/** Время серии, целые секунды (в `FunResult.t`); идущая серия — до `now`. */
export const timeFree = (s: FreeState, now: number): number => Math.round(((s.endedAt ?? now) - s.startedAt) / 1000);

/** Сколько мс осталось на текущее слово (не меньше 0); серия кончена — 0. */
export const wordLeft = (s: FreeState, now: number): number => (s.over ? 0 : Math.max(0, K.wordMs - (now - s.since)));
