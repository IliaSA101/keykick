/**
 * Слои сцены Дома (065 К-Е, 048 §2–§3): из вида Дома и входа — список картинок печи с местом в кадре 1920×1072.
 * Правило рисования одно с макетом (`tools/mock-map/compose_layers.py`, `home_sprites.py`): основа → под людьми → заготовка →
 * люди → поверх → команда. Чистая функция: семя рассадки приходит снаружи, `Math.random` нет. Люди и окна — по числу болельщиков.
 */
import art from '../../content/home-art.json';
import yard from '../../content/home-yard.json';
import type { HomeInput } from '../../engine/home';
import { createRandom } from '../../engine/random';
import type { HomeView } from '../../engine/home/view';
import { teamOf } from './team';

export type Box = [number, number, number, number];
/** Картинка в кадре 1920×1072: левый верх `x, y`, размер `w, h`; `clip` — до какой высоты видна (ноги за бортом). */
export interface Piece {
  key: string;
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
  flip?: boolean;
  clip?: number;
}
export interface Scene {
  base: string;
  ghost: string | null;
  under: Piece[];
  people: Piece[];
  over: Piece[];
  /** Команда на поле: вратарь, игроки по урокам, контур следующей группы (Т7д, `team.ts`) — поверх всего. */
  team: Piece[];
}

const ITEM_OF: Record<string, string> = { 'gate-sticker': 'sticker', 'center-circle': 'circle', 'net-flags': 'bunting', graffiti: 'graffiti', drum: 'drum', garland: 'garland', banner: 'banner' };
type ItemArt = { file: string; box: Box; z: string };
const ITEMS = art.overlays.items as unknown as Record<string, ItemArt>;

const piece = (key: string, file: string, box: Box, flip = false): Piece => ({ key, file, x: box[0], y: box[1], w: box[2] - box[0], h: box[3] - box[1], ...(flip ? { flip } : {}) });

/**
 * Щит «Школы» на фронтоне (Т7д, 023-Р10): плашка с гербом клуба, `n` из 10 частей в цвете, остальные — пунктиром. Со дня 2 (урок 3+).
 * Картинка запечена с синим гербом: цвет клуба она получает перекраской, как болельщики. Раньше — нет щита.
 */
export function shieldOf(cur: number, n: number): Piece | null {
  const sh = art.shield;
  if (cur < sh.from) return null;
  const file = sh.files[Math.max(0, Math.min(sh.files.length - 1, Math.floor(n)))]!;
  return { key: 'shield', file, x: sh.x - Math.floor(sh.w / 2), y: sh.y - Math.floor(sh.h / 2), w: sh.w, h: sh.h };
}

/** Прежнее имя для сцены и её теста: генератор один — `createRandom` движка (066 Т6). */
export { createRandom as rng };

type Row = number[];
type Place = [number, number, number];

/** Места рядов (sprites.seats): `rows` — [y доски, x0, x1, y обреза ног]; `holes` — участки x без мест (столб табло). */
export function seatsOf(rows: Row[], gap: number, holes: [number, number][] = []): Place[] {
  const out: Place[] = [];
  for (const [y, x0, x1, clip] of rows as [number, number, number, number][]) {
    const n = Math.floor((x1 - x0) / gap);
    const step = (x1 - x0) / n;
    for (let j = 0; j < n; j++) {
      const x = x0 + step * (j + 0.5);
      if (!holes.some(([a, b]) => a <= x && x <= b)) out.push([x, y, clip]);
    }
  }
  return out;
}

/** Заполнение мест трети: 0 — пусто, 1…3 (compose_layers.level); 1 фигурка = `figure` болельщиков. */
export const levelOf = (fans: number, places: number): number => {
  const figs = Math.floor(fans / yard.figure);
  return figs <= 0 ? 0 : Math.min(3, Math.ceil((3 * figs) / places));
};

/** Лучшие места первыми — первые ряды и центр (sprites.order); сколько посадить — `n`. */
function crowd(places: Place[], n: number, pool: { file: string; w: number; h: number }[], rnd: () => number, key: string, flip: boolean): Piece[] {
  if (places.length === 0 || n <= 0) return [];
  const cx = places.reduce((a, p) => a + p[0], 0) / places.length;
  const take = [...places].sort((a, b) => b[1] - a[1] || Math.abs(a[0] - cx) - Math.abs(b[0] - cx)).slice(0, n).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const picked: number[] = [];
  return take.map(([x, y, clip], i) => {
    const near = new Set(take.slice(0, i).map((p, j) => (Math.abs(p[0] - x) < 80 && Math.abs(p[1] - y) < 40 ? picked[j]! : -1)));
    const free = pool.map((_, j) => j).filter((j) => !near.has(j));
    const list = free.length > 0 ? free : pool.map((_, j) => j);
    const j = list[Math.floor(rnd() * list.length)]!;
    picked.push(j);
    const dx = (rnd() * 2 - 1) * 3;
    const dy = (rnd() * 2 - 1) * 2;
    const sc = 0.94 + rnd() * 0.1;
    const mirror = flip && rnd() < 0.5;
    const spr = pool[j]!;
    const h = yard.fanHeight * sc;
    const w = (spr.w / spr.h) * h;
    const top = y + dy - h * 0.66;
    return { key: `${key}${i}`, file: spr.file, x: x + dx - w / 2, y: top, w, h, ...(mirror ? { flip: true } : {}), clip: clip - top };
  });
}

/** Слои сцены по виду Дома. */
export function sceneOf(i: HomeInput, v: HomeView, seed: number): Scene {
  const built = v.stadium.built;
  const under: Piece[] = [];
  const over: Piece[] = [];
  const put = (z: string, p: Piece): void => void (z === 'under' ? under : over).push(p);
  for (const g of art.golds) if (g.n === built && v.stadium.golds.includes(g.k)) put(g.z, piece(`gold${g.k}`, g.file, g.box as Box));
  const corner = art.overlays.corner.find((c) => c.n === built);
  if (corner) over.push(piece('corner', corner.file, corner.box as Box));
  const flags = art.overlays.flags.find((f) => f.n === built);
  if (flags) over.push(piece('flags', flags.file, flags.box as Box));
  const arch = art.overlays.arch.find((a) => a.lesson === Math.min(i.cur, 33));
  if (arch) over.push(piece('arch', arch.file, arch.box as Box));
  const shield = shieldOf(i.cur, i.extras.emblemN ?? 0);
  if (shield) over.push(shield);
  const museum = v.houses.museum;
  const mu = museum.lock ? art.overlays.museum.closed : museum.sub?.key === 'goldAward' ? art.overlays.museum.gold : art.overlays.museum.open;
  over.push(piece('museum', mu.file, mu.box as Box));
  for (const id of i.bought) {
    const key = ITEM_OF[id];
    const it = key === undefined ? undefined : ITEMS[key];
    if (key !== undefined && it !== undefined && (key !== 'garland' || i.cur >= 27)) put(it.z, piece(`item-${key}`, it.file, it.box));
  }
  for (const w of art.overlays.windows) {
    if (i.fans < w.fans) continue;
    const mirror = yard.windows.find((y) => y.at[0] === w.at[0] && y.at[1] === w.at[1])?.mirror === true;
    over.push(piece(`win${w.i}`, w.file, w.box as Box, mirror));
  }
  const rnd = createRandom(seed);
  const people: Piece[] = [];
  const fans = art.sprites.fans;
  const benches = i.cur > 9 && i.cur <= 18;
  if (benches) {
    const rows = built <= 3 ? yard.seats.cup.rows : yard.seats.mid.rows;
    const places = seatsOf(rows, yard.fanGap);
    const lv = levelOf(i.fans, yard.seats.mid.n);
    people.push(...crowd(places, Math.round((places.length * lv) / 3), fans, rnd, 'b', true));
  }
  if (i.cur > 18) {
    const [h0, h1] = yard.seats.trib.hole as [number, number];
    const star = v.stadium.sector;
    const [s0, s1] = yard.seats.sector.x as [number, number];
    let places = seatsOf(yard.seats.trib.rows, yard.fanGap, i.cur >= 22 ? [[h0, h1]] : []);
    if (star) places = places.filter((p) => !(p[1] >= 613 && s0 <= p[0] && p[0] <= s1));
    const lv = levelOf(i.fans, yard.seats.trib.n);
    if (lv > 0) people.push(...crowd(places, Math.round((places.length * lv) / 3), fans, rnd, 't', true));
    if (star) people.push(...crowd(seatsOf(yard.seats.sector.rows, yard.fanGap).filter((p) => s0 <= p[0] && p[0] <= s1), 99, art.sprites.stars, rnd, 's', false));
  }
  const base = art.bases.find((b) => b.n === built)?.file ?? art.bases[0]!.file;
  const ghost = v.stadium.ghost ? (art.ghosts.find((g) => g.n === built)?.file ?? null) : null;
  return { base, ghost, under, people, over, team: teamOf(i.cur, i.bought, built) };
}

/** Ступень выросла после прошлого показа Дома (моушн М4): `prev` — сколько ступеней видели; не видели — не играем. */
export const stepGrew = (prev: number | null, built: number): boolean => prev !== null && built > prev;

/**
 * Новая ступень сегодня — строка «Новая ступень: …!» на табличке стадиона: урок сразу после её порога (ворота не объявляем: день 2 — про Школу).
 * После паузы ≥ 5 дней (`pause5`) ступень уже не новая: ребёнок видел её до перерыва; в принятом кадре Э2.91 баннера нет (065-Р80).
 */
export function newStepId(cur: number, steps: readonly { after: number; id: string }[], pause5 = false): string | null {
  if (pause5) return null;
  const s = steps.find((x) => x.after + 1 === cur && x.id !== 'gate');
  return s?.id ?? null;
}
