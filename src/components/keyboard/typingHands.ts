/**
 * Руки «как в кадре матча» (065-Р73, кадры Э1.03–Э1.05; макет `tools/mock-mk1/hands-b.mjs`, набор `typing`): две картинки
 * 900×900 с согнутыми пальцами. Каждая рука ложится на клавиатуру подобием (поворот + масштаб + сдвиг) по четырём кончикам
 * сразу — наименьшими квадратами; правая рука на 0,2 клавиши правее (большой палец — на правой половине пробела).
 * Чистые функции без DOM: проверяются тестом. Единицы — шаг клавиши клавиатуры (`layoutKeys`).
 */
import type { Finger, Thumb } from '../../engine/typing/keymap';
import type { NailMark } from './marks';

export type Pt = readonly [number, number];
/** Подобие: x' = c·x − s·y + tx, y' = s·x + c·y + ty (это же `matrix(c s −s c tx ty)` в SVG). */
export interface Similarity {
  c: number;
  s: number;
  tx: number;
  ty: number;
}

/** Сторона картинки, пиксели. */
export const TYPING_SIZE = 900;
/** Верхние точки пальцев на картинке, от мизинца к указательному (поиск минимумов контура, макет 08.11). */
export const TYPING_TIPS: Record<Thumb, readonly Pt[]> = {
  left: [[203, 41], [398, 1], [519, 15], [738, 75]],
  right: [[690, 41], [496, 1], [367, 15], [147, 75]],
};
/** Ногти больших пальцев на картинке. */
const THUMBS: Record<Thumb, Pt> = { left: [855, 480], right: [45, 485] };
/** Ноготь — ниже верхней точки пальца, пиксели картинки. */
const NAIL_DROP = 45;
/** Правая рука правее на 0,2 клавиши (владелец 08.11). */
export const SHIFT_RIGHT = 0.2;
/** Верхние точки пальцев — на 0,2 ниже верха клавиши основного ряда. */
export const TOP_DROP = 0.2;

/**
 * Рамка клавиши в `typing` шире на 0,04 с каждой стороны (зазор 0,08, а не 0,12): её середина — на 0,06 правее середины
 * клавиши движка. Руки в кадре стоят по середине рамки: `fingerHomes` движка сдвигаем на столько же (065-Р150).
 */
export const FRAME_CENTER_SHIFT = 0.06;
export const frameHomes = (homes: Record<Finger, number>): Record<Finger, number> =>
  Object.fromEntries(Object.entries(homes).map(([f, x]) => [f, x + FRAME_CENTER_SHIFT])) as Record<Finger, number>;

const SIDE_FINGERS: Record<Thumb, readonly Exclude<Finger, 'th'>[]> = {
  left: ['lp', 'lr', 'lm', 'li'],
  right: ['rp', 'rr', 'rm', 'ri'],
};

/** Подобие по методу наименьших квадратов: точки `src` → точки `dst`. */
export function fitLsq(src: readonly Pt[], dst: readonly Pt[]): Similarity {
  const n = src.length;
  const mean = (pts: readonly Pt[], k: 0 | 1): number => pts.reduce((sum, p) => sum + p[k], 0) / n;
  const [sx, sy, dx, dy] = [mean(src, 0), mean(src, 1), mean(dst, 0), mean(dst, 1)];
  let a = 0;
  let b = 0;
  let ss = 0;
  src.forEach(([x, y], i) => {
    const [u, v] = [x - sx, y - sy];
    const [p, q] = [dst[i]![0] - dx, dst[i]![1] - dy];
    a += u * p + v * q;
    b += u * q - v * p;
    ss += u * u + v * v;
  });
  const c = a / ss;
  const s = b / ss;
  return { c, s, tx: dx - (c * sx - s * sy), ty: dy - (s * sx + c * sy) };
}

export const applySim = (m: Similarity, p: Pt): { x: number; y: number } => ({ x: m.tx + m.c * p[0] - m.s * p[1], y: m.ty + m.s * p[0] + m.c * p[1] });
export const matrixOf = (m: Similarity): string => `matrix(${m.c.toFixed(6)} ${m.s.toFixed(6)} ${(-m.s).toFixed(6)} ${m.c.toFixed(6)} ${m.tx.toFixed(4)} ${m.ty.toFixed(4)})`;

export type TypingFit = Record<Thumb, Similarity>;

/** Подгонка обеих рук: `homes` — середины клавиш основного ряда по пальцам (`fingerHomes`), `rowTop` — верх основного ряда. */
export function typingFit(homes: Record<Finger, number>, rowTop: number): TypingFit {
  const dst = (side: Thumb): Pt[] => SIDE_FINGERS[side].map((f) => [homes[f] + (side === 'right' ? SHIFT_RIGHT : 0), rowTop + TOP_DROP] as const);
  return { left: fitLsq(TYPING_TIPS.left, dst('left')), right: fitLsq(TYPING_TIPS.right, dst('right')) };
}

/** Где ставить метку: ноготь пальца цели или большой палец (пробел). */
export function typingNail(fit: TypingFit, mark: NailMark): { x: number; y: number } {
  if (mark.finger === 'th') return applySim(fit[mark.thumb], THUMBS[mark.thumb]);
  const side: Thumb = mark.finger.startsWith('l') ? 'left' : 'right';
  const tip = TYPING_TIPS[side][SIDE_FINGERS[side].indexOf(mark.finger)]!;
  return applySim(fit[side], [tip[0], tip[1] + NAIL_DROP]);
}
