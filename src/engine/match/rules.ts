/** Правила матча (ТЗ-2.23, 060-Т9б): пороги атаки и перерыв. Снимаются на `start` (059 С-25). */
import type { MatchRules, Outcome } from './types';

/** По умолчанию — правило сына (ТЗ-2.23): 0 ошибок — гол, 1–2 — сейв, 3 и больше — гол соперника. Перерыв — 5 с (060-Р21). */
export const DEFAULT_RULES: Readonly<MatchRules> = { goalMax: 0, concedeMin: 3, breakMs: 5000 };

const whole = (n: number | undefined, fallback: number, min: number): number =>
  n === undefined || !Number.isFinite(n) ? Math.max(min, fallback) : Math.max(min, Math.floor(n));

/**
 * Правила на старт: недостающие поля — по умолчанию, дробное и отрицательное — к целому не ниже 0, а порог гола
 * соперника — всегда выше порога гола (иначе сейва между ними нет и «≤ g» спорит с «≥ c»).
 */
export function snapshotRules(rules: Partial<MatchRules>): Readonly<MatchRules> {
  const goalMax = whole(rules.goalMax, DEFAULT_RULES.goalMax, 0);
  return {
    goalMax,
    concedeMin: whole(rules.concedeMin, DEFAULT_RULES.concedeMin, goalMax + 1),
    breakMs: whole(rules.breakMs, DEFAULT_RULES.breakMs, 0),
  };
}

/** Исход атаки по числу ошибок: ≤ goalMax — гол, ≥ concedeMin — гол соперника, между — сейв. */
export function attackOutcome(errors: number, rules: Pick<MatchRules, 'goalMax' | 'concedeMin'>): Outcome {
  if (errors <= rules.goalMax) return 'goal';
  return errors >= rules.concedeMin ? 'concede' : 'save';
}
