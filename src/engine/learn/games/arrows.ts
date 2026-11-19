/**
 * «Пас стрелками» (057, игра 1; ТЗ-7.1, 7.5): мяч по клеткам к воротам в обход защитников, три поля.
 * Ворота — на ряду мяча, цель — зона столбца 7 из трёх рядов (кадры Э8.01–02). Промах — шаг не к воротам (дальше кратчайшего пути), упор в защитника или край. Игра идёт дальше (057-Р4).
 */
import cfg from '../../../content/learn.json';
import { createRandom, randomInt } from '../../random';
import type { Playing, Pt } from './common';

export type Dir = 'left' | 'up' | 'right' | 'down';
/** Сдвиг клетки за шаг стрелкой — экран по нему находит клетку, в которую упёрся мяч. */
export const STEP: Record<Dir, Pt> = { left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 } };

export interface ArrowsState extends Playing {
  /** Номер поля, 0…2. */
  field: number;
  seed: number;
  ball: Pt;
  /** Ворота — снаружи сетки, на ряду мяча (057-Р22); здесь — клетка столбца 7 на этом ряду. */
  goal: Pt;
  /** Зона цели: столбец 7, три ряда вокруг ряда ворот (у края ряды сдвигаются, чтобы клеток было три). */
  zone: readonly Pt[];
  defenders: readonly Pt[];
  /** Сколько шагов до ворот по кратчайшему пути — от каждой клетки (ключ `x,y`); недостижимые — нет. */
  dist: Readonly<Record<string, number>>;
  steps: number;
}

const key = (p: Pt): string => `${p.x},${p.y}`;
const COLS = cfg.play.arrows.cols;
const ROWS = cfg.play.arrows.rows;
const inside = (p: Pt): boolean => p.x >= 0 && p.y >= 0 && p.x < COLS && p.y < ROWS;

/** Три клетки столбца 7 вокруг ряда `row`. */
function goalZone(row: number): Pt[] {
  const mid = Math.min(Math.max(row, 1), ROWS - 2);
  return [mid - 1, mid, mid + 1].map((y) => ({ x: COLS - 1, y }));
}

/** Расстояния до зоны цели обходом в ширину от всех её клеток, защитники — стены. */
function distances(zone: readonly Pt[], walls: ReadonlySet<string>): Record<string, number> {
  const dist: Record<string, number> = Object.fromEntries(zone.map((p) => [key(p), 0]));
  const queue: Pt[] = [...zone];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    for (const d of Object.values(STEP)) {
      const next = { x: at.x + d.x, y: at.y + d.y };
      if (!inside(next) || walls.has(key(next)) || dist[key(next)] !== undefined) continue;
      dist[key(next)] = dist[key(at)]! + 1;
      queue.push(next);
    }
  }
  return dist;
}

/** Поле по зерну: мяч слева, ворота справа на ряду мяча, защитники на свободных клетках; путь от мяча к воротам всегда есть. */
function makeField(seed: number, field: number): Omit<ArrowsState, 'misses' | 'done' | 'steps'> {
  const rnd = createRandom(seed * 31 + field + 1);
  const count = cfg.play.arrows.defenders[field] ?? 5;
  for (;;) {
    const ball = { x: 0, y: randomInt(rnd, ROWS) };
    const zone = goalZone(ball.y);
    const goal = { x: COLS - 1, y: ball.y };
    const defenders: Pt[] = [];
    const taken = new Set([key(ball), ...zone.map(key)]);
    while (defenders.length < count) {
      const p = { x: randomInt(rnd, COLS), y: randomInt(rnd, ROWS) };
      if (taken.has(key(p))) continue;
      taken.add(key(p));
      defenders.push(p);
    }
    const dist = distances(zone, new Set(defenders.map(key)));
    if (dist[key(ball)] !== undefined) return { field, seed, ball, goal, zone, defenders, dist };
  }
}

export function startArrows(seed: number): ArrowsState {
  return { ...makeField(seed, 0), misses: 0, done: false, steps: 0 };
}

/** Шаг стрелкой. Упор — промах, мяч стоит; шаг не ближе к воротам — промах, мяч идёт; ворота — следующее поле или конец. */
export function moveArrows(s: ArrowsState, dir: Dir): ArrowsState {
  if (s.done) return s;
  const next = { x: s.ball.x + STEP[dir].x, y: s.ball.y + STEP[dir].y };
  const to = inside(next) ? s.dist[key(next)] : undefined;
  if (to === undefined) return { ...s, misses: s.misses + 1 };
  const worse = to >= (s.dist[key(s.ball)] ?? Infinity);
  const misses = s.misses + (worse ? 1 : 0);
  if (to > 0) return { ...s, ball: next, misses, steps: s.steps + 1 };
  if (s.field + 1 >= cfg.play.arrows.defenders.length) return { ...s, ball: next, misses, steps: s.steps + 1, done: true };
  return { ...makeField(s.seed, s.field + 1), misses, done: false, steps: s.steps + 1 };
}
