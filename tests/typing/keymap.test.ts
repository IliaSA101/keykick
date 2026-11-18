/**
 * Карта клавиатуры: каждая буква находится, у каждой клавиши свой палец по таблице
 * из docs/idea.md, засечки на месте, ошибки в файлах раскладок ловятся.
 */
import { describe, expect, it } from 'vitest';
import { keymap } from '../../src/engine/typing/layouts';
import { findChar, layoutsOf, parseKeymap, shiftFor, thumbAfter, type Finger } from '../../src/engine/typing/keymap';
import { weakKeys } from '../../src/engine/stats';

/**
 * Подготовка: из описания клавиш «по-старому» (код, палец, знаки ru и en на одной клавише) —
 * два файла раскладок, как в content/layouts, для parseKeymap.
 */
interface OldKey {
  code: string;
  finger: string;
  ru?: string[];
  en?: string[];
  label?: string;
  width?: number;
  bump?: boolean;
}
function layoutFiles(raw: { rows?: OldKey[][] }): Record<string, unknown> {
  const build = (lang: 'ru' | 'en') => ({
    id: `test-${lang}`,
    os: 'win',
    rows: (raw.rows ?? []).map((r) => r.map((k) => k.code)),
    keys: Object.fromEntries(
      (raw.rows ?? []).flatMap((r, row) =>
        r.map((k) => [
          k.code,
          {
            finger: k.finger,
            row,
            ...(k[lang] ? { ch: k[lang] } : {}),
            ...(k.label !== undefined ? { label: k.label } : {}),
            ...(k.width !== undefined ? { width: k.width } : {}),
            ...(k.bump ? { bump: true } : {}),
          },
        ]),
      ),
    ),
  });
  return { ru: build('ru'), en: build('en') };
}

const RU = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const EN = 'abcdefghijklmnopqrstuvwxyz';

// Таблица «Палец — клавиши» из docs/idea.md (ЙЦУКЕН).
const FINGERS: Record<Finger, string> = {
  lp: 'ё1йфя',
  lr: '2цыч',
  lm: '3увс',
  li: '45кеапми',
  ri: '67нгроть',
  rm: '8шлб',
  rr: '9щдю',
  rp: '0-=зхъжэ.',
  th: ' ',
};

describe('карта клавиатуры', () => {
  it('каждая буква обеих раскладок находится — строчная без Shift, заглавная с Shift', () => {
    for (const [layout, letters] of [['jcuken-win', RU], ['qwerty-win', EN]] as const) {
      for (const ch of letters) {
        expect(findChar(keymap, layout, ch)?.shift, ch).toBe(false);
        expect(findChar(keymap, layout, ch.toUpperCase())?.shift, ch.toUpperCase()).toBe(true);
      }
    }
  });

  it('пальцы — по таблице из docs/idea.md', () => {
    for (const [finger, keys] of Object.entries(FINGERS)) {
      for (const ch of keys) expect(findChar(keymap, 'jcuken-win', ch)?.key.finger, ch).toBe(finger);
    }
  });

  it('буква и её латинская пара — одна физическая клавиша', () => {
    expect(findChar(keymap, 'jcuken-win', 'а')?.key.code).toBe('KeyF');
    expect(findChar(keymap, 'qwerty-win', 'f')?.key.code).toBe('KeyF');
    expect(findChar(keymap, 'jcuken-win', 'ж')?.key.code).toBe('Semicolon');
    expect(findChar(keymap, 'jcuken-win', 'ё')?.key.code).toBe('Backquote');
  });

  it('засечки — только на А и О (F и J)', () => {
    const bumps = keymap.rows.flat().filter((k) => k.bump).map((k) => k.code);
    expect(bumps).toEqual(['KeyF', 'KeyJ']);
  });

  it('цифры — только верхний ряд; точка и запятая в русской раскладке — на одной клавише', () => {
    for (const d of '0123456789') expect(findChar(keymap, 'jcuken-win', d)?.key.code).toBe(`Digit${d}`);
    expect(findChar(keymap, 'jcuken-win', '.')).toMatchObject({ key: { code: 'Slash' }, shift: false });
    expect(findChar(keymap, 'jcuken-win', ',')).toMatchObject({ key: { code: 'Slash' }, shift: true });
  });

  it('раскладка символа и Shift другой руки', () => {
    expect(layoutsOf(keymap, 'ф')).toEqual(['jcuken-win']);
    expect(layoutsOf(keymap, 'f')).toEqual(['qwerty-win']);
    expect(layoutsOf(keymap, '5')).toEqual(['jcuken-win', 'qwerty-win']);
    expect(layoutsOf(keymap, '€')).toEqual([]);
    expect(shiftFor('li')).toBe('ShiftRight');
    expect(shiftFor('rp')).toBe('ShiftLeft');
  });

  it('пробел — большим пальцем другой руки; начало строки и неясное — правым', () => {
    for (const f of ['lp', 'lr', 'lm', 'li'] as const) expect(thumbAfter(f), f).toBe('right');
    for (const f of ['ri', 'rm', 'rr', 'rp'] as const) expect(thumbAfter(f), f).toBe('left');
    expect(thumbAfter('th')).toBe('right');
    expect(thumbAfter(undefined)).toBe('right');
  });

  it('служебные клавиши — с подписью и без символов', () => {
    const enter = keymap.byCode.get('Enter');
    expect(enter?.chars).toBeNull();
    expect(enter?.label).toBe('Enter');
    expect(keymap.byCode.get('Space')?.finger).toBe('th');
  });

  it('ошибки в файлах раскладок ловятся', () => {
    const key = { code: 'KeyA', finger: 'lp', ru: ['ф', 'Ф'], en: ['a', 'A'] };
    expect(parseKeymap(layoutFiles({ rows: [[key]] })).byCode.size).toBe(1);
    expect(() => parseKeymap(layoutFiles({}))).toThrow(/rows/);
    expect(() => parseKeymap(layoutFiles({ rows: [[key, key]] }))).toThrow(/duplicate/);
    expect(() => parseKeymap(layoutFiles({ rows: [[{ ...key, finger: 'toe' }]] }))).toThrow(/finger/);
    expect(() => parseKeymap(layoutFiles({ rows: [[key, { ...key, code: 'KeyB' }]] }))).toThrow(/two keys/);
    expect(() => parseKeymap(layoutFiles({ rows: [[{ ...key, ru: ['фы', 'Ф'] }]] }))).toThrow(/single/);
    expect(() => parseKeymap(layoutFiles({ rows: [[{ code: 'Tab', finger: 'lp' }]] }))).toThrow(/label/);
  });
});

describe('карта из нескольких файлов раскладок (060-Т8)', () => {
  const file = (id: string, a: string[], extra: Record<string, unknown> = {}) => ({
    id,
    os: 'win',
    rows: [['KeyA', 'Tab']],
    keys: { KeyA: { finger: 'lp', row: 0, ch: a, ...extra }, Tab: { finger: 'lp', row: 0, label: 'Tab' } },
  });

  it('раскладки в порядке сборки; знак ищется в своей раскладке, подпись — по главной', () => {
    const map = parseKeymap({ one: file('one', ['a', 'A']), two: file('two', ['ä', 'Ä']), three: file('three', ['å', 'Å']) });
    expect(map.layouts).toEqual(['one', 'two', 'three']);
    expect(findChar(map, 'three', 'Å')).toMatchObject({ shift: true, key: { code: 'KeyA' } });
    expect(findChar(map, 'one', 'ä')).toBeUndefined();
    expect(findChar(map, 'нет-такой', 'a')).toBeUndefined();
    expect(layoutsOf(map, 'ä')).toEqual(['two']);
    expect(map.byCode.get('KeyA')?.label).toBe('a');
  });

  // Ловит: раскладки с разными физическими клавишами или чужими пальцами, знаки только на части раскладок, пустой набор.
  it('разные ряды, палец, ширина, засечка, знаки не во всех раскладках, пустой набор — ошибка', () => {
    const ok = file('one', ['a', 'A']);
    expect(() => parseKeymap({})).toThrow(/layout/);
    expect(() => parseKeymap({ one: ok, two: { ...file('two', ['b', 'B']), rows: [['Tab', 'KeyA']] } })).toThrow(/rows differ/);
    expect(() => parseKeymap({ one: ok, two: file('two', ['b', 'B'], { finger: 'ri' }) })).toThrow(/differs/);
    expect(() => parseKeymap({ one: ok, two: file('two', ['b', 'B'], { width: 2 }) })).toThrow(/differs/);
    expect(() => parseKeymap({ one: ok, two: file('two', ['b', 'B'], { bump: true }) })).toThrow(/differs/);
    const noChars = file('two', ['b', 'B']);
    delete (noChars.keys.KeyA as { ch?: unknown }).ch;
    (noChars.keys.KeyA as { label?: string }).label = 'a';
    expect(() => parseKeymap({ one: ok, two: noChars })).toThrow(/not in every layout/);
    expect(parseKeymap({ one: ok, two: file('two', ['b', 'B']) }).byCode.size).toBe(2);
  });
});

describe('трудные клавиши для статистики', () => {
  it('больше ошибок — раньше, ничья — по коду, нули отброшены, подпись — символ раскладки', () => {
    const weak = weakKeys({ KeyF: 2, KeyJ: 5, KeyD: 2, KeyK: 0, Space: 1 }, keymap, 'jcuken-win', 4);
    expect(weak.map((w) => [w.label, w.errors])).toEqual([
      ['О', 5],
      ['В', 2],
      ['А', 2],
      // Слово «пробел» подставляет экран: в движке русских текстов нет.
      [' ', 1],
    ]);
  });

  it('пусто — пустой список; лимит соблюдается', () => {
    expect(weakKeys({}, keymap, 'jcuken-win')).toEqual([]);
    expect(weakKeys({ KeyA: 1, KeyS: 2, KeyD: 3 }, keymap, 'qwerty-win', 2).map((w) => w.label)).toEqual(['D', 'S']);
  });
});
