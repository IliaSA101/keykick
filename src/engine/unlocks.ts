/**
 * План открытий (спека 002, content/unlocks.json): что открывается и после какого урока. Вехи —
 * id уроков: вставка урока их не сдвигает (002-Р2). Раунды кубка — по лигам; возможности
 * (features) ставят спеки, которые их делают (первой — 005). Открыто — по ходу игрока (lessonIndex),
 * а не по уроку матча: дошёл дальше вехи — открыто и при переигровке ранних уроков.
 */
import {
  CUP_ROUNDS,
  CUP_STAGES,
  LEAGUES,
  cupMilestones,
  isLeague,
  roundOpen,
  roundPassed,
  type CupStage,
  type League,
  type LessonRef,
} from './cup';
import type { SaveData } from './save';

/** Возможность: открыта, когда пройден урок after. */
export interface FeatureUnlock {
  id: string;
  after: string;
}

export interface UnlockPlan {
  /** cup[лига][stage] — id урока-вехи раунда stage (0 — 1/8 … 3 — финал). */
  cup: Record<League, readonly string[]>;
  features: readonly FeatureUnlock[];
}

export type UnlockId = `cup:${League}:${CupStage}` | `feature:${string}`;

/** Открытие и номер его урока-вехи (с 0). */
export interface Unlock {
  id: UnlockId;
  at: number;
}

const FEATURE_ID = /^[A-Za-z][A-Za-z0-9]*$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function parseCupPlan(raw: unknown, lessons: readonly LessonRef[]): Record<League, readonly string[]> {
  if (!isRecord(raw)) throw new Error('unlocks: cup must be an object');
  const out: Partial<Record<League, readonly string[]>> = {};
  for (const league of LEAGUES) {
    const ids = raw[league];
    if (!Array.isArray(ids) || ids.length !== CUP_ROUNDS) throw new Error(`unlocks: cup.${league} must list ${CUP_ROUNDS} lessons`);
    let prev = -1;
    for (const id of ids as unknown[]) {
      const i = lessons.findIndex((l) => l.id === id);
      if (typeof id !== 'string' || i < 0) throw new Error(`unlocks: cup.${league}: unknown lesson ${String(id)}`);
      if (lessons[i]?.league !== league) throw new Error(`unlocks: cup.${league}: ${id} is from another league`);
      if (i <= prev) throw new Error(`unlocks: cup.${league}: ${id} is out of order`);
      prev = i;
    }
    const lastOwn = lessons.reduce((last, l, i) => (l.league === league ? i : last), -1);
    if (prev !== lastOwn) throw new Error(`unlocks: cup.${league}: the final must be the last lesson of the league`);
    out[league] = [...(ids as string[])];
  }
  return out as Record<League, readonly string[]>;
}

function parseFeatures(raw: unknown, lessons: readonly LessonRef[]): FeatureUnlock[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error('unlocks: features must be an array');
  const out: FeatureUnlock[] = [];
  for (const f of raw as unknown[]) {
    if (!isRecord(f) || typeof f.id !== 'string' || !FEATURE_ID.test(f.id)) throw new Error('unlocks: feature id must be latin');
    if (out.some((o) => o.id === f.id)) throw new Error(`unlocks: feature ${f.id} is listed twice`);
    if (typeof f.after !== 'string' || !lessons.some((l) => l.id === f.after)) throw new Error(`unlocks: feature ${f.id}: unknown lesson`);
    out.push({ id: f.id, after: f.after });
  }
  return out;
}

/**
 * Разбор плана; битый — ошибка (контент — часть сборки, ловит тест на настоящем файле). У каждой
 * лиги ровно 4 вехи: из этой лиги, строго по порядку, последняя — последний урок лиги.
 * about и лишние поля пропускаются.
 */
export function parseUnlocks(raw: unknown, lessons: readonly LessonRef[]): UnlockPlan {
  if (!isRecord(raw)) throw new Error('unlocks: plan must be an object');
  return { cup: parseCupPlan(raw.cup, lessons), features: parseFeatures(raw.features, lessons) };
}

/** Все открытия по возрастанию урока-вехи; при равных — кубок раньше возможности. */
export function unlocksOf(plan: UnlockPlan, lessons: readonly LessonRef[]): Unlock[] {
  const cups: Unlock[] = LEAGUES.flatMap((league) => {
    const at = cupMilestones(plan, lessons, league);
    return CUP_STAGES.map((stage) => ({ id: `cup:${league}:${stage}` as const, at: at[stage] ?? Number.POSITIVE_INFINITY }));
  });
  const features: Unlock[] = plan.features.map((f) => ({
    id: `feature:${f.id}` as const,
    at: lessons.findIndex((l) => l.id === f.after),
  }));
  // sort устойчивая: при равных at кубки (они в списке первыми) остаются впереди.
  // Недостижимые вехи (Infinity) — в конце; Infinity − Infinity дало бы NaN.
  return [...cups, ...features].sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? -1 : 1));
}

/** Раунд кубка из id открытия; не кубок — null. */
export function cupOfUnlock(id: UnlockId): { league: League; stage: CupStage } | null {
  const [kind, league, stage] = id.split(':');
  const n = Number(stage);
  if (kind !== 'cup' || !isLeague(league) || !CUP_STAGES.includes(n as CupStage)) return null;
  return { league, stage: n as CupStage };
}

/** Открыто ли: кубок — roundOpen (там ещё finalOpen); возможность — игрок ушёл дальше урока after. */
export function isUnlocked(save: SaveData, lessons: readonly LessonRef[], plan: UnlockPlan, u: Unlock): boolean {
  const cup = cupOfUnlock(u.id);
  if (cup) return roundOpen(save, lessons, plan, cup.league, cup.stage);
  return u.at >= 0 && save.lessonIndex > u.at;
}

/** Открытое сейчас — в порядке unlocksOf. */
export function openUnlocks(save: SaveData, lessons: readonly LessonRef[], plan: UnlockPlan): UnlockId[] {
  return unlocksOf(plan, lessons)
    .filter((u) => isUnlocked(save, lessons, plan, u))
    .map((u) => u.id);
}

/** Открыта ли возможность id (для 005 и дальше); её нет в плане — закрыта. */
export function featureOpen(save: SaveData, lessons: readonly LessonRef[], plan: UnlockPlan, id: string): boolean {
  const u = unlocksOf(plan, lessons).find((x) => x.id === `feature:${id}`);
  return u !== undefined && isUnlocked(save, lessons, plan, u);
}

/** Ближайшее неоткрытое: lesson — номер урока-вехи для подписи (с 1); left — сколько уроков пройти (1 — этот). */
export interface Upcoming {
  id: UnlockId;
  lesson: number;
  left: number;
}

/** Раунд кубка уже пройден по записи (после «Поставить урок» назад он закрыт, но звать к нему незачем). */
function passedCup(save: SaveData, u: Unlock): boolean {
  const cup = cupOfUnlock(u.id);
  return cup !== null && roundPassed(save, cup.league, cup.stage);
}

/** Ближайшее закрытое открытие, кроме пройденных по записи раундов кубка; всё открыто — null. */
export function upcoming(save: SaveData, lessons: readonly LessonRef[], plan: UnlockPlan): Upcoming | null {
  const next = unlocksOf(plan, lessons).find(
    (u) => Number.isFinite(u.at) && u.at >= 0 && !isUnlocked(save, lessons, plan, u) && !passedCup(save, u),
  );
  if (!next) return null;
  return { id: next.id, lesson: next.at + 1, left: Math.max(1, next.at - save.lessonIndex + 1) };
}

/** Что открылось матчем: открыто в after и закрыто в before (порядок — unlocksOf). */
export function newlyOpened(before: SaveData, after: SaveData, lessons: readonly LessonRef[], plan: UnlockPlan): UnlockId[] {
  const was = new Set(openUnlocks(before, lessons, plan));
  return openUnlocks(after, lessons, plan).filter((id) => !was.has(id));
}

/** Что открывает урок lessonId — для итога в быстрой проверке (там сохранение не меняется). */
export function milestoneOf(lessonId: string, lessons: readonly LessonRef[], plan: UnlockPlan): UnlockId[] {
  const i = lessons.findIndex((l) => l.id === lessonId);
  if (i < 0) return [];
  return unlocksOf(plan, lessons)
    .filter((u) => u.at === i)
    .map((u) => u.id);
}
