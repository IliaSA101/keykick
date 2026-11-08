/**
 * Раскладка карты лиги (спека 019, design §4.1): разбор `map-<лига>.json`.
 * Чистая функция без Vue и DOM; файлы по маске читает `app/map/load.ts`. Любая ошибка — `fail` с путём.
 */
import type { CourseLesson, League } from '../course/model';
import { fail } from '../lessonModel';

export type Pt = [number, number];
export const buildingIds = ['stadium', 'school', 'base', 'museum'] as const;
export type BuildingId = (typeof buildingIds)[number];

export interface MapLayout {
  league: string;
  view: Pt;
  /** Точки уроков по порядку, длина = число уроков лиги. */
  points: Pt[];
  places: { stage: number; name: string; at: Pt }[];
  buildings: Record<BuildingId, Pt>;
  gate: Pt;
}

/** Поле, в которое нельзя выходить точкам, местам и зданиям. */
export const MAP_MARGIN = 40;
/**
 * Минимум между соседними точками уроков: 88 единиц поля — на 1024 это ≈ 41,6 px между центрами. Круги нажатия по 44 px
 * на краях перекрываются ≤ 3 px; точка в 3 px от края круга — ещё своя (e2e `map-targets`, 019-Р45, Р48).
 */
export const MIN_NEIGHBOUR = 88;
/** Минимум между любыми двумя точками: круги нажатия не должны налезать друг на друга. */
export const MIN_ANY = 88;

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {});

function known(r: Rec, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(r)) if (!allowed.includes(key)) fail(where, `unknown field ${key}`);
}

function pt(v: unknown, where: string): Pt {
  if (!Array.isArray(v) || v.length !== 2 || v.some((n) => typeof n !== 'number' || !Number.isInteger(n))) {
    fail(where, 'expected [x, y] of integers');
  }
  return [v[0] as number, v[1] as number];
}

function inside(p: Pt, view: Pt, where: string): void {
  if (p[0] < MAP_MARGIN || p[1] < MAP_MARGIN || p[0] > view[0] - MAP_MARGIN || p[1] > view[1] - MAP_MARGIN) {
    fail(where, `point ${p[0]},${p[1]} is outside the field with margin ${MAP_MARGIN}`);
  }
}

const dist = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Разбор `map-<лига>.json` против каркаса лиг и уроков этой лиги. */
export function parseMapLayout(raw: unknown, leagues: readonly League[], lessons: readonly CourseLesson[]): MapLayout {
  const r = rec(raw);
  known(r, ['about', 'league', 'view', 'points', 'places', 'buildings', 'gate'], 'map');
  const id = r.league;
  const league = leagues.find((l) => l.id === id);
  if (typeof id !== 'string' || !league) fail('map', `unknown league ${String(id)}`);
  const where = `map[${league.id}]`;
  const view = pt(r.view, `${where}.view`);
  if (view[0] < 2 * MAP_MARGIN + 1 || view[1] < 2 * MAP_MARGIN + 1) fail(`${where}.view`, 'field is too small');

  if (!Array.isArray(r.points) || r.points.length !== league.lessons) {
    fail(where, `expected points: ${league.lessons} (one per lesson)`);
  }
  const points = r.points.map((p, i) => {
    const q = pt(p, `${where}.points[${i}]`);
    inside(q, view, `${where}.points[${i}]`);
    return q;
  });
  points.forEach((p, i) => {
    for (let j = 0; j < i; j++) {
      const min = j === i - 1 ? MIN_NEIGHBOUR : MIN_ANY;
      if (dist(p, points[j]!) < min) fail(`${where}.points[${i}]`, `too close to points[${j}] (< ${min})`);
    }
  });

  const stages = new Set(lessons.filter((l) => l.league === league.id).map((l) => l.stage));
  if (!Array.isArray(r.places)) fail(where, 'expected places');
  const seen = new Set<number>();
  const places = r.places.map((item, i) => {
    const w = `${where}.places[${i}]`;
    const p = rec(item);
    known(p, ['stage', 'name', 'at'], w);
    const stage = p.stage;
    if (typeof stage !== 'number' || !stages.has(stage)) fail(w, `stage ${String(stage)} has no lessons in the league`);
    if (seen.has(stage)) fail(w, `duplicate stage ${stage}`);
    seen.add(stage);
    if (typeof p.name !== 'string' || p.name === '') fail(w, 'expected name');
    const at = pt(p.at, `${w}.at`);
    inside(at, view, w);
    return { stage, name: p.name, at };
  });
  for (const s of stages) if (!seen.has(s)) fail(where, `no place for stage ${s}`);

  const b = rec(r.buildings);
  known(b, buildingIds, `${where}.buildings`);
  const buildings = {} as Record<BuildingId, Pt>;
  for (const key of buildingIds) {
    buildings[key] = pt(b[key], `${where}.buildings.${key}`);
    inside(buildings[key], view, `${where}.buildings.${key}`);
  }
  const gate = pt(r.gate, `${where}.gate`);
  inside(gate, view, `${where}.gate`);
  return { league: league.id, view, points, places, buildings, gate };
}
