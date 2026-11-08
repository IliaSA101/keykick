/**
 * Цепочки сохранения (спека 018-Т5, design §8): длинные случайные сценарии на `createSaveStore` 014 и слое `updatePlayer`
 * над поддельным хранилищем; 4 игрока, часы идут от действия. После каждого шага — семь инвариантов (ТЗ-13.8, 0.11, 0.3, 12.10).
 * Действия разделов — `tests/chain/<name>.ts` (маска), общие и окружение — `tests/chain/run.ts`. Сторож («видит ли нарушение») —
 * tests/saveChainGuards.test.ts. Упало — в сообщении семя, шаг, действие, инвариант;
 * повтор: `KK_SEED=<семя> npx vitest run tests/saveChain.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { REWARD_SOURCES } from '../src/engine/save/rewards';
import type { ChainAction } from './chain/types';
import { PLAYERS, STEPS, checkJournal, common, inTx, lying, runChain, type Env, type Step } from './chain/run';

const SEEDS = [1, 7, 42, 101, 2024, 31337, 777, 5150, 90210, 20251108];

// Действия разделов — маской: новый раздел кладёт свой файл в tests/chain и ничего больше не правит.
const files = import.meta.glob<{ actions?: ChainAction[] }>('./chain/*.ts', { eager: true });
const sectionActions: ChainAction[] = Object.values(files).flatMap((m) => m.actions ?? []);

const fromEnv = process.env.KK_SEED === undefined ? [] : [Number(process.env.KK_SEED)];
const seeds = [...SEEDS, ...fromEnv.filter((s) => Number.isInteger(s))];
const pool: Step[] = [...common, ...sectionActions.map(inTx)];

/** Прогоны полного пула по семенам: считаются один раз, дальше их берут остальные кейсы (файл ≤ 2 с). */
const ran = new Map<number, Env>();
const fullRun = (seed: number): Env => {
  const cached = ran.get(seed);
  if (cached) return cached;
  const env = runChain(seed, STEPS, pool);
  ran.set(seed, env);
  return env;
};

describe('цепочки сохранения: 4 игрока, 200 шагов, семь инвариантов', () => {
  // Ловит: любую поломку записи при длинной смене игроков, перезагрузок и чужих вкладок — разделы не по check, дробные числа,
  // убывшие счётчики, награда мимо объявленной, чужие ключи, память ≠ лежащее, потеря записи при чужой кассе.
  it.each(seeds)('семя %i', (seed) => {
    fullRun(seed);
  });

  // Ловит: пул без действий разделов или без общих — цепочка зелёная, но ничего не проверяет.
  it('пул: общие действия и все пять разделов на месте, награды — из REWARD_SOURCES', () => {
    const names = pool.map((s) => s.name);
    for (const need of ['switchPlayer', 'reload', 'secondTab', 'pause', 'lossStreak']) expect(names).toContain(need);
    for (const prefix of ['club.', 'course.', 'match.', 'wallet.', 'school.']) expect(names.some((n) => n.startsWith(prefix)), prefix).toBe(true);
    for (const s of pool) for (const r of s.rewards) expect(Object.keys(REWARD_SOURCES), s.name).toContain(r);
  });

  // Ловит: ТЗ-0.11 — пауза или серия провалов уменьшает счётчик (в т. ч. через `mayDecrease` «на всякий случай»).
  it('pause и lossStreak: без mayDecrease, цепочка из них и матчей счётчики не убавляет', () => {
    const ours = pool.filter((s) => ['pause', 'lossStreak', 'match.finish', 'course.pass', 'wallet.spend'].includes(s.name));
    expect(ours.find((s) => s.name === 'pause')?.mayDecrease).toBeUndefined();
    expect(ours.find((s) => s.name === 'lossStreak')?.mayDecrease).toBeUndefined();
    for (const seed of seeds.slice(0, 2)) runChain(seed, STEPS, ours);
  });

  // Ловит: игрок 2–4 портят ключи друг друга или журнал сводит монеты не по игроку (ТЗ-12.10).
  it('4 игрока: у каждого свой кошелёк и журнал, чужие ключи побайтно прежние', () => {
    const env = fullRun(SEEDS[0] as number);
    const earned = PLAYERS.map((id) => (lying(env, id).wallet as { earned: number }).earned);
    expect(earned.filter((e) => e > 0).length).toBeGreaterThan(1);
    expect(new Set(env.journal.map((j) => j.player)).size).toBeGreaterThan(1);
    expect(checkJournal(env)).toEqual([]);
  });
});
