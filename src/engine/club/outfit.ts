/**
 * Шорты и гетры клуба (065 Т9д, кадры Э1.01–Э1.05; спека 004): те же два слоя, что у футболки (`paint.ts`), но своя раскладка —
 * три зоны без узора. Чистые функции без DOM. Возвращено из снесённого движка форм v2 (060 Т0): цвета шорт и гетр выводятся из формы.
 * Зоны слоя: R, G, B — у шорт «корпус, полоса, пояс», у гетр «голень, верх, носок».
 */
import { channelBounds, hexToRgb, NO_ZONE, shadePixel, type KitLayers } from './paint';
import type { ClubKit } from './section';

/** Тёмный нейтральный — по светлому цвету, белый — по тёмному. */
export const NEUTRAL_DARK = '#16161a';
export const NEUTRAL_LIGHT = '#ffffff';
/** Насколько различны соседние зоны: расстояние RGB в шкале 0…441; ближе — зоны сливаются. */
export const OUTFIT_DIFF = 60;

export interface Outfit {
  shorts: { body: string; stripe: string; waist: string };
  socks: { leg: string; top: string; foot: string };
}

/** Рамка непрозрачного в долях холста: слои — квадрат 640 с разными полями вокруг предмета. */
export interface OpaqueBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Перекраска трёх зон слоя в RGBA (без узора). Нет зоны — почти чёрный, тень и блик как у зон. */
export function paintZones(layers: KitLayers, colors: readonly [string, string, string]): Uint8ClampedArray<ArrayBuffer> {
  const { width: w, height: h, zones: z, shade: s } = layers;
  const out = new Uint8ClampedArray(w * h * 4);
  const rgb = [hexToRgb(colors[0]), hexToRgb(colors[1]), hexToRgb(colors[2])] as const;
  const none = hexToRgb(NO_ZONE);
  for (let i = 0; i < w * h * 4; i += 4) {
    if ((s[i + 2] ?? 0) === 0) continue;
    shadePixel(out, i, z, s, rgb, none);
  }
  return out;
}

/** Где на холсте сам предмет (B слоя shade > 0); пустой слой — null. */
export function opaqueBox(layers: KitLayers): OpaqueBox | null {
  const { width: w, height: h, shade } = layers;
  const b = channelBounds(shade, w, h, 2, 0);
  return b === null ? null : { x: b.x0 / w, y: b.y0 / h, w: (b.x1 - b.x0 + 1) / w, h: (b.y1 - b.y0 + 1) / h };
}

export function rgbDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return 255 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

function neutral(c: string): string {
  const [r, g, b] = hexToRgb(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? NEUTRAL_DARK : NEUTRAL_LIGHT;
}

/** Первый цвет из списка, заметно отличный от base; нет такого — нейтральный к base (функция тотальна). */
function firstDiffering(base: string, candidates: readonly (string | undefined)[]): string {
  for (const c of candidates) if (c !== undefined && rgbDistance(c, base) >= OUTFIT_DIFF) return c;
  return neutral(base);
}

/** Шорты и гетры к форме: шорты не цвета корпуса, соседние зоны заметно разные; гетры — к шортам. */
export function outfitFor(kit: ClubKit): Outfit {
  const sleeves = kit.sleeves === 'split' ? undefined : kit.sleeves;
  const body = firstDiffering(kit.body, [sleeves, kit.trim]);
  const shorts = { body, stripe: firstDiffering(body, [kit.body]), waist: firstDiffering(body, [kit.trim, kit.body]) };
  const socks = { leg: kit.body, top: firstDiffering(kit.body, [kit.trim, body]), foot: firstDiffering(kit.body, [body]) };
  return { shorts, socks };
}
