/**
 * Разминка перед таймом : удары-блоки строк — буква, другая буква, пары;
 * повторяемость по зерну. Блок вынесен из lessons.test.ts (спека 009, Т1), кейсы те же.
 */
import { describe, expect, it } from 'vitest';
import { lessons } from '../src/app/lessons';
import {
  WARMUP_LETTERS,
  WARMUP_MAX_CHARS,
  WARMUP_PAIRS,
  WARMUP_WIDTH,
  makeWarmup,
  materials,
  warmupPlan,
  type Lesson,
} from '../src/engine/lessons';

const lesson = (id: string): Lesson => {
  const l = lessons.find((x) => x.id === id);
  if (!l) throw new Error(`no lesson ${id}`);
  return l;
};

const atLeast = (l: Lesson, m: (typeof materials)[number]): boolean =>
  materials.indexOf(l.material) >= materials.indexOf(m);

describe('разминка', () => {
  /** Буквы, которые урок разминает: новые (с фокусом — для пар); без новых — фокус; без фокуса — основной ряд. */
  const warmKeys = (l: Lesson): string => (l.newKeys ? l.newKeys + l.focus : l.focus || 'фываолдж');

  it('удары-блоки: буква, другая буква, пары — если они есть в тайме; строк 2 → 3', () => {
    const a = Array(15).fill('а').join(' ');
    const o = Array(15).fill('о').join(' ');
    expect(makeWarmup(lesson('yard-1'), 1)).toEqual([
      [a, a],
      [o, o, o],
    ]);
    // Строка разминки — 15 букв, длиннее (04.11): буквы — 29 знаков, пары — 14 букв, 20 знаков.
    expect(2 * WARMUP_LETTERS - 1).toBe(29);
    expect(3 * WARMUP_PAIRS - 1).toBe(20);
    expect(WARMUP_WIDTH).toBe(29);
    for (const l of lessons) {
      const warm = makeWarmup(l, 7);
      const rows = warm.map((kick) => kick.length);
      expect(warm.length, l.id).toBeGreaterThanOrEqual(2);
      expect(warm.length, l.id).toBeLessThanOrEqual(3);
      for (let i = 1; i < rows.length; i++) expect(rows[i], l.id).toBeGreaterThanOrEqual(rows[i - 1] ?? 0);
      expect(rows[0], l.id).toBe(2);
      expect(rows.at(-1), l.id).toBe(3);
      // Удар пар — только у урока, где пары есть в тайме.
      const kinds = warmupPlan(l).map((k) => k.kind);
      expect(kinds.includes('pairs'), l.id).toBe(atLeast(l, 'pairs'));
      for (const [k, kick] of warm.entries()) {
        const width = kinds[k] === 'pairs' ? 3 * WARMUP_PAIRS - 1 : 2 * WARMUP_LETTERS - 1;
        for (const line of kick) expect(line.length, `${l.id} ${line}`).toBe(width);
      }
      for (const line of warm.flat()) expect(line.length, l.id).toBeLessThanOrEqual(WARMUP_WIDTH);
      const all = warm.flat().join('');
      // Самая короткая разминка — 2 строки букв и 3 строки пар: 2 · 29 + 3 · 20 = 118 знаков.
      expect(all.length, l.id).toBeGreaterThanOrEqual(118);
      expect(all.length, l.id).toBeLessThanOrEqual(WARMUP_MAX_CHARS);
    }
  });

  it('строки — одиночные буквы или пары двух разных букв через пробел; буквы — только разминаемые', () => {
    for (const l of lessons) {
      const warm = makeWarmup(l, 7);
      for (const [k, kick] of warm.entries()) {
        const plan = warmupPlan(l)[k];
        if (!plan) throw new Error(`${l.id}: no kick ${k}`);
        for (const line of kick) {
          const parts = line.split(' ');
          if (plan.kind === 'letters') {
            expect(line, l.id).toMatch(/^\S( \S)*$/);
            expect(parts.length, l.id).toBe(WARMUP_LETTERS);
            // Одна буква дважды подряд — только если в ударе она одна.
            if (plan.letters.length > 1) for (let i = 1; i < parts.length; i++) expect(parts[i]).not.toBe(parts[i - 1]);
          } else {
            expect(line, l.id).toMatch(/^\S\S( \S\S)*$/);
            expect(parts.length, l.id).toBe(WARMUP_PAIRS);
            for (const [i, p] of parts.entries()) {
              expect(p[0], `${l.id} ${p}`).not.toBe(p[1]);
              if (i > 0) expect(p, l.id).not.toBe(parts[i - 1]);
              if (plan.pivot) expect(p, l.id).toContain(plan.pivot);
            }
          }
          for (const ch of line.replaceAll(' ', '')) {
            expect(plan.letters, l.id).toContain(ch);
            expect(warmKeys(l), l.id).toContain(ch);
          }
        }
        // Каждая буква удара встречается в его блоке хоть раз.
        for (const ch of plan.letters) expect(kick.join(''), `${l.id} ${ch}`).toContain(ch);
      }
      // Каждая новая буква урока — в разминке.
      for (const ch of l.newKeys) expect(warm.flat().join(''), l.id).toContain(ch);
    }
  });

  it('план: две новые — удар на букву и пары (без пар в тайме — вторая буква в 3 строки); одна — удар и пары с фокусом; без новых — фокус', () => {
    const plan = (id: string): string[] =>
      warmupPlan(lesson(id)).map((k) => `${k.kind}:${k.letters}:${k.rows}${k.pivot ? `:${k.pivot}` : ''}`);
    expect(plan('yard-1')).toEqual(['letters:а:2', 'letters:о:3']);
    expect(plan('yard-2')).toEqual(['letters:в:2', 'letters:л:3']);
    expect(plan('yard-3')).toEqual(['letters:ы:2', 'letters:д:2', 'pairs:ыд:3']);
    expect(plan('district-1')).toEqual(['letters:к:2', 'letters:г:2', 'pairs:кг:3']);
    expect(plan('yard-7')).toEqual(['letters:э:2', 'pairs:эж:3:э']);
    expect(plan('city-6')).toEqual(['letters:я:2', 'pairs:яф:3:я']);
    // Точка (009): удар «. . .» и пары с фокусом «.ж», «ю.».
    expect(plan('city-dot')).toEqual(['letters:.:2', 'pairs:.жю:3:.']);
    // «Мизинцы»: правый мизинец, потом левый, потом пары всех семи букв.
    expect(plan('city-pinky')).toEqual(['letters:зжэх:2', 'letters:йфя:2', 'pairs:зжэхйфя:3']);
    expect(plan('yard-8')).toEqual(['letters:п:2', 'letters:р:2', 'pairs:пр:3']);
    expect(plan('yard-9')).toEqual(['letters:фыва:2', 'letters:олдж:2', 'pairs:фываолдж:3']);
    expect(plan('yard-10')).toEqual(['letters:фыва:2', 'letters:олдж:2', 'pairs:фываолдж:3']);
    expect(plan('district-9')).toEqual(['letters:йцукен:2', 'letters:гшщзх:2', 'pairs:йцукенгшщзх:3']);
  });

  it('одно зерно — та же разминка; другое зерно — другие строки, где есть из чего выбрать', () => {
    for (const l of lessons) expect(makeWarmup(l, 42), l.id).toEqual(makeWarmup(l, 42));
    const l = lesson('yard-9');
    const seen = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) seen.add(JSON.stringify(makeWarmup(l, seed)));
    expect(seen.size).toBeGreaterThan(5);
  });
});
