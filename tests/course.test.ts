/**
 * Курс v2 (спека 016): лестница по настоящим файлам, модель победы и цепочка профилей по лестнице Двора.
 * Разбор схем контента и словарь — в `course-content.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { courseLessons, leagues } from '../src/app/course/load';
import { keymap } from '../src/app/keymap';
import { accuracyFor, winChance } from '../src/engine/course/odds';
import type { CourseLesson } from '../src/engine/course/model';

describe('лестница', () => {
  const yard = courseLessons.filter((x) => x.league === 'yard');
  const scoring = yard.filter((x) => !x.friendly);
  const a80 = (x: CourseLesson) => accuracyFor(x, 0.8);

  it('каркас: 6 лиг, 200 уроков, у full файл Двора на 32 урока, у frame файла нет (Район станет base со своей спекой)', () => {
    // Ловит: лига без файла уроков, лишний файл у каркаса, сумму уроков не 200, потерянный shiftFrom или игры лиг 2–6.
    expect(leagues.map((x) => x.id)).toEqual(['yard', 'district', 'city', 'country', 'europe', 'world']);
    expect(leagues.reduce((s, x) => s + x.lessons, 0)).toBe(200);
    expect(leagues.map((x) => x.lessons)).toEqual([32, 36, 30, 32, 40, 30]);
    expect(leagues.map((x) => x.depth)).toEqual(['full', 'frame', 'frame', 'frame', 'frame', 'frame']);
    for (const x of leagues.filter((l) => l.depth === 'frame')) {
      expect(courseLessons.filter((l) => l.league === x.id).length, x.id).toBe(0);
    }
    expect(yard).toHaveLength(32);
    expect(leagues.slice(1).every((x) => x.games !== undefined)).toBe(true);
    expect(leagues[0]!.games).toBeUndefined();
    expect(leagues.find((x) => x.id === 'country')?.shiftFrom).toBe(17);
    expect(leagues.every((x) => x.shiftFrom !== 1)).toBe(true);
    expect(leagues.at(-1)?.keys).toBe('');
  });

  it('цифровой ряд: знак без Shift и с Shift лежат в keys одной лиги, все клавиши ряда учтены', () => {
    // Ловит: клавиша ряда цифр, потерянная или разнесённая по лигам (ТЗ-1.11).
    const digitRow = keymap.rows.flat().filter((k) => k.code.startsWith('Digit'));
    expect(digitRow.length).toBe(10);
    for (const k of digitRow) {
      const owners = leagues.filter((x) => (k.chars?.ru ?? []).some((ch) => x.keys.includes(ch)));
      expect(owners.length, k.code).toBe(1);
      for (const ch of k.chars?.ru ?? []) expect(owners[0]!.keys, k.code).toContain(ch);
    }
  });

  it('буквы Двора — основной ряд и Э; ни одна клавиша не сидит в двух лигах', () => {
    // Ловит: буква Двора не из основного ряда или клавиша, засевшая сразу в двух слоях лиг.
    expect([...leagues[0]!.keys].sort().join('')).toBe([...'фывапролджэ'].sort().join(''));
    const all = leagues.flatMap((x) => [...x.keys]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('уроки: id по порядку, товарищеские 1/3/6/10/15/19/27, контрольные 14 и 21, фокус и особое', () => {
    // Ловит: сбитую нумерацию (id хранит сохранение), потерянные флаги, фокус 12 и noWords 30 (ТЗ-2.1).
    expect(yard.map((x) => x.id)).toEqual(Array.from({ length: 32 }, (_, i) => `yard-${String(i + 1).padStart(2, '0')}`));
    expect(yard.filter((x) => x.friendly).map((x) => x.n)).toEqual([1, 3, 6, 10, 15, 19, 27]);
    expect(yard.filter((x) => x.control).map((x) => x.n)).toEqual([14, 21]);
    expect(yard[11]!.focus).toBe('фж');
    expect(yard[29]).toMatchObject({ noWords: true, focusWeak: 3 });
    expect(yard[0]!.trap).toBe(true);
    expect(yard.filter((x) => x.chants).map((x) => x.n)).toEqual([31, 32]);
    expect(yard.every((x) => x.tips.length >= 1)).toBe(true);
    expect(yard.every((x) => x.rowWidth === 29 && x.ladder.length === x.attacks.length && x.ladder.length > 0)).toBe(true);
  });

  it('матч каждого урока — в полосе своей ступени (ТЗ-2.14); итог 13 302 знака', () => {
    // Ловит: разминку или атаки, выведенные из полосы длины; разъезд с таблицей design §2.
    const total = yard.reduce((s, x) => s + x.warmup + 2 * x.attacks.reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(13302);
    const band = (stage: number) => (stage <= 4 ? [270, 345] : stage <= 8 ? [420, 534] : [570, 620]);
    for (const x of yard) {
      const m = x.warmup + 2 * x.attacks.reduce((a, b) => a + b, 0);
      expect(m, x.id).toBeGreaterThanOrEqual(band(x.stage)[0]!);
      expect(m, x.id).toBeLessThanOrEqual(band(x.stage)[1]!);
    }
  });

  it('A80 не убывает: урок 1 — 89,1 ± 0,2, урок 16 — 92,9 ± 0,2, урок 32 — 95,8 ± 0,2', () => {
    // Ловит: ступеньку вниз по строгости и сдвиг краёв лестницы (числа ТЗ-2.1).
    const a = yard.map((x) => a80(x) * 100);
    for (let i = 1; i < a.length; i++) expect(a[i]!, yard[i]!.id).toBeGreaterThanOrEqual(a[i - 1]! - 1e-9);
    expect(Math.abs(a[0]! - 89.1)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(a[15]! - 92.9)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(a[31]! - 95.8)).toBeLessThanOrEqual(0.2);
  });

  it('товарищеский — ровно у урока с новыми буквами или строкой больше; следующий за ним — та же строгость', () => {
    // Ловит: товарищеский, не готовящий следующий урок, лишний или пропущенный товарищеский (ТЗ-2.1, ТЗ-2.2).
    yard.forEach((x, i) => {
      if (x.friendly) {
        const next = yard[i + 1]!;
        expect([next.attacks, next.g, next.c], x.id).toEqual([x.attacks, x.g, x.c]);
      }
      const prev = yard[i - 1];
      expect(x.friendly, x.id).toBe(x.newKeys !== '' || (prev !== undefined && x.rows > prev.rows));
    });
  });

  it('атака растёт не больше чем на 3 знака на строку от урока к уроку', () => {
    // Ловит: резкий скачок длины, который ребёнок почувствует как стену.
    for (let i = 1; i < yard.length; i++) {
      const [a, b] = [yard[i - 1]!, yard[i]!];
      b.attacks.forEach((len, k) => expect(len / b.rows - a.attacks[k]! / a.rows, `${b.id} #${k}`).toBeLessThanOrEqual(3));
    }
  });

  it('три профиля на файле: средний (A80 прошлого) ≥ 0,70 и 0,70–0,85 на 2–9; точный 98 % ≥ 0,99; слабый (A50) ≥ 0,35', () => {
    // Ловит: скачок строгости, стену для слабого и уроки, где проигрывает даже аккуратный ребёнок (design §6).
    scoring.slice(1).forEach((x, i) => {
      const prev = scoring[i]!;
      const mid = winChance(x, accuracyFor(prev, 0.8));
      expect(mid, x.id).toBeGreaterThanOrEqual(0.7);
      if (x.n >= 2 && x.n <= 9) expect(mid, x.id).toBeLessThanOrEqual(0.85);
      expect(winChance(x, accuracyFor(prev, 0.5)), x.id).toBeGreaterThanOrEqual(0.35);
    });
    for (const x of scoring) expect(winChance(x, 0.98), x.id).toBeGreaterThanOrEqual(0.99);
  });
});

// --- фикстуры ---------------------------------------------------------------------------------------------

describe('модель победы: winChance и accuracyFor', () => {
  const lessons = courseLessons.filter((x) => x.league === 'yard');
  const a80 = (x: CourseLesson) => accuracyFor(x, 0.8);

  it('A80 на уроках 1, 16, 31 совпадает с таблицей design §2 с точностью 0,1 п. п.', () => {
    // Ловит: расхождение с моделью 011 — не тот знак, g/c или хвост распределения (A80 = 89,1 / 92,9 / 95,8).
    expect(a80(lessons[0]!) * 100).toBeCloseTo(89.1, 0);
    expect(Math.abs(a80(lessons[0]!) * 100 - 89.1)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(a80(lessons[15]!) * 100 - 92.9)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(a80(lessons[30]!) * 100 - 95.8)).toBeLessThanOrEqual(0.1);
  });

  it('winChance и accuracyFor взаимно обратны; точность растёт — победа не убывает', () => {
    // Ловит: нарушенную монотонность (бисекция уйдёт не туда) и подмену accuracy на p.
    const x = lessons[15]!;
    expect(winChance(x, accuracyFor(x, 0.8))).toBeCloseTo(0.8, 4);
    expect(winChance(x, accuracyFor(x, 0.5))).toBeCloseTo(0.5, 4);
    let prev = 0;
    for (const acc of [0.8, 0.85, 0.9, 0.95, 0.99, 1]) {
      const w = winChance(x, acc);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
    expect(winChance(x, 1)).toBeCloseTo(1, 10);
  });

  it('безошибочный матч — победа; почти без попаданий — почти ноль; одна атака в тайме сходится с ручной формулой', () => {
    // Ловит: поломку краёв — гол при 0 ошибок не засчитывается или вероятности не сходятся в 1.
    const tiny = { attacks: [10], g: 1, c: 3 };
    expect(winChance(tiny, 1)).toBe(1);
    expect(winChance(tiny, 0.2)).toBeLessThan(0.05);
    const p = 0.1;
    const goal = Math.pow(1 - p, 10) + 10 * p * Math.pow(1 - p, 10); // ≤ 1 ошибки на 10 знаков
    // Две атаки в одном матче (по одной в тайме): победа = (гол, гол) или (гол, сейв) или (сейв, гол).
    const pc = 1 - (Math.pow(0.9, 10) + 10 * 0.1 * Math.pow(0.9, 10) + 55 * 0.01 * Math.pow(0.9, 10));
    const save = 1 - goal - pc;
    expect(winChance(tiny, 1 - p)).toBeCloseTo(goal * goal + 2 * goal * save, 10);
  });
});

// --- цепочка трёх профилей --------------------------------------------------------------------------------

describe('цепочка A80 / 98 % / A50 по лестнице Двора (design §6): настоящие уроки', () => {
  const lessons = courseLessons.filter((x) => x.league === 'yard');
  const scoring = lessons.filter((x) => !x.friendly);
  const a80 = (x: CourseLesson) => accuracyFor(x, 0.8);

  // Точность предыдущего зачётного урока в цепочке; у первого предка нет.
  const withPrev = (chance: number) =>
    scoring.slice(1).map((x) => ({ x, prev: scoring[scoring.indexOf(x) - 1]!, ref: accuracyFor(scoring[scoring.indexOf(x) - 1]!, chance) }));

  it('средний (A80 прошлого): победа с первой ≥ 0,70 на каждом зачётном; на уроках 2–9 ещё и ≤ 0,85', () => {
    // Ловит: скачок строгости — урок, на котором ребёнок «на своём уровне» проигрывает чаще, чем в 30 % матчей; или слишком лёгкий.
    for (const { x, ref } of withPrev(0.8)) {
      const p1 = winChance(x, ref);
      expect(p1, x.id).toBeGreaterThanOrEqual(0.7);
      if (x.n >= 2 && x.n <= 9) expect(p1, x.id).toBeLessThanOrEqual(0.85);
    }
  });

  it('средний растёт на 0,3 п. п. за урок: среднее с первой на уроках 10–32 ≥ 0,8', () => {
    // Ловит: лестница, которая не учитывает рост ребёнка и остаётся слишком жёсткой на всём курсе.
    const ps: number[] = [];
    let ref = a80(scoring[0]!);
    let refN = scoring[0]!.n;
    for (const x of scoring.slice(1)) {
      if (x.n >= 10) ps.push(winChance(x, Math.min(0.995, ref + 0.003 * (x.n - refN))));
      ref = a80(x);
      refN = x.n;
    }
    expect(ps.length).toBeGreaterThan(15);
    expect(ps.reduce((s, v) => s + v, 0) / ps.length).toBeGreaterThanOrEqual(0.8);
  });

  it('точный (98 %): победа ≥ 0,99 на каждом зачётном уроке', () => {
    // Ловит: уроки, на которых проигрывает даже аккуратный ребёнок.
    for (const x of scoring) expect(winChance(x, 0.98), x.id).toBeGreaterThanOrEqual(0.99);
  });

  it('слабый (A50 прошлого): победа ≥ 0,35 на каждом зачётном уроке', () => {
    // Ловит: стену для слабого — урок, после которого шансы упираются в ноль.
    for (const { x, ref } of withPrev(0.5)) expect(winChance(x, ref), x.id).toBeGreaterThanOrEqual(0.35);
  });

  it('A80 не убывает по лестнице; урока 1 — 89,1 ± 0,2, урока 32 — 95,8 ± 0,2', () => {
    // Ловит: ступенька вниз по строгости и сдвиг краёв лестницы (числа ТЗ-2.1).
    const a = lessons.map((x) => a80(x) * 100);
    for (let i = 1; i < a.length; i++) expect(a[i]!, lessons[i]!.id).toBeGreaterThanOrEqual(a[i - 1]! - 1e-9);
    expect(Math.abs(a[0]! - 89.1)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(a[31]! - 95.8)).toBeLessThanOrEqual(0.2);
  });

  it('урок после товарищеского — те же attacks, g, c; товарищеский — у новых букв или бо́льшего числа строк', () => {
    // Ловит: товарищеский, который не готовит следующий урок, или лишний/пропущенный товарищеский (ТЗ-2.1, ТЗ-2.2).
    lessons.forEach((x, i) => {
      if (x.friendly) {
        const next = lessons[i + 1]!;
        expect([next.attacks, next.g, next.c], x.id).toEqual([x.attacks, x.g, x.c]);
      }
      const prev = lessons[i - 1];
      const fresh = x.newKeys !== '' || (prev !== undefined && x.rows > prev.rows);
      expect(x.friendly, x.id).toBe(fresh);
    });
  });

  it('атака растёт не больше чем на 3 знака на строку от урока к уроку', () => {
    // Ловит: резкий скачок длины, который ребёнок почувствует как стену.
    for (let i = 1; i < lessons.length; i++) {
      const [a, b] = [lessons[i - 1]!, lessons[i]!];
      b.attacks.forEach((len, k) => expect(len / b.rows - a.attacks[k]! / a.rows, `${b.id} #${k}`).toBeLessThanOrEqual(3));
    }
  });
});

// --- словарь (016-Т3) -------------------------------------------------------------------------------------
