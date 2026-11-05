/**
 * Пенальти по ходу матча (спека 005): когда назначается, что даёт и как пишется удар.
 * Первое — по зерну после атаки 2, 3 или 4 первого тайма; второе — во втором тайме за две чистые
 * атаки подряд, не позже атаки 4 (005-Р1) и только если следующая строка — не из решающей серии
 * (008-Р7: в районе — после атак 2–3). Не больше одного за тайм и двух за матч; в разминке,
 * после последней строки тайма и после атаки 4 — нет.
 * Верно — гол в счёт (match.ts, addPenalty) и MID_GOAL_COINS; промах с ответом — MISS_COINS;
 * «Не бить» — ничего. Пишется с таймом (save.ts, HalfResult.penalties): перезагрузка на задаче
 * не даёт награды дважды (005-Р5). Случайность — зерном снаружи.
 */
import { MATCH_HALVES, addPenalty, type AttackResult, type MatchScore } from './match';
import { createRandom, randomInt } from './random';
import { PENALTY_COINS } from './rewards';

/** Монеты за гол с пенальти посреди матча — как за гол в серии после матча. */
export const MID_GOAL_COINS = PENALTY_COINS;
/** Монеты за промах с ответом — и посреди матча, и в серии после матча (005-Р3, 005-Р9). */
export const MISS_COINS = 2;

/** Самая ранняя и самая поздняя атака тайма (с 1), после которой бывает пенальти. */
export const PENALTY_FROM_ATTACK = 2;
export const PENALTY_TO_ATTACK = 4;

/** План матча: после какой атаки первого тайма (с 1) — пенальти. */
export interface MidPenaltyPlan {
  first: number;
}

/** Итог удара: гол, вратарь отбил (ответ неверный), «Не бить» (Esc). */
export type KickResult = 'scored' | 'missed' | 'skipped';

/** Удар посреди матча: задача и итог. */
export interface MidKick {
  taskId: string;
  result: KickResult;
}

/** План по зерну матча: первое пенальти — после атаки 2, 3 или 4 первого тайма. */
export function penaltyPlan(seed: number): MidPenaltyPlan {
  const span = PENALTY_TO_ATTACK - PENALTY_FROM_ATTACK + 1;
  return { first: PENALTY_FROM_ATTACK + randomInt(createRandom(seed), span) };
}

/**
 * Второй тайм: пенальти заработано — две последние атаки тайма чистые (гол), и сыграно
 * от PENALTY_FROM_ATTACK до PENALTY_TO_ATTACK атак. results — атаки этого тайма по порядку.
 */
export function earnedPenalty(results: readonly AttackResult[]): boolean {
  const n = results.length;
  if (n < PENALTY_FROM_ATTACK || n > PENALTY_TO_ATTACK) return false;
  return results[n - 1] === 'goal' && results[n - 2] === 'goal';
}

/**
 * Пенальти сейчас — после только что сыгранной атаки. half — тайм с 1; attacks — атаки этого тайма
 * (не всего матча); lines — строк в тайме; taken — в этом тайме пенальти уже было (в том числе «Не бить»);
 * seriesFrom — первая строка решающей серии (match.ts, seriesFrom).
 * После последней строки тайма пенальти нет: там перерыв или конец матча. Во втором тайме нет и тогда,
 * когда следующая строка (номер n) — из серии: пенальти переиграло бы её и съело надпись (008-Р7, 005-Р22).
 */
export function penaltyNow(
  plan: MidPenaltyPlan,
  half: number,
  attacks: readonly AttackResult[],
  lines: number,
  taken: boolean,
  seriesFrom: number,
): boolean {
  const n = attacks.length;
  if (taken || n >= lines) return false;
  if (half === 1) return n === plan.first;
  return half === MATCH_HALVES && n < seriesFrom && earnedPenalty(attacks);
}

/**
 * Удар — в список тайма. Задача уже в списке (двойной Enter, повторный ответ после решения) —
 * тот же список: пишется только первый ответ.
 */
export function recordKick(kicks: readonly MidKick[], taskId: string, result: KickResult): readonly MidKick[] {
  if (taskId === '' || kicks.some((k) => k.taskId === taskId)) return kicks;
  return [...kicks, { taskId, result }];
}

/** Первые удары по каждой задаче: повтор той же задачи не считается второй раз. */
function firstKicks(kicks: readonly MidKick[]): MidKick[] {
  return kicks.filter((k, i) => kicks.findIndex((o) => o.taskId === k.taskId) === i);
}

/** Монеты за удары: гол — MID_GOAL_COINS, промах — MISS_COINS, «Не бить» — 0. */
export function penaltyCoins(results: readonly MidKick[]): number {
  const coins: Record<KickResult, number> = { scored: MID_GOAL_COINS, missed: MISS_COINS, skipped: 0 };
  return firstKicks(results).reduce((sum, k) => sum + coins[k.result], 0);
}

/** Решённые ударами задачи — в решённые игрока (их реже дают снова). */
export function scoredTasks(results: readonly MidKick[]): string[] {
  return firstKicks(results)
    .filter((k) => k.result === 'scored')
    .map((k) => k.taskId);
}

/** Повод пенальти: в первом тайме — фол в штрафной (по зерну), во втором — заработано чистыми атаками. */
export type PenaltyReason = 'foul' | 'earned';

/** Пенальти на экране: задача, повод, итог (null — ещё не бил). */
export interface PenaltyTurn {
  taskId: string;
  reason: PenaltyReason;
  result: KickResult | null;
}

/** Повод по тайму: первый тайм — фол, дальше — заработано. */
export function penaltyReason(half: number): PenaltyReason {
  return half === 1 ? 'foul' : 'earned';
}

/** Пенальти, ответ на него и счёт матча вместе — так их меняет ответ. */
export interface KickState {
  turn: PenaltyTurn;
  kicks: readonly MidKick[];
  score: MatchScore;
}

/**
 * Ответ на пенальти: засчитывается только первый (двойной Enter, двойной клик, Esc после ответа —
 * то же состояние, тем же объектом). Гол или промах — в счётчик пенальти, гол — и в счёт;
 * «Не бить» — только в удары тайма (место в тайме занято, 005-Р13).
 */
export function settleKick(state: KickState, result: KickResult): KickState {
  if (state.turn.result !== null) return state;
  const kicks = recordKick(state.kicks, state.turn.taskId, result);
  const counted = kicks !== state.kicks && result !== 'skipped';
  return {
    turn: { ...state.turn, result },
    kicks,
    score: counted ? addPenalty(state.score, result === 'scored') : state.score,
  };
}
