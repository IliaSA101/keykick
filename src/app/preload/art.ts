/**
 * Графика экрана для догрузки (067 Т23): какие файлы экран попросит при первом открытии. Статичные экраны — списки `screenArt`
 * (`src/art/assets.ts`), Дом — функция от урока и покупок (манифест `home-art.json`, ступень по `builtOf` — тем же путём, что рисует Дом), Карта и Путь — манифест
 * и `artPath*`. Чистые функции: состояние приходит снаружи (`ArtCtx`). Пути — от корня сайта, без `BASE_URL`.
 */
import art from '../../content/home-art.json';
import { artFiles, artPathEager, artPathLazy, screenArt, type ArtKey } from '../../art/assets';
import { builtOf } from '../../engine/home/stadium';
import { baseOf } from '../home/scene';
import { teamOf } from '../home/team';
import { reach, type PreloadScreen } from './graph';
import type { Plan } from './queue';

/** Что догрузка знает о состоянии: урок Дома (`null` — ещё не известен) и купленное. */
export interface ArtCtx {
  cur: number | null;
  bought: readonly string[];
}

const uniq = (files: readonly string[]): string[] => [...new Set(files)];

/** Дом: основа и заготовка ступени, золото и углы ступени, арка урока, Музей (закрыт и открыт), купленное, команда на поле. */
export function homeArtFiles(cur: number, bought: readonly string[]): string[] {
  const built = builtOf(cur);
  const ofStage = (list: readonly { n: number; file: string }[]): string[] => list.filter((x) => x.n === built).map((x) => x.file);
  const items = art.overlays.items as unknown as Record<string, { file: string }>;
  const boughtFiles = Object.entries({ 'gate-sticker': 'sticker', 'center-circle': 'circle', 'net-flags': 'bunting', graffiti: 'graffiti', drum: 'drum', garland: 'garland', banner: 'banner' })
    .filter(([id]) => bought.includes(id))
    .map(([, key]) => items[key]?.file ?? '');
  return uniq([
    baseOf(built),
    ...ofStage(art.ghosts),
    ...ofStage(art.golds),
    ...ofStage(art.overlays.corner),
    ...ofStage(art.overlays.flags),
    ...art.overlays.arch.filter((a) => a.lesson === Math.min(cur, 33)).map((a) => a.file),
    art.overlays.museum.closed.file,
    art.overlays.museum.open.file,
    ...boughtFiles,
    ...teamOf(cur, bought, built).map((p) => p.file),
  ]).filter((f) => f !== '');
}

/** Карта: основа, вырезки Двора, облака и автобус. */
export const mapArtFiles = (): string[] => uniq([art.map.base, art.map.yard.empty.file, art.map.yard.full.file, ...[1, 2, 3, 4, 5, 6].map((n) => `art/map/cloud-${n}.webp`), 'art/map/bus-34.webp']);

/** Путь клуба: сразу — облака, кубок мира, основа Двора; следующий уровень (первый из ленивых) — вдогонку. */
export const pathArtFiles = (): string[] => uniq([...artPathEager.map((k) => artFiles[k]), art.map.base, art.map.yard.empty.file, art.map.yard.full.file, artFiles[artPathLazy[0]!]]);

const screenArtFiles = (screen: string): string[] => ((screenArt as Partial<Record<string, readonly ArtKey[]>>)[screen] ?? []).map((k) => artFiles[k]);

/** Все файлы экрана при первом открытии (без общего каркаса: шапка, значки). Кубок и Клуб без своих картинок отдают пусто или список. */
export function filesOf(screen: PreloadScreen, ctx: ArtCtx): string[] {
  if (screen === 'home') return homeArtFiles(ctx.cur ?? 1, ctx.bought);
  if (screen === 'map') return mapArtFiles();
  if (screen === 'path') return pathArtFiles();
  // Музей: свои картинки и врезка Двора (основа ступени, как на Доме; `MuseumScreen`).
  if (screen === 'museum') return uniq([...screenArtFiles('museum'), baseOf(builtOf(ctx.cur ?? 1))]);
  return screenArtFiles(screen);
}

/** План очереди для экрана: он сам — только пометка (грузит себя сам), соседи на один переход — в порядке графа (067-Р248). */
export function planOf(screen: PreloadScreen, ctx: ArtCtx): Plan {
  return { now: filesOf(screen, ctx), near: reach(screen).flatMap((s) => filesOf(s, ctx)) };
}
