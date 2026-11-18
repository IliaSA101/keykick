/**
 * Сцена-масштаб оболочки (006 по смыслу, 063 К7): вёрстка — в «базовых» px сцены 1024×640, окно любого размера
 * получает множитель `s = min(w/1024, h/640)`. Сцена шире окна по базовым px: ширина `w/s`, высота `h/s`, `zoom: s`.
 * На 1920×1080 — s = 1,6875, ширина 1137,78 (как в макетах ЭБ); на 1024×640 — единица.
 */
export const BASE_W = 1024;
export const BASE_H = 640;

export interface StageBox {
  scale: number;
  /** Ширина сцены в базовых px. */
  width: number;
  /** Высота сцены в базовых px. */
  height: number;
}

export function stageScale(w: number, h: number): StageBox {
  if (!(w > 0) || !(h > 0)) return { scale: 1, width: BASE_W, height: BASE_H };
  const scale = Math.min(w / BASE_W, h / BASE_H);
  return { scale, width: w / scale, height: h / scale };
}

/** Сцена уже этой ширины (базовых px) — «узкая»: кадры макета для 1024 отличаются от кадров для 1920 (ширина сцены 1138). */
export const NARROW_BELOW = 1100;

export const isNarrowStage = (width: number): boolean => width < NARROW_BELOW;
