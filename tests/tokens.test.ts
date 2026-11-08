/**
 * Токены цвета: одна «вечерняя» палитра (019-Р7, ТЗ-0.15 в прочтении 04.11).
 * Тест читает tokens.css как есть, поэтому правка цвета без оглядки на контраст его заденет.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');

/** Первый блок `:root { … }` — объявления `--имя: значение;` (комментарии убраны). */
function rootTokens(): Map<string, string> {
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1];
  if (!block) throw new Error('в tokens.css нет блока :root');
  const tokens = new Map<string, string>();
  for (const m of block.matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)) tokens.set(m[1] ?? '', (m[2] ?? '').trim());
  return tokens;
}

const tokens = rootTokens();

function hex(name: string): number[] {
  let value = tokens.get(name);
  const ref = value && /^var\((--[\w-]+)\)$/.exec(value);
  if (ref) value = tokens.get(ref[1] ?? '');
  const m = value && /^#([0-9a-f]{6})$/i.exec(value);
  if (!m?.[1]) throw new Error(`токен ${name} — не цвет #rrggbb: ${value ?? 'нет такого'}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(name: string): number {
  const [r = 0, g = 0, b = 0] = hex(name).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контраст двух токенов по WCAG: (L1 + 0,05) / (L2 + 0,05), светлый в числителе. */
function contrast(a: string, b: string): number {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

describe('токены: контраст одной палитры', () => {
  // Ловит: текст или ошибка на фоне/поверхности стали нечитаемыми (порог 4,5)
  it.each([
    ['--text', '--bg'],
    ['--text', '--surface'],
    ['--text-muted', '--bg'],
    ['--text-muted', '--surface'],
    ['--error', '--bg'],
    ['--error', '--surface'],
  ])('%s на %s — не меньше 4,5', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  // Ловит: акцент (рамка фокуса, крупные элементы) сливается с фоном
  it('--accent на --bg — не меньше 3', () => {
    expect(contrast('--accent', '--bg')).toBeGreaterThanOrEqual(3);
  });

  // Ловит: подписи карты тонут в земле карты
  it('--map-label на --map-ground — не меньше 4,5', () => {
    expect(contrast('--map-label', '--map-ground')).toBeGreaterThanOrEqual(4.5);
  });

  // Ловит: точки, флаг и тропа карты сливаются с землёй (графика — порог 3)
  it.each(['--map-path', '--map-point', '--map-point-done', '--map-current', '--map-flag'])(
    '%s на --map-ground — не меньше 3',
    (fg) => {
      expect(contrast(fg, '--map-ground')).toBeGreaterThanOrEqual(3);
    },
  );

  // Ловит: рамка поля города вернулась к --border (1,81 к --surface) — поле не видно
  it('--field-border на --surface — не меньше 3', () => {
    expect(contrast('--field-border', '--surface')).toBeGreaterThanOrEqual(3);
  });

  // Ловит: счёт контраста врёт (одинаковые = 1, белое на тёмном > 15) — тесты выше молчали бы всегда
  it('формула контраста: цвет на себе — 1, белое на тёмном — больше 15', () => {
    expect(contrast('--paper', '--paper')).toBeCloseTo(1, 5);
    expect(contrast('--paper', '--on-zone')).toBeGreaterThan(15);
  });

  // Ловит: токен карты пропал или стал не цветом — тесты выше упали бы с невнятным сообщением
  it('токены карты объявлены', () => {
    const names = [
      '--map-ground',
      '--map-path',
      '--map-point',
      '--map-point-done',
      '--map-current',
      '--map-flag',
      '--map-label',
      '--field-border',
    ];
    for (const name of names) expect(tokens.has(name), name).toBe(true);
    expect(tokens.get('--map-fog')).toMatch(/gradient/);
  });
});

describe('токены: второй палитры нет', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  const files = walk(join(root, 'src')).filter((p) => /\.(css|vue)$/.test(p));

  // Ловит: добавлена светлая/тёмная ветка по настройке ОС — экран перестал быть одним на всех
  it('в src/**/*.{css,vue} нет prefers-color-scheme', () => {
    expect(files.length).toBeGreaterThan(10); // страж видит файлы
    const bad = files.filter((p) => readFileSync(p, 'utf8').includes('prefers-color-scheme'));
    expect(bad.map((p) => relative(root, p).split(sep).join('/'))).toEqual([]);
  });

  // Ловит: из :root пропал color-scheme: dark — системные поля и полосы прокрутки станут светлыми
  it('у :root — color-scheme: dark', () => {
    expect(tokens.get('color-scheme')).toBe('dark');
  });
});
