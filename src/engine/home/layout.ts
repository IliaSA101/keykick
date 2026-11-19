/**
 * Поле ярлыка места у края сцены (Р42 п.2; 068 Т9-5): ярлык не выходит за окно на любой ширине. Тот же расчёт, что `placeX`
 * в `tools/mock-map/home-parts.mjs`; чистые функции — ширина сцены приходит снаружи.
 */

/** Поле у края сцены, px. */
export const EDGE = 16;

export interface TagSize {
  name: string;
  /** Нажимаемый ярлык: после имени «›» (15 px). */
  go?: boolean;
  rows?: readonly string[];
}

/** Полуширина ярлыка по тексту: имя 15 px жирным ≈ 9 px на знак, подписи 12 px ≈ 6,4 px на знак, поля 12 px (замер Chrome). */
export function placeHalf({ name, go = false, rows = [] }: TagSize): number {
  const nameW = name.length * 9 + (go ? 15 : 0);
  const subW = Math.max(0, ...rows.map((r) => r.length * 6.4));
  return Math.max(nameW, subW) / 2 + 12;
}

/** x центра ярлыка, прижатый внутрь сцены шириной `width`: от любого края — не ближе `EDGE`. */
export function placeX(x: number, width: number, tag: TagSize): number {
  const half = placeHalf(tag);
  return Math.min(Math.max(x, EDGE + half), width - EDGE - half);
}

/** Высота сцены, px (картинка «cover» по высоте — `components/home/geometry.ts`). */
export const STAGE_H = 640;
/** Главная карточка Дома (`HomeCards`): ширина у широкой и узкой сцены, отступ снизу. */
export const mainWidth = (narrow: boolean): number => (narrow ? 340 : 400);
export const MAIN_BOTTOM = 8;
/** Высота «высокой» главной карточки — «На карту» при 96/96: две строки ленты и подпись в две строки (замер Chrome, Э2.83, 068-Р98). */
export const MAIN_TALL_H = 155;
/** Высота кнопки ярлыка (без метки над ней) и зазор до карточки под ним, px сцены. */
export const TAG_H = 27;
export const TAG_GAP = 6;

/**
 * Верх ярлыка стенда (068-Р98): ярлык не наезжает на главную карточку. Карточка высокая только при 96/96 (`mainKind === 'done'`),
 * там ярлык, если он над карточкой по ширине, поднимается выше её верха; остальные состояния и ярлык в стороне — как есть.
 * `x` — центр ярлыка (после `placeX`), `y` — верх по макету; всё в px сцены шириной `width`.
 */
export function standTop(y: number, x: number, width: number, narrow: boolean, mainKind: string, tag: TagSize): number {
  if (mainKind !== 'done') return y;
  const half = placeHalf(tag);
  const cardHalf = mainWidth(narrow) / 2;
  if (x + half <= width / 2 - cardHalf || x - half >= width / 2 + cardHalf) return y;
  return Math.min(y, STAGE_H - MAIN_BOTTOM - MAIN_TALL_H - TAG_GAP - TAG_H);
}
