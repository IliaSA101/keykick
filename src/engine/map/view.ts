/**
 * Карта Двора (065 Т8, спека 048/054): `mapView` — узлы 10 дворов, туман, «Ты здесь», флажок Кубка, выбор. Чистые функции:
 * номер урока 1…32 (33 — Двор пройден), стрелки двигают только выбор и никогда не запускают матч (К3).
 * Макет-образец — `tools/mock-map/league.mjs` (`yardState`, `node`, `pickCard`).
 */
import { isAway, isControl, lessonsOf, ROUNDS, stageOf, streetName } from '../home/yard';

export type YardState = 'done' | 'cur' | 'near' | 'fog';
export type LessonState = 'done' | 'ring' | 'cur' | 'near';
/** Метка Кубка на узле: `next` — ближайший флажок, `later` — остальные, `none` — нет (после титула — все `later`). */
export type FlagMark = 'none' | 'next' | 'later';
export type MapKey = 'left' | 'right' | 'up' | 'down';

export interface MapInput {
  /** Текущий урок 1…32; 33 — Двор пройден. */
  cur: number;
  /** Звёзды уроков (1…3), номер урока → звёзды. */
  stars: Readonly<Record<number, number>>;
  /** Номера товарищеских уроков. */
  friendly: ReadonlySet<number>;
  /** Титул взят: все дворы пройдены, флажки погашены. */
  end: boolean;
}

export interface MapSel {
  stage: number;
  lesson: number;
}

export interface LessonView {
  n: number;
  state: LessonState;
  stars: number;
  control: boolean;
  friendly: boolean;
  away: boolean;
  /** Выбор и матч доступны: урок сыгран или текущий (за туманом и впереди текущего — нет, К1). */
  reach: boolean;
}

export interface YardNode {
  stage: number;
  street: string;
  state: YardState;
  lessons: LessonView[];
  flag: FlagMark;
  /** «Ты здесь» и флаг клуба — только у узла текущего урока (К2). */
  here: boolean;
  /** Двор пройден: итог «на ★★★: k из n уроков». */
  passed: boolean;
  full: number;
}

export interface MapView {
  nodes: YardNode[];
  /** Текущий урок, у которого «Ты здесь»; null — Двор пройден. */
  here: number | null;
  sel: MapSel;
  /** Выбранный урок — для карточки «На матч». */
  selLesson: LessonView;
  /** Урок, после которого играется ближайший Кубок («Кубок — после урока N»); null — Кубка впереди нет (титул взят, раунды сыграны). */
  cupAfter: number | null;
}

const LAST_LESSON = lessonsOf(10).at(-1)!;
const STAGES = 10;
/** Последний урок, до которого можно дойти: текущий или последний, если Двор пройден. */
const reachTo = (cur: number): number => Math.min(cur, LAST_LESSON);
/** Самый дальний двор, который можно выбрать (не туман и не «следующий»): двор текущего урока. */
const maxStage = (cur: number): number => stageOf(reachTo(cur));

const yardState = (stage: number, i: MapInput): YardState => {
  if (i.end || i.cur > LAST_LESSON) return 'done';
  const cur = stageOf(i.cur);
  return stage < cur ? 'done' : stage === cur ? 'cur' : stage === cur + 1 ? 'near' : 'fog';
};

const lessonState = (n: number, i: MapInput): LessonState => {
  if (n < i.cur) return i.stars[n] === 1 ? 'ring' : 'done';
  return n === i.cur ? 'cur' : 'near';
};

const flagOf = (stage: number, i: MapInput): FlagMark => {
  const ls = lessonsOf(stage);
  if (!ls.some((n) => ROUNDS.includes(n))) return 'none';
  const next = ROUNDS.find((r) => r >= i.cur);
  return !i.end && next !== undefined && ls.includes(next) ? 'next' : 'later';
};

export function lessonView(n: number, i: MapInput): LessonView {
  return { n, state: lessonState(n, i), stars: i.stars[n] ?? 0, control: isControl(n), friendly: i.friendly.has(n), away: isAway(n), reach: n <= reachTo(i.cur) };
}

/** Выбор по умолчанию: текущий урок и его двор (Двор пройден — последний урок). */
export const defaultSel = (i: MapInput): MapSel => ({ stage: maxStage(i.cur), lesson: reachTo(i.cur) });

/** Выбор допустим: двор не за туманом, урок сыгран или текущий и лежит в этом дворе. */
const valid = (i: MapInput, sel: MapSel): boolean =>
  Number.isInteger(sel.stage) && Number.isInteger(sel.lesson) && sel.stage >= 1 && sel.stage <= maxStage(i.cur) && sel.lesson >= 1 && sel.lesson <= reachTo(i.cur) && stageOf(sel.lesson) === sel.stage;

/** Урок, на который встаёт выбор при смене двора: у текущего двора — текущий, у пройденного — первый «за звёздами», иначе первый. */
function lessonOnEntry(stage: number, i: MapInput): number {
  const ls = lessonsOf(stage);
  if (stage === maxStage(i.cur)) return reachTo(i.cur);
  return ls.find((n) => lessonState(n, i) === 'ring') ?? ls[0]!;
}

/** Выбор по клику на двор: туман и «следующий» двор не выбираются (К1) — выбор остаётся прежним. */
export function pickYard(i: MapInput, sel: MapSel, stage: number): MapSel {
  if (!Number.isInteger(stage) || stage < 1 || stage > maxStage(i.cur)) return sel;
  return { stage, lesson: lessonOnEntry(stage, i) };
}

/** Стрелки: ← → — двор, ↑ ↓ — урок двора; выбор не выходит за доступное (К1) и не запускает матч (К3). */
export function navigate(i: MapInput, sel: MapSel, key: MapKey): MapSel {
  const from = clampSel(i, sel);
  if (key === 'left' || key === 'right') return pickYard(i, from, Math.min(Math.max(from.stage + (key === 'right' ? 1 : -1), 1), STAGES));
  const ls = lessonsOf(from.stage).filter((n) => n <= reachTo(i.cur));
  const to = ls[Math.min(Math.max(ls.indexOf(from.lesson) + (key === 'down' ? 1 : -1), 0), ls.length - 1)];
  return to === undefined ? from : { stage: from.stage, lesson: to };
}

/** Выбор приведён к доступному: после смены данных (новый урок) выбор не остаётся за туманом. */
export const clampSel = (i: MapInput, sel: MapSel): MapSel => (valid(i, sel) ? sel : defaultSel(i));

export function mapView(i: MapInput, sel: MapSel = defaultSel(i)): MapView {
  const s = clampSel(i, sel);
  const here = i.cur > LAST_LESSON ? null : i.cur;
  const nodes = Array.from({ length: STAGES }, (_, k): YardNode => {
    const stage = k + 1;
    const lessons = lessonsOf(stage).map((n) => lessonView(n, i));
    return {
      stage,
      street: streetName(k),
      state: yardState(stage, i),
      lessons,
      flag: flagOf(stage, i),
      here: here !== null && stageOf(here) === stage,
      passed: i.end || i.cur > LAST_LESSON || stage < stageOf(i.cur),
      full: lessons.filter((l) => l.stars === 3).length,
    };
  });
  return { nodes, here, sel: s, selLesson: lessonView(s.lesson, i), cupAfter: i.end ? null : (ROUNDS.find((r) => r >= i.cur) ?? null) };
}

/** Enter: какой урок играть — выбранный, если он допустим; иначе null (холостой Enter, К1). */
export const enterLesson = (i: MapInput, sel: MapSel): number | null => (valid(i, sel) ? sel.lesson : null);
