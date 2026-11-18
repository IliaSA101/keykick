/**
 * Цвета клуба у людей на трибуне (065 Т7в, Р80): спрайты болельщиков печи нарисованы в синем с белым; зелёно-белый образец
 * (023-Р30) и любой клуб игрока получают их перекраской синего — как `green_club` в `tools/mock-map/sprites.py`. Чистые функции
 * без DOM: байты картинки приходят снаружи (экран рисует их через canvas), поэтому проверяются тестом.
 */
import type { ClubKit } from './section';

/** Диапазон синего в спрайтах (HSV-оттенок в градусах): то, что перекрашиваем; кожа, волосы, белое — вне его. */
const BLUE_FROM = 176;
const BLUE_TO = 268;
/** Минимальная насыщенность и яркость цвета формы, чтобы считать его «цветом клуба» (белое, серое, чёрное — не цвет). */
const MIN_SAT = 0.3;
const MIN_VAL = 0.25;

const HEX = /^#[0-9a-f]{6}$/i;

/** HSV: оттенок в градусах 0…360, насыщенность и яркость 0…1. */
function hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h * 60, max === 0 ? 0 : d / max, max];
}

function rgbOf(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/**
 * Оттенок людей на трибуне по форме клуба: первый «цветной» из тела, второго цвета, рукавов, окантовки.
 * `null` — перекрашивать не надо: цвет клуба — синий (спрайты уже такие) или формы без цвета (белое, серое, чёрное).
 */
export function crowdHue(kit: ClubKit | null | undefined): number | null {
  if (!kit) return null;
  for (const c of [kit.body, kit.alt, kit.sleeves, kit.trim]) {
    if (c === undefined || !HEX.test(c)) continue;
    const n = parseInt(c.slice(1), 16);
    const [h, s, v] = hsv((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    if (s < MIN_SAT || v < MIN_VAL) continue;
    return h >= BLUE_FROM && h <= BLUE_TO ? null : Math.round(h);
  }
  return null;
}

/** Перекраска синего в `hue` на месте: байты RGBA (формат ImageData). Вес — насыщенность синего: белое и тени не трогаются. */
export function recolorCrowd(data: Uint8ClampedArray, hue: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]! / 255;
    const g = data[i + 1]! / 255;
    const b = data[i + 2]! / 255;
    const [h, s, v] = hsv(r, g, b);
    if (h < BLUE_FROM || h > BLUE_TO) continue;
    const w = Math.max(0, Math.min(1, (s * 255 - 50) * 4 / 255));
    if (w === 0) continue;
    const [nr, ng, nb] = rgbOf(hue, s * 0.92, Math.min(1, v * 1.05));
    data[i] = Math.round((r + (nr - r) * w) * 255);
    data[i + 1] = Math.round((g + (ng - g) * w) * 255);
    data[i + 2] = Math.round((b + (nb - b) * w) * 255);
  }
}
