/**
 * Перекраска формы: чистые функции без DOM, поэтому проверяются тестом.
 *
 * Основа формы — два слоя одной картинки (tools/kit_layers.py):
 *   zones — R = корпус, G = рукава, B = окантовка (доли 0…255);
 *   shade — R = затемнение, G = блик, B = непрозрачность.
 * Цвет пикселя: base = цвет зоны · затемнение; итог = base + (1 − base) · блик.
 * Шорты, гетры и бутсы — те же два слоя со своими тремя зонами (paintZones), цвета шорт
 * и гетр выводятся из формы (outfitFor), если не заданы явно (спека 004).
 */

export const kitPatterns = ['plain', 'stripes', 'hoops', 'halves', 'sash', 'checks'] as const;
export type KitPattern = (typeof kitPatterns)[number];

/** Расцветка формы. sleeves: 'split' — рукава в цвет своей половины (для узора «половинки»). */
export interface KitColors {
  pattern: KitPattern;
  body: string;
  alt?: string;
  sleeves: string;
  trim: string;
  /** Явные цвета шорт и гетр; нет — выводятся из формы (outfitFor). */
  shorts?: ShortsColors;
  socks?: SocksColors;
}

/** Цвета шорт по зонам слоёв: R — шорты, G — боковая полоса, B — пояс и низ штанин. */
export interface ShortsColors {
  body: string;
  stripe: string;
  waist: string;
}

/** Цвета гетр по зонам слоёв: R — гетра, G — отворот, B — стопа, пятка и носок. */
export interface SocksColors {
  leg: string;
  top: string;
  foot: string;
}

export const kitRarities = ['common', 'rare', 'epic'] as const;
export type KitRarity = (typeof kitRarities)[number];

export interface Kit extends KitColors {
  id: string;
  name: string;
  rarity: KitRarity;
}

/** Пиксели слоёв в формате ImageData: 4 байта на пиксель, альфа слоя не используется. */
export interface KitLayers {
  width: number;
  height: number;
  zones: Uint8ClampedArray;
  shade: Uint8ClampedArray;
}

/** Рамка корпуса: узор считается в её долях (u — вправо, v — вниз). */
export interface BodyBox {
  x0: number;
  y0: number;
  sx: number;
  sy: number;
  /** Вид сзади: левая половина узора оказывается справа («половинки», лента, рукава «split»). */
  mirror?: boolean;
}

type Rgb = readonly [number, number, number];

/** Сила блика: при 1 светлые места любой формы становились бы чисто белыми. */
export const GLOSS = 0.85;

const HEX = /^#[0-9a-f]{6}$/i;

export function hexToRgb(hex: string): Rgb {
  if (!HEX.test(hex)) throw new Error(`bad color: ${hex}`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Попадает ли точка корпуса (u, v) во второй цвет узора. */
export function patternAt(pattern: KitPattern, u: number, v: number): boolean {
  switch (pattern) {
    case 'plain':
      return false;
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
  }
}

export function bodyBox(layers: KitLayers, mirror = false): BodyBox {
  const { width: w, height: h, zones } = layers;
  let x0 = w;
  let x1 = 0;
  let y0 = h;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((zones[(y * w + x) * 4] ?? 0) > 128) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < x0) throw new Error('kit layers have no body');
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

/** Узор футболки для paintZones: второй цвет корпуса и рукава «split» (в цвет своей половины). */
export interface ZonePattern {
  pattern: KitPattern;
  alt: string;
  splitSleeves: boolean;
}

/**
 * Цвет пикселя без зон (сумма долей 0): почти чёрный, с затемнением и бликом как у зон.
 * Так выйдет подошва бутс, если kit_layers.py оставит её без зоны (спека 004, раздел 2).
 */
export const NO_ZONE = '#1a1a1a';

/**
 * Перекраска трёх зон слоёв (R, G, B) в RGBA. Узор и рукава «split» — только у футболки:
 * считаются в долях рамки корпуса box (не передана — bodyBox). Без узора рамка не нужна.
 */
export function paintZones(
  layers: KitLayers,
  colors: readonly [string, string, string],
  box?: BodyBox,
  pattern?: ZonePattern,
): Uint8ClampedArray<ArrayBuffer> {
  const { width: w, height: h, zones: z, shade: s } = layers;
  const out = new Uint8ClampedArray(w * h * 4);
  const [zr, zg, zb] = [hexToRgb(colors[0]), hexToRgb(colors[1]), hexToRgb(colors[2])];
  const none = hexToRgb(NO_ZONE);
  const alt = pattern ? hexToRgb(pattern.alt) : zr;
  const frame = pattern ? (box ?? bodyBox(layers)) : undefined;
  const striped = pattern !== undefined && pattern.pattern !== 'plain';
  const across = (x: number): number => {
    if (!frame) return 0;
    const u = (x - frame.x0) * frame.sx;
    return frame.mirror === true ? 1 - u : u;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const opacity = s[i + 2] ?? 0;
      if (opacity === 0) continue;

      let k = 0;
      if (striped && frame) {
        for (const [dx, dy] of SAMPLES) {
          if (patternAt(pattern.pattern, across(x + dx), (y + dy - frame.y0) * frame.sy)) k += 0.25;
        }
      }
      const second = pattern?.splitSleeves === true ? (across(x + 0.5) < 0.5 ? zr : alt) : zg;
      const wr = (z[i] ?? 0) / 255;
      const wg = (z[i + 1] ?? 0) / 255;
      const wb = (z[i + 2] ?? 0) / 255;
      const sum = wr + wg + wb;
      const dark = (s[i] ?? 0) / 255;
      const gloss = ((s[i + 1] ?? 0) / 255) * GLOSS;

      for (let c = 0; c < 3; c++) {
        const r = zr[c] ?? 0;
        const tone = r + ((alt[c] ?? 0) - r) * k;
        const mix = sum === 0 ? (none[c] ?? 0) : (tone * wr + (second[c] ?? 0) * wg + (zb[c] ?? 0) * wb) / sum;
        const base = mix * dark;
        out[i + c] = Math.round(255 * (base + (1 - base) * gloss));
      }
      out[i + 3] = opacity;
    }
  }
  return out;
}

/** Готовая форма в формате ImageData (RGBA): корпус, рукава, окантовка и узор. */
export function paintKit(
  layers: KitLayers,
  kit: KitColors,
  box: BodyBox = bodyBox(layers),
): Uint8ClampedArray<ArrayBuffer> {
  const split = kit.sleeves === 'split';
  return paintZones(layers, [kit.body, split ? kit.body : kit.sleeves, kit.trim], box, {
    pattern: kit.pattern,
    alt: kit.alt ?? kit.body,
    splitSleeves: split,
  });
}

/** Рамка непрозрачного в долях холста: x, y — левый верхний угол, w, h — ширина и высота. */
export interface OpaqueBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Где на холсте сам предмет (B слоя shade > 0): слои всегда квадрат 640, а поля вокруг шорт,
 * гетр и бутс разные — раскладка комплекта идёт по этой рамке. Пустой слой — null.
 */
export function opaqueBox(layers: KitLayers): OpaqueBox | null {
  const { width: w, height: h, shade } = layers;
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((shade[(y * w + x) * 4 + 2] ?? 0) > 0) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h };
}

/**
 * Насколько различны два цвета для комплекта: обычное расстояние RGB, шкала 0…441.
 * Меньше OUTFIT_DIFF — соседние зоны сливаются.
 */
export function rgbDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return 255 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export const OUTFIT_DIFF = 60;

/** Тёмный нейтральный — по светлому цвету, белый — по тёмному. */
export const NEUTRAL_DARK = '#16161a';
export const NEUTRAL_LIGHT = '#ffffff';

function neutral(c: string): string {
  const [r, g, b] = hexToRgb(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? NEUTRAL_DARK : NEUTRAL_LIGHT;
}

/** Первый цвет из списка, заметно отличный от base; нет такого — нейтральный к base. */
function firstDiffering(base: string, candidates: readonly (string | undefined)[]): string {
  for (const c of candidates) if (c !== undefined && rgbDistance(c, base) >= OUTFIT_DIFF) return c;
  return neutral(base);
}

/**
 * Шорты и гетры к форме (спека 004, design.md §1): шорты не цвета корпуса, соседние зоны
 * заметно разные. Нейтральный (neutral) всегда далёк от своего цвета — функция тотальна.
 * Явные kit.shorts / kit.socks заменяют вывод целиком.
 */
export function outfitFor(kit: KitColors): { shorts: ShortsColors; socks: SocksColors } {
  const sleeves = kit.sleeves === 'split' ? undefined : kit.sleeves;
  const shortsBody = firstDiffering(kit.body, [sleeves, kit.trim]);
  const shorts = kit.shorts ?? {
    body: shortsBody,
    stripe: firstDiffering(shortsBody, [kit.body]),
    waist: firstDiffering(shortsBody, [kit.trim, kit.body]),
  };
  // Гетры — к шортам на ребёнке: явные шорты тоже идут в стопу и отворот, если отличаются от ноги.
  const socks = kit.socks ?? {
    leg: kit.body,
    top: firstDiffering(kit.body, [kit.trim, shorts.body]),
    foot: firstDiffering(kit.body, [shorts.body]),
  };
  return { shorts: { ...shorts }, socks: { ...socks } };
}

type Field = (key: string) => string;

/** Строковое поле записи: пустое или не строка — ошибка с адресом поля. */
function fieldReader(r: Record<string, unknown>, where: string): Field {
  return (key) => {
    const v = r[key];
    if (typeof v !== 'string' || v === '') throw new Error(`${where}.${key}: expected string`);
    return v;
  };
}

/** Разбор расцветки: общая проверка для форм коллекции и палитр своего клуба. */
export function parseKitColors(raw: unknown, where = 'kit'): KitColors {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = fieldReader(r, where);
  const pattern = str('pattern');
  if (!(kitPatterns as readonly string[]).includes(pattern)) throw new Error(`${where}: bad pattern ${pattern}`);
  const colors: KitColors = {
    pattern: pattern as KitPattern,
    body: str('body'),
    sleeves: str('sleeves'),
    trim: str('trim'),
  };
  if (r.alt !== undefined) colors.alt = str('alt');
  // Узору нужен второй цвет; однотонной он лишний.
  if ((colors.pattern === 'plain') !== (colors.alt === undefined)) throw new Error(`${where}: alt must match pattern`);
  if (colors.sleeves === 'split' && colors.pattern !== 'halves') throw new Error(`${where}: split sleeves need halves`);
  for (const c of [colors.body, colors.alt, colors.sleeves === 'split' ? undefined : colors.sleeves, colors.trim]) {
    if (c !== undefined) hexToRgb(c);
  }
  if (r.shorts !== undefined) {
    const [body, stripe, waist] = zoneColors(r.shorts, `${where}.shorts`, ['body', 'stripe', 'waist']);
    colors.shorts = { body, stripe, waist };
  }
  if (r.socks !== undefined) {
    const [leg, top, foot] = zoneColors(r.socks, `${where}.socks`, ['leg', 'top', 'foot']);
    colors.socks = { leg, top, foot };
  }
  return colors;
}

/** Три цвета предмета комплекта (шорты, гетры): ошибка — с адресом поля (kit.shorts.waist). */
function zoneColors(raw: unknown, where: string, keys: readonly [string, string, string]): [string, string, string] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${where}: expected object`);
  const str = fieldReader(raw as Record<string, unknown>, where);
  const color = (key: string): string => {
    const v = str(key);
    if (!HEX.test(v)) throw new Error(`${where}.${key}: bad color ${v}`);
    return v;
  };
  return [color(keys[0]), color(keys[1]), color(keys[2])];
}

/** Разбор списка форм из content: ошибка в данных должна падать в тесте, а не на экране ребёнка. */
export function parseKits(raw: unknown): Kit[] {
  if (!Array.isArray(raw)) throw new Error('kits: expected array');
  const ids = new Set<string>();
  return raw.map((item: unknown, n) => {
    const where = `kits[${n}]`;
    const r = (item ?? {}) as Record<string, unknown>;
    const str = fieldReader(r, where);
    const id = str('id');
    if (ids.has(id)) throw new Error(`${where}: duplicate id ${id}`);
    ids.add(id);
    const name = str('name');
    const rarity = str('rarity');
    if (!(kitRarities as readonly string[]).includes(rarity)) throw new Error(`${where}: bad rarity ${rarity}`);
    return { id, name, rarity: rarity as KitRarity, ...parseKitColors(r, where) };
  });
}
