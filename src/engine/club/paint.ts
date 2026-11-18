/**
 * Перекраска формы клуба (спека 063 Т6а, К10): чистые функции без DOM — поэтому проверяются тестом.
 * Основа — два слоя одной картинки (`tools/kit_layers.py`, `public/art/kit`):
 *   zones — R = корпус, G = рукава, B = окантовка (доли 0…255);
 *   shade — R = затемнение, G = блик, B = непрозрачность.
 * Цвет пикселя: base = цвет зоны · затемнение; итог = base + (1 − base) · блик. Узор считается в долях рамки корпуса.
 * Возвращено из снесённого движка форм v2 (060 Т0) только в части футболки спереди и сзади: шорты, гетры, бутсы — волна Коллекции.
 */
import type { ClubKit } from './section';

/** Пиксели слоёв в формате ImageData: 4 байта на пиксель, альфа слоя не используется. */
export interface KitLayers {
  width: number;
  height: number;
  zones: Uint8ClampedArray;
  shade: Uint8ClampedArray;
}

/** Рамка корпуса: узор считается в её долях (u — вправо, v — вниз). `mirror` — вид сзади: левая половина узора оказывается справа. */
export interface BodyBox {
  x0: number;
  y0: number;
  sx: number;
  sy: number;
  mirror?: boolean;
}

export type Rgb = readonly [number, number, number];

/** Сила блика: при 1 светлые места любой формы становились бы чисто белыми. */
export const GLOSS = 0.85;
const HEX = /^#[0-9a-f]{6}$/i;
/** Цвет пикселя без зон: почти чёрный (подошва и мелочи), с затемнением и бликом как у зон. */
export const NO_ZONE = '#1a1a1a';

export function hexToRgb(hex: string): Rgb {
  if (!HEX.test(hex)) throw new Error(`bad color: ${hex}`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Рамка пикселей слоя, где канал `channel` (0…3) больше `min`; таких нет — null. Общий обход для рамки корпуса
 * (зона R > 128) и рамки предмета (непрозрачность B > 0).
 */
export function channelBounds(data: Uint8ClampedArray, w: number, h: number, channel: number, min: number): { x0: number; x1: number; y0: number; y1: number } | null {
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((data[(y * w + x) * 4 + channel] ?? 0) > min) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  return x1 < 0 ? null : { x0, x1, y0, y1 };
}

/**
 * Цвет одного пикселя `i` (индекс в байтах): три зоны слоя `zones` смешиваются по весам R, G, B в цвета `colors`,
 * затем затемнение и блик слоя `shade`; в `out` пишутся RGB и непрозрачность. Нет зон — `none` (почти чёрный).
 * Пиксель с нулевой непрозрачностью вызывающий пропускает сам.
 */
export function shadePixel(out: Uint8ClampedArray, i: number, zones: Uint8ClampedArray, shade: Uint8ClampedArray, colors: readonly [Rgb, Rgb, Rgb], none: Rgb): void {
  const wr = (zones[i] ?? 0) / 255;
  const wg = (zones[i + 1] ?? 0) / 255;
  const wb = (zones[i + 2] ?? 0) / 255;
  const sum = wr + wg + wb;
  const dark = (shade[i] ?? 0) / 255;
  const gloss = ((shade[i + 1] ?? 0) / 255) * GLOSS;
  for (let c = 0; c < 3; c++) {
    const mix = sum === 0 ? (none[c] ?? 0) : ((colors[0][c] ?? 0) * wr + (colors[1][c] ?? 0) * wg + (colors[2][c] ?? 0) * wb) / sum;
    const base = mix * dark;
    out[i + c] = Math.round(255 * (base + (1 - base) * gloss));
  }
  out[i + 3] = shade[i + 2] ?? 0;
}

/** Попадает ли точка корпуса (u, v) во второй цвет узора; незнакомый узор — однотонный. */
export function patternAt(pattern: string, u: number, v: number): boolean {
  switch (pattern) {
    case 'stripes':
      return Math.floor(u * 7) % 2 === 1;
    case 'hoops':
      return Math.floor(v * 6.5) % 2 === 1;
    case 'halves':
      return u >= 0.5;
    case 'sash':
      return Math.abs(u - 0.95 * v - 0.02) < 0.11;
    case 'checks':
      return (Math.floor(u * 6) + Math.floor(v * 7)) % 2 === 1;
    default:
      return false;
  }
}

/** Рамка корпуса по зоне R слоя; корпуса нет — ошибка (основа повреждена). */
export function bodyBox(layers: KitLayers, mirror = false): BodyBox {
  const bounds = channelBounds(layers.zones, layers.width, layers.height, 0, 128);
  if (!bounds) throw new Error('kit layers have no body');
  const { x0, x1, y0, y1 } = bounds;
  const box = { x0, y0, sx: 1 / (x1 - x0 + 1), sy: 1 / (y1 - y0 + 1) };
  return mirror ? { ...box, mirror } : box;
}

// Доля узора в пикселе — по четырём точкам, чтобы края полос не шли лесенкой.
const SAMPLES = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
] as const;

/** Готовая форма в формате ImageData (RGBA): корпус, рукава (`split` — в цвет своей половины), окантовка и узор. */
export function paintKit(layers: KitLayers, kit: ClubKit, box: BodyBox = bodyBox(layers)): Uint8ClampedArray<ArrayBuffer> {
  const { width: w, height: h, zones: z, shade: s } = layers;
  const out = new Uint8ClampedArray(w * h * 4);
  const split = kit.sleeves === 'split';
  const body = hexToRgb(kit.body);
  const sleeves = split ? body : hexToRgb(kit.sleeves);
  const trim = hexToRgb(kit.trim);
  const alt = hexToRgb(kit.alt ?? kit.body);
  const none = hexToRgb(NO_ZONE);
  const tone: [number, number, number] = [0, 0, 0];
  const striped = kit.pattern !== 'plain' && kit.alt !== undefined;
  const across = (x: number): number => {
    const u = (x - box.x0) * box.sx;
    return box.mirror === true ? 1 - u : u;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const opacity = s[i + 2] ?? 0;
      if (opacity === 0) continue;

      let k = 0;
      if (striped) {
        for (const [dx, dy] of SAMPLES) {
          if (patternAt(kit.pattern, across(x + dx), (y + dy - box.y0) * box.sy)) k += 0.25;
        }
      }
      const second = split ? (across(x + 0.5) < 0.5 ? body : alt) : sleeves;
      for (let c = 0; c < 3; c++) tone[c] = (body[c] ?? 0) + ((alt[c] ?? 0) - (body[c] ?? 0)) * k;
      shadePixel(out, i, z, s, [tone, second, trim], none);
    }
  }
  return out;
}

/** Яркость цвета по-простому (0…1). */
function lightness(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Цвет имени и номера на спине: по светлой форме — тёмный с белой обводкой, по тёмной — наоборот.
 * У узора берётся среднее двух цветов: обводка держит надпись на обоих.
 */
export function shirtInk(kit: ClubKit): { fill: string; outline: string } {
  const l = kit.pattern === 'plain' ? lightness(kit.body) : (lightness(kit.body) + lightness(kit.alt ?? kit.body)) / 2;
  return l > 0.55 ? { fill: '#16161a', outline: '#ffffff' } : { fill: '#ffffff', outline: '#16161a' };
}

/** Оттенок цвета 0…360; у серого, белого и почти чёрного оттенка нет — null. */
function hue(hex: string): number | null {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const c = max - Math.min(r, g, b);
  if (c < 0.25 || max < 0.35) return null;
  const h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return (h * 60 + 360) % 360;
}

/** ТАБУ (В1): жёлтое или золотое рядом с синим на форме — нельзя. Истина, если в форме есть и то, и другое. */
export function yellowWithBlue(kit: ClubKit): boolean {
  const colors = [kit.body, kit.alt, kit.sleeves === 'split' ? undefined : kit.sleeves, kit.trim].filter((c): c is string => c !== undefined);
  const hues = colors.map(hue);
  const yellow = hues.some((h) => h !== null && h >= 38 && h <= 62);
  const blue = hues.some((h) => h !== null && h >= 195 && h <= 260);
  return yellow && blue;
}
