/** Общая подготовка тестов Кубка (068-Т1): прохождение группы и плей-офф по заданным исходам. Не тест. */
import { emptyCup, recordKo, recordTour } from '../../src/engine/cup/section';
import { KO_ROUNDS } from '../../src/engine/cup/rounds';
import type { Cup, CupCtx } from '../../src/engine/cup/types';

export const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13);
export const ctx = (over: Partial<CupCtx> = {}): CupCtx => ({ cur: 1, day: '2026-11-20', dayN: 5, pause5: false, seed: 1, ...over });

/** Исходы трёх туров: W — 2:1, D — 1:1. */
export type Res = 'W' | 'D';
export const ALL_RES: Res[][] = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => [0, 1, 2].map((i): Res => ((n >> i) & 1 ? 'D' : 'W')));

export function playGroup(res: readonly Res[], cup: Cup = emptyCup()): Cup {
  let c = cup;
  res.forEach((r, i) => {
    c = recordTour(c, i + 1, r === 'W' ? 2 : 1, 1);
  });
  return c;
}

/** Группа пройдена, первые `n` раундов плей-офф выиграны 2:1. */
export function playKo(cup: Cup, n: number): Cup {
  let c = cup;
  KO_ROUNDS.slice(0, n).forEach((r) => {
    c = recordKo(c, r, 2, 1, null, '2026-11-20');
  });
  return c;
}
