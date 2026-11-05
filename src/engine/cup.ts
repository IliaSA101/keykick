/**
 * Кубок лиги (спека 002, «Кубок по ходу лиги»): четыре раунда 1/8 → 1/4 → 1/2 → финал по ходу лиги.
 * Раунд открыт, когда игрок ушёл дальше урока-вехи из плана открытий (content/unlocks.json,
 * engine/unlocks). Соперники раундов постоянные. Проход дальше — победа по счёту; ничья — по решающей
 * серии (как зачёт урока, по правилам лиги урока — спека 008); поражение — раунд переигрывается, вылета нет. Финал — трофей лиги
 * (один раз) и бесплатный пак. Матч кубка урок не продвигает (save.ts, applyHalf с advance: false).
 */
import { pickRival, type Club, type ClubData, type Rival } from './club';
import { lessonPassed, outcome, type LeagueRules, type MatchScore } from './match';
import type { SaveData } from './save';
import type { UnlockPlan } from './unlocks';

export const LEAGUES = ['yard', 'district', 'city'] as const;
export type League = (typeof LEAGUES)[number];

/** Раундов в кубке: 1/8, 1/4, 1/2, финал. */
export const CUP_ROUNDS = 4;
/** Раунд кубка: 0 — 1/8, 1 — 1/4, 2 — 1/2, 3 — финал. */
export type CupStage = 0 | 1 | 2 | 3;
export const CUP_STAGES: readonly CupStage[] = [0, 1, 2, 3];
/** Финал — последний раунд. */
export const FINAL_STAGE: CupStage = 3;

/**
 * Кубок лиги в сохранении. stage — раунд, который играется сейчас; 4 — все пройдены (на экране
 * кубка — трофей и «Сыграть кубок снова»). won — трофей получен; второй раз его не дают.
 * finalOpen — финал открыт зачётом последнего урока курса: там урок не сдвигается (002-Р10).
 */
export interface CupState {
  stage: CupStage | 4;
  won: boolean;
  finalOpen?: true;
}

/** Кубки по лигам. Записи нет — кубок ещё не тронут. */
export type Cups = Partial<Record<League, CupState>>;

/** Урок глазами кубка и плана открытий: нужны только id и лига. */
export interface LessonRef {
  id: string;
  league: string;
}

export function isLeague(v: unknown): v is League {
  return typeof v === 'string' && (LEAGUES as readonly string[]).includes(v);
}

function isStage(v: unknown): v is CupStage | 4 {
  return v === 0 || v === 1 || v === 2 || v === 3 || v === 4;
}

/** Одна запись кубка: новый вид — stage; старый (до 002) — round 0–3, он бывает только после финала лиги. */
function parseCup(raw: unknown): CupState {
  const r = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const won = r.won === true;
  if (isStage(r.stage)) return r.finalOpen === true ? { stage: r.stage, won, finalOpen: true } : { stage: r.stage, won };
  // Старый раунд r — это раунд r + 1 новой сетки (002-Р9); финал был открыт — отсюда finalOpen.
  if (r.round === 0 || r.round === 1 || r.round === 2 || r.round === 3) return { stage: (r.round + 1) as CupStage | 4, won, finalOpen: true };
  return { stage: 0, won };
}

/** Разбор поля кубков: битая запись — кубок с начала, чужая лига — выбрасывается. */
export function parseCups(v: unknown): Cups {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Cups = {};
  for (const [league, raw] of Object.entries(v as Record<string, unknown>)) {
    if (isLeague(league)) out[league] = parseCup(raw);
  }
  return out;
}

/**
 * Номера уроков-вех лиги (с 0) по раундам. План проверен при разборе (parseUnlocks); урока нет
 * в списке — веха недостижима (Infinity): раунд не откроется.
 */
export function cupMilestones(plan: UnlockPlan, lessons: readonly LessonRef[], league: League): number[] {
  return plan.cup[league].map((id) => {
    const i = lessons.findIndex((l) => l.id === id);
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  });
}

/** Раунд открыт: игрок ушёл дальше вехи; финал — ещё и по finalOpen (последний урок курса). */
export function roundOpen(
  save: SaveData,
  lessons: readonly LessonRef[],
  plan: UnlockPlan,
  league: League,
  stage: CupStage,
): boolean {
  const milestone = cupMilestones(plan, lessons, league)[stage] ?? Number.POSITIVE_INFINITY;
  return save.lessonIndex > milestone || (stage === FINAL_STAGE && save.cups[league]?.finalOpen === true);
}

/** Кубок виден (кнопка на главной, экран, страж): открыт 1/8 или кубок уже записан. */
export function cupVisible(save: SaveData, lessons: readonly LessonRef[], plan: UnlockPlan, league: League): boolean {
  return save.cups[league] !== undefined || roundOpen(save, lessons, plan, league, 0);
}

/** Видимые кубки по порядку лиг. */
export function visibleCups(save: SaveData, lessons: readonly LessonRef[], plan: UnlockPlan): League[] {
  return LEAGUES.filter((l) => cupVisible(save, lessons, plan, l));
}

export function cupState(save: SaveData, league: League): CupState {
  return save.cups[league] ?? { stage: 0, won: false };
}

/** Кубок доигран: трофей получен или все раунды пройдены (stage 4). */
export function cupDone(save: SaveData, league: League): boolean {
  const state = save.cups[league];
  return state !== undefined && (state.won || state.stage === 4);
}

/**
 * Раунд уже пройден по записи: запись ушла дальше него или кубок доигран (после «Сыграть кубок
 * снова» трофей остаётся — раунды тоже считаются пройденными). Нужно «Скоро»: «Поставить урок»
 * назад закрывает раунд, но звать к пройденному не надо.
 */
export function roundPassed(save: SaveData, league: League, stage: CupStage): boolean {
  const state = save.cups[league];
  return state !== undefined && (cupDone(save, league) || state.stage > stage);
}

/**
 * Кубок для кнопки на главной (одна кнопка — главная влезает в 1024×640): самый ранний видимый
 * недоигранный — иначе к недоигранному дворовому из районной лиги путь только с полки трофеев;
 * все видимые доиграны — самый старший; видимых нет — null.
 */
export function homeCup(save: SaveData, lessons: readonly LessonRef[], plan: UnlockPlan): League | null {
  const visible = visibleCups(save, lessons, plan);
  return visible.find((l) => !cupDone(save, l)) ?? visible.at(-1) ?? null;
}

/** Раунд, который играется сейчас: после пройденного кубка — снова 1/8. */
export function playStage(state: CupState): CupStage {
  return state.stage === 4 ? 0 : state.stage;
}

/**
 * stage → индекс зерна. У 1/4, 1/2 и финала — прежние зёрна (до 002 это были раунды 0, 1, 2):
 * соперники, которых ребёнок уже видел, не меняются (К5). У 1/8 — новое зерно.
 */
const SEED_INDEX = [3, 0, 1, 2] as const;
/** Порядок выбора: прежние раунды первыми — их перевыбор при повторе имени тот же, что до 002. */
const PICK_ORDER: readonly CupStage[] = [1, 2, 3, 0];

/** Зерно соперника — от лиги и индекса зерна раунда (SEED_INDEX): соперник раунда всегда тот же. */
export function cupRivalSeed(league: League, seedIndex: number): number {
  return (LEAGUES.indexOf(league) + 1) * 104_729 + seedIndex * 7_919 + 31;
}

/**
 * Соперники четырёх раундов по stage. Название у каждого своё: «Полёт, Пермь» в 1/4 и «Полёт, Пенза»
 * в 1/2 выглядели бы как один клуб — повтор перевыбирается со сдвинутым зерном (зерно постоянное).
 * Город тоже свой: при повторе берётся следующий свободный по списку, название и форма — прежние.
 */
export function cupRivals(data: ClubData, own: Club | null, league: League): Rival[] {
  const out: Rival[] = [];
  const picked: Rival[] = [];
  for (const stage of PICK_ORDER) {
    const seed = cupRivalSeed(league, SEED_INDEX[stage]);
    let rival = pickRival(data, own, seed);
    for (let k = 1; k < 20 && picked.some((r) => r.name === rival.name); k++) rival = pickRival(data, own, seed + k * 977);
    if (picked.some((r) => r.city === rival.city)) rival = { ...rival, city: freeCity(data, picked, rival.city) };
    picked.push(rival);
    out[stage] = rival;
  }
  return out;
}

function freeCity(data: ClubData, picked: readonly Rival[], city: string): string {
  const n = data.cities.length;
  const start = data.cities.indexOf(city);
  for (let i = 1; i < n; i++) {
    const next = data.cities[(start + i) % n];
    if (next && !picked.some((r) => r.city === next)) return next;
  }
  return city;
}

export function cupRival(data: ClubData, own: Club | null, league: League, stage: CupStage): Rival {
  const rival = cupRivals(data, own, league)[stage];
  if (!rival) throw new Error(`no cup stage ${stage}`);
  return rival;
}

/**
 * Проход дальше: победа по счёту; ничья — если решающая серия зачтена по правилам лиги урока
 * (match.ts, leagueRules(lesson.league)); поражение — нет.
 */
export function cupAdvances(score: MatchScore, decisiveErrors: number, rules: LeagueRules): boolean {
  const result = outcome(score);
  return result === 'win' || (result === 'draw' && lessonPassed(decisiveErrors, rules));
}

function withCup(save: SaveData, league: League, state: CupState): SaveData {
  return { ...save, cups: { ...save.cups, [league]: state } };
}

/**
 * Итог матча кубка в сохранение. stage — раунд, с которым матч начинался: не совпал с текущим
 * (двойная запись, другая вкладка) или раунд закрыт (адрес из закладок) — сохранение не меняется.
 * Финал впервые — трофей и пак.
 */
export function applyCupMatch(
  save: SaveData,
  lessons: readonly LessonRef[],
  plan: UnlockPlan,
  league: League,
  stage: CupStage,
  advanced: boolean,
): SaveData {
  const state = cupState(save, league);
  if (playStage(state) !== stage || !roundOpen(save, lessons, plan, league, stage)) return save;
  if (!advanced) return withCup(save, league, { ...state, stage });
  if (stage < FINAL_STAGE) return withCup(save, league, { ...state, stage: (stage + 1) as CupStage });
  const next = withCup(save, league, { ...state, stage: 4, won: true });
  return state.won ? next : { ...next, pendingPacks: save.pendingPacks + 1 };
}

/** «Сыграть кубок снова»: пройденный кубок — снова с 1/8; трофей и finalOpen остаются. */
export function restartCup(save: SaveData, league: League): SaveData {
  const state = save.cups[league];
  return state?.stage === 4 ? withCup(save, league, { ...state, stage: 0 }) : save;
}

/**
 * Обычный матч на последнем уроке курса зачтён (две звезды и больше), и этот урок — веха финала
 * своей лиги: финал открыт (finalOpen). Там урок не сдвигается, и по номеру урока финал не открыть.
 */
export function openCupOnPass(
  save: SaveData,
  lessons: readonly LessonRef[],
  plan: UnlockPlan,
  lessonId: string,
  stars: number,
): SaveData {
  if (stars < 2) return save;
  const last = lessons.at(-1);
  if (!last || last.id !== lessonId || !isLeague(last.league)) return save;
  if (plan.cup[last.league][FINAL_STAGE] !== lessonId) return save;
  const state = save.cups[last.league];
  if (state?.finalOpen === true) return save;
  return withCup(save, last.league, { ...(state ?? { stage: 0, won: false }), finalOpen: true });
}

/** Полученные трофеи по порядку лиг. */
export function trophies(save: SaveData): League[] {
  return LEAGUES.filter((l) => save.cups[l]?.won === true);
}
