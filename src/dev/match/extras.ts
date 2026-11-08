/**
 * Витрина итога матча v2 (спека 017, Т7): `ResultExtras` для сцены — кошелёк, потолок звёзд, рост формы.
 * Числа выдуманы для кадра (остаток кошелька 8, ранги), честные только потолок и верные нажатия матча.
 */
import { earn } from '../../engine/matchResult/coins';
import { formGrowth, type FingerForm, type FormState } from '../../engine/matchResult/form';
import type { MatchState } from '../../engine/match/machine';
import type { ResultExtras } from '../../engine/matchResult/resultModel';
import { rules } from './driver';

const CARRY_BEFORE = 8;

/** Ранги отчёта по порядку состава (`rules.squad`): юниор…звезда. */
const REPORT_RANKS = [3, 2, 2, 4, 1, 2, 3, 0];

/** Окно из `n` нажатий, из них верных `ok` — для «+N %» (нужно не меньше `minPresses` до матча). */
const bits = (n: number, ok: number): boolean[] => Array.from({ length: n }, (_, i) => i < ok);
const rank = (maxRank: number, recent: boolean[] = []): FingerForm => ({ recent, maxRank, candidate: null });

export function extrasOf(s: MatchState, scene: string): ResultExtras {
  const prints = [s.first, s.second, s.extra].filter((p) => p !== null);
  const correct = prints.reduce((n, p) => n + p.correct, 0);
  const won = earn(CARRY_BEFORE, correct, rules.coinPer);
  // li: ранг и +4 %; rr: ранг без процентов (в окне не было базы); lp: только +2 % без смены ранга.
  const before: FormState = { li: rank(1, bits(100, 90)), rr: rank(0), lp: rank(0, bits(100, 80)) };
  const after: FormState = { li: rank(2, bits(100, 94)), rr: rank(1, bits(100, 91)), lp: rank(0, bits(100, 82)) };
  return {
    help: s.help,
    softened: s.cfg.softened,
    rules,
    paid: true,
    correct,
    coins: won.coins,
    carry: won.carry,
    growth: scene === 'growth' || scene === 'report' ? formGrowth(before, after, rules.squad, rules.form) : [],
    report: scene === 'report' ? rules.squad.map((p, i) => ({ name: p.name, rank: REPORT_RANKS[i] ?? 0 })) : null,
  };
}
