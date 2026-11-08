/**
 * Модель карты лиги (спека 019, design §5, ТЗ-1.4, 1.5, 14.6): чистая функция без Vue и DOM.
 * Вход собирает `app/map/state.ts`; поставщики (`provided`) приходят готовыми, часы не нужны.
 */
import type { CourseLesson, League } from '../course/model';
import type { BuildingId, MapLayout, Pt } from './layout';
import type { LockCond } from './lock';
import { leagueDone } from './path';

export type { BuildingId } from './layout';
export type { LockCond } from './lock';

export interface MapProvided {
  cup?: (after: number) => { lock: LockCond | null; hint: string | null };
  buildings?: Partial<Record<BuildingId, () => { lock: LockCond | null; mark: 'new' | null }>>;
}

export interface MapInput {
  league: League;
  lessons: CourseLesson[];
  layout: MapLayout;
  nextLeague: League | null;
  /** `course.passed`. */
  passed: readonly string[];
  /** `course.lessons`: лучшие звёзды и кольцо «вернуться за звёздами». */
  records: Readonly<Record<string, { stars: number; back: boolean }>>;
  /** `match.half2`: матч с отложенным вторым таймом (017). */
  half2: { lessonId: string; score: [number, number] } | null;
  provided: MapProvided;
}

export type PointState = 'passed' | 'current' | 'ahead' | 'fog';

export interface MapPoint {
  id: string;
  n: number;
  stage: number;
  at: Pt;
  state: PointState;
  stars: number;
  badge: 'friendly' | 'control' | null;
  back: boolean;
  resume: [number, number] | null;
}

export interface MapPlace {
  stage: number;
  name: string;
  at: Pt;
  state: 'open' | 'next' | 'fog';
}

export interface MapFlag {
  after: number;
  /** Над точкой урока (`side: 'up'`) или слева от неё, на уровне точки (`'left'`, правый край пути). */
  at: Pt;
  side: 'up' | 'left';
  /** Кубка в игре ещё нет: поставщика (чемпионат, Э5) нет — флажок «появится в следующих версиях» (019-Р46, Р48). */
  later: boolean;
  big: boolean;
  lock: LockCond | null;
  hint: string | null;
}

export interface MapBuilding {
  id: BuildingId;
  at: Pt;
  lock: LockCond | null;
  mark: 'new' | null;
  /** Только стадион: следующий этап. */
  next: { after: number; name: string } | null;
}

export interface MapModel {
  points: MapPoint[];
  places: MapPlace[];
  flags: MapFlag[];
  buildings: MapBuilding[];
  gate: { at: Pt; state: 'fog' | 'building' | 'open' };
  /** Фокус по умолчанию: id текущей точки, все пройдены — `gate`. */
  focus: string;
  stars: { got: number; max: number };
}

/** Сколько непройденных уроков после текущего видно (подписаны, но не играются). */
export const AHEAD = 3;
/** Флажок стоит над точкой урока на столько единиц поля: выше точек-соседей, которые на другой высоте зигзага (019-Р41). */
export const FLAG_LIFT = 78;
/** Путь идёт вниз круче этого (единицы поля на шаг): точка в колонке, флажок там — слева от неё, а не над ней (019-Р41). */
export const COLUMN_STEP = 60;

/** Точка играется: пройдена или текущая. «Впереди» и туман — нет. Одно условие для карты, клавиатуры и карточки. */
export const isPlayablePoint = (p: Pick<MapPoint, 'state'>): boolean => p.state === 'passed' || p.state === 'current';

const byN = (a: CourseLesson, b: CourseLesson): number => a.n - b.n;

/** Первый непройденный урок лиги по порядку (В3); `null` — все пройдены. Незнакомые id не мешают. */
function currentOf(lessons: readonly CourseLesson[], passed: ReadonlySet<string>): CourseLesson | null {
  return lessons.find((l) => !passed.has(l.id)) ?? null;
}

/**
 * Играется ли урок: пройден или текущий (первый непройденный своей лиги) при условии, что все лиги до неё пройдены.
 * Одна функция для карты и для адреса матча (019-В3, 019-Р18).
 */
export function playable(input: Pick<MapInput, 'lessons' | 'passed'> & { leagues: readonly League[] }, id: string): boolean {
  const lesson = input.lessons.find((l) => l.id === id);
  if (!lesson) return false;
  const passed = new Set(input.passed);
  if (passed.has(id)) return true;
  const at = input.leagues.findIndex((l) => l.id === lesson.league);
  if (at === -1) return false;
  if (input.leagues.slice(0, at).some((l) => !leagueDone(l, input.lessons, input.passed))) return false;
  const own = input.lessons.filter((l) => l.league === lesson.league).sort(byN);
  return currentOf(own, passed)?.id === id;
}

const clampStars = (n: number | undefined): number => (n === undefined || !Number.isFinite(n) ? 0 : Math.min(3, Math.max(0, Math.floor(n))));

/** Модель карты лиги по входу §5. */
export function buildMapModel(input: MapInput): MapModel {
  const { league, layout, records, provided } = input;
  const lessons = input.lessons.filter((l) => l.league === league.id).sort(byN);
  const passed = new Set(input.passed);
  const c = currentOf(lessons, passed);
  const aheadIds = new Set(lessons.filter((l) => !passed.has(l.id) && c !== null && l.n > c.n).slice(0, AHEAD).map((l) => l.id));

  const points: MapPoint[] = lessons.map((l, i) => {
    const state: PointState = passed.has(l.id) ? 'passed' : l.id === c?.id ? 'current' : aheadIds.has(l.id) ? 'ahead' : 'fog';
    const isPlayable = isPlayablePoint({ state });
    const resume: [number, number] | null =
      input.half2 && input.half2.lessonId === l.id && isPlayable ? [input.half2.score[0], input.half2.score[1]] : null;
    return {
      id: l.id,
      n: l.n,
      stage: l.stage,
      at: layout.points[i] ?? [0, 0],
      state,
      stars: clampStars(records[l.id]?.stars),
      badge: l.friendly ? 'friendly' : l.control ? 'control' : null,
      back: records[l.id]?.back === true,
      resume,
    };
  });

  // Места ступеней: открыта, если ступень ≤ ступени текущего урока или в ней есть пройденный урок (019-Р18);
  // «next» — первая не открытая после ступени текущего.
  const cStage = c?.stage ?? Infinity;
  const passedStages = new Set(lessons.filter((l) => passed.has(l.id)).map((l) => l.stage));
  const isOpen = (stage: number): boolean => stage <= cStage || passedStages.has(stage);
  const ordered = [...layout.places].sort((a, b) => a.stage - b.stage);
  const nextStage = ordered.find((p) => p.stage > cStage && !isOpen(p.stage))?.stage;
  const places: MapPlace[] = ordered.map((p) => ({
    stage: p.stage,
    name: p.name,
    at: p.at,
    state: isOpen(p.stage) ? 'open' : p.stage === nextStage ? 'next' : 'fog',
  }));

  const anchors = league.anchors;
  const cupAfters = anchors?.cup ?? [];
  const cN = c?.n ?? Infinity;
  const bigAfter = cupAfters.find((a) => a >= cN) ?? cupAfters[cupAfters.length - 1];
  const passedN = (n: number): boolean => lessons.some((l) => l.n === n && passed.has(l.id));
  const flags: MapFlag[] = cupAfters.map((after) => {
    const from = layout.points[after - 1] ?? [0, 0];
    const given = provided.cup?.(after);
    const first = cupAfters[0] ?? 0;
    const lock: LockCond | null = given ? given.lock : passedN(first) ? { soon: true } : { lesson: first };
    const before = layout.points[after - 2];
    const side = before !== undefined && from[1] - before[1] > COLUMN_STEP ? 'left' : 'up';
    const at: Pt = side === 'left' ? [from[0], from[1]] : [from[0], from[1] - FLAG_LIFT];
    return { after, at, side, later: given === undefined, big: after === bigAfter, lock, hint: given ? given.hint : null };
  });

  const nextStadium = anchors?.stadium.find((s) => !passedN(s.after)) ?? null;
  const ids: BuildingId[] = ['stadium', 'school', 'base', 'museum'];
  const buildings: MapBuilding[] = ids.map((id) => {
    const given = provided.buildings?.[id]?.();
    const lock: LockCond | null = given ? given.lock : id === 'stadium' ? null : { soon: true };
    return { id, at: layout.buildings[id], lock, mark: given?.mark ?? null, next: id === 'stadium' ? nextStadium : null };
  });

  const done = leagueDone(league, input.lessons, input.passed);
  const gateState: MapModel['gate']['state'] =
    !done || !input.nextLeague ? 'fog' : input.nextLeague.depth === 'frame' ? 'building' : 'open';

  const got = lessons.reduce((s, l) => s + clampStars(records[l.id]?.stars), 0);
  return {
    points,
    places,
    flags,
    buildings,
    gate: { at: layout.gate, state: gateState },
    focus: c ? c.id : 'gate',
    stars: { got, max: lessons.length * 3 },
  };
}
