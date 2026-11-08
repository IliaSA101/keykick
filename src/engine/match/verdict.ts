/**
 * Матч v2 (спека 017, design §3–4): итог, звёзды, «чего не хватило», `fails` и предложения застрявшему.
 * Чистые функции без Vue и DOM; пороги — из `content/match.json` (`rules.ts`).
 */
import { goalDiff, type MatchScore } from './score';
import { permille } from '../save/section';
import type { MatchRules } from './rules';

/** Помощь, с которой пройден матч: «с запасом» (c + 1) и «с тренером» (g + 1, c + 1). */
export type Help = 'none' | 'reserve' | 'coach';

export type LessonKind = 'lesson' | 'cup';

export interface VerdictInput {
  /** Счёт после доп. времени (его гол уже в `typed`). */
  score: MatchScore;
  /** Товарищеский урок: при поражении тоже пройден (ТЗ-2.4). */
  friendly: boolean;
  /** Точность обоих таймов и доп. времени без разминки, 0–1. */
  accuracy: number;
  help: Help;
  /** Урок идёт смягчённой копией (017-Р8). */
  softened: boolean;
  /** Матчи кубка звёзд не дают. */
  kind: LessonKind;
  /** Лучшее по уроку до матча. */
  best: number;
}

export interface Verdict {
  passed: boolean;
  /** Победа держится на голах печатью — только такая даёт звезду (В-1, ТЗ-2.6). */
  typedWin: boolean;
  stars: number;
  /** Сверх лучшего (ТЗ-4.1). */
  newStars: number;
  /** Пройден поражением товарищеского: подпись «можно лучше». */
  couldBeBetter: boolean;
}

/** Потолок звёзд при помощи и смягчении (ТЗ-2.9, 017-Р16). */
export function starCap(help: Help, softened: boolean, rules: Pick<MatchRules, 'help'>): number {
  const caps = [3];
  if (help === 'reserve') caps.push(rules.help.reserveCap);
  if (help === 'coach') caps.push(rules.help.coachCap);
  if (softened) caps.push(rules.help.softenCap);
  return Math.min(...caps);
}

/** Порог ★★★ в тысячных — те же `permille`, что и рекорд `acc` в сохранении (017-Р35): 969,7 ‰ — ещё не 970. */
export function threeStarReached(accuracy: number, rules: Pick<MatchRules, 'threeStar'>): boolean {
  return permille(Math.round(accuracy * 1e6), 1e6) >= Math.round(rules.threeStar * 1000);
}

export function verdict(input: VerdictInput, rules: MatchRules): Verdict {
  const { score } = input;
  const typedWin = score.typed > score.conceded;
  const passed = input.friendly || goalDiff(score) > 0;
  const base = !typedWin ? 0 : score.conceded > 0 ? 1 : !threeStarReached(input.accuracy, rules) ? 2 : 3;
  const stars = Math.min(base, starCap(input.help, input.softened, rules));
  return {
    passed,
    typedWin,
    stars,
    newStars: input.kind === 'cup' ? 0 : Math.max(0, stars - input.best),
    couldBeBetter: input.friendly && goalDiff(score) <= 0,
  };
}

/** Звёзды не тратятся (ТЗ-4.2): лучшее по уроку только растёт. */
export const bestAfter = (best: number, stars: number): number => Math.max(best, stars);

/** Точность по счётчикам таймов (верные, ошибки); в переигровке 2-го тайма 1-й берётся из сохранённой печати. */
export function matchAccuracy(parts: readonly { correct: number; errors: number }[]): number {
  const correct = parts.reduce((n, p) => n + p.correct, 0);
  const errors = parts.reduce((n, p) => n + p.errors, 0);
  return correct + errors === 0 ? 0 : correct / (correct + errors);
}

export type Shortfall = { goals: number } | { typedOnly: true };

/** «Чего не хватило» (ТЗ-2.8): сколько голов до победы или «победа держалась на пенальти». */
export function shortfall(score: MatchScore): Shortfall {
  if (score.typed > score.conceded) return { goals: 0 };
  if (goalDiff(score) > 0) return { typedOnly: true };
  return { goals: score.conceded - score.typed - score.kick + 1 };
}

/** `fails` после матча: сброс при `passed`, иначе +1 (переигровка тайма — тоже матч). */
export const nextFails = (fails: number, passed: boolean): number => (passed ? 0 : fails + 1);

export type Offer = 'replay2' | 'replay' | 'reserve' | 'again' | 'coach' | 'quit';

export interface StuckOffer {
  /** Сначала минута тренера (ТЗ-2.9). */
  coachMinute: boolean;
  /** Кнопки по порядку; первая — выделена (Enter, 017-Р12). */
  options: Offer[];
}

/**
 * Что предложить после провала (design §4): `fails` 1 — переигровка, 2 — минута тренера и переигровка,
 * 3–4 — «С запасом — до ★★», «Ещё раз», «На сегодня хватит»; ≥ 5 — «С тренером», «С запасом», «хватит».
 * `firstHalfKept` — 1-й тайм не проигран (`typed1 ≥ conceded1`): тогда переигрывается только 2-й.
 */
export function stuckOffer(fails: number, firstHalfKept: boolean, rules: MatchRules): StuckOffer {
  if (fails >= rules.help.coachHelpAt) return { coachMinute: false, options: ['coach', 'reserve', 'quit'] };
  if (fails >= rules.help.reserveAt) return { coachMinute: false, options: ['reserve', 'again', 'quit'] };
  return { coachMinute: fails >= rules.help.coachAt, options: [firstHalfKept ? 'replay2' : 'replay'] };
}
