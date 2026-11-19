/**
 * Графика: каждый файл, на который ссылается код, лежит в public/,
 * и в public/art нет файлов, о которых код не знает (забытые генерации раздувают сайт).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artBackgrounds, artFiles, artPathEager, artPathLazy, screenArt } from '../../src/art/assets';
import { QINDEX_OF_Q76, webpInfo } from './webp';

const publicDir = join(import.meta.dirname, '..', '..', 'public');

/** Слои Дома и Карты — манифест печи (tools/home-bake/bake.py, 065 Т6): их файлы известны ему, а не artFiles. */
const homeArtFiles: string[] = [
  ...new Set(
    readFileSync(join(import.meta.dirname, '..', '..', 'src', 'content', 'home-art.json'), 'utf8').match(
      /art\/(?:home|map)\/[\w-]+\.webp/g,
    ) ?? [],
  ),
];

/** Все файлы под public/<dir> путями от public, с прямыми слэшами — как в artFiles. */
function filesUnder(dir: string): string[] {
  return readdirSync(join(publicDir, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(publicDir, rel)).isDirectory() ? filesUnder(rel) : [rel];
  });
}

describe('графика', () => {
  it('каждый файл из artFiles лежит в public', () => {
    const files = Object.values(artFiles);
    expect(files.length).toBeGreaterThan(0);
    const missing = files.filter((f) => !existsSync(join(publicDir, f)));
    expect(missing).toEqual([]);
  });

  it('в public/art нет файлов, о которых не знает код', () => {
    const known = new Set<string>([...Object.values(artFiles), ...homeArtFiles]);
    const all = filesUnder('art');
    expect(all.length).toBeGreaterThan(2);
    const orphans = all.filter((f) => !known.has(f));
    expect(orphans).toEqual([]);
  });

  it('у футболки, шорт, гетр и бутс — слои зон и теней: без потерь, квадрат 640 (спека 004)', () => {
    const files = new Set<string>(Object.values(artFiles));
    for (const item of ['base', 'back', 'shorts', 'socks', 'boots']) {
      for (const layer of ['zones', 'shade']) {
        const file = `art/kit/${item}-${layer}.webp`;
        expect(files.has(file), file).toBe(true);
        // Сжатие с потерями сдвинуло бы доли зон, и цвета поплыли бы по краям.
        const info = webpInfo(join(publicDir, file));
        expect({ lossless: info.lossless, w: info.w, h: info.h }, file).toEqual({ lossless: true, w: 640, h: 640 });
      }
    }
  });

  const MB = 1024 * 1024;
  const size = (f: string) => statSync(join(publicDir, f)).size;

  /**
   * Слои Дома и Карты (065 Т6, К-Е): каждый файл манифеста лежит на диске; первый экран Дома — ≤ 1,5 МБ.
   * Веса папок home и map не ограничены: решение владельца 19.11 — предел на экран, не на папку.
   */
  it('слои Дома и Карты: файлы на месте, первый экран Дома (ступень 0) ≤ 1,5 МБ', () => {
    expect(homeArtFiles.length).toBeGreaterThan(100);
    expect(homeArtFiles.filter((f) => !existsSync(join(publicDir, f)))).toEqual([]);
    // первый экран Дома: основа ступени 0, её заготовка и накладки, видимые на ней
    const first = ['art/home/base-0.webp', 'art/home/ghost-0.webp'];
    expect(first.reduce((sum, f) => sum + size(f), 0)).toBeLessThanOrEqual(1.5 * MB);
  });

  /**
   * Вес по экранам (решение владельца 19.11): при первом открытии экран грузит ≤ 1,5 МБ графики; общий объём игры и папок
   * не ограничен. Набор файлов экрана — явный список `screenArt` из src/art/assets.ts (ключ → путь в artFiles).
   */
  describe('вес экрана при первом открытии ≤ 1,5 МБ', () => {
    for (const [screen, keys] of Object.entries(screenArt)) {
      it(`экран «${screen}»`, () => {
        expect(keys.length).toBeGreaterThan(1);
        expect(new Set(keys).size, 'ключи без повторов').toBe(keys.length);
        const files = keys.map((k) => artFiles[k]);
        expect(files.filter((f) => !existsSync(join(publicDir, f)))).toEqual([]);
        expect(files.reduce((sum, f) => sum + size(f), 0)).toBeLessThanOrEqual(1.5 * MB);
      });
    }

    // Ловит картинку, раздутую так, что одна не влезает в предел ни одного экрана (в списки она может ещё не попасть).
    it('ни один файл графики не тяжелее 1,5 МБ', () => {
      const heavy = filesUnder('art').filter((f) => size(f) > 1.5 * MB);
      expect(heavy).toEqual([]);
    });
  });

  /**
   * Качество фонов (решение владельца 19.11: «не уже 1920 px, без пережатия ради веса»): ширина ≥ 1920 и кодек не грубее
   * исходного пайплайна — q76 (docs/art-pipeline.md; индекс квантования читается из заголовка файла, tests/art/webp.ts).
   */
  it('фоны: не уже 1920 px и не пережаты (кодек не грубее q76)', () => {
    const backgrounds = [
      ...artBackgrounds.map((k) => artFiles[k]),
      ...homeArtFiles.filter((f) => /art\/home\/base-\d+\.webp$|art\/map\/base\.webp$/.test(f)),
    ];
    expect(backgrounds.length).toBeGreaterThan(25);
    const narrow = backgrounds.filter((f) => webpInfo(join(publicDir, f)).w < 1920);
    expect(narrow, 'уже 1920 px').toEqual([]);
    const squeezed = backgrounds.filter((f) => webpInfo(join(publicDir, f)).qindex > QINDEX_OF_Q76);
    expect(squeezed, 'пережаты (грубее q76)').toEqual([]);
  });

  /** Сам разбор заголовка держится на известных файлах: q76 даёт индекс 34, без потерь — qindex 0 (иначе тест выше слеп). */
  it('разбор заголовка WebP: фон Базы — 1920 px, q76; слой формы — без потерь', () => {
    const base = webpInfo(join(publicDir, artFiles.baseBgBase));
    expect(base).toMatchObject({ w: 1920, lossless: false, qindex: QINDEX_OF_Q76 });
    expect(webpInfo(join(publicDir, artFiles.kitZones))).toMatchObject({ w: 640, lossless: true });
  });

  /** Картинки волны 4 (067 Т9, К9): Путь клуба делится на ленивые уровни (К-Ж). */
  it('Двор грузит сразу только облака и кубок мира, уровни 2–6 — лениво', () => {
    // Ловит: уровень 2–6 попал в сразу-загружаемые — Двор тянет лишнее.
    for (const dir of ['album', 'school', 'learn', 'base']) {
      expect(filesUnder(`art/${dir}`).reduce((sum, f) => sum + size(f), 0), dir).toBeGreaterThan(0);
    }
    const pathAll = filesUnder('art/path');
    const eager = artPathEager.map((k) => artFiles[k]);
    const lazy = artPathLazy.map((k) => artFiles[k]);
    expect([...eager, ...lazy].sort()).toEqual([...pathAll].sort());
    // первый экран не растёт: сразу — не больше 0,2 МБ (облака, кубок), уровни 2–6 — в ленивой части
    expect(eager.reduce((sum, f) => sum + size(f), 0)).toBeLessThanOrEqual(0.2 * MB);
    expect(lazy).toEqual(expect.arrayContaining(['art/path/district.webp', 'art/path/city.webp']));
  });
});
