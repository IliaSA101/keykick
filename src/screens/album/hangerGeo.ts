/**
 * Геометрия вешалки в шкафчике Раздевалки (067 Т13 ш6): числа макета `tools/mock-collection/e2k-kit.mjs` (HG, BAR, WAIST, TONES, градиенты).
 * Система координат — своя: ширина 160, ось шкафчика x = 80, y — от верха плечиков (в кадре блок стоит на cx − 80, 216). Чистые данные и числа — без Vue.
 */

/** Размеры вещей на вешалке (px блока): футболка, штанга, шорты, гетры, бутсы. */
export const HG = { w: 92, shirtH: 130, shirtTop: 28, rodY: 186, rodH: 7, shortsH: 72, shortsL: 11, socksH: 82, socksL: 82, bootsH: 36 } as const;
/** Планка вешалки шорт: верх, толщина, просвет до пояса; зажимы — на 0,26 и 0,74 ширины пояса. */
export const BAR = { y: 206.5, h: 5.5, drop: 3 } as const;
export const WAIST = [0.26, 0.74] as const;
export const ROD_TOP = 6;
/** Вешалка с футболкой ниже верхней штанги на 6 px (шейка и крючок). */
export const SHIFT = 6;
/** Плечики — только шейка над воротом: картинка 648×376 обрезана по `inset(27% 36% 52% 36%)`. */
export const HANGER = { l: 80 - HG.w / 2, t: 2 + SHIFT, w: HG.w, h: Math.round((HG.w * 376) / 648), clip: 'inset(27% 36% 52% 36%)' } as const;

/** Спрайты (рамки предметов в px: 581×611, 602×605, 465×611): ширина по высоте вещи. */
export const SHIRT = { w: Math.round(HG.shirtH * (581 / 611)), h: HG.shirtH, t: HG.shirtTop } as const;
export const SHORTS = { w: Math.round(HG.shortsH * (602 / 605)), h: HG.shortsH, l: HG.shortsL, t: BAR.y + BAR.h + BAR.drop } as const;
export const SOCKS = { w: Math.round(HG.socksH * (465 / 611)), h: HG.socksH, l: HG.socksL, t: HG.rodY - 3 } as const;
export const BOOTS = { w: Math.round((HG.bootsH * 627) / 386), h: HG.bootsH } as const;
export const SHIRT_L = 80 - SHIRT.w / 2;

export interface Stop {
  o: number;
  c: string;
  a?: number;
}
export interface Grad {
  id: string;
  /** Координаты — в px блока (`user`), иначе в долях. */
  box: [number, number, number, number];
  user: boolean;
  stops: Stop[];
}
const grad = (id: string, box: [number, number, number, number], stops: Stop[], user = false): Grad => ({ id, box, stops, user });
/** Градиенты штанг, планки и зажимов (дерево шкафа — беж и коричневое, зажимы — серая сталь; жёлтого и золота нет: ТАБУ). */
export const GRADS: Grad[] = [
  grad('hgr-cyl', [0, 0, 0, 1], [{ o: 0, c: '#6e3a1c' }, { o: 0.12, c: '#b47640' }, { o: 0.3, c: '#d9a06a' }, { o: 0.45, c: '#a8673a' }, { o: 0.72, c: '#6a3519' }, { o: 0.86, c: '#4a2312' }, { o: 1, c: '#6a3a22' }]),
  grad('hgr-spec', [0, 0, 1, 0], [{ o: 0, c: '#f3d6b4', a: 0.25 }, { o: 0.7, c: '#f3d6b4', a: 0.8 }, { o: 1, c: '#f3d6b4', a: 0.6 }]),
  grad('hgr-ao', [0, 0, 1, 0], [{ o: 0, c: '#2a1006', a: 0.55 }, { o: 1, c: '#2a1006', a: 0 }]),
  grad('hgr-aor', [0, 0, 1, 0], [{ o: 0, c: '#2a1006', a: 0 }, { o: 1, c: '#2a1006', a: 0.55 }]),
  grad('hgr-hw', [74, 3, 86, 27], [{ o: 0, c: '#d4ccc5' }, { o: 1, c: '#8b817b' }], true),
  grad('hgr-hw2', [41, 183, 53, 207], [{ o: 0, c: '#d4ccc5' }, { o: 1, c: '#8b817b' }], true),
  grad('hgr-st', [0, 0, 0, 1], [{ o: 0, c: '#b97a48' }, { o: 0.2, c: '#e2bb94' }, { o: 0.42, c: '#d19a62' }, { o: 0.7, c: '#b16a40' }, { o: 0.92, c: '#7f381e' }, { o: 1, c: '#5a2a17' }]),
  grad('hgr-stx', [0, 0, 1, 0], [{ o: 0, c: '#2a1006', a: 0.35 }, { o: 0.25, c: '#2a1006', a: 0 }, { o: 0.8, c: '#f3d6b4', a: 0 }, { o: 0.95, c: '#f3d6b4', a: 0.35 }, { o: 1, c: '#f3d6b4', a: 0.1 }]),
  grad('hgr-cl', [0, 0, 1, 0], [{ o: 0, c: '#2c353c' }, { o: 0.55, c: '#5c6770' }, { o: 0.85, c: '#8d99a2' }, { o: 1, c: '#3a444b' }]),
];

export const ROD_INK = '#4a2312';

/** Штанга: тень на стенку, розетка на левой боковине, цилиндр с бликом и затемнением у розетки; `x1` — внутренняя кромка правой стойки. */
export function rodOf(y: number, x1: number, x0 = -4, h: number = HG.rodH) {
  return {
    x0,
    x1,
    y,
    h,
    c: y + h / 2,
    shadow: `${x0},${y + h - 1} ${x0 + 30},${y + h + 3} ${x1},${y + h + 3} ${x1},${y + h + 9} ${x0 + 30},${y + h + 9} ${x0},${y + h + 3}`,
    lines: [
      [y + 0.3, 0.7],
      [y + h - 0.3, 0.9],
    ] as [number, number][],
  };
}

/** Крючок плечиков (проволока одной кривой): центр изгиба на оси штанги, радиус по оси проволоки; кончик слева прячет маска по полосе штанги. */
export function hookOf(rodTop: number, neck: number, cx = 80) {
  const cy = rodTop + HG.rodH / 2;
  const r = 4.9;
  return { cx, rodTop, d: `M${cx} ${neck}V${cy + 8}C${cx} ${cy + 5.5} ${cx + r} ${cy + 4} ${cx + r} ${cy}A${r} ${r} 0 0 0 ${cx - r} ${cy}V${cy + 1.5}` };
}

/** Вешалка шорт: планка по ширине пояса + 7 px и два зажима на 0,26 и 0,74 пояса. */
export function barOf() {
  const cx = SHORTS.l + SHORTS.w / 2;
  const half = (SHORTS.w * 0.72) / 2 + 3.5;
  const r1 = (n: number): number => Math.round(n * 10) / 10;
  const { y, h } = BAR;
  return { cx, x0: r1(cx - half), w: r1(half * 2), y, h, clamps: WAIST.map((u) => r1(SHORTS.l + SHORTS.w * u)) };
}

/** Проход света по спрайту: SVG-фильтр с градиентом (свет справа сверху, низ темнее ≈ 20 %) умножается на картинку, альфа остаётся от спрайта. */
const BASE = '<rect width="1" height="1" fill="url(#b)"/>';
const TONE_DEFS =
  '<defs><linearGradient id="b" x1=".64" y1="0" x2=".36" y2="1"><stop offset="0" stop-color="#fffdfa"/><stop offset=".55" stop-color="#f5f2ee"/><stop offset="1" stop-color="#cdc9c5"/></linearGradient>' +
  '<radialGradient id="n"><stop offset="0" stop-color="#000" stop-opacity=".2"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="f"><stop offset=".2" stop-color="#000" stop-opacity="0"/><stop offset=".27" stop-color="#000" stop-opacity=".11"/><stop offset=".34" stop-color="#000" stop-opacity="0"/><stop offset=".66" stop-color="#000" stop-opacity="0"/><stop offset=".73" stop-color="#000" stop-opacity=".11"/><stop offset=".8" stop-color="#000" stop-opacity="0"/></linearGradient></defs>';
const TONES: Record<'base' | 'shirt' | 'shorts', string> = {
  base: BASE,
  shirt: `${BASE}<ellipse cx=".5" cy=".04" rx=".4" ry=".12" fill="url(#n)"/><rect width="1" height="1" fill="url(#f)"/>`,
  shorts: `${BASE}<ellipse cx=".5" cy="0" rx=".3" ry=".1" fill="url(#n)"/>`,
};
export const TONE_FILTERS = Object.entries<string>(TONES).map(([id, g]) => ({
  id: `hgt-${id}`,
  uri: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none">${TONE_DEFS}${g}</svg>`)}`,
}));
