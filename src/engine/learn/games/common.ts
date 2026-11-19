/**
 * Общее у правил учебных игр (067 Т5, ТЗ-7.1, 7.5): итог игры для `finishLearn` — запуск с числом промахов и временем.
 * Правила игр чистые: время (`at`) и зерно приходят снаружи.
 */
import { stepLearn, type LearnRun } from '../steps';

/** Что есть у состояния любой игры. */
export interface Playing {
  misses: number;
  done: boolean;
}

/** Точка на арене. */
export interface Pt {
  x: number;
  y: number;
}

/**
 * Итог для `finishLearn` — единственный путь от состояния игры к запуску (К-Г, 067 design §3). Промахи берутся из состояния;
 * игра не доделана — запуск без времени (ничего не засчитано, ТЗ-7.4); доделана — время считает `stepLearn`.
 * Законченный запуск (`ms` уже есть) не меняется: повтор не перезаписывает время и промахи.
 */
export function settle(run: LearnRun, state: Playing, at: number): LearnRun {
  if (run.ms !== null) return run;
  const counted = { ...run, misses: state.misses };
  return state.done ? stepLearn(counted, { type: 'finish', at }) : counted;
}
