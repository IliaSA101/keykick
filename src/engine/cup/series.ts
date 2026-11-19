/**
 * Серия ударов Кубка (ТЗ-8.6, 038-Р35, 038-Р38, 068-Р2): плей-офф, ничья после доп. времени. Своя машина, не фаза матча.
 * Три удара — слова 4 / 6 / 8 букв только из пройденных букв урока-якоря, слабые клавиши чаще. Удар чистый (ни одной ошибки в слове) — гол.
 * Кончается на двух чистых (победа) или на двух промахах (поражение): после двух чистых третий удар не бьётся. Соперник — «театр»:
 * его удары по кадрам (068-Р21): гол, мимо, гол — при двух наших чистых он забил не больше одного, при двух промахах мы позади. Чистая функция: часы — в `key.t`, случайность — зерно `start`.
 */
import { createRandom, pick } from '../random';
import { typable } from '../plan/attack';
import type { CourseLesson, Dictionary } from '../plan/lesson';
import { lettersOf, unique } from '../plan/lessonModel';
import type { Press, SoundName } from '../match/types';
import type { Keymap, Layout } from '../typing/keymap';
import { typeKey, type KeyEffect, type KeyInput } from '../typing/keystep';
import { emptyStats, isDone, startLine, type TypingState, type TypingStats } from '../typing/typing';

/** Длины слов трёх ударов (ТЗ-8.6). */
export const SERIES_LENGTHS: readonly number[] = [4, 6, 8];
/** Чистых ударов для победы. */
export const SERIES_WIN = 2;

export type Shot = 'goal' | 'miss';

export interface SeriesStart {
  type: 'start';
  seed: number;
  lesson: CourseLesson;
  dict: Dictionary;
  keymap: Keymap;
}

export type SeriesKey = KeyInput & { type: 'key' };

export type SeriesEvent = SeriesStart | SeriesKey;

export type SeriesEffect =
  | KeyEffect
  | { kind: 'sound'; sound: SoundName }
  /** Удар `n` (с 0) стороны `side`: гол или мимо. */
  | { kind: 'kick'; side: 'me' | 'opp'; goal: boolean; n: number }
  /** Серия кончилась: наша ли победа. */
  | { kind: 'end'; won: boolean };

export interface RunningSeries {
  phase: 'run' | 'done';
  words: readonly string[];
  layout: Layout;
  keymap: Keymap;
  /** Номер текущего удара (с 0). */
  kick: number;
  typing: TypingState | null;
  mine: readonly Shot[];
  theirs: readonly Shot[];
  stats: TypingStats;
  presses: readonly Press[];
  /** Исход после конца серии; до конца — `null`. */
  won: boolean | null;
}

export type SeriesState = { phase: 'idle' } | RunningSeries;
export const idleSeries: SeriesState = { phase: 'idle' };

/** Слово удара: из слов словаря, набираемых буквами урока, нужной длины; со слабыми клавишами — в первую очередь. Слов нужной длины нет — ряд букв урока (слабые чаще). */
export function seriesWord(l: CourseLesson, d: Dictionary, rnd: () => number, len: number): string {
  const letters = lettersOf(l);
  const own = d.words.filter((w) => w.length === len && /^\p{L}+$/u.test(w) && typable(l.keys, w));
  const weak = unique(l.focus);
  const hard = own.filter((w) => weak.some((c) => w.includes(c)));
  const from = hard.length > 0 ? hard : own;
  if (from.length > 0) return pick(rnd, from);
  const pool = [...weak, ...weak, ...letters];
  return Array.from({ length: len }, () => pick(rnd, pool)).join('');
}

function begin(e: SeriesStart): RunningSeries {
  const rnd = createRandom(e.seed);
  const words = SERIES_LENGTHS.map((len) => seriesWord(e.lesson, e.dict, rnd, len));
  return {
    phase: 'run',
    words,
    layout: e.lesson.layout,
    keymap: e.keymap,
    kick: 0,
    typing: startLine(words[0] ?? '', e.lesson.layout, emptyStats, false, false),
    mine: [],
    theirs: [],
    stats: emptyStats,
    presses: [],
    won: null,
  };
}

const goals = (s: readonly Shot[]): number => s.filter((x) => x === 'goal').length;

/** Один шаг серии. До `start` и после конца события игнорируются. */
export function seriesStep(state: SeriesState, event: SeriesEvent): { state: SeriesState; effects: SeriesEffect[] } {
  if (event.type === 'start') return { state: begin(event), effects: [] };
  if (state.phase !== 'run' || state.typing === null) return { state, effects: [] };
  const { typed, presses, effects: keyFx } = typeKey(state.keymap, state.typing, event, state.presses);
  const effects: SeriesEffect[] = [...keyFx];
  if (!isDone(typed)) return { state: { ...state, typing: typed, presses, stats: typed.stats }, effects };

  // Слово набрано: чистое — гол, с ошибкой — мимо.
  const n = state.kick;
  const shot: Shot = typed.lineErrors === 0 ? 'goal' : 'miss';
  const mine = [...state.mine, shot];
  effects.push({ kind: 'kick', side: 'me', goal: shot === 'goal', n }, { kind: 'sound', sound: shot === 'goal' ? 'goal' : 'save' });
  if (goals(mine) >= SERIES_WIN) {
    effects.push({ kind: 'end', won: true }, { kind: 'sound', sound: 'whistle' });
    return { state: { ...state, phase: 'done', typing: null, kick: n + 1, mine, stats: typed.stats, presses, won: true }, effects };
  }
  // Соперник — «театр» по кадрам Э5.32–35 (068-Р21): 1-й удар — гол, 2-й — мимо, 3-й — гол; при двух наших чистых серия кончилась до его третьего.
  const reply: Shot = n === 1 ? 'miss' : 'goal';
  const theirs = [...state.theirs, reply];
  effects.push({ kind: 'kick', side: 'opp', goal: reply === 'goal', n });
  if (mine.length - goals(mine) >= SERIES_WIN) {
    effects.push({ kind: 'end', won: false }, { kind: 'sound', sound: 'whistle' });
    return { state: { ...state, phase: 'done', typing: null, kick: n + 1, mine, theirs, stats: typed.stats, presses, won: false }, effects };
  }
  const next = startLine(state.words[n + 1] ?? '', state.layout, typed.stats, true, false);
  return { state: { ...state, kick: n + 1, typing: next, mine, theirs, stats: typed.stats, presses }, effects };
}

/** Исход серии для `finishCup`. */
export interface SeriesResult {
  won: boolean;
  /** Наши удары и удары соперника по порядку (✓ ✕ ✓). */
  mine: readonly Shot[];
  theirs: readonly Shot[];
  /** Печать серии: счётчики и нажатия — их платит свисток (ТЗ-3.1 «серия печатью»). */
  stats: TypingStats;
  presses: readonly Press[];
}

/** Готов только после конца серии, иначе `null`. */
export function seriesResult(state: SeriesState): SeriesResult | null {
  if (state.phase !== 'done' || state.won === null) return null;
  return { won: state.won, mine: state.mine, theirs: state.theirs, stats: state.stats, presses: state.presses };
}
