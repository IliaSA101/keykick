/**
 * Поле Мини-футбола (кадры Э4.21–25, 42, 43; макет `tools/mock-games/e4-field.mjs`): слои картинки по ступени «Коробки» (067-Р174, 036-Р42–Р45) и места фишек.
 * Координаты — пиксели картинки 1920×1072; окно `VIEW` — весь стадион без пустых краёв. Ничего не считает по правилам игры.
 */
import type { ArtKey } from '../../art/assets';

export const IW = 1920;
export const IH = 1072;
export const VIEW = '140 52 1640 976';

/** Вещи кольца: ключ вырезки, положение в картинке (x, y, w, h — `ring.json` макета) и с какой ступени «Коробки» она стоит (номер ступени по порядку Двора). */
export const RING: readonly { art: ArtKey; at: readonly [number, number, number, number]; step: number }[] = [
  { art: 'baseRingBenches', at: [321, 905, 504, 147], step: 3 },
  { art: 'baseRingFence', at: [278, 16, 1360, 978], step: 4 },
  { art: 'baseRingStands', at: [510, 50, 898, 176], step: 5 },
  { art: 'baseRingBoard', at: [1542, 398, 150, 276], step: 6 },
  { art: 'baseRingLights', at: [268, 18, 1386, 204], step: 7 },
  { art: 'baseRingFlags', at: [190, 828, 1542, 214], step: 8 },
  { art: 'baseRingStand', at: [1096, 901, 430, 171], step: 9 },
];

/** Основа газона по ступеням (036-Р44): пустырь до разметки, вытоптан до сетки, подлатан до трибуны, дальше ровный. */
export const turfOf = (built: number): ArtKey => (built < 2 ? 'baseFieldBare' : built < 4 ? 'baseFieldWorn' : built < 5 ? 'baseFieldPatch' : 'baseFieldGoals');

/** Серые полосы под золотыми воротами: синеватый асфальт не должен касаться золота (ТАБУ, 036-Р57). */
export const KERBS: readonly (readonly [number, number])[] = [[364, 402], [1518, 1556]];

/** Координаты макета П4 (840×500, линии 40…800 × 40…460) → пиксели картинки поля. */
export const at = ([x, y]: readonly [number, number]): { x: number; y: number } => ({ x: Math.round(433 + ((x - 40) / 760) * 1054), y: Math.round(232 + ((y - 40) / 420) * 630) });

type XY = readonly [number, number];
/** Расстановка n×n: наши по порядку состава (последний — нападающий, у ворот справа), соперники правее центра. */
export const SPOTS: Record<number, { our: readonly XY[]; rv: readonly XY[] }> = {
  2: { our: [[330, 250], [540, 160]], rv: [[450, 330], [640, 270]] },
  3: { our: [[300, 250], [470, 150], [470, 350]], rv: [[420, 250], [600, 170], [600, 340]] },
  4: { our: [[250, 250], [420, 140], [420, 360], [740, 250]], rv: [[360, 250], [520, 190], [520, 330], [680, 330]] },
};
/** Фишка П4 (радиус 25) → радиус 35 в пикселях картинки. */
export const PIECE_SCALE = 1.4;
/** Зона удара: у ворот справа. */
export const ZONE = { x: 1302, y: 362, w: 185, h: 348 };
/** Мяч — рядом с фишкой, у которой он. */
export const ballAt = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x + 48, y: p.y + 28 });
