/**
 * Кубок лиги для экранов (спека 002): какие кубки видны, раунды с уроками-вехами и соперниками,
 * матч кубка по адресу #/match?cup=<лига>. Правила — в движке (engine/cup), здесь только данные игры.
 */
import type { RouteLocationNormalized } from 'vue-router';
import type { Rival } from '../engine/club';
import {
  FINAL_STAGE,
  cupAdvances,
  cupMilestones,
  cupRivals,
  cupState,
  cupVisible,
  homeCup,
  isLeague,
  playStage,
  roundOpen,
  type CupStage,
  type CupState,
  type League,
} from '../engine/cup';
import type { Lesson } from '../engine/lessons';
import { leagueRules, outcome, type MatchScore } from '../engine/match';
import type { HalfResult } from '../engine/save';
import { ru } from '../i18n/ru';
import { clubData } from './kits';
import { lessons } from './lessons';
import { lessonAt, progress, recordCupHalf } from './progress';
import { plan } from './unlocks';

export interface CupRoundInfo {
  stage: CupStage;
  /** Урок-веха раунда: на нём играется матч кубка. */
  lesson: Lesson;
  /** Номер урока-вехи для подписи (с 1): «после урока 8». */
  lessonNumber: number;
  rival: Rival;
  /** Раунд открыт: игрок ушёл дальше вехи (roundOpen). */
  open: boolean;
}

/** Виден ли кубок лиги у игрока: открыт 1/8 или кубок записан. */
export function isCupVisible(league: League): boolean {
  return cupVisible(progress, lessons, plan, league);
}

/** Кубок для кнопки на главной: самый ранний недоигранный видимый, иначе старший (engine/cup, homeCup). */
export function homeLeague(): League | null {
  return homeCup(progress, lessons, plan);
}

/** Номер урока-вехи раунда для подписи (с 1); вехи нет — 0. */
function milestoneNumber(league: League, stage: CupStage): number {
  const n = cupMilestones(plan, lessons, league)[stage] ?? Number.POSITIVE_INFINITY;
  return Number.isFinite(n) ? n + 1 : 0;
}

/** Номер урока первой вехи (1/8) — для полки: «Откроется после урока 4». */
export function firstMilestoneNumber(league: League): number {
  return milestoneNumber(league, 0);
}

/** Название раунда: «1/8 финала» … «Финал». */
export function stageName(stage: number): string {
  return ru.cup.rounds[stage] ?? '';
}

export function stateOf(league: League): CupState {
  return cupState(progress, league);
}

/** Открыт ли раунд у игрока. */
export function isRoundOpen(league: League, stage: CupStage): boolean {
  return roundOpen(progress, lessons, plan, league, stage);
}

/** Четыре раунда кубка: урок-веха, соперник, открыт ли. */
export function cupRounds(league: League): CupRoundInfo[] {
  const rivals = cupRivals(clubData, progress.club, league);
  return cupMilestones(plan, lessons, league).flatMap((index, n) => {
    const rival = rivals[n];
    const stage = n as CupStage;
    if (!rival || !Number.isFinite(index)) return [];
    return [{ stage, lesson: lessonAt(index), lessonNumber: index + 1, rival, open: isRoundOpen(league, stage) }];
  });
}

/** Лига из адреса (?cup= или :league); нет, чужая или кубок не виден — null. */
export function openLeagueOf(v: unknown): League | null {
  return isLeague(v) && isCupVisible(v) ? v : null;
}

/** Матч кубка: раунд, который играется сейчас, его урок и соперник, подпись для табло. */
export interface CupMatch extends CupRoundInfo {
  league: League;
  /** «Кубок дворовой лиги · 1/2 финала» — на табло во вступлении. */
  title: string;
  /** «1/2 финала» — на табло во время игры. */
  roundName: string;
}

/** stage — раунд вместо текущего: только быстрая проверка (#/match?cup=yard&round=3, app/matchJump). */
export function cupMatch(league: League, stage: CupStage = playStage(stateOf(league))): CupMatch {
  const info = cupRounds(league)[stage];
  if (!info) throw new Error(`no cup stage ${stage}`);
  const roundName = stageName(stage);
  return { ...info, league, roundName, title: `${ru.cup.titles[league]} · ${roundName}` };
}

/**
 * Страж маршрутов кубка. Экран кубка — только у видимого кубка. Матч кубка — только если текущий
 * раунд открыт; закрыт — на экран кубка (там видно, после какого урока), кубок не виден — на главную
 * (ссылка из закладок, кубок другого игрока, «Поставить урок» назад).
 */
export function cupGuard(to: RouteLocationNormalized): true | string {
  const league = to.name === 'cup' ? to.params.league : to.query.cup;
  if (to.name === 'match' && league === undefined) return true;
  // Быстрая проверка (?round=, app/matchJump): любой раунд, открыт он или нет, — в сохранение не пишется.
  if (to.name === 'match' && to.query.round !== undefined && isLeague(league)) return true;
  const open = openLeagueOf(league);
  if (!open) return '/';
  if (to.name === 'match' && !isRoundOpen(open, playStage(stateOf(open)))) return `/cup/${open}`;
  return true;
}

/**
 * Следующий раунд в итоге: открыт — «Следующий раунд — 1/4 финала»; закрыт — «1/4 финала — после
 * урока 8» (строка итога до 52 знаков: длиннее переносится, и итог вылезает за 640 px).
 */
function nextRoundText(league: League, stage: CupStage): string {
  const name = stageName(stage);
  if (isRoundOpen(league, stage)) return `${ru.cup.result.nextRound} ${name}`;
  return `${name} — ${ru.unlocks.after} ${milestoneNumber(league, stage)}`;
}

/**
 * Конец матча кубка: второй тайм и итог раунда — в сохранение (recordCupHalf); возвращает
 * итог раунда для экрана итога матча — проход, кубок или переигровка.
 * dryRun — быстрая проверка (app/matchJump): только итог, в сохранение ничего.
 */
export function finishCupMatch(
  match: CupMatch,
  half: HalfResult,
  score: MatchScore,
  decisiveErrors: number,
  dryRun = false,
): CupNote {
  // Правила решающей — от лиги урока раунда, не от игрока (спека 008).
  const rules = leagueRules(match.lesson.league);
  const advanced = cupAdvances(score, decisiveErrors, rules);
  const wonBefore = stateOf(match.league).won;
  if (!dryRun) recordCupHalf(half, match.league, match.stage, advanced);
  const t = ru.cup.result;
  const draw = outcome(score) === 'draw';
  if (!advanced) return { advanced, draw, text: t.replay };
  if (match.stage === FINAL_STAGE) return { advanced, draw, text: wonBefore ? t.again : t.trophy };
  const next = nextRoundText(match.league, (match.stage + 1) as CupStage);
  const drawText = rules.series > 1 ? t.drawSeries : t.draw;
  return { advanced, draw, text: `${draw ? drawText : t.next} ${next}.` };
}

/** Итог раунда кубка на экране итога матча. */
export interface CupNote {
  advanced: boolean;
  /** Ничья: только тогда в итоге важна решающая серия — без ничьей её ошибки не пишем. */
  draw: boolean;
  text: string;
}
