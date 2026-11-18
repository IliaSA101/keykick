/**
 * Минута тренера (ТЗ-2.9, 3.4; 017 §5): без счёта и голов, строки пар из 2 самых ошибочных клавиш. Строка за строкой;
 * минута кончается на конце строки, когда с первого нажатия прошло `coach.ms`. Не матч (ТЗ-10.9). Платит как печать
 * (монеты — касса, `finishMinute`), пишет окно формы (`presses`). Чистый редьюсер: часы — в `key.t`, зерно — в `start`.
 */
import cfg from '../../content/match.json';
import type { Effect, KeyEvent, Press } from '../match/types';
import { makeCourseHalf } from '../plan/attack';
import type { CourseLesson, Dictionary } from '../plan/lesson';
import { weakKeys } from '../stats';
import type { Keymap, Layout } from '../typing/keymap';
import { emptyStats, isDone, startLine, step as typeStep, type KeyPress, type TypingState, type TypingStats } from '../typing/typing';

export interface MinuteStart {
  type: 'start';
  seed: number;
  lesson: CourseLesson;
  /** Клавиши фокуса — строчные знаки (две самые ошибочные, `coachKeys`). */
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

/** Две самые ошибочные клавиши урока (по ошибкам игрока); не хватает — добираем из фокуса урока. */
export function coachKeys(keyErrors: Readonly<Record<string, number>>, keymap: Keymap, lesson: CourseLesson): string {
  const weak = weakKeys(keyErrors, keymap, lesson.layout, cfg.coach.keys).map((k) => k.label.toLowerCase());
  const more = Array.from(lesson.focus.toLowerCase()).filter((c) => !weak.includes(c));
  return [...weak, ...more].slice(0, cfg.coach.keys).join('');
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

const press = (e: Pick<KeyEvent, 'code' | 'key' | 't' | 'repeat' | 'mod' | 'caps'>): KeyPress => ({ code: e.code, key: e.key, repeat: e.repeat ?? false, mod: e.mod ?? false, caps: e.caps ?? false, time: e.t });

/** Один шаг минуты. До `start` и после конца события игнорируются. */
export function minuteStep(state: MinuteState, event: MinuteEvent): { state: MinuteState; effects: Effect[] } {
  if (event.type === 'start') return { state: begin(event), effects: [] };
  if (state.phase !== 'run' || state.typing === null) return { state, effects: [] };
  const before = state.typing;
  const typed = typeStep(state.keymap, before, press(event));
  const effects: Effect[] = [];
  if (typed.last === 'ok') effects.push({ kind: 'sound', sound: 'key' });
  if (typed.last === 'error') effects.push({ kind: 'sound', sound: 'miss' });
  if (typed.hint !== null && typed.hint !== before.hint) effects.push({ kind: 'hint', hint: typed.hint });
  const counted = typed.last === 'ok' || typed.last === 'error';
  const presses = counted ? [...state.presses, { ch: (before.text[before.pos] ?? '').toLowerCase(), ok: typed.last === 'ok' }] : state.presses;
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
