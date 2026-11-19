/**
 * Координаты картинки Двора на Карте и на Пути клуба (065 Т8, 067 Т10): доли кадра из `content/map-yard.json` → px сцены.
 * Картинка 1920×1072 лежит «cover» по высоте 640 и по центру ширины сцены (как у Дома, `./geometry`). Одно место для слоя
 * `YardGround` и обоих экранов — экран не берёт числа у соседнего экрана. Чистые функции.
 */
import cfg from '../../content/map-yard.json';

export const H = 640;
/** Ширина картинки в сцене, px. */
export const IW: number = cfg.frame.w;
export type Pt = [number, number];

/** Сдвиг картинки по ширине сцены `W`. */
export const offOf = (W: number): number => (W - IW) / 2;
export const pointOf = (W: number, [fx, fy]: readonly number[]): Pt => [offOf(W) + fx! * IW, fy! * H];

/** Основание ворот Района на сцене `W`. */
export const gateOf = (W: number): Pt => pointOf(W, cfg.gateAt);
/** Левый край плашки ворот: правее ворот на 20 px, но не левее ярлыка Двора (16 px отступ + 110 ширина). */
export const gateX = (W: number): number => Math.max(gateOf(W)[0] + 20, 16 + 110);
