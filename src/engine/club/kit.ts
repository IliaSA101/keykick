/**
 * Формы клуба: домашняя форма (обычная форма коллекции, всегда своя и первая в шкафчике), имя и номер на спине,
 * соперник на тайм и его форма, «заметно другая» форма (цвет и оттенок).
 */
import { hexToRgb, type Kit, type KitColors } from '../kit';
import { createRandom, pick, randomInt } from '../random';
import { nameWords, plainWord, type Club, type ClubData, type Rival } from './names';

/** id домашней формы клуба: не должен совпасть ни с одной формой коллекции (тест в kit.test.ts). */
export const CLUB_KIT_ID = 'club-home';

/** id формы соперника: она выдуманная, в коллекцию не попадает. */
export const RIVAL_KIT_ID = 'rival';

/**
 * Насколько цвета корпуса соперника должны отличаться от надетой формы (kitDistance, шкала 0…765):
 * 200 — синий и голубой (≈ 150) ещё «близко», красный и оранжевый (≈ 240) — уже разные. При таком
 * пороге у любой формы коллекции и палитры остаётся хотя бы две подходящие палитры (тест в kit.test.ts).
 */
export const KIT_CONTRAST = 200;

export function clubKit(club: Club): Kit {
  return { id: CLUB_KIT_ID, name: club.name, rarity: 'epic', ...club.kit };
}

/**
 * Имя и номер игрока для спины надетой формы; ни имени, ни номера — null (форма видна спереди).
 * Подписи — у игрока, а не у формы: надел другую — они переезжают на неё.
 */
export function shirtBack(club: Club | null): { name: string; number: number | null } | null {
  if (!club || (club.shirtName === undefined && club.shirtNumber === undefined)) return null;
  return { name: club.shirtName ?? '', number: club.shirtNumber ?? null };
}

/** Одинаковы ли расцветки — чтобы на экране клуба отметить уже выбранную палитру. */
export function sameColors(a: KitColors, b: KitColors): boolean {
  return (
    a.pattern === b.pattern && a.body === b.body && a.alt === b.alt && a.sleeves === b.sleeves && a.trim === b.trim
  );
}

/**
 * Соперник на тайм: слово, город и форма. Слово из названия своего клуба соперник не берёт —
 * иначе на табло «Прогресс 0 : 0 Прогресс» и не понять, кто есть кто. Форма — по тому же зерну
 * (после слова и города) и заметно другая, чем надетая (worn; null — сравнивать не с чем).
 */
export function pickRival(data: ClubData, own: Club | null, seed: number, worn: KitColors | null = null): Rival {
  const rnd = createRandom(seed);
  const taken = new Set(own ? nameWords(own.name) : []);
  const free = data.words.filter((w) => !taken.has(plainWord(w)));
  const name = pick(rnd, free.length > 0 ? free : data.words);
  const city = pick(rnd, data.cities);
  return { name, city, kit: kitAgainst(data, name, worn, rnd) };
}

/** Форма соперника-персонажа урока («Фыва»): та же, что у выдуманного клуба, но своё зерно. */
export function rivalKit(data: ClubData, name: string, worn: KitColors | null, seed: number): Kit {
  return kitAgainst(data, name, worn, createRandom(seed));
}

/**
 * Палитра с места по зерну; близко к надетой — следующая по кругу. Совсем все близко (палитр мало) —
 * самая далёкая из них: соперник без формы хуже, чем в похожей.
 */
function kitAgainst(data: ClubData, name: string, worn: KitColors | null, rnd: () => number): Kit {
  const n = data.palettes.length;
  const start = randomInt(rnd, n);
  let best: KitColors | undefined;
  let bestDistance = -1;
  for (let i = 0; i < n; i++) {
    const p = data.palettes[(start + i) % n];
    if (!p) continue;
    const d = worn ? kitDistance(p, worn) : Infinity;
    if (!worn || kitsDiffer(p, worn)) return { id: RIVAL_KIT_ID, name, rarity: 'common', ...p };
    if (d > bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  if (!best) throw new Error('no palettes');
  return { id: RIVAL_KIT_ID, name, rarity: 'common', ...best };
}

/** Цвета корпуса: у однотонной — один, у узора — оба (полосы, половинки, лента…). */
function bodyColors(kit: KitColors): string[] {
  return kit.alt === undefined || kit.pattern === 'plain' ? [kit.body] : [kit.body, kit.alt];
}

/**
 * Разница двух цветов «на глаз» — взвешенный RGB (redmean), шкала 0…765 (чёрный и белый).
 * Зелёный глаз различает сильнее, поэтому у него вес больше.
 */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a).map((c) => c * 255) as [number, number, number];
  const [r2, g2, b2] = hexToRgb(b).map((c) => c * 255) as [number, number, number];
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/**
 * Насколько различимы формы по корпусу: самая близкая пара их цветов. Строго: красно-белые полосы
 * и бело-красная лента «близки» — у обеих белое, на маленьком табло их легко спутать.
 */
export function kitDistance(a: KitColors, b: KitColors): number {
  let min = Infinity;
  for (const x of bodyColors(a)) for (const y of bodyColors(b)) min = Math.min(min, colorDistance(x, y));
  return min;
}

/** Наименьшая разница оттенков основных цветов, в градусах: синий и тёмно-синий, алый и оранжевый — рядом. */
export const HUE_CONTRAST = 40;

/** Оттенок цвета 0…360; у серого, белого и почти чёрного оттенка нет — null. */
function hue(hex: string): number | null {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const c = max - min;
  if (c < 0.3 || max < 0.2) return null;
  const h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return (h * 60 + 360) % 360;
}

/**
 * Формы для ребёнка разные: цвета далеко (kitDistance) и основной цвет корпуса другого оттенка.
 * По одному расстоянию тёмно-синяя в полоску и синяя однотонная проходили — а на табло похожи.
 */
export function kitsDiffer(a: KitColors, b: KitColors): boolean {
  if (kitDistance(a, b) < KIT_CONTRAST) return false;
  const ha = hue(a.body);
  const hb = hue(b.body);
  if (ha === null || hb === null) return true;
  const diff = Math.abs(ha - hb);
  return Math.min(diff, 360 - diff) >= HUE_CONTRAST;
}

/** Яркость цвета по-простому (0…1): чтобы выбрать, чем писать по форме. */
function lightness(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Цвет имени и номера на спине: по светлой форме — тёмный с белой обводкой, по тёмной — наоборот.
 * У узора считается среднее двух цветов: обводка держит надпись на обоих.
 */
export function shirtInk(kit: KitColors): { fill: string; outline: string } {
  const l = kit.pattern === 'plain' ? lightness(kit.body) : (lightness(kit.body) + lightness(kit.alt ?? kit.body)) / 2;
  return l > 0.55 ? { fill: '#16161a', outline: '#ffffff' } : { fill: '#ffffff', outline: '#16161a' };
}
