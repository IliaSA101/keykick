/**
 * Минута тренера (ТЗ-2.9, 3.4; 017 §5): без счёта и голов, строки пар из 2 самых трудных клавиш. Строка за строкой;
 * минута кончается на конце строки, когда с первого нажатия прошло `coach.ms`. Не матч (ТЗ-10.9). Платит как печать
 * (монеты — касса, `finishMinute`), пишет окно формы (`presses`). Чистый редьюсер: часы — в `key.t`, зерно — в `start`.
 */
import cfg from '../../content/match.json';
import type { Effect, KeyEvent, Press } from '../match/types';
import { makeCourseHalf } from '../plan/attack';
import type { CourseLesson, Dictionary } from '../plan/lesson';
import { findChar, type Keymap, type Layout } from '../typing/keymap';
import { emptyStats, isDone, startLine, type TypingState, type TypingStats } from '../typing/typing';
import { typeKey } from '../typing/keystep';

export interface MinuteStart {
  type: 'start';
  seed: number;
  lesson: CourseLesson;
  /** Клавиши фокуса — строчные знаки (две самые трудные, `coachKeys`). */
  keys: string;
  dict: Dictionary;
  keymap: Keymap;
  /** Длина минуты, мс; по умолчанию `coach.ms`. */
  ms?: number;
}

export type MinuteEvent = MinuteStart | Pick<KeyEvent, 'type' | 'code' | 'key' | 't' | 'repeat' | 'mod' | 'caps'>;

export interface RunningMinute {
  phase: 'run' | 'done';
  seed: number;
  lesson: CourseLesson;
  keys: string;
  dict: Dictionary;
  keymap: Keymap;
  layout: Layout;
  ms: number;
  /** Сколько строк уже набрано. */
  rows: number;
  typing: TypingState | null;
  stats: TypingStats;
  presses: readonly Press[];
}

export type MinuteState = { phase: 'idle' } | RunningMinute;

export const idleMinute: MinuteState = { phase: 'idle' };

/** Итог минуты: нажатия (верные и ошибочные) и верные — по ним монеты (1 за 20 верных) и окно формы. */
export interface MinuteResult {
  presses: number;
  correct: number;
  list: readonly Press[];
}

/** Копия урока для минуты: пары из двух клавиш, одна строка в `rowWidth` (контракт 016-Р10). */
export function coachLesson(l: CourseLesson, keys: string): CourseLesson {
  return { ...l, focus: keys, focusWeak: 0, material: 'pairs', ladder: ['pairs'], noWords: true, attacks: [l.rowWidth], rows: 1 };
}

/** Трудные клавиши, что есть на раскладке урока: строчные, не больше `coach.keys`; остальных до числа минуте не хватает (`fresh`). */
export function weakKeys(hard: readonly string[], keymap: Keymap, lesson: CourseLesson): string[] {
  return hard.map((c) => c.toLowerCase()).filter((c) => findChar(keymap, lesson.layout, c) !== undefined).slice(0, cfg.coach.keys);
}

/**
 * Две самые трудные клавиши (`hardKeys`: буквы, худшая точность первой); нет на раскладке урока — пропуск; не хватает — добираем из
 * фокуса урока, а на уроке без фокуса — самыми свежими буквами урока (сначала новые, затем с конца `keys`; 067-Р280): строка минуты не пустая.
 */
export function coachKeys(hard: readonly string[], keymap: Keymap, lesson: CourseLesson): string {
  const weak = weakKeys(hard, keymap, lesson);
  const letters = (s: string): string[] => Array.from(s.toLowerCase()).filter((c) => /\p{L}/u.test(c) && findChar(keymap, lesson.layout, c) !== undefined);
  const fresh = [...letters(lesson.newKeys), ...letters(lesson.keys).reverse()];
  const more = [...Array.from(lesson.focus.toLowerCase()), ...fresh].filter((c) => !weak.includes(c));
  return [...new Set([...weak, ...more])].slice(0, cfg.coach.keys).join('');
}

const lineOf = (s: Pick<RunningMinute, 'lesson' | 'keys' | 'dict' | 'keymap' | 'seed'>, n: number): string => {
  const line = makeCourseHalf(coachLesson(s.lesson, s.keys), s.dict, s.keymap, s.seed + n, undefined, false)[0];
  if (line === undefined || line === '') throw new Error('empty coach line');
  return line;
};

function begin(e: MinuteStart): RunningMinute {
  const base = { seed: e.seed, lesson: e.lesson, keys: e.keys, dict: e.dict, keymap: e.keymap };
  return { phase: 'run', ...base, layout: e.lesson.layout, ms: e.ms ?? cfg.coach.ms, rows: 0, typing: startLine(lineOf(base, 0), e.lesson.layout), stats: emptyStats, presses: [] };
}


/** Один шаг минуты. До `start` и после конца события игнорируются. */
export function minuteStep(state: MinuteState, event: MinuteEvent): { state: MinuteState; effects: Effect[] } {
  if (event.type === 'start') return { state: begin(event), effects: [] };
  if (state.phase !== 'run' || state.typing === null) return { state, effects: [] };
  const before = state.typing;
  const keyed = typeKey(state.keymap, before, event, state.presses);
  const { typed, presses } = keyed;
  const effects: Effect[] = [...keyed.effects];
  if (!isDone(typed)) return { state: { ...state, typing: typed, stats: typed.stats, presses }, effects };
  const rows = state.rows + 1;
  // Минута кончается на конце строки: время — от первого засчитанного нажатия.
  if (event.t - (typed.stats.startedAt ?? event.t) >= state.ms) {
    effects.push({ kind: 'sound', sound: 'whistle' });
    return { state: { ...state, phase: 'done', typing: null, rows, stats: typed.stats, presses }, effects };
  }
  const line = startLine(lineOf(state, rows), state.layout, typed.stats, true, false);
  return { state: { ...state, rows, typing: line, stats: typed.stats, presses }, effects };
}

/** Итог минуты (по ходу тоже годится: сколько набрано пока). */
export function minuteResult(state: MinuteState): MinuteResult {
  if (state.phase === 'idle') return { presses: 0, correct: 0, list: [] };
  return { presses: state.stats.correct + state.stats.errors, correct: state.stats.correct, list: state.presses };
}
