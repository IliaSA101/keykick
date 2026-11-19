/**
 * Раскладка арены Штрафного (кадры Э4.34–36, 44, 46; макет `tools/mock-games/e4-free.mjs`): всё в единицах арены 816 × 480, как viewBox макета.
 * Фон — арена матча (`matchBgB`), приближенная к воротам; Саша со спины, стенка из четырёх игроков соперника, три мишени-слова над стенкой.
 * Ничего не считает по правилам игры — только где что стоит.
 */
import type { ArtKey } from '../../art/assets';

export const ARENA_W = 816;
export const ARENA_H = 480;
/** Отношение 1920 к базовым px (сцена на 1920 в 1,6875 раза крупнее базовой): диаметры мяча в макете даны в px 1920. */
const Z = 1.6875;

/** Фон 2560 × 1429: приближен к воротам (ворота ≈ 299 × 109, штанга внизу на y 250), газон впереди, камера низко. */
export const BG = { w: 2560, h: 1429, k: 0.4535, ox: -172, oy: -122 };

/** Игроки стенки: файл рисунка и маски формы, размер файла, центр по горизонтали и подошвы. Рост — одинаковый. */
export interface WallKid { art: ArtKey; kit: ArtKey; w: number; h: number; x: number; feet: number }
export const WALL_H = 106;
export const WALL: readonly WallKid[] = [
  { art: 'baseRivalWallCover', kit: 'baseRivalWallCoverKit', w: 144, h: 414, x: 340, feet: 294 },
  { art: 'baseRivalWallCross2', kit: 'baseRivalWallCross2Kit', w: 142, h: 422, x: 380, feet: 296 },
  { art: 'baseRivalWallCross', kit: 'baseRivalWallCrossKit', w: 156, h: 422, x: 420, feet: 294 },
  { art: 'baseRivalWallStand', kit: 'baseRivalWallStandKit', w: 153, h: 438, x: 460, feet: 296 },
];

export type SashaPose = 'run' | 'kick' | 'joy';
/** Саша: файл, размер, где тень (доли ширины) и где на спине надпись (px файла: центр, строка имени, строка номера, наклон). */
interface SashaDef { art: ArtKey; w: number; h: number; shadow: [number, number]; back: { x: number; name: number; num: number; rot: number } }
export const SASHA: Record<SashaPose, SashaDef> = {
  run: { art: 'baseSashaRun', w: 232, h: 419, shadow: [0.4, 0.3], back: { x: 98, name: 152, num: 214, rot: -3 } },
  kick: { art: 'baseSashaKick', w: 286, h: 424, shadow: [0.55, 0.3], back: { x: 162, name: 167, num: 224, rot: -5 } },
  joy: { art: 'baseSashaJoy', w: 200, h: 421, shadow: [0.52, 0.3], back: { x: 98, name: 150, num: 207, rot: 0 } },
};
export const SASHA_H = 236;
export const SASHA_FEET = 472;
/** Левый край Саши по позе. */
export const SASHA_LEFT: Record<SashaPose, number> = { run: 178, kick: 176, joy: 190 };
/** У позы «удар» в файле нарисован мяч — вырезается (px файла); мяч в полёте рисуем сами. */
export const KICK_BALL_CLIP = { x: 0, y: 222, w: 70, h: 76 };

/** Мишени: левый край трёх табличек (первая — текущий удар), верх и размер. */
export const BOARD_X = [267, 366, 465] as const;
export const BOARD = { y: 150, w: 86, h: 29 };

/** Дуга мяча над стенкой: кубическая кривая от ноги Саши к первой мишени. */
export const ARC = [[195, 380], [180, 300], [210, 200], [300, 170]] as const;
/** Точка дуги при доле пути `f` (0 — у ноги, 1 — у мишени). */
export function arcAt(f: number): { x: number; y: number } {
  const u = 1 - f;
  const [a, b, c, d] = ARC;
  const w = [u * u * u, 3 * u * u * f, 3 * u * f * f, f * f * f] as const;
  return { x: w[0] * a[0] + w[1] * b[0] + w[2] * c[0] + w[3] * d[0], y: w[0] * a[1] + w[1] * b[1] + w[2] * c[1] + w[3] * d[1] };
}
/** Радиус мяча в полёте: чем дальше, тем меньше (56 → 30 px на 1920). */
export const ballRadius = (f: number): number => (56 + (30 - 56) * f) / Z / 2;
/** Мяч в сетке (итог): центр и радиус. */
export const NET = { x: 508, y: 192, r: 30 / Z / 2 };
/** Знак рекорда над Сашей: диаметр круга 150 px на 1920, центр. */
export const SIGN = { d: 150 / Z, x: 246, y: 152 };
