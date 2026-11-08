/**
 * Матч v2 (спека 017, Т7, design §3, §4, §6, §8): что показать на итоге — вид итога, «чего не хватило», потолок
 * звёзд, кнопки и их порядок, монеты и рост формы. Чистая функция: тексты подставляет компонент (`i18n`).
 */
import { untilCoin } from './coins';
import type { FormGrowth } from './form';
import type { MatchResultInfo } from '../match/view';
import type { MatchRules } from '../match/rules';
import { shortfall, starCap, type Help, type Offer } from '../match/verdict';

/** Строка отчёта о форме (контрольные уроки): игрок-палец и его ранг (0 — «юниор»). */
export interface ReportRow {
  name: string;
  rank: number;
}

/** Всё, что итогу нужно кроме `MatchResultInfo`: собирает поток матча (`app/match/flow`) или витрина. */
export interface ResultExtras {
  help: Help;
  softened: boolean;
  /** Правила: потолок звёзд (`starCap`), потолки кнопок помощи, порог ★★★ (доля 0–1), монета. */
  rules: Pick<MatchRules, 'help' | 'threeStar' | 'coinPer'>;
  /** Урок оплачивается (`isPaid`). */
  paid: boolean;
  /** Верные нажатия матча, монеты за них и остаток кошелька после матча. */
  correct: number;
  coins: number;
  carry: number;
  /** Выросшие пальцы (`formGrowth`): падение не показывается. */
  growth: FormGrowth[];
  /** Отчёт по 8 игрокам на контрольных уроках (14 и 21); иначе null. */
  report: ReportRow[] | null;
}

/** Дальше этой разницы в голах «Ещё N голов» звучит приговором (0:8): вместо числа — строка про следующую попытку (017-Р49). */
export const NEAR_GOALS = 2;

export type ResultKind = 'win' | 'penalty' | 'passed' | 'loss';

/** «Чего не хватило» или пояснение к звёздам; текст — в i18n. */
export type ResultWhy =
  | { kind: 'goals'; n: number }
  /** Проигрыш с большим разрывом: ободрение без цифр (017-Р49). */
  | { kind: 'nextTry' }
  | { kind: 'typedOnly' }
  | { kind: 'couldBeBetter' }
  | { kind: 'toTwo' }
  | { kind: 'toThree'; percent: number }
  | { kind: 'capHelp'; cap: number }
  | { kind: 'capSoften'; cap: number };

export interface ResultButton {
  id: Offer | 'next';
  /** Потолок звёзд в подписи кнопки (для `reserve` и `coach`); у остальных 0. */
  stars: number;
}

export interface ResultModel {
  kind: ResultKind;
  /** Голы команды (печать и пенальти) и пропущенные. */
  goals: number;
  conceded: number;
  stars: number;
  newStars: number;
  cap: number;
  why: ResultWhy | null;
  /** Кнопки по порядку; первая выделена, на неё и фокус (Enter). */
  buttons: ResultButton[];
  /** Подсказка «Enter — первая кнопка, Tab — другая» — только когда кнопок две и больше (017-Р30). */
  keysHint: boolean;
  /** Предложение застрявшему (провал 3 и больше подряд): добавить пояснение «помощь — не позор». */
  stuck: boolean;
  coins: { paid: boolean; correct: number; coins: number; left: number };
  growth: FormGrowth[];
  report: ReportRow[] | null;
}

function kindOf(info: MatchResultInfo): ResultKind {
  const v = info.verdict;
  if (!v.passed) return 'loss';
  if (v.typedWin) return 'win';
  return v.couldBeBetter ? 'passed' : 'penalty';
}

function whyOf(info: MatchResultInfo, kind: ResultKind, x: ResultExtras, cap: number): ResultWhy | null {
  const v = info.verdict;
  if (kind === 'loss') {
    const s = shortfall(info.score);
    if (!('goals' in s)) return null;
    return s.goals <= NEAR_GOALS ? { kind: 'goals', n: s.goals } : { kind: 'nextTry' };
  }
  if (kind === 'penalty') return { kind: 'typedOnly' };
  if (kind === 'passed') return { kind: 'couldBeBetter' };
  if (v.stars >= 3) return null;
  if (v.stars < cap) {
    return info.score.conceded > 0 ? { kind: 'toTwo' } : { kind: 'toThree', percent: Math.round(x.rules.threeStar * 100) };
  }
  return x.help === 'none' ? { kind: 'capSoften', cap } : { kind: 'capHelp', cap };
}

const starsOfButton = (id: Offer | 'next', x: ResultExtras): number =>
  id === 'reserve' ? x.rules.help.reserveCap : id === 'coach' ? x.rules.help.coachCap : 0;

export function resultModel(info: MatchResultInfo, x: ResultExtras): ResultModel {
  const kind = kindOf(info);
  const cap = starCap(x.help, x.softened, x.rules);
  const ids: (Offer | 'next')[] = info.verdict.passed ? ['next'] : (info.offer?.options ?? ['quit']);
  return {
    kind,
    goals: info.score.typed + info.score.kick,
    conceded: info.score.conceded,
    stars: info.verdict.stars,
    newStars: info.verdict.newStars,
    cap,
    why: whyOf(info, kind, x, cap),
    buttons: ids.map((id) => ({ id, stars: starsOfButton(id, x) })),
    keysHint: ids.length >= 2,
    stuck: !info.verdict.passed && info.fails >= 3,
    coins: { paid: x.paid, correct: x.correct, coins: x.coins, left: untilCoin(x.carry, x.rules.coinPer) },
    growth: x.growth,
    report: x.report,
  };
}
