/**
 * Генераторы числовых задач (ТЗ-6.12): та же задача, другие числа. Семя приходит снаружи, поэтому по одному
 * семени — одна задача (в тесте повторяется). Условие собирает i18n по номеру шаблона (`template`) и числам (`nums`),
 * здесь только числа и ответ: тексты — не дело движка. Шаблон (`steps`) — шаги решения числами.
 */
import { createRandom, randomInt } from '../random';
import type { ExprAnswer, IntegerAnswer } from './answers';

/** Целое в [lo, hi] включительно. */
const int = (rnd: () => number, lo: number, hi: number): number => lo + randomInt(rnd, hi - lo + 1);

/** Шаблоны: матчи «каждый с каждым», клетки поля «ширина и ещё k», очки за победы и ничьи. */
export const genTemplates = ['round-robin', 'field-area', 'points'] as const;
export type GenTemplate = (typeof genTemplates)[number];

/** Сгенерированная задача: nums — числа условия по порядку шаблона, answer — верный ответ, solution — шаги решения числами. */
export interface GeneratedTask {
  template: GenTemplate;
  nums: readonly number[];
  answer: IntegerAnswer | ExprAnswer;
  /** Шаги решения числами, например «6 · 5 = 30; 30 : 2 = 15». */
  steps: string;
}

/** Круговой турнир из n команд: n · (n − 1) : 2 матчей. nums = [n]. */
function roundRobin(rnd: () => number): GeneratedTask {
  const n = int(rnd, 4, 12);
  const value = (n * (n - 1)) / 2;
  return { template: 'round-robin', nums: [n], answer: { kind: 'integer', value }, steps: `${n} · ${n - 1} = ${n * (n - 1)}; ${n * (n - 1)} : 2 = ${value}` };
}

/** Поле: ширина w, длина на k больше; поля выражения «w × (w + k) = S». nums = [w, k]. */
function fieldArea(rnd: () => number): GeneratedTask {
  const w = int(rnd, 3, 9);
  const k = int(rnd, 2, 4);
  const s = w * (w + k);
  return {
    template: 'field-area',
    nums: [w, k],
    answer: { kind: 'expr', parts: [null, '×', '(', null, `+ ${k}`, ')', '=', null], values: [w, w, s] },
    steps: `${w} + ${k} = ${w + k}; ${w} · ${w + k} = ${s}`,
  };
}

/** Очки: w побед по 3 и d ничьих по 1. nums = [w, d]. */
function points(rnd: () => number): GeneratedTask {
  const w = int(rnd, 2, 7);
  const d = int(rnd, 1, 4);
  const value = 3 * w + d;
  return { template: 'points', nums: [w, d], answer: { kind: 'integer', value }, steps: `3 · ${w} = ${3 * w}; ${3 * w} + ${d} = ${value}` };
}

const makers: Record<GenTemplate, (rnd: () => number) => GeneratedTask> = {
  'round-robin': roundRobin,
  'field-area': fieldArea,
  points,
};

/** Задача по шаблону и семени: числа и ответ; повторимо. */
export function generateTask(template: GenTemplate, seed: number): GeneratedTask {
  return makers[template](createRandom(seed));
}
