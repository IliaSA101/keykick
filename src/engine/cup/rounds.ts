/**
 * Раунды Кубка Двора на пути ребёнка (ТЗ-8.1, 8.3, 048-Р36, 038-Р16, 068 design §4): семь флажков-якорей, состояние каждого,
 * следующий матч и раунд для главной кнопки Дома. Раунд открыт ⇔ якорь пройден ∧ прошлый раунд выигран ∧ игровой день ≥ 3.
 * Чистые функции: день и номер урока приходят снаружи.
 */
import { ROUNDS, isHomeRound } from '../home/yard';
import type { Cup, CupCtx, CupNext, CupStage, KoRound, RoundKey, RoundState } from './types';

/** Раунды плей-офф по порядку: 1/8, 1/4, полуфинал, финал. */
export const KO_ROUNDS: readonly KoRound[] = ['r16', 'qf', 'sf', 'f'];
/** Семь раундов ребёнка по порядку: три тура группы и плей-офф (они же ключи паков). */
export const ROUND_KEYS: readonly RoundKey[] = ['g1', 'g2', 'g3', ...KO_ROUNDS];

/** Урок-якорь раунда: Двор — 9, 14, 18 / 21, 24, 28, 32 (`content/yard.json`, ТЗ-8.3). */
export const anchorOf = (round: RoundKey): number => ROUNDS[ROUND_KEYS.indexOf(round)]!;

/** Выигран ли каждый из семи раундов: тур группы засчитан, раунд плей-офф выигран. */
export function wonRounds(cup: Cup): boolean[] {
  return ROUND_KEYS.map((r, i) => (i < 3 ? cup.tours[i]!.me !== null : cup.ko[r as KoRound].won));
}

const triesOf = (cup: Cup, i: number): number => (i < 3 ? cup.tours[i]!.tries : cup.ko[ROUND_KEYS[i] as KoRound].tries);

/** Состояния семи раундов по порядку: `won` позади, первый невыигранный — `before | day3 | later | open | replay`, дальше `wait` (якорь пройден) или `before`. */
export function roundStates(cup: Cup, ctx: Pick<CupCtx, 'cur' | 'dayN'>): RoundState[] {
  const won = wonRounds(cup);
  const cur = won.indexOf(false);
  return ROUND_KEYS.map((_, i) => {
    if (won[i]) return 'won';
    const passed = ctx.cur > ROUNDS[i]!;
    if (i !== cur) return passed ? 'wait' : 'before';
    if (!passed) return 'before';
    if (ctx.dayN < 3) return ctx.dayN === 2 ? 'later' : 'day3';
    return triesOf(cup, i) > 0 ? 'replay' : 'open';
  });
}

/** Этап Кубка: туры группы 1–3, раунды плей-офф, `done` — титул золотой. */
export function cupStage(cup: Cup): CupStage {
  const i = wonRounds(cup).indexOf(false);
  if (i < 0) return 'done';
  return i < 3 ? (`group${i + 1}` as CupStage) : (ROUND_KEYS[i] as KoRound);
}

/** Следующий матч ребёнка. `rivalOf` отдаёт соперника раунда (группа — по турам, плей-офф — по сетке). */
export function nextMatch(cup: Cup, ctx: CupCtx, rivalOf: (r: RoundKey) => string | null): CupNext {
  const i = wonRounds(cup).indexOf(false);
  if (i < 0) return { round: null, flag: null, rival: null, home: false, state: 'done', warmup: false };
  const round = ROUND_KEYS[i]!;
  const state = roundStates(cup, ctx)[i]!;
  const playable = state === 'open' || state === 'replay';
  return { round, flag: ROUNDS[i]!, rival: rivalOf(round), home: isHomeRound(ROUNDS[i]!), state, warmup: playable && ctx.pause5 };
}

/** Флажок раунда для главной кнопки Дома (`HomeInput.round`): урок-якорь открытого раунда или `null`. */
export function cupRound(cup: Cup, ctx: Pick<CupCtx, 'cur' | 'dayN'>): number | null {
  const i = wonRounds(cup).indexOf(false);
  if (i < 0) return null;
  const s = roundStates(cup, ctx)[i];
  return s === 'open' || s === 'replay' ? ROUNDS[i]! : null;
}
