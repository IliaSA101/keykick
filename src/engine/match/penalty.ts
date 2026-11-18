/**
 * Пенальти матча (ТЗ-2.7): одно на матч, во 2-м тайме, после первой чистой атаки. Верно — гол и «+1 к Знатоку»,
 * промах или «Не бить» — без гола; монет не даёт никогда (касса пенальти не платит), звезду не даёт (ТЗ-2.6).
 */
import type { Phase } from '../plan';
import type { Outcome, PenaltyAnswer, PenaltyState, RunningMatch } from './types';

export const noPenalty = (): PenaltyState => ({ offered: false, scored: false });

/** Пора ли предложить пенальти после атаки: 2-й тайм, ещё не предлагали, атака чистая (гол по порогам правил). */
export function penaltyDue(s: Pick<RunningMatch, 'penalty'>, phase: Phase, outcome: Outcome | null): boolean {
  return phase === 'half2' && !s.penalty.offered && outcome === 'goal';
}

/** Гол ли с пенальти по ответу: только `hit`. */
export const penaltyScored = (answer: PenaltyAnswer): boolean => answer === 'hit';
