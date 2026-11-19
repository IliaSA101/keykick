/**
 * Единственный переход «свисток → сохранение» (059 правило 4, 065 К-Б): `finishMatch` и `finishMinute`. Чистые функции от
 * разделов игрока; часы, день и идентификатор матча приходят снаружи. Монеты и «Знаток» — только через кассу
 * (`engine/rewards/cash.ts`, страж С1). Повтор с тем же `matchId` (двойной Enter, F5 на итоге) — сохранение без изменений.
 */
import cfg from '../../content/match.json';
import { PACKS_YARD } from '../album/order';
import type { Album } from '../album/section';
import type { CourseProgress, LessonMark } from '../course/reconcile';
import { ruCourseDef } from '../course/section';
import { addAcc, addTyped, playedMatch, type Day } from '../day/section';
import { applyKeys, keyTile, type KeyTile } from '../coach/keys';
import type { CoachKeys } from '../coach/section';
import { addGoals, type Stadium } from '../home/section';
import { applyPresses, type FormGrowth, type FormState } from '../form/rank';
import { credit, isPaid, type Wallet } from '../rewards/cash';
import type { School } from '../school/section';
import { charsPerMinute, typedMs } from '../typing/typing';
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
  /** Окна нажатий по буквам — «трудные клавиши» (067 Т24). */
  coach: CoachKeys;
  stadium: Stadium;
  album: Album;
}

/** Имя раздела в конверте → данные: то, что отдают `session.save(patch)`. */
export function matchPatch(s: MatchSave): Record<string, unknown> {
  return { [ruCourseDef.name]: s.course, wallet: s.wallet, day: s.day, school: s.school, form: s.form, coach: s.coach, stadium: s.stadium, album: s.album };
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
  /** Ступень урока: матч идёт в ритм дня (окно точностей); нет — только время печати. */
  stage?: number;
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

/** Откуда ритм дня берёт матч (068 Т8, ТЗ-10.4, 10.5): урок и его ступень — для окна точностей и серии «пальцы устали». Нет — день без ритма. */
export interface Rhythm {
  lessonId: string;
  stage: number;
}

/** Разделы, которые меняет общий свисток: касса, игровой день, форма клавиш, голы стадиона (без курса). */
export type WhistleSave = Pick<MatchSave, 'wallet' | 'school' | 'day' | 'form' | 'coach' | 'stadium' | 'album'>;

/** День после матча: время печати матча (разминка, итог дня) и его точность в окно ступени («пальцы устали»); матч без урока (Кубок) рвёт серию урока (068-Р18). */
function rhythmDay(d: Day, result: MatchResult, ctx: { day: string; rhythm?: Rhythm }): Day {
  const typed = addTyped(d, ctx.day, typedMs(result.stats));
  return ctx.rhythm === undefined ? { ...typed, series: null } : addAcc(typed, ctx.day, ctx.rhythm.lessonId, ctx.rhythm.stage, permille(result.play));
}

/**
 * Общий свисток (065 К-Б, 068 К-Б): всё, что платит и пишет любой засчитанный матч — монеты и болельщики за верные нажатия, «Знаток» за гол
 * пенальти, игровой день, окна формы и трудных клавиш, голы стадиона. Курс, звёзды и пак тут не трогаются: их решает вызывающий
 * (`finishMatch` — урок, `finishCup` — раунд Кубка).
 */
export function whistle(
  save: WhistleSave,
  result: MatchResult,
  ctx: { now: number; day: string; matchId: string; pays: boolean; rhythm?: Rhythm },
): { save: WhistleSave; correct: number; coins: number; fans: number; grew: FormGrowth[] } {
  const correct = ctx.pays ? result.stats.correct : 0;
  const coin = credit({ wallet: save.wallet, school: save.school, stadium: save.stadium, album: save.album }, 'match-coins', correct, ctx.matchId);
  let purse = coin.purse;
  const fan = credit(purse, 'match-fans', correct);
  purse = fan.purse;
  const fans = fan.gain;
  if (result.penalty.scored) purse = credit(purse, 'penalty-knower', 1).purse;
  purse = { ...purse, stadium: addGoals(purse.stadium, result.total.me) };
  const formed = applyPresses(save.form, result.presses);
  const coach = applyKeys(save.coach, result.presses);
  const out: WhistleSave = { wallet: purse.wallet, school: purse.school, stadium: purse.stadium, album: purse.album, day: rhythmDay(playedMatch(save.day, ctx.day, ctx.now), result, ctx), form: formed.form, coach };
  return { save: out, correct, coins: coin.gain, fans, grew: formed.grew };
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
  const paid = whistle(save, result, { now: ctx.now, day: ctx.day, matchId: ctx.matchId, pays, ...(ctx.stage === undefined ? {} : { rhythm: { lessonId: ctx.lessonId, stage: ctx.stage } }) });
  let purse = { wallet: paid.save.wallet, school: paid.save.school, stadium: paid.save.stadium, album: paid.save.album };
  // Пак — за первый проход урока (ТЗ-5.1); повтор и поражение — нет; Двор даёт 39 паков, дальше пака нет.
  if (passed && !wasDone && !(ctx.championship ?? false) && purse.album.packs < PACKS_YARD) purse = credit(purse, 'lesson-pack', 1).purse;

  const view: ResultView = {
    verdict: result.verdict,
    total: result.total,
    stars,
    starsAll,
    newStars: gained,
    record,
    permille: acc,
    cpm,
    correct: paid.correct,
    coins: paid.coins,
    fans: paid.fans,
    grew: paid.grew,
    missing: missingOf(result, passed),
    replay: result.replay,
    passed,
    help: helpOf(fails),
    rest: restOffered(fails),
    back,
    knower: result.penalty.scored,
  };
  const out: MatchSave = { ...paid.save, course, wallet: purse.wallet, school: purse.school, stadium: purse.stadium, album: purse.album };
  return { save: out, facts: [{ fact: 'match', verdict: result.verdict, replay: result.replay }], view };
}

/** Итог минуты тренера (ТЗ-3.4): монеты как за печать и окно формы; в игровой день и «доигранные матчи» не идёт (ТЗ-10.9). */
export interface MinuteView {
  presses: number;
  correct: number;
  coins: number;
  grew: FormGrowth[];
  /** По клавишам минуты (`ctx.keys`): плитка до и после — «было → стало» (Э4.14), ранг — из формы. */
  keys: { before: KeyTile; after: KeyTile }[];
}

/** Разделы, которые меняет минута тренера (067 Т25): не матч — курс и игровой день не трогает. */
export type MinuteSave = Pick<MatchSave, 'wallet' | 'school' | 'form' | 'coach' | 'stadium' | 'album'>;

/** Имя раздела в конверте → данные после минуты: то, что отдают `session.save(patch)`; ровно разделы `MinuteSave`. */
export function minutePatch(s: MinuteSave): Record<string, unknown> {
  return { wallet: s.wallet, school: s.school, form: s.form, coach: s.coach, stadium: s.stadium, album: s.album };
}

export function finishMinute(
  save: MinuteSave,
  minute: MinuteResult,
  ctx: { matchId: string; /** Клавиши минуты — строчные буквы (`RunningMinute.keys`). */ keys?: string },
): { save: MinuteSave; facts: Fact[]; view: MinuteView | null } {
  if (isPaid(save.wallet, ctx.matchId)) return { save, facts: [], view: null };
  const coin = credit({ wallet: save.wallet, school: save.school, stadium: save.stadium, album: save.album }, 'minute-coins', minute.correct, ctx.matchId);
  const formed = applyPresses(save.form, minute.list);
  const coach = applyKeys(save.coach, minute.list);
  const keys = Array.from(ctx.keys ?? '').map((ch) => ({ before: keyTile(save.coach, save.form, ch), after: keyTile(coach, formed.form, ch) }));
  return {
    save: { wallet: coin.purse.wallet, school: coin.purse.school, form: formed.form, coach, stadium: coin.purse.stadium, album: coin.purse.album },
    facts: [],
    view: { presses: minute.presses, correct: minute.correct, coins: coin.gain, grew: formed.grew, keys },
  };
}
