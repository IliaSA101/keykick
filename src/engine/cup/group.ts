/**
 * Группа Кубка Двора (ТЗ-8.5, 8.12, 068 design §4): туры, таблица, чужие матчи от семени.
 * Чужие матчи не хранятся: счёт — функция семени, группы и номера матча, поэтому переигровка нашего тура их не меняет (К6).
 * Подгонка только чужих (В-7 = А): ребёнок без поражений выходит из группы — 2–3 победы 1-м, иначе 2-м. Чужие матчи туров 1–2
 * нашей группы от нашего исхода не зависят, тур 3 решает развязку; очки разведены строго, разница мячей места не решает.
 * Соперники нашего плей-офф (`KO_RIVALS`: Стриж, Фрегат, Флагман, Рассвет — дворы Карты) при нашем 1-м месте выходят 2-ми, при 2-м — 1-ми:
 * так наша пара 1/8, 1/4, полуфинала и финала — тот же двор, что у Дома и Карты (023-Р35а), а «Рассвет» — в половине сетки, где нас нет (038-Р6).
 * Чистые функции: Vue, DOM, часов и `Math.random` нет.
 */
import { KO_RIVAL_GROUPS, TEAMS } from './teams';
import type { Cup, TableRow, Tour } from './types';

/** Id нашей команды в таблицах и сетке. */
export const OUR = 'our';
export const OUR_GROUP = 'C';
export const LETTERS: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const TOURS = 3;

/** Семя Кубка из id игрока (068-Р4): FNV-1a, беззнаковое 32 бита. */
export function seedOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Целое 0…n−1 — функция семени и ключа (без состояния, порядок вызовов не важен). */
export function rnd(seed: number, key: string, n: number): number {
  let h = seed ^ 0x9e3779b9;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) % n;
}

/** Команды группы по порядку посева; в нашей группе первой стоит `our`. */
export function groupTeams(letter: string): string[] {
  const ids = TEAMS.filter((t) => t.group === letter).map((t) => t.id);
  return letter === OUR_GROUP ? [OUR, ...ids] : ids;
}

/** Исход пары: `a` — выиграл первый, `d` — ничья, `b` — выиграл второй. */
export type Out = 'a' | 'd' | 'b';
export interface Match {
  t: number;
  a: number;
  b: number;
  ga: number;
  gb: number;
}

/** Пары туров (индексы в `groupTeams`): в нашей группе мы — 0-й, соперники по турам — 1-й, 2-й, 3-й. */
const PAIRS_OUR: readonly (readonly [number, number][])[] = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
const PAIRS_OTHER: readonly (readonly [number, number][])[] = [[[0, 3], [1, 2]], [[0, 2], [1, 3]], [[0, 1], [2, 3]]];

/** Счёт матча по исходу — функция семени и ключа: ничья 0:0…2:2, победа 1:0…3:2. Общий для группы и плей-офф. */
export function scoreOf(seed: number, key: string, out: Out): [number, number] {
  if (out === 'd') {
    const g = rnd(seed, `${key}d`, 3);
    return [g, g];
  }
  const w = 1 + rnd(seed, `${key}w`, 3);
  const l = rnd(seed, `${key}l`, w);
  return out === 'a' ? [w, l] : [l, w];
}

const recorded = (t: Tour): t is Tour & { me: number; opp: number } => t.me !== null && t.opp !== null;
/** Сколько туров засчитано (туры идут подряд). */
export const playedTours = (tours: readonly Tour[]): number => tours.filter(recorded).length;
/** Ребёнок выходит 1-м (2–3 победы из трёх); верно только когда все туры засчитаны. */
export const firstPlace = (tours: readonly Tour[]): boolean => tours.filter((t) => recorded(t) && t.me > t.opp).length >= 2;

/**
 * Исходы чужих групп. Порядок мест — по посеву (0-й — 1-й). Тур 3: команда 0 берёт 9/7 очков; у групп соперников нашего плей-офф при
 * нашем 1-м месте команда 0 проигрывает команде 1 (`flip`: 6 против 7). Очки: команда 1 — 4/5/7, команда 2 ≤ 4, команда 3 ≤ 3 — разведены строго.
 */
function otherOuts(seed: number, letter: string, flip: boolean): Out[][] {
  const k = (s: string): number => rnd(seed, `g${letter}${s}`, 2);
  const first: Out = flip ? 'b' : k('a') === 0 ? 'a' : 'd';
  const second: Out = first === 'a' ? (k('b') === 0 ? 'd' : 'b') : (['a', 'd', 'b'] as const)[rnd(seed, `g${letter}c`, 3)]!;
  return [['a', 'd'], ['a', 'a'], [first, second]];
}

/** Исходы чужих матчей нашей группы по турам: 2:3 — ничья; 1:3 — побеждает 1-й; тур 3, 1:2 — ничья (мы 1-е) или победа 1-го (мы 2-е). */
const ourOuts = (first: boolean): Out[] => ['d', 'a', first ? 'd' : 'a'];

/** Матчи группы `letter` первых `played` туров. `ours` — туры ребёнка (нужны нашей группе и группе сквозной команды). */
export function groupMatches(letter: string, played: number, ours: readonly Tour[], seed: number): Match[] {
  const out: Match[] = [];
  const first = playedTours(ours) === TOURS && firstPlace(ours);
  const mine = letter === OUR_GROUP;
  const other = mine ? [] : otherOuts(seed, letter, first && KO_RIVAL_GROUPS.has(letter));
  for (let t = 0; t < Math.min(played, TOURS); t++) {
    (mine ? PAIRS_OUR : PAIRS_OTHER)[t]!.forEach(([a, b], k) => {
      if (mine && k === 0) {
        const r = ours[t]!;
        out.push({ t: t + 1, a, b, ga: r.me ?? 0, gb: r.opp ?? 0 });
        return;
      }
      const [ga, gb] = scoreOf(seed, `m${letter}${t}${k}`, mine ? ourOuts(first)[t]! : other[t]![k]!);
      out.push({ t: t + 1, a, b, ga, gb });
    });
  }
  return out;
}

/** Таблица группы после `played` туров: очки, разница, забитые, посев. */
export function groupTable(letter: string, played: number, ours: readonly Tour[], seed: number): TableRow[] {
  const ids = groupTeams(letter);
  const rows: TableRow[] = ids.map((team) => ({ team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, byTour: [null, null, null] }));
  for (const m of groupMatches(letter, played, ours, seed)) {
    const A = rows[m.a]!;
    const B = rows[m.b]!;
    A.p++; B.p++;
    A.gf += m.ga; A.ga += m.gb; B.gf += m.gb; B.ga += m.ga;
    const rs: ['W' | 'D' | 'L', 'W' | 'D' | 'L'] = m.ga > m.gb ? ['W', 'L'] : m.ga < m.gb ? ['L', 'W'] : ['D', 'D'];
    A.byTour[m.t - 1] = { r: rs[0], f: m.ga, a: m.gb };
    B.byTour[m.t - 1] = { r: rs[1], f: m.gb, a: m.ga };
    for (const [row, r] of [[A, rs[0]], [B, rs[1]]] as const) {
      if (r === 'W') { row.w++; row.pts += 3; } else if (r === 'D') { row.d++; row.pts += 1; } else row.l++;
    }
  }
  const order = (r: TableRow): number => ids.indexOf(r.team);
  return [...rows].sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || order(x) - order(y));
}

/** Наше место в группе 1/2 после трёх засчитанных туров; раньше — `null`. */
export function ourPlace(cup: Pick<Cup, 'tours'>, seed: number): 1 | 2 | null {
  if (playedTours(cup.tours) < TOURS) return null;
  const i = groupTable(OUR_GROUP, TOURS, cup.tours, seed).findIndex((r) => r.team === OUR);
  return i === 0 ? 1 : 2;
}
