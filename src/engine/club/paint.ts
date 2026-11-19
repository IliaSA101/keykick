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

/**
 * Что добавляют веха и призовая поверх расцветки (067 Т13 ш6, Р158): `kant` — кант в цвет вехи (`kantTrim`), `sheen` — косой блик
 * по корпусу (форма «Звёздная I»), `stars` — звёзды вехи над именем на спине (одна или две, «Звёздная II»); у вида спереди звёзд нет.
 */
export interface KitDeco {
  kant?: boolean;
  sheen?: boolean;
  stars?: 1 | 2;
}

/** Готовая форма в формате ImageData (RGBA): корпус, рукава (`split` — в цвет своей половины), окантовка, узор и отделка призовой (`decorate`). */
export function paintKit(layers: KitLayers, kit: ClubKit, box: BodyBox = bodyBox(layers), deco: KitDeco = {}): Uint8ClampedArray<ArrayBuffer> {
  const { width: w, height: h, zones: z, shade: s } = layers;
  const out = new Uint8ClampedArray(w * h * 4);
  const split = kit.sleeves === 'split';
  const body = hexToRgb(kit.body);
  const sleeves = split ? body : hexToRgb(kit.sleeves);
  const trim = hexToRgb(deco.kant === true ? kantTrim(kit) : kit.trim);
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
  decorate(out, layers, kit, box, deco);
  return out;
}

// ---------- отделка призовых и вех (Э2К.16, 18, 19; код макета tools/mock-collection/kits.mjs) ----------

/** Узоры, которых нет в `patternAt`: рисуются поверх ткани `decorate`. */
export const OVERLAY_PATTERNS = ['stars', 'champ', 'chevron'] as const;
/** Цвета шеврона «Бирюзовый»: белая «V» и тонкий кант (050-Р48). */
export const CHEVRON = { fill: '#f4f6f6', kant: '#0d3b4f' } as const;
/** Кант вехи: золото; у красного, синего, бирюзового и фиолетового — белый (ТАБУ, 049-Р10). */
export const KANT_GOLD = '#eab92f';
export const KANT_WHITE = '#ffffff';

/** Красный или бордо (340…12°) в форме — со звездой ТАБУ (ассоциации): звёзды вехи на такой форме не рисуются, кант — белый. */
export function hasRed(kit: ClubKit): boolean {
  return [kit.body, kit.alt, kit.sleeves === 'split' ? undefined : kit.sleeves, kit.trim].some((c) => {
    const h = c === undefined ? null : hue(c);
    return h !== null && (h >= 340 || h <= 12);
  });
}

/** Тон вех по расцветке: `white` — золото канта коснулось бы синего (`yellowWithBlue`) или в форме есть красный/бордо. */
export function milestoneTone(kit: ClubKit): 'gold' | 'white' {
  return yellowWithBlue({ ...kit, trim: KANT_GOLD }) || hasRed(kit) ? 'white' : 'gold';
}

/** Цвет канта вехи для формы. */
export function kantTrim(kit: ClubKit): string {
  return milestoneTone(kit) === 'gold' ? KANT_GOLD : KANT_WHITE;
}

/** Место звезды на корпусе: центр в долях рамки корпуса и радиус в долях её высоты. */
export interface StarSpot {
  u: number;
  v: number;
  r: number;
}

/** Звёзды узора: «stars» — семь вразброс, «champ» — одна у плеча; прочие узоры звёзд не имеют. */
export function starSpots(pattern: string): StarSpot[] {
  if (pattern === 'stars') {
    return [[0.28, 0.3], [0.66, 0.22], [0.5, 0.48], [0.24, 0.66], [0.74, 0.62], [0.46, 0.84], [0.8, 0.88]].map(([u, v]) => ({ u: u ?? 0, v: v ?? 0, r: 0.065 }));
  }
  return pattern === 'champ' ? [{ u: 0.68, v: 0.24, r: 0.07 }] : [];
}

/** Лежит ли точка (dx, dy) от центра в пятиконечной звезде радиуса r (вершина вверх, внутренний радиус 0,45 r). */
export function inStar(dx: number, dy: number, r: number): boolean {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 1 ? r * 0.45 : r;
    pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
  }
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i] ?? [0, 0];
    const [xj, yj] = pts[j] ?? [0, 0];
    if (yi > dy !== yj > dy && dx < ((xj - xi) * (dy - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Доля пикселя (x, y) внутри фигуры: по тем же четырём точкам, что и узор, края без лесенки. */
function cover(x: number, y: number, inside: (px: number, py: number) => boolean): number {
  let k = 0;
  for (const [dx, dy] of SAMPLES) if (inside(x + dx, y + dy)) k += 0.25;
  return k;
}

/** Доля пикселя (x, y) внутри звезды с центром (cx, cy) и радиусом rad; далёкие пиксели отбрасываются сразу (форма — 400 тыс. пикселей). */
function starCover(x: number, y: number, cx: number, cy: number, rad: number): number {
  if (Math.abs(x - cx) > rad + 1 || Math.abs(y - cy) > rad + 1) return 0;
  return cover(x, y, (px, py) => inStar(px - cx, py - cy, rad));
}

/** Расстояние от точки до отрезка. */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** Доля 0…1 для края радиуса r на расстоянии d: край без лесенки. */
const edge = (d: number, r: number): number => Math.max(0, Math.min(1, r - d + 0.5));

/**
 * Отделка поверх готовой ткани `out` (меняет её на месте): звёзды «stars» и «champ» (цвет `alt` умножается на ткань — складки остаются)
 * и золотая полоса «champ»; шеврон «chevron» — белая «V» с тонким кантом, только спереди; блик `deco.sheen` (у шеврона слабее) — только
 * спереди; звёзды вехи `deco.stars` — только на спине. Пиксели без непрозрачности не трогаем.
 */
export function decorate(out: Uint8ClampedArray, layers: KitLayers, kit: ClubKit, box: BodyBox, deco: KitDeco): void {
  const { width: w, height: h, zones, shade } = layers;
  const bw = 1 / box.sx;
  const bh = 1 / box.sy;
  const front = box.mirror !== true;
  const spots = starSpots(kit.pattern);
  const fill = hexToRgb(kit.alt ?? kit.trim);
  const chevron = front && kit.pattern === 'chevron';
  const plain = { ...kit, pattern: 'plain' };
  const white = chevron ? paintKit(layers, { ...plain, body: CHEVRON.fill }, box) : null;
  const dark = chevron ? paintKit(layers, { ...plain, body: CHEVRON.kant }, box) : null;
  const tip = [box.x0 + bw * 0.5, box.y0 + bh * 0.47] as const;
  const arms = [[box.x0 + bw * 0.1, box.y0], [box.x0 + bw * 0.9, box.y0]] as const;
  const half = bw * 0.1;
  const rim = Math.max(2, bw * 0.022);
  const gain = kit.pattern === 'chevron' ? 0.6 : 1;
  const mark = hexToRgb(milestoneTone(kit) === 'gold' ? KANT_GOLD : KANT_WHITE);
  const marks: StarSpot[] = !front && deco.stars !== undefined && !hasRed(kit) ? (deco.stars === 2 ? [{ u: 0.4, v: 0.07, r: 0.05 }, { u: 0.6, v: 0.07, r: 0.05 }] : [{ u: 0.5, v: 0.07, r: 0.05 }]) : [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if ((out[i + 3] ?? 0) === 0) continue;
      const body = (zones[i] ?? 0) / 255;
      for (const s of spots) {
        const k = starCover(x, y, box.x0 + bw * s.u, box.y0 + bh * s.v, bh * s.r);
        for (let c = 0; c < 3; c++) out[i + c] = Math.round((out[i + c] ?? 0) * (1 - k + k * (fill[c] ?? 0)));
      }
      if (kit.pattern === 'champ' && y >= box.y0 + bh * 0.9 && y < box.y0 + bh * 0.935) {
        for (let c = 0; c < 3; c++) out[i + c] = Math.round((out[i + c] ?? 0) * (fill[c] ?? 0));
      }
      if (white !== null && dark !== null && body > 0) {
        const d = Math.min(segDist(x + 0.5, y + 0.5, arms[0][0], arms[0][1], tip[0], tip[1]), segDist(x + 0.5, y + 0.5, arms[1][0], arms[1][1], tip[0], tip[1]));
        const outer = edge(d, half + rim) * body;
        const inner = edge(d, half) * body;
        if (outer > 0) for (let c = 0; c < 3; c++) out[i + c] = Math.round((out[i + c] ?? 0) * (1 - outer) + (dark[i + c] ?? 0) * (outer - inner) + (white[i + c] ?? 0) * inner);
      }
      if (front && (deco.sheen === true || chevron) && body > 0) {
        const t = ((x - 0.25 * w) * 0.5 * w + y * h) / ((0.5 * w) ** 2 + h * h);
        const a = (t < 0.3 || t > 0.7 ? 0 : t < 0.46 ? ((t - 0.3) / 0.16) * 0.55 : t < 0.5 ? 0.55 + ((t - 0.46) / 0.04) * 0.25 : t < 0.54 ? 0.8 - ((t - 0.5) / 0.04) * 0.25 : 0.55 - ((t - 0.54) / 0.16) * 0.55) * gain * body;
        for (let c = 0; c < 3; c++) out[i + c] = Math.round((out[i + c] ?? 0) * (1 - a) + 255 * a);
      }
      for (const s of marks) {
        const k = starCover(x, y, box.x0 + bw * s.u, box.y0 + bh * s.v, bh * s.r);
        const dim = (shade[i] ?? 0) / 255;
        for (let c = 0; c < 3; c++) out[i + c] = Math.round((out[i + c] ?? 0) * (1 - k) + 255 * (mark[c] ?? 0) * dim * k);
      }
    }
  }
}

/** Яркость цвета по-простому (0…1). */
export function lightness(hex: string): number {
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
export function hue(hex: string): number | null {
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
