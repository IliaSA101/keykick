/**
 * Геометрия экранной клавиатуры и рук: чистые функции без DOM, поэтому проверяются тестом.
 *
 * Единицы: шаг обычной клавиши = 1 (ширина клавиши плюс зазор). Клавиша шириной width
 * занимает width − KEY_GAP, зазор остаётся справа и снизу; рамка всей клавиатуры — без
 * внешнего зазора. Ряды выравниваются по правому краю, как на ANSI; ряд с пробелом —
 * по центру между засечками (А и О): туда сами собой ложатся большие пальцы.
 */
import type { Finger, KeyDef, Keymap } from './keymap';

export interface KeyBox {
  key: KeyDef;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface KeyboardGeometry {
  keys: KeyBox[];
  width: number;
  height: number;
}

/** Зазор между клавишами, в долях шага. */
export const KEY_GAP = 0.12;

/**
 * Поле вокруг клавиатуры в рисунке: туда помещается обводка нужной клавиши.
 * Руки рисуются с тем же полем, чтобы при одной ширине пальцы стояли над своими клавишами.
 */
export const VIEW_PAD = 0.15;

const rowWidth = (row: readonly KeyDef[]) => row.reduce((sum, k) => sum + k.width, 0);
const isSpaceRow = (row: readonly KeyDef[]) => row.some((k) => k.finger === 'th');

/** Середина между клавишами с засечками — центр рук; без засечек — середина клавиатуры. */
function handsCenter(rows: readonly (readonly KeyDef[])[], full: number): number {
  const centers: number[] = [];
  for (const row of rows) {
    let x = full - rowWidth(row);
    for (const key of row) {
      if (key.bump) centers.push(x + key.width / 2);
      x += key.width;
    }
  }
  if (centers.length < 2) return full / 2;
  return (Math.min(...centers) + Math.max(...centers)) / 2;
}

export function layoutKeys(map: Keymap): KeyboardGeometry {
  const full = Math.max(...map.rows.map(rowWidth));
  const center = handsCenter(map.rows.filter((r) => !isSpaceRow(r)), full);
  const keys: KeyBox[] = [];

  map.rows.forEach((row, y) => {
    const width = rowWidth(row);
    let x = isSpaceRow(row) ? center - width / 2 : full - width;
    for (const key of row) {
      keys.push({ key, x, y, w: key.width - KEY_GAP, h: 1 - KEY_GAP });
      x += key.width;
    }
  });

  return { keys, width: full - KEY_GAP, height: map.rows.length - KEY_GAP };
}

/**
 * Где над клавиатурой стоит кончик каждого пальца (x — середина его клавиши в основной позиции).
 * Основная позиция: левый указательный — на клавише с засечкой и три клавиши левее,
 * правый — на засечке и три правее; большие — по краям середины пробела.
 */
export function fingerHomes(geometry: KeyboardGeometry): Record<Finger, number> {
  const bumps = geometry.keys.filter((b) => b.key.bump).sort((a, b) => a.x - b.x);
  const left = bumps[0];
  const right = bumps[bumps.length - 1];
  if (!left || !right || left === right) throw new Error('keyboard: need two keys with a bump');
  const row = geometry.keys.filter((b) => b.key.row === left.key.row).sort((a, b) => a.x - b.x);
  const at = (box: KeyBox, shift: number): number => {
    const found = row[row.indexOf(box) + shift];
    if (!found) throw new Error('keyboard: home row is too short');
    return found.x + found.w / 2;
  };
  const space = geometry.keys.find((b) => b.key.finger === 'th');
  const mid = space ? space.x + space.w / 2 : (at(left, 0) + at(right, 0)) / 2;
  return {
    lp: at(left, -3),
    lr: at(left, -2),
    lm: at(left, -1),
    li: at(left, 0),
    ri: at(right, 0),
    rm: at(right, 1),
    rr: at(right, 2),
    rp: at(right, 3),
    th: mid,
  };
}

/** Точка на картинке, в пикселях картинки. */
export interface ImagePoint {
  x: number;
  y: number;
}

/** Пальцы, по которым картинка рук ложится на клавиатуру. */
export type FitFinger = 'lm' | 'li' | 'ri' | 'rm';

/** Левый верхний угол картинки рук для одной руки, в единицах клавиатуры. */
export interface HandOffset {
  x: number;
  y: number;
}

/**
 * Как положить картинку рук на клавиатуру: единый масштаб — сколько единиц в пикселе картинки
 * (по обеим осям) — и свой сдвиг у каждой руки: руки нарисованы не зеркально, шаг кончиков
 * у них разный.
 */
export interface HandsFit {
  scale: number;
  left: HandOffset;
  right: HandOffset;
}

/** Все ногти руки: четыре нужных для масштаба обязательны, остальные добавляют высоту. */
export type HandTips = Record<FitFinger, ImagePoint> &
  Partial<Record<'lp' | 'lr' | 'rr' | 'rp', ImagePoint>>;

/**
 * Масштаб и сдвиги картинки рук без искажения. Масштаб общий: наименьшие квадраты по x для
 * четырёх кончиков (указательные и средние), каждый — относительно середины своей руки.
 * Сдвиг каждой руки свой: середина её двух кончиков — над серединой их клавиш основного ряда
 * по x, а средняя высота всех её ногтей (4 у руки, если даны все 8) — на середине основного ряда:
 * ногти лежат на ФЫВА и ОЛДЖ, а не на верхнем ряду.
 */
export function fitHands(geometry: KeyboardGeometry, tips: HandTips): HandsFit {
  const homes = fingerHomes(geometry);
  const bump = geometry.keys.find((b) => b.key.bump);
  if (!bump) throw new Error('keyboard: need two keys with a bump');
  const homeY = bump.y + bump.h / 2;
  const left: FitFinger[] = ['lm', 'li'];
  const right: FitFinger[] = ['ri', 'rm'];
  const mean = (fs: FitFinger[], get: (f: FitFinger) => number): number =>
    fs.reduce((sum, f) => sum + get(f), 0) / fs.length;
  let cov = 0;
  let varX = 0;
  for (const fs of [left, right]) {
    const mx = mean(fs, (f) => tips[f].x);
    const mk = mean(fs, (f) => homes[f]);
    for (const f of fs) {
      cov += (tips[f].x - mx) * (homes[f] - mk);
      varX += (tips[f].x - mx) ** 2;
    }
  }
  if (varX === 0) throw new Error('hands: fingertips must differ in x');
  const scale = cov / varX;
  const offset = (fs: FitFinger[], all: ImagePoint[]): HandOffset => ({
    x: mean(fs, (f) => homes[f]) - scale * mean(fs, (f) => tips[f].x),
    y: homeY - (scale * all.reduce((sum, p) => sum + p.y, 0)) / all.length,
  });
  const own = (...names: (keyof HandTips)[]): ImagePoint[] =>
    names.flatMap((n) => tips[n] ?? []);
  return {
    scale,
    left: offset(left, own('lp', 'lr', 'lm', 'li')),
    right: offset(right, own('ri', 'rm', 'rr', 'rp')),
  };
}
