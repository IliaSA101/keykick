/**
 * Матч v2 (спека 017, design §2): исход атаки по запасу ошибок, мячи запаса, счёт, решающая атака.
 * Чистые функции без Vue и DOM; пороги `g`, `c` приходят из урока (или его копии, `lessonCopy.ts`).
 */

export type AttackOutcome = 'goal' | 'save' | 'conceded';

/** ТЗ-2.3: ошибок `e ≤ g` — гол; `e ≥ c` — гол соперника; иначе сейв. Граница `e = g` — ещё гол. */
export function attackOutcome(errors: number, g: number, c: number): AttackOutcome {
  if (errors <= g) return 'goal';
  if (errors >= c) return 'conceded';
  return 'save';
}

/** Подпись над мячами: «можно ошибиться ещё N», «дальше без ошибок» (при e = g) или ничего (e > g). */
export type ReserveHint = { kind: 'more'; n: number } | { kind: 'last' } | { kind: 'none' };

export interface ReserveView {
  /** Всего мячей: `c − 1` (017-Р13). */
  total: number;
  /** Сколько ещё горит. */
  left: number;
  /** Сколько горящих мячей ещё красят «гол»: ошибки гасят мячи слева направо, и первыми гаснут цветные (`g − e`). */
  goalLit: number;
  /** Сколько первых мячей (считая погасшие) окрашено «гол»: `max(g, e)` в пределах `total` — для рисования мячей. */
  goalBalls: number;
  hint: ReserveHint;
}

export function reserveView(errors: number, g: number, c: number): ReserveView {
  const total = Math.max(0, c - 1);
  const left = Math.max(0, total - errors);
  const hint: ReserveHint = errors < g ? { kind: 'more', n: g - errors } : errors === g ? { kind: 'last' } : { kind: 'none' };
  // Цветные мячи «гол» гаснут первыми: при e > g гола уже нет, цветной мяч не должен гореть (017-Р13, ревью Т1).
  return { total, left, goalLit: Math.max(0, g - errors), goalBalls: Math.min(total, Math.max(g, errors)), hint };
}

/** Бывает ли сейв: между «гол» (e ≤ g) и «гол соперника» (e ≥ c) есть число ошибок — правило вступления (design §1). */
export const saveExists = (g: number, c: number): boolean => c - g > 1;

/** Счёт матча: голы печатью (оба тайма и доп. время), голы с пенальти, пропущенные. */
export interface MatchScore {
  typed: number;
  kick: number;
  conceded: number;
}

export const emptyScore: MatchScore = { typed: 0, kick: 0, conceded: 0 };

/** Счёт после исхода атаки: сейв его не меняет. */
export function addOutcome(score: MatchScore, outcome: AttackOutcome): MatchScore {
  if (outcome === 'goal') return { ...score, typed: score.typed + 1 };
  if (outcome === 'conceded') return { ...score, conceded: score.conceded + 1 };
  return score;
}

export function addKick(score: MatchScore, scored: boolean): MatchScore {
  return scored ? { ...score, kick: score.kick + 1 } : score;
}

/** Разница голов с учётом пенальти. */
export const goalDiff = (s: MatchScore): number => s.typed + s.kick - s.conceded;

export type MatchResult = 'win' | 'draw' | 'loss';

/** Итог по общему счёту (ТЗ-2.4): победа — голов больше, ничья ведёт в доп. время. */
export function matchResult(s: MatchScore): MatchResult {
  const d = goalDiff(s);
  return d > 0 ? 'win' : d < 0 ? 'loss' : 'draw';
}

/**
 * Решающая атака (ТЗ-2.4, 017-Р2): последняя атака 2-го тайма, если её исход меняет «победа / доп. время / поражение»
 * (до неё разница в −1…+1), и атака доп. времени. `before` — счёт до этой атаки.
 */
export function isDecisive(
  // attack — номер атаки с 1 (последняя: attack === attacks).
  where: { half: 1 | 2 | 'extra'; attack: number; attacks: number },
  before: MatchScore,
): boolean {
  if (where.half === 'extra') return true;
  if (where.half === 1 || where.attack !== where.attacks) return false;
  const d = goalDiff(before);
  return d >= -1 && d <= 1;
}
