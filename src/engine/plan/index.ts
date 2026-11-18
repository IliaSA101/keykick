/**
 * План урока по методике 011 на данных пакета (060-Т9а, 060-Р4): `planLesson` — контракт Т9а → Т9б.
 * Чистая функция: зерно и статистика ошибок приходят снаружи, результат при том же зерне — тот же бит в бит
 * (голден `tests/golden/plan/ru.yard.json`). Строки делают `warmup.ts` и `attack.ts`.
 */
import type { Keymap } from '../typing/keymap';
import type { TypingStats } from '../typing/typing';
import { makeCourseHalf, makeExtraAttack, wrapRows } from './attack';
import type { CourseLesson, Dictionary } from './lesson';
import { makeCourseWarmup } from './warmup';

/** Фаза матча, к которой относится атака: разминка, тайм 1, тайм 2, доп. время. */
export type Phase = 'warmup' | 'half1' | 'half2' | 'extra';

/**
 * Одна атака плана: что напечатать подряд. `rows` — строки на экране (перенос по `rowWidth` урока); у удара разминки
 * строки — сам удар. Знаки строк набираются без перерыва между строками одной атаки.
 */
export interface Attack {
  phase: Phase;
  /** Номер в фазе, с 0: удар разминки или атака тайма. */
  index: number;
  rows: string[];
}

/**
 * Весь план урока в порядке матча: два удара разминки, атаки тайма 1, атаки тайма 2 (в последней — ловушка смены,
 * если урок с `trap`), доп. атака. `keymap` — карта клавиатуры сборки (раскладка урока — `lesson.layout`);
 * `stats` — ошибки игрока по клавишам: буквы с ошибками встречаются чаще, у уроков с `focusWeak` — в фокусе.
 */
export function planLesson(lesson: CourseLesson, dict: Dictionary, keymap: Keymap, seed: number, stats?: TypingStats): Attack[] {
  const wrap = (line: string): string[] => wrapRows(line, lesson.rowWidth);
  const warmup = makeCourseWarmup(lesson, dict, keymap, seed, stats).map((rows, index): Attack => ({ phase: 'warmup', index, rows }));
  const half = (second: boolean): Attack[] =>
    makeCourseHalf(lesson, dict, keymap, seed, stats, second).map((line, index): Attack => ({ phase: second ? 'half2' : 'half1', index, rows: wrap(line) }));
  const extra: Attack = { phase: 'extra', index: 0, rows: wrap(makeExtraAttack(lesson, dict, keymap, seed, stats)) };
  return [...warmup, ...half(false), ...half(true), extra];
}
