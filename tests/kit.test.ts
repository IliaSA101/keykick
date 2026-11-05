/**
 * Перекраска формы и список форм. Слои — крошечные искусственные картинки:
 * так видно, что именно получает каждый пиксель.
 */
import { describe, expect, it } from 'vitest';
import { clubData, kits } from '../src/app/kits';
import {
  CLUB_KIT_ID,
  KIT_CONTRAST,
  RIVAL_KIT_ID,
  checkClubName,
  checkShirtName,
  checkShirtNumber,
  clubKit,
  colorDistance,
  kitDistance,
  parseClubData,
  pickRival,
  kitsDiffer,
  rivalKit,
  sameColors,
  shirtBack,
  shirtInk,
  suggestName,
} from '../src/engine/club';
import {
  GLOSS,
  NO_ZONE,
  OUTFIT_DIFF,
  bodyBox,
  hexToRgb,
  kitPatterns,
  kitRarities,
  opaqueBox,
  outfitFor,
  paintKit,
  paintZones,
  parseKitColors,
  parseKits,
  patternAt,
  rgbDistance,
  type BodyBox,
  type KitColors,
  type KitLayers,
} from '../src/engine/kit';
import { createRandom } from '../src/engine/random';

type Px = { zones: [number, number, number]; shade: [number, number, number] };
const BODY: Px = { zones: [255, 0, 0], shade: [255, 0, 255] };
const SLEEVE: Px = { zones: [0, 255, 0], shade: [255, 0, 255] };
const TRIM: Px = { zones: [0, 0, 255], shade: [255, 0, 255] };
const EMPTY: Px = { zones: [0, 0, 0], shade: [0, 0, 0] };

/** Слои из строк пикселей. */
function layers(rows: Px[][]): KitLayers {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const zones = new Uint8ClampedArray(width * height * 4);
  const shade = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) =>
    row.forEach((p, x) => {
      const i = (y * width + x) * 4;
      zones.set([...p.zones, 255], i);
      shade.set([...p.shade, 255], i);
    }),
  );
  return { width, height, zones, shade };
}

const px = (out: Uint8ClampedArray, width: number, x: number, y: number) =>
  Array.from(out.slice((y * width + x) * 4, (y * width + x) * 4 + 4));

const PLAIN: KitColors = { pattern: 'plain', body: '#ff0000', sleeves: '#00ff00', trim: '#0000ff' };

describe('перекраска формы', () => {
  it('каждая зона получает свой цвет, фон остаётся прозрачным', () => {
    const l = layers([[SLEEVE, BODY, BODY, TRIM, EMPTY]]);
    const out = paintKit(l, PLAIN, { x0: 1, y0: 0, sx: 1, sy: 1 });
    expect(px(out, 5, 0, 0)).toEqual([0, 255, 0, 255]);
    expect(px(out, 5, 1, 0)).toEqual([255, 0, 0, 255]);
    expect(px(out, 5, 3, 0)).toEqual([0, 0, 255, 255]);
    expect(px(out, 5, 4, 0)).toEqual([0, 0, 0, 0]);
  });

  it('затемнение умножает цвет, блик тянет к белому, непрозрачность переходит как есть', () => {
    const half: Px = { zones: [255, 0, 0], shade: [128, 0, 200] };
    const shiny: Px = { zones: [255, 0, 0], shade: [255, 255, 255] };
    const l = layers([[half, shiny, BODY]]);
    const kit: KitColors = { ...PLAIN, body: '#808080' };
    const out = paintKit(l, kit, { x0: 0, y0: 0, sx: 1, sy: 1 });
    const g = 128 / 255;
    const dim = Math.round(255 * g * (128 / 255));
    expect(px(out, 3, 0, 0)).toEqual([dim, dim, dim, 200]);
    const lit = Math.round(255 * (g + (1 - g) * GLOSS));
    expect(px(out, 3, 1, 0)).toEqual([lit, lit, lit, 255]);
  });

  it('на стыке зон цвета смешиваются по долям', () => {
    const seam: Px = { zones: [128, 128, 0], shade: [255, 0, 255] };
    const out = paintKit(layers([[seam]]), PLAIN, { x0: 0, y0: 0, sx: 1, sy: 1 });
    expect(px(out, 1, 0, 0)).toEqual([128, 128, 0, 255]);
  });

  it('узор красит корпус вторым цветом, рукава «split» — в цвет своей половины', () => {
    const l = layers([[SLEEVE, BODY, BODY, BODY, BODY, SLEEVE]]);
    const kit: KitColors = { pattern: 'halves', body: '#ff0000', alt: '#000000', sleeves: 'split', trim: '#ffffff' };
    const out = paintKit(l, kit);
    expect(px(out, 6, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(px(out, 6, 1, 0)).toEqual([255, 0, 0, 255]);
    expect(px(out, 6, 4, 0)).toEqual([0, 0, 0, 255]);
    expect(px(out, 6, 5, 0)).toEqual([0, 0, 0, 255]);
    // Сзади та же форма зеркальна: тёмная половина и её рукав — слева.
    const back = paintKit(l, kit, bodyBox(l, true));
    expect(px(back, 6, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(px(back, 6, 1, 0)).toEqual([0, 0, 0, 255]);
    expect(px(back, 6, 4, 0)).toEqual([255, 0, 0, 255]);
    expect(px(back, 6, 5, 0)).toEqual([255, 0, 0, 255]);
  });

  it('рамка корпуса — по пикселям корпуса, без рукавов', () => {
    const l = layers([
      [EMPTY, EMPTY, EMPTY, EMPTY],
      [SLEEVE, BODY, BODY, SLEEVE],
      [EMPTY, BODY, BODY, EMPTY],
    ]);
    expect(bodyBox(l)).toEqual({ x0: 1, y0: 1, sx: 1 / 2, sy: 1 / 2 });
    expect(bodyBox(l, true)).toEqual({ x0: 1, y0: 1, sx: 1 / 2, sy: 1 / 2, mirror: true });
    expect(() => bodyBox(layers([[SLEEVE, TRIM]]))).toThrow();
  });

  it('узоры различаются и однотонная без узора', () => {
    expect(patternAt('plain', 0.9, 0.9)).toBe(false);
    expect([0.05, 0.2].map((u) => patternAt('stripes', u, 0))).toEqual([false, true]);
    expect([0.05, 0.2].map((v) => patternAt('hoops', 0, v))).toEqual([false, true]);
    expect([0.4, 0.6].map((u) => patternAt('halves', u, 0))).toEqual([false, true]);
    expect([patternAt('sash', 0.5, 0.5), patternAt('sash', 0.9, 0.1)]).toEqual([true, false]);
    expect([patternAt('checks', 0.05, 0.05), patternAt('checks', 0.2, 0.05)]).toEqual([false, true]);
  });

  it('цвет — только #rrggbb', () => {
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(() => hexToRgb('red')).toThrow();
    expect(() => hexToRgb('#fff')).toThrow();
  });
});

describe('список форм', () => {
  it('формы из content разобраны, у каждой узор и редкость из известных', () => {
    expect(kits.length).toBeGreaterThanOrEqual(24);
    for (const kit of kits) {
      expect(kitPatterns).toContain(kit.pattern);
      expect(kitRarities).toContain(kit.rarity);
    }
  });

  it('в коллекции есть все узоры, эпических — 3–4, обычных — больше всех', () => {
    expect(new Set(kits.map((k) => k.pattern))).toEqual(new Set(kitPatterns));
    const n = (r: string) => kits.filter((k) => k.rarity === r).length;
    expect(n('epic')).toBeGreaterThanOrEqual(3);
    expect(n('epic')).toBeLessThanOrEqual(4);
    expect(n('common')).toBeGreaterThan(n('rare'));
    expect(n('rare')).toBeGreaterThan(n('epic'));
  });

  it('id формы клуба не занят формой коллекции, названия форм не повторяются', () => {
    expect(kits.map((k) => k.id)).not.toContain(CLUB_KIT_ID);
    expect(kits.map((k) => k.id)).not.toContain(RIVAL_KIT_ID);
    expect(new Set(kits.map((k) => k.name)).size).toBe(kits.length);
  });

  it('ошибки в данных ловятся', () => {
    const ok = { id: 'a', name: 'А', rarity: 'common', pattern: 'plain', body: '#000000', sleeves: '#000000', trim: '#000000' };
    expect(parseKits([ok])).toHaveLength(1);
    expect(() => parseKits({})).toThrow();
    expect(() => parseKits([ok, ok])).toThrow(/duplicate/);
    expect(() => parseKits([{ ...ok, pattern: 'zigzag', alt: '#ffffff' }])).toThrow(/bad pattern/);
    expect(() => parseKits([{ ...ok, body: 'red' }])).toThrow(/color/);
    expect(() => parseKits([{ ...ok, name: '' }])).toThrow(/name/);
    expect(() => parseKits([{ ...ok, pattern: 'stripes' }])).toThrow(/alt/);
    expect(() => parseKits([{ ...ok, alt: '#ffffff' }])).toThrow(/alt/);
    expect(() => parseKits([{ ...ok, sleeves: 'split' }])).toThrow(/split/);
    expect(() => parseKits([{ ...ok, rarity: 'legendary' }])).toThrow(/rarity/);
    expect(() => parseKits([{ ...ok, rarity: undefined }])).toThrow(/rarity/);
  });
});

describe('свой клуб', () => {
  const KIT: KitColors = { pattern: 'plain', body: '#000000', sleeves: '#ffffff', trim: '#ffffff' };

  it('в content: палитр 9, слов и городов хватает, все годятся в название', () => {
    expect(clubData.palettes).toHaveLength(9);
    for (const p of clubData.palettes) expect(kitPatterns).toContain(p.pattern);
    expect(clubData.words.length).toBeGreaterThanOrEqual(30);
    expect(clubData.cities.length).toBeGreaterThanOrEqual(20);
    for (const w of [...clubData.words, ...clubData.cities]) expect(checkClubName(w).ok).toBe(true);
  });

  it('домашняя форма клуба — эпическая, с названием клуба и его цветами', () => {
    const palette = clubData.palettes[0];
    if (!palette) throw new Error('no palette');
    const kit = clubKit({ name: 'Гром', kit: palette });
    expect([kit.id, kit.name, kit.rarity]).toEqual([CLUB_KIT_ID, 'Гром', 'epic']);
    expect(sameColors(kit, palette)).toBe(true);
    expect(sameColors(palette, { ...palette, trim: '#123456' })).toBe(false);
  });

  it('ошибки в данных клубов ловятся', () => {
    const kit = { pattern: 'plain', body: '#000000', sleeves: '#000000', trim: '#000000' };
    const data = (over: Record<string, unknown> = {}) => ({ palettes: [kit], words: ['Старт'], cities: ['Тула'], ...over });
    expect(parseClubData(data()).words).toEqual(['Старт']);
    expect(() => parseClubData(null)).toThrow(/palettes/);
    expect(() => parseClubData(data({ palettes: [] }))).toThrow(/palettes/);
    expect(() => parseClubData(data({ palettes: [{ ...kit, pattern: 'stripes' }] }))).toThrow(/alt/);
    expect(() => parseClubData(data({ words: [] }))).toThrow(/words/);
    expect(() => parseClubData(data({ words: ['Старт', 'Старт'] }))).toThrow(/duplicate/);
    expect(() => parseClubData(data({ words: [' Старт'] }))).toThrow(/words/);
    expect(() => parseClubData(data({ cities: [7] }))).toThrow(/cities/);
    expect(() => parseClubData(data({ cities: ['я'.repeat(21)] }))).toThrow(/cities/);
  });

  it('своё название: 2–20 знаков после обрезки, только допустимые знаки', () => {
    expect(checkClubName('  Ракета ')).toEqual({ ok: true, name: 'Ракета' });
    expect(checkClubName('Ёж')).toEqual({ ok: true, name: 'Ёж' });
    expect(checkClubName('ФК Звезда-2 St.')).toEqual({ ok: true, name: 'ФК Звезда-2 St.' });
    expect(checkClubName('а'.repeat(20)).ok).toBe(true);
    expect(checkClubName('   ')).toEqual({ ok: false, error: 'short' });
    expect(checkClubName(' я ')).toEqual({ ok: false, error: 'short' });
    expect(checkClubName('а'.repeat(21))).toEqual({ ok: false, error: 'long' });
    expect(checkClubName('Гол!')).toEqual({ ok: false, error: 'chars' });
    expect(checkClubName('Мяч\tГол')).toEqual({ ok: false, error: 'chars' });
    expect(checkClubName('Ünion')).toEqual({ ok: false, error: 'chars' });
    expect(checkClubName('Два  пробела')).toEqual({ ok: false, error: 'spaces' });
    expect(checkClubName('-.-')).toEqual({ ok: false, error: 'noLetters' });
    expect(checkClubName('11').ok).toBe(true);
  });

  it('«Придумать»: слово или «слово город», допустимое название, не то же, что в поле', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const name = suggestName(clubData, '', seed);
      expect(checkClubName(name)).toEqual({ ok: true, name });
      expect(suggestName(clubData, '', seed)).toBe(name);
      seen.add(name);
    }
    expect(seen.size).toBeGreaterThan(100);
    expect([...seen].some((n) => n.includes(' '))).toBe(true);
    expect([...seen].some((n) => !n.includes(' '))).toBe(true);
    const one = { ...clubData, words: ['Старт', 'Темп'], cities: ['Тула'] };
    for (let seed = 0; seed < 50; seed++) expect(suggestName(one, ' старт ', seed)).not.toBe('Старт');
    // Слово из того, что уже в поле, не повторяется: иначе кажется, что кнопка не сработала.
    for (let seed = 0; seed < 50; seed++) expect(suggestName(one, 'Старт Тула', seed).split(' ')[0]).toBe('Темп');
  });

  it('соперник: слово и город из content; одно зерно — тот же соперник', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const r = pickRival(clubData, null, seed);
      expect(clubData.words).toContain(r.name);
      expect(clubData.cities).toContain(r.city);
      expect(pickRival(clubData, null, seed)).toEqual(r);
      seen.add(r.name);
    }
    expect(seen.size).toBe(clubData.words.length);
  });

  it('соперник не тёзка: слово из своего названия он не берёт', () => {
    const own = { name: 'Прогресс Тверь', kit: KIT };
    for (let seed = 0; seed < 300; seed++) expect(pickRival(clubData, own, seed).name).not.toBe('Прогресс');
    // Ё и Е для тёзок одно и то же: «Полет» против «Полёт» на табло не различить.
    for (let seed = 0; seed < 300; seed++) expect(pickRival(clubData, { name: 'Полет', kit: KIT }, seed).name).not.toBe('Полёт');
    const one = { ...clubData, words: ['Старт'] };
    expect(pickRival(one, { name: 'Старт', kit: KIT }, 1).name).toBe('Старт');
  });

  it('форма соперника: из палитр клубов, по зерну; одно зерно — та же форма', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 300; seed++) {
      const r = pickRival(clubData, null, seed);
      expect(r.kit.id).toBe(RIVAL_KIT_ID);
      expect(r.kit.name).toBe(r.name);
      expect(clubData.palettes.some((p) => sameColors(p, r.kit))).toBe(true);
      expect(pickRival(clubData, null, seed, clubData.palettes[0])).toEqual(pickRival(clubData, null, seed, clubData.palettes[0]));
      const own = rivalKit(clubData, 'Фыва', null, seed);
      expect(rivalKit(clubData, 'Фыва', null, seed)).toEqual(own);
      expect(own.name).toBe('Фыва');
      seen.add(clubData.palettes.findIndex((p) => sameColors(p, r.kit)));
    }
    expect(seen.size).toBe(clubData.palettes.length);
    // Форма не сдвигает выбор названия и города: соперник тот же, что и до форм.
    expect(pickRival(clubData, null, 5, clubData.palettes[1]).name).toBe(pickRival(clubData, null, 5).name);
  });

  it('форма соперника заметно другая, чем надетая: любая форма коллекции и любая палитра', () => {
    const worn: KitColors[] = [...kits, ...clubData.palettes];
    for (const w of worn) {
      // Хотя бы две подходящие палитры — соперники не все в одной форме.
      expect(clubData.palettes.filter((p) => kitsDiffer(p, w)).length, w.body).toBeGreaterThanOrEqual(2);
      for (let seed = 0; seed < 100; seed++) {
        expect(kitDistance(pickRival(clubData, null, seed, w).kit, w)).toBeGreaterThanOrEqual(KIT_CONTRAST);
        expect(kitsDiffer(pickRival(clubData, null, seed, w).kit, w), w.body).toBe(true);
        expect(kitsDiffer(rivalKit(clubData, 'Олдж', w, seed), w), w.body).toBe(true);
      }
    }
  });

  it('расстояние цветов: одинаковые — 0, чёрный и белый — самые далёкие; общий цвет узора — близко', () => {
    expect(colorDistance('#2f6fe0', '#2f6fe0')).toBe(0);
    expect(colorDistance('#000000', '#ffffff')).toBeCloseTo(765, 0);
    expect(colorDistance('#16161a', '#1b1f5e')).toBeLessThan(KIT_CONTRAST);
    expect(colorDistance('#2f6fe0', '#5fb3e6')).toBeLessThan(KIT_CONTRAST);
    expect(colorDistance('#c8102e', '#ff7a00')).toBeGreaterThan(KIT_CONTRAST);
    const redWhite: KitColors = { pattern: 'stripes', body: '#c8102e', alt: '#ffffff', sleeves: '#c8102e', trim: '#16161a' };
    const whiteBlue: KitColors = { pattern: 'sash', body: '#f4f4f4', alt: '#2f6fe0', sleeves: '#f4f4f4', trim: '#2f6fe0' };
    expect(kitDistance(redWhite, whiteBlue)).toBeLessThan(KIT_CONTRAST);
    expect(kitDistance(redWhite, whiteBlue)).toBe(kitDistance(whiteBlue, redWhite));
    // У однотонной второй цвет не считается, даже если он есть в данных.
    expect(kitDistance({ ...KIT, body: '#000000' }, { ...KIT, body: '#ffffff' })).toBeCloseTo(765, 0);
  });

  it('палитр мало и все близко — самая далёкая из них', () => {
    const near = { ...clubData, palettes: [{ ...KIT, body: '#111111' }, { ...KIT, body: '#333333' }] };
    for (let seed = 0; seed < 20; seed++) expect(pickRival(near, null, seed, { ...KIT, body: '#000000' }).kit.body).toBe('#333333');
  });

  it('имя на спине: пусто можно; 2–12 букв, пробел и дефис', () => {
    expect(checkShirtName('  ')).toEqual({ ok: true, name: '' });
    expect(checkShirtName(' Илья ')).toEqual({ ok: true, name: 'Илья' });
    expect(checkShirtName('Анна-Мария')).toEqual({ ok: true, name: 'Анна-Мария' });
    expect(checkShirtName('Max').ok).toBe(true);
    expect(checkShirtName('Я')).toEqual({ ok: false, error: 'short' });
    expect(checkShirtName('а'.repeat(13))).toEqual({ ok: false, error: 'long' });
    expect(checkShirtName('Илья10')).toEqual({ ok: false, error: 'chars' });
    expect(checkShirtName('--')).toEqual({ ok: false, error: 'chars' });
    expect(checkShirtName('Ян  Ли')).toEqual({ ok: false, error: 'spaces' });
  });

  it('спина надетой формы: имя и номер игрока; нет ни того, ни другого — спереди', () => {
    expect(shirtBack(null)).toBeNull();
    expect(shirtBack({ name: 'Гром', kit: KIT })).toBeNull();
    expect(shirtBack({ name: 'Гром', kit: KIT, shirtName: 'Илья', shirtNumber: 38 })).toEqual({ name: 'Илья', number: 38 });
    expect(shirtBack({ name: 'Гром', kit: KIT, shirtNumber: 7 })).toEqual({ name: '', number: 7 });
    expect(shirtBack({ name: 'Гром', kit: KIT, shirtName: 'Илья' })).toEqual({ name: 'Илья', number: null });
  });

  it('номер на спине: пусто — без номера; 1–99', () => {
    expect(checkShirtNumber('')).toEqual({ ok: true, number: null });
    expect(checkShirtNumber(' 7 ')).toEqual({ ok: true, number: 7 });
    expect(checkShirtNumber('07')).toEqual({ ok: true, number: 7 });
    expect(checkShirtNumber('99')).toEqual({ ok: true, number: 99 });
    for (const bad of ['0', '00', '100', '-1', '1.5', 'десять', '1 0']) expect(checkShirtNumber(bad).ok).toBe(false);
  });

  it('надпись на спине: по светлой форме тёмная, по тёмной — светлая, всегда с обводкой', () => {
    expect(shirtInk({ ...KIT, body: '#ffffff' })).toEqual({ fill: '#16161a', outline: '#ffffff' });
    expect(shirtInk(KIT)).toEqual({ fill: '#ffffff', outline: '#16161a' });
    // Узор — по среднему двух цветов: бело-чёрные полосы читаются светлой надписью с тёмной обводкой.
    expect(shirtInk({ ...KIT, pattern: 'stripes', body: '#ffffff', alt: '#000000' }).fill).toBe('#ffffff');
    for (const p of clubData.palettes) expect(shirtInk(p).fill).not.toBe(shirtInk(p).outline);
  });
});

/**
 * paintKit до спеки 004 — дословно, как эталон: перекраска футболки через paintZones
 * должна давать те же байты (К2). Отличие одно и намеренное: пиксель без зон (у футболки
 * таких нет — kit_layers.py даёт зону каждому пикселю силуэта).
 */
function paintKitBefore(layers: KitLayers, kit: KitColors, box: BodyBox): Uint8ClampedArray {
  const { width: w, height: h, zones: z, shade: s } = layers;
  const out = new Uint8ClampedArray(w * h * 4);
  const body = hexToRgb(kit.body);
  const alt = kit.alt === undefined ? body : hexToRgb(kit.alt);
  const trim = hexToRgb(kit.trim);
  const sleeves = kit.sleeves === 'split' ? null : hexToRgb(kit.sleeves);
  const plain = kit.pattern === 'plain';
  const SAMPLES = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ] as const;
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
      if (!plain) {
        for (const [dx, dy] of SAMPLES) {
          if (patternAt(kit.pattern, across(x + dx), (y + dy - box.y0) * box.sy)) k += 0.25;
        }
      }
      const sleeve = sleeves ?? (across(x + 0.5) < 0.5 ? body : alt);
      const wb = (z[i] ?? 0) / 255;
      const ws = (z[i + 1] ?? 0) / 255;
      const wt = (z[i + 2] ?? 0) / 255;
      const sum = wb + ws + wt || 1;
      const dark = (s[i] ?? 0) / 255;
      const gloss = ((s[i + 1] ?? 0) / 255) * GLOSS;
      for (let c = 0; c < 3; c++) {
        const b = body[c] ?? 0;
        const tone = b + ((alt[c] ?? 0) - b) * k;
        const base = ((tone * wb + (sleeve[c] ?? 0) * ws + (trim[c] ?? 0) * wt) / sum) * dark;
        out[i + c] = Math.round(255 * (base + (1 - base) * gloss));
      }
      out[i + 3] = opacity;
    }
  }
  return out;
}

/** Синтетические слои по зерну: случайные доли зон (сумма > 0), затемнение, блик, прозрачные дыры. */
function noiseLayers(seed: number, width = 24, height = 20): KitLayers {
  const rnd = createRandom(seed);
  const zones = new Uint8ClampedArray(width * height * 4);
  const shade = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = Math.floor(rnd() * 256);
    const g = Math.floor(rnd() * 256);
    zones.set([r, g, r + g === 0 ? 255 : Math.floor(rnd() * 256), 255], i * 4);
    shade.set([Math.floor(rnd() * 256), Math.floor(rnd() * 256), rnd() < 0.15 ? 0 : Math.floor(rnd() * 256), 255], i * 4);
  }
  return { width, height, zones, shade };
}

describe('предметы комплекта: paintZones и рамка', () => {
  it('футболка через paintZones — те же байты, что до правки: все формы и палитры, спереди и сзади', () => {
    for (const [n, kit] of [...kits, ...clubData.palettes].entries()) {
      const l = noiseLayers(n + 1);
      for (const mirror of [false, true]) {
        const box = bodyBox(l, mirror);
        const before = paintKitBefore(l, kit, box);
        expect(Array.from(paintKit(l, kit, box))).toEqual(Array.from(before));
        const split = kit.sleeves === 'split';
        const zones = paintZones(l, [kit.body, split ? kit.body : kit.sleeves, kit.trim], box, {
          pattern: kit.pattern,
          alt: kit.alt ?? kit.body,
          splitSleeves: split,
        });
        expect(Array.from(zones)).toEqual(Array.from(before));
      }
    }
  });

  it('без узора — три зоны своими цветами, рамка не нужна; пиксель без зон — NO_ZONE', () => {
    const none: Px = { zones: [0, 0, 0], shade: [255, 0, 255] };
    const l = layers([[BODY, SLEEVE, TRIM, none, EMPTY]]);
    const out = paintZones(l, ['#ff0000', '#00ff00', '#0000ff']);
    expect([0, 1, 2, 3, 4].map((x) => px(out, 5, x, 0))).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [...hexToRgb(NO_ZONE).map((c) => Math.round(c * 255)), 255],
      [0, 0, 0, 0],
    ]);
    // Без корпуса (гетры, бутсы без зоны R > 128) рамка не считается и не падает.
    expect(() => paintZones(layers([[SLEEVE, TRIM]]), ['#ff0000', '#00ff00', '#0000ff'])).not.toThrow();
  });

  it('рамка непрозрачного — в долях холста; пустой слой — null', () => {
    const faint: Px = { zones: [0, 0, 0], shade: [0, 0, 1] };
    const l = layers([
      [EMPTY, EMPTY, EMPTY, EMPTY],
      [EMPTY, faint, BODY, EMPTY],
      [EMPTY, EMPTY, TRIM, EMPTY],
      [EMPTY, EMPTY, EMPTY, EMPTY],
    ]);
    expect(opaqueBox(l)).toEqual({ x: 1 / 4, y: 1 / 4, w: 2 / 4, h: 2 / 4 });
    expect(opaqueBox(layers([[BODY]]))).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(opaqueBox(layers([[EMPTY, EMPTY]]))).toBeNull();
  });
});

describe('шорты и гетры: outfitFor', () => {
  const differ = (a: string, b: string) => rgbDistance(a, b) >= OUTFIT_DIFF;

  /** Зоны рядом на ребёнке: шорты — корпус футболки, полоса и пояс — шорты, гетры — нога. */
  function expectReadable(kit: KitColors, where: string) {
    const { shorts, socks } = outfitFor(kit);
    expect(differ(shorts.body, shorts.stripe), `${where}: шорты и полоса`).toBe(true);
    expect(differ(shorts.body, shorts.waist), `${where}: шорты и пояс`).toBe(true);
    expect(differ(socks.leg, socks.top), `${where}: гетра и отворот`).toBe(true);
    expect(differ(socks.leg, socks.foot), `${where}: гетра и стопа`).toBe(true);
    const all = [shorts.body, shorts.stripe, shorts.waist, socks.leg, socks.top, socks.foot];
    for (const c of all) expect(() => hexToRgb(c)).not.toThrow();
    return { shorts, socks };
  }

  it('1 000 случайных форм: шорты не цвета корпуса, соседние зоны разные', () => {
    const rnd = createRandom(2026);
    const hex = () => `#${Math.floor(rnd() * 0x1000000).toString(16).padStart(6, '0')}`;
    const palette = ['#000000', '#ffffff', '#16161a', '#f4f4f4', '#ff0000', '#ffd400'];
    const color = () => (rnd() < 0.3 ? palette[Math.floor(rnd() * palette.length)] ?? '#000000' : hex());
    for (let n = 0; n < 1000; n++) {
      const pattern = kitPatterns[n % kitPatterns.length] ?? 'plain';
      const body = color();
      // Совпадения нарочно часты: рукава и окантовка в цвет корпуса, почти в цвет, «split».
      const same = rnd();
      const sleeves = pattern === 'halves' && rnd() < 0.5 ? 'split' : same < 0.3 ? body : color();
      const trim = same < 0.5 ? (same < 0.2 ? body : sleeves === 'split' ? body : sleeves) : color();
      const kit: KitColors = { pattern, body, sleeves, trim };
      if (pattern !== 'plain') kit.alt = color();
      const { shorts } = expectReadable(kit, `#${n} ${JSON.stringify(kit)}`);
      expect(differ(shorts.body, kit.body), `#${n}: шорты и корпус`).toBe(true);
    }
  });

  it('все формы коллекции и палитры клубов — читаемый комплект', () => {
    for (const kit of [...kits, ...clubData.palettes]) expectReadable(kit, kit.body);
  });

  it('вывод: шорты — цвет рукавов, полоса — корпус, пояс — окантовка; одинаковые — нейтральный', () => {
    const kit: KitColors = { pattern: 'plain', body: '#c8102e', sleeves: '#ffffff', trim: '#16161a' };
    expect(outfitFor(kit)).toEqual({
      shorts: { body: '#ffffff', stripe: '#c8102e', waist: '#16161a' },
      socks: { leg: '#c8102e', top: '#16161a', foot: '#ffffff' },
    });
    const mono: KitColors = { pattern: 'plain', body: '#ffffff', sleeves: '#ffffff', trim: '#ffffff' };
    expect(outfitFor(mono).shorts).toEqual({ body: '#16161a', stripe: '#ffffff', waist: '#ffffff' });
    expect(outfitFor({ ...mono, body: '#000000', sleeves: '#000000', trim: '#000000' }).shorts.body).toBe('#ffffff');
  });

  it('явные шорты и гетры побеждают вывод целиком', () => {
    const shorts = { body: '#000001', stripe: '#000002', waist: '#000003' };
    const socks = { leg: '#000004', top: '#000005', foot: '#000006' };
    const out = outfitFor({ ...PLAIN, shorts, socks });
    expect(out).toEqual({ shorts, socks });
    expect(out.shorts).not.toBe(shorts);
    expect(outfitFor({ ...PLAIN, socks }).socks).toEqual(socks);
    expect(outfitFor({ ...PLAIN, shorts }).shorts).toEqual(shorts);
  });

  it('разбор явных цветов: та же проверка hex, ошибка — с адресом поля', () => {
    const ok = { pattern: 'plain', body: '#000000', sleeves: '#ffffff', trim: '#ffffff' };
    const shorts = { body: '#111111', stripe: '#222222', waist: '#333333' };
    const socks = { leg: '#444444', top: '#555555', foot: '#666666' };
    expect(parseKitColors({ ...ok, shorts, socks })).toEqual({ ...ok, shorts, socks });
    expect(parseKitColors(ok)).not.toHaveProperty('shorts');
    expect(() => parseKitColors({ ...ok, shorts: { ...shorts, waist: 'red' } })).toThrow('kit.shorts.waist');
    expect(() => parseKitColors({ ...ok, socks: { leg: '#444444', top: '#555555' } })).toThrow('kit.socks.foot');
    expect(() => parseKitColors({ ...ok, shorts: '#111111' })).toThrow('kit.shorts');
    expect(() => parseKits([{ id: 'a', name: 'А', rarity: 'common', ...ok, socks: [] }])).toThrow('kits[0].socks');
  });
});
