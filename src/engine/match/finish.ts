/**
 * Единственный переход «свисток → сохранение» (059 правило 4, 065 К-Б): `finishMatch` и `finishMinute`. Чистые функции от
 * разделов игрока; часы, день и идентификатор матча приходят снаружи. Монеты и «Знаток» — только через кассу
 * (`engine/rewards/cash.ts`, страж С1). Повтор с тем же `matchId` (двойной Enter, F5 на итоге) — сохранение без изменений.
 */
import cfg from '../../content/match.json';
import type { CourseProgress, LessonMark } from '../course/reconcile';
import { ruCourseDef } from '../course/section';
import { playedMatch, type Day } from '../day/section';
import { addGoals, type Stadium } from '../home/section';
import { applyPresses, type FormGrowth, type FormState } from '../form/rank';
import { credit, isPaid, type Wallet } from '../rewards/cash';
import type { School } from '../school/section';
import { charsPerMinute } from '../typing/typing';
import type { MinuteResult } from '../coach/minute';
import { assistOf, backAfter, failsAfter, helpOf, restOffered, type Help } from './help';
import { recordOf, type RecordView } from './record';
import { newStars, permille, starsOf, type Assist, type Stars } from './stars';
import type { Fact, MatchResult, Replay, Score, Verdict } from './types';

/** Разделы игрока, которые меняет итог. */
export interface MatchSave {
  course: CourseProgress;
  wallet: Wallet;
  day: Day;
  school: School;
  form: FormState;
  stadium: Stadium;
}

/** Имя раздела в конверте → данные: то, что отдают `session.save(patch)`. */
export function matchPatch(s: MatchSave): Record<string, unknown> {
  return { [ruCourseDef.name]: s.course, wallet: s.wallet, day: s.day, school: s.school, form: s.form, stadium: s.stadium };
}

export interface FinishCtx {
  /** Время свистка, мс. */
  now: number;
  /** Игровой день `ГГГГ-ММ-ДД`. */
  day: string;
  lessonId: string;
  /** Идентификатор матча (повтор — без второй награды). */
  matchId: string;
  /** Помощь матча; по умолчанию — по счётчику провалов отметки урока. */
  assist?: Assist;
  /** Урок шёл смягчённой копией (ТЗ-2.9): звёзды не выше ★★. */
  softened?: boolean;
  /** Матч чемпионата: звёзд нет. */
  championship?: boolean;
  /** Платит ли урок (ТЗ-0.2: старше прошлой лиги — 0 монет и болельщиков); по умолчанию — да. */
  pays?: boolean;
  /** Урок, на который переходит игрок после первого прохода текущего урока; нет — `current` не трогаем. */
  next?: string;
}

/** Чего не хватило до следующей награды (ТЗ-2.12): голов до победы, чистой игры до ★★ или точности до ★★★. */
export type Missing = { kind: 'goals'; n: number } | { kind: 'clean' } | { kind: 'accuracy'; permille: number } | null;

/** Всё, что показывает итог: экран ничего не считает (страж С1). */
export interface ResultView {
  verdict: Verdict;
  /** Счёт с пенальти. */
  total: Score;
  /** Звёзды этого матча (потолок помощи учтён) и лучшие по уроку после него. */
  stars: Stars;
  starsAll: Stars;
  /** Новые звёзды сверх прежнего лучшего (ТЗ-4.1). */
  newStars: number;
  record: RecordView;
  /** Точность печати, тысячные, и знаков в минуту (ТЗ-2.18). */
  permille: number;
  cpm: number;
  /** «Верные → монеты»: верные нажатия матча и начисленные монеты. */
  correct: number;
  coins: number;
  /** Болельщики за матч (1 за верное нажатие лиги). */
  fans: number;
  /** Ранги клавиш, выросшие в этом матче. */
  grew: FormGrowth[];
  missing: Missing;
  replay: Replay | null;
  /** Засчитан ли матч (победа, товарищеский — всегда). */
  passed: boolean;
  /** Помощь, которую предложить дальше, и «на сегодня хватит». */
  help: Help;
  rest: boolean;
  /** Метка «вернуться за звёздами». */
  back: boolean;
  /** Гол пенальти: «+1 к Знатоку». */
  knower: boolean;
}

function missingOf(result: MatchResult, passed: boolean): Missing {
  if (!passed || result.total.me <= result.total.opp) return { kind: 'goals', n: result.total.opp - result.total.me + 1 };
  if (result.score.me <= result.score.opp) return null;
  if (result.score.opp > 0) return { kind: 'clean' };
  const need = Math.round(cfg.threeStar * 1000);
  return permille(result.play) < need ? { kind: 'accuracy', permille: need } : null;
}

export function finishMatch(save: MatchSave, result: MatchResult, ctx: FinishCtx): { save: MatchSave; facts: Fact[]; view: ResultView | null } {
  if (isPaid(save.wallet, ctx.matchId)) return { save, facts: [], view: null };
  const mark: LessonMark | undefined = save.course.lessons[ctx.lessonId];
  const fails0 = mark?.fails ?? 0;
  const assist = ctx.assist ?? assistOf(helpOf(fails0));
  const passed = result.counted;
  const stars = starsOf(result, { assist, softened: ctx.softened ?? false, championship: ctx.championship ?? false });
  const gained = newStars(stars, mark?.stars ?? 0);
  const acc = permille(result.play);
  const cpm = charsPerMinute(result.play);
  const prev = mark !== undefined && mark.best > 0 ? { cpm: mark.best, permille: mark.bestAcc ?? 0 } : null;
  const record = recordOf(prev, { cpm, permille: acc }, passed);
  const fails = failsAfter(fails0, passed);
  const back = backAfter(mark?.back ?? false, assist, passed);
  const starsAll = Math.max(mark?.stars ?? 0, stars) as Stars;

  const next: LessonMark = { stars: starsAll, best: record.best?.cpm ?? mark?.best ?? 0, tries: (mark?.tries ?? 0) + 1, fails, back };
  const bestAcc = record.best?.permille ?? mark?.bestAcc;
  if (bestAcc !== undefined) next.bestAcc = bestAcc;
  const done = mark?.done ?? (passed ? ctx.day : undefined);
  if (done !== undefined) next.done = done;
  const wasDone = mark?.done !== undefined || (mark?.stars ?? 0) > 0;
  const moves = passed && !wasDone && ctx.next !== undefined && save.course.current === ctx.lessonId;
  const course: CourseProgress = { ...save.course, current: moves ? ctx.next! : save.course.current, lessons: { ...save.course.lessons, [ctx.lessonId]: next } };

  const pays = ctx.pays ?? true;
  const correct = pays ? result.stats.correct : 0;
  let purse = { wallet: save.wallet, school: save.school, stadium: save.stadium };
  const coin = credit(purse, 'match-coins', correct, ctx.matchId);
  const fan = credit(coin.purse, 'match-fans', correct);
  purse = fan.purse;
  if (result.penalty.scored) purse = credit(purse, 'penalty-knower', 1).purse;
  const formed = applyPresses(save.form, result.presses);

  const view: ResultView = {
    verdict: result.verdict,
    total: result.total,
    stars,
    starsAll,
    newStars: gained,
    record,
    permille: acc,
    cpm,
    correct,
    coins: coin.gain,
    fans: fan.gain,
    grew: formed.grew,
    missing: missingOf(result, passed),
    replay: result.replay,
    passed,
    help: helpOf(fails),
    rest: restOffered(fails),
    back,
    knower: result.penalty.scored,
  };
  const out: MatchSave = { course, wallet: purse.wallet, day: playedMatch(save.day, ctx.day, ctx.now), school: purse.school, form: formed.form, stadium: addGoals(purse.stadium, result.total.me) };
  return { save: out, facts: [{ fact: 'match', verdict: result.verdict, replay: result.replay }], view };
}

/** Итог минуты тренера (ТЗ-3.4): монеты как за печать и окно формы; в игровой день и «доигранные матчи» не идёт (ТЗ-10.9). */
export interface MinuteView {
  presses: number;
  correct: number;
  coins: number;
  grew: FormGrowth[];
}

export function finishMinute(
  save: Pick<MatchSave, 'wallet' | 'school' | 'form' | 'stadium'>,
  minute: MinuteResult,
  ctx: { matchId: string },
): { save: Pick<MatchSave, 'wallet' | 'school' | 'form' | 'stadium'>; facts: Fact[]; view: MinuteView | null } {
  if (isPaid(save.wallet, ctx.matchId)) return { save, facts: [], view: null };
  const coin = credit({ wallet: save.wallet, school: save.school, stadium: save.stadium }, 'minute-coins', minute.correct, ctx.matchId);
  const formed = applyPresses(save.form, minute.list);
  return {
    save: { wallet: coin.purse.wallet, school: coin.purse.school, form: formed.form, stadium: coin.purse.stadium },
    facts: [],
    view: { presses: minute.presses, correct: minute.correct, coins: coin.gain, grew: formed.grew },
  };
}
