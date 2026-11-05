/**
 * Графика: каждый файл, на который ссылается код, лежит в public/,
 * и в public/art нет файлов, о которых код не знает (забытые генерации раздувают сайт).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artFiles } from '../src/art/assets';

const publicDir = join(import.meta.dirname, '..', 'public');

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
    const known = new Set<string>(Object.values(artFiles));
    const all = filesUnder('art');
    expect(all.length).toBeGreaterThan(2);
    const orphans = all.filter((f) => !known.has(f));
    expect(orphans).toEqual([]);
  });

  /** Размер картинки WebP без потерь (VP8L): ширина и высота — по 14 бит после подписи 0x2f. */
  function losslessSize(file: string): { w: number; h: number } | null {
    const b = readFileSync(join(publicDir, file));
    if (b.toString('ascii', 12, 16) !== 'VP8L' || b[20] !== 0x2f) return null;
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }

  it('у футболки, шорт, гетр и бутс — слои зон и теней: без потерь, квадрат 640 (спека 004)', () => {
    const files = new Set<string>(Object.values(artFiles));
    for (const item of ['base', 'back', 'shorts', 'socks', 'boots']) {
      for (const layer of ['zones', 'shade']) {
        const file = `art/kit/${item}-${layer}.webp`;
        expect(files.has(file), file).toBe(true);
        // Сжатие с потерями сдвинуло бы доли зон, и цвета поплыли бы по краям.
        expect(losslessSize(file), file).toEqual({ w: 640, h: 640 });
      }
    }
  });
});
