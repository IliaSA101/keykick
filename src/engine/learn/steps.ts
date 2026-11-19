/**
 * Общий каркас учебной игры (ТЗ-7.5, 7.6; 067 К-Г): запуск, промахи, конец, ступень и карточка «Права на компьютер».
 * Правил конкретных игр здесь нет — они в `games/*` (Т5): каркасу нужны только «промах» и «доделал». Время приходит снаружи.
 */
import cfg from '../../content/learn.json';
import { GAMES, gameOf, type LearnCtx } from './queue';
import type { Learn } from './section';

/** Ступени (ТЗ-7.5): 0 — нет, 1 бронза — доделал, 2 серебро — ≤ 1 промаха, 3 золото — 0 промахов и время ≤ T. */
export type Step = 0 | 1 | 2 | 3;

export interface LearnRun {
  /** Идентификатор запуска: ключ оплаты кассы (повтор — без второй награды). */
  id: string;
  game: string;
  seed: number;
  startedAt: number;
  misses: number;
  /** Время доделки, мс; `null` — идёт. */
  ms: number | null;
}

export type LearnInput = { type: 'miss' } | { type: 'finish'; at: number };

export function startLearn(game: string, ctx: Pick<LearnCtx, 'now'>, seed: number): LearnRun {
  if (!GAMES.some((g) => g.id === game)) throw new Error(`unknown learn game: ${game}`);
  return { id: `learn-${game}-${ctx.now}-${seed}`, game, seed, startedAt: ctx.now, misses: 0, ms: null };
}

/** Ввод в игру: промах считается, конец фиксирует время; после конца ввод игнорируется. */
export function stepLearn(run: LearnRun, input: LearnInput): LearnRun {
  if (run.ms !== null) return run;
  if (input.type === 'miss') return { ...run, misses: run.misses + 1 };
  return { ...run, ms: Math.max(0, input.at - run.startedAt) };
}

/** Ступень за эту игру; `null` — игра не доделана (пропуск: ничего не засчитано). */
export function stepOf(run: LearnRun): Step | null {
  const def = GAMES.find((g) => g.id === run.game);
  if (run.ms === null || def === undefined) return null;
  if (run.misses === 0 && run.ms <= def.t * 1000) return 3;
  return run.misses <= 1 ? 2 : 1;
}

/** Где ребёнок: «Права» не показываются посреди тайма (ТЗ-7.6). */
export type Moment = 'break' | 'base' | 'half';

export interface Right {
  id: string;
  /** Умение есть (бронза и выше). */
  have: boolean;
  /** Ступень умения, 0…3 (036-Р4: умения «со ступенью»). */
  step: number;
  /** «Нужно к «Школе», тур N»; `null` — тур не нужен. */
  tour: number | null;
}

export interface RightsCard {
  items: Right[];
  /** Сколько показывать, мс. */
  showMs: number;
}

/** Умений-бронз у игрока. */
export const bronzeCount = (learn: Learn): number => GAMES.filter((g) => gameOf(learn, g.id).step >= 1).length;

/**
 * Карточка «Права на компьютер» (ТЗ-7.6): после игры, давшей новое умение, если бронз уже не меньше второй; не посреди тайма.
 * `gained` — игра дала новое умение (была 0, стала ≥ 1).
 */
export function rightsCard(learn: Learn, gained: boolean, moment: Moment): RightsCard | null {
  if (!gained || moment === 'half' || bronzeCount(learn) < cfg.rights.minBronze) return null;
  return { items: GAMES.map((g) => ({ id: g.id, have: gameOf(learn, g.id).step >= 1, step: gameOf(learn, g.id).step, tour: g.tour })), showMs: cfg.rights.showMs };
}
