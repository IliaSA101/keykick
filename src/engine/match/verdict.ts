/** Итог матча (ТЗ-2.4, 2.5, 2.8, 060-Т9б): победа, ничья или поражение, зачёт и что переигрывать. */
import type { TypingStats } from '../typing/typing';
import type { MatchResult, Replay, RunningMatch, Score, Verdict } from './types';

/** Счёт с голом пенальти (ТЗ-2.6): по нему — победа, доп. время и переигровка, но не звёзды. */
export const totalOf = (s: Pick<RunningMatch, 'score' | 'penalty'>): Score => ({ me: s.score.me + (s.penalty.scored ? 1 : 0), opp: s.score.opp });

/** Счётчики без разминки: всё, что набрано после её конца (ТЗ-2.3: ошибки разминки — только в подстройку). */
export function playStats(stats: TypingStats, warm: TypingStats | null): TypingStats {
  if (warm === null) return stats;
  return { ...stats, correct: stats.correct - warm.correct, errors: stats.errors - warm.errors, intervals: stats.intervals.slice(warm.intervals.length) };
}

export const verdictOf = (score: Score): Verdict => (score.me > score.opp ? 'win' : score.me < score.opp ? 'loss' : 'draw');

/** Нужна ли доп. атака: после 2-го тайма ничья (ТЗ-2.5). */
export const isDraw = (score: Score): boolean => score.me === score.opp;

/**
 * Что переигрывать (ТЗ-2.8): 2-й тайм, если 1-й не проигран (его счёт сохраняется), иначе оба. Победа — ничего.
 * Доп. время на выбор тайма не влияет: смотрим только на счёт 1-го.
 */
export function replayOf(verdict: Verdict, half1: Score): Replay | null {
  if (verdict === 'win') return null;
  return half1.me >= half1.opp ? 'half2' : 'both';
}

export function makeResult(s: RunningMatch): MatchResult {
  const total = totalOf(s);
  const verdict = verdictOf(total);
  return {
    verdict,
    score: s.score,
    total,
    penalty: s.penalty,
    half1: s.half1,
    half2: s.half2,
    extra: s.extra,
    replay: replayOf(verdict, s.half1),
    // Товарищеский засчитывается всегда, остальные — победой (ТЗ-2.4).
    counted: s.friendly || verdict === 'win',
    stats: s.stats,
    play: playStats(s.stats, s.warm),
    presses: s.presses,
  };
}
