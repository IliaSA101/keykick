/**
 * Карта клавиатуры: каждая буква находится, у каждой клавиши свой палец по таблице
 * из docs/idea.md, засечки на месте, ошибки в keyboard.json ловятся.
 */
import { describe, expect, it } from 'vitest';
import { keymap } from '../src/app/keymap';
import { findChar, layoutsOf, parseKeymap, shiftFor, thumbAfter, type Finger } from '../src/engine/keymap';
import { weakKeys } from '../src/engine/stats';

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
    for (const [layout, letters] of [['ru', RU], ['en', EN]] as const) {
      for (const ch of letters) {
        expect(findChar(keymap, layout, ch)?.shift, ch).toBe(false);
        expect(findChar(keymap, layout, ch.toUpperCase())?.shift, ch.toUpperCase()).toBe(true);
      }
    }
  });

  it('пальцы — по таблице из docs/idea.md', () => {
    for (const [finger, keys] of Object.entries(FINGERS)) {
      for (const ch of keys) expect(findChar(keymap, 'ru', ch)?.key.finger, ch).toBe(finger);
    }
  });

  it('буква и её латинская пара — одна физическая клавиша', () => {
    expect(findChar(keymap, 'ru', 'а')?.key.code).toBe('KeyF');
    expect(findChar(keymap, 'en', 'f')?.key.code).toBe('KeyF');
    expect(findChar(keymap, 'ru', 'ж')?.key.code).toBe('Semicolon');
    expect(findChar(keymap, 'ru', 'ё')?.key.code).toBe('Backquote');
  });

  it('засечки — только на А и О (F и J)', () => {
    const bumps = keymap.rows.flat().filter((k) => k.bump).map((k) => k.code);
    expect(bumps).toEqual(['KeyF', 'KeyJ']);
  });

  it('цифры — только верхний ряд; точка и запятая в русской раскладке — на одной клавише', () => {
    for (const d of '0123456789') expect(findChar(keymap, 'ru', d)?.key.code).toBe(`Digit${d}`);
    expect(findChar(keymap, 'ru', '.')).toMatchObject({ key: { code: 'Slash' }, shift: false });
    expect(findChar(keymap, 'ru', ',')).toMatchObject({ key: { code: 'Slash' }, shift: true });
  });

  it('раскладка символа и Shift другой руки', () => {
    expect(layoutsOf(keymap, 'ф')).toEqual(['ru']);
    expect(layoutsOf(keymap, 'f')).toEqual(['en']);
    expect(layoutsOf(keymap, '5')).toEqual(['ru', 'en']);
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

  it('ошибки в keyboard.json ловятся', () => {
    const key = { code: 'KeyA', finger: 'lp', ru: ['ф', 'Ф'], en: ['a', 'A'] };
    expect(parseKeymap({ rows: [[key]] }).byCode.size).toBe(1);
    expect(() => parseKeymap({})).toThrow(/rows/);
    expect(() => parseKeymap({ rows: [[key, key]] })).toThrow(/duplicate/);
    expect(() => parseKeymap({ rows: [[{ ...key, finger: 'toe' }]] })).toThrow(/finger/);
    expect(() => parseKeymap({ rows: [[key, { ...key, code: 'KeyB' }]] })).toThrow(/two keys/);
    expect(() => parseKeymap({ rows: [[{ ...key, ru: ['фы', 'Ф'] }]] })).toThrow(/single/);
    expect(() => parseKeymap({ rows: [[{ code: 'Tab', finger: 'lp' }]] })).toThrow(/label/);
  });
});

describe('трудные клавиши для статистики', () => {
  it('больше ошибок — раньше, ничья — по коду, нули отброшены, подпись — символ раскладки', () => {
    const weak = weakKeys({ KeyF: 2, KeyJ: 5, KeyD: 2, KeyK: 0, Space: 1 }, keymap, 'ru', 4);
    expect(weak.map((w) => [w.label, w.errors])).toEqual([
      ['О', 5],
      ['В', 2],
      ['А', 2],
      // Слово «пробел» подставляет экран: в движке русских текстов нет.
      [' ', 1],
    ]);
  });

  it('пусто — пустой список; лимит соблюдается', () => {
    expect(weakKeys({}, keymap, 'ru')).toEqual([]);
    expect(weakKeys({ KeyA: 1, KeyS: 2, KeyD: 3 }, keymap, 'en', 2).map((w) => w.label)).toEqual(['D', 'S']);
  });
});
