/**
 * Уроки и генератор упражнений: строки только из букв урока, нужной длины, повторяемы
 * по зерну; клавиши с ошибками и новые клавиши урока выпадают чаще.
 * Лесенка атак до потолка урока; разминка — warmup.test.ts.
 * Снимок генератора (009-Р8) держит точные строки: разрез модуля и новые уроки их не меняют.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { keymap } from '../src/app/keymap';
import { lessons, wordsRu } from '../src/app/lessons';
import {
  HALF_LINES,
  LINE_MAX,
  LINE_MIN,
  LINE_RANGES,
  TRAP_FROM,
  TRAP_TO,
  attackPlan,
  makeHalf,
  makeWarmup,
  materials,
  parseLessons,
  parseWords,
  tipAt,
  type Lesson,
} from '../src/engine/lessons';
import { emptyStats, type TypingStats } from '../src/engine/typing';

const lesson = (id: string): Lesson => {
  const l = lessons.find((x) => x.id === id);
  if (!l) throw new Error(`no lesson ${id}`);
  return l;
};

/** Доля буквы среди всех букв таймов с зёрнами 1…n. */
function share(l: Lesson, ch: string, stats?: TypingStats, n = 40): number {
  let hits = 0;
  let total = 0;
  for (let seed = 1; seed <= n; seed++) {
    for (const line of makeHalf(l, wordsRu, keymap, seed, stats)) {
      for (const c of line.replaceAll(' ', '')) {
        total++;
        if (c === ch) hits++;
      }
    }
  }
  return hits / total;
}

/**
 * Лиги уроков по порядку: каждая проходит свой ряд русской раскладки. numbered — уроки со старыми
 * id `лига-N` (до 007); вставки 007 — со своими id по роли. Ъ в районе нет (журнал 04.11, 007).
 */
const LEAGUES = [
  { league: 'yard', count: 12, numbered: 12, row: 'фывапролджэ' },
  { league: 'district', count: 12, numbered: 12, row: 'йцукенгшщзх' },
  { league: 'city', count: 13, numbered: 10, row: 'ячсмитьбю.' },
] as const;

const sorted = (s: string): string => [...new Set(s)].sort().join('');
const atLeast = (l: Lesson, m: (typeof materials)[number]): boolean =>
  materials.indexOf(l.material) >= materials.indexOf(m);

describe('уроки', () => {
  // Правило поменяно по спеке 007 (К5), а не ослаблено: урок хранится по id, вставки получают id по роли,
  // а старые `лига-N` — те же и в прежнем порядке (рекорды, вехи и адреса &lesson= не переезжают).
  it('лиги идут по порядку: двор, район, город; id уникальны, начинаются с лиги, старые `лига-N` — в прежнем порядке', () => {
    expect([...new Set(lessons.map((l) => l.league))]).toEqual(LEAGUES.map((x) => x.league));
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    let start = 0;
    for (const { league, count, numbered } of LEAGUES) {
      const block = lessons.slice(start, start + count);
      for (const l of block) {
        expect(l.league, l.id).toBe(league);
        expect(l.id.startsWith(`${league}-`), l.id).toBe(true);
      }
      const old = block.map((l) => l.id).filter((id) => new RegExp(`^${league}-\\d+$`).test(id));
      expect(old).toEqual(Array.from({ length: numbered }, (_, i) => `${league}-${i + 1}`));
      start += count;
    }
    expect(start).toBe(lessons.length);
    // Город 007: закрепление «Слова с С, Б, Ч, Ю» после Ч и Ю, «Мизинцы» — после Я; точка (009) — после Я.
    const city = lessons.filter((l) => l.league === 'city').map((l) => l.id);
    expect(city.join(' ')).toBe('city-1 city-2 city-3 city-4 city-5 city-words-b city-6 city-dot city-pinky city-7 city-8 city-9 city-10');
  });

  it('Ъ нет ни в одном уроке: ни в буквах, ни в фокусе (007)', () => {
    for (const l of lessons) {
      expect(l.keys, l.id).not.toContain('ъ');
      expect(l.focus, l.id).not.toContain('ъ');
    }
    expect(lesson('district-8')).toMatchObject({ newKeys: 'х', focus: 'хж' });
  });

  it('каждая лига — свой ряд, по 1–2 новые буквы; остальные буквы урока уже пройдены', () => {
    expect(lessons[0]?.keys).toBe('ао');
    let known = '';
    for (const { league, row } of LEAGUES) {
      let fresh = '';
      for (const l of lessons.filter((x) => x.league === league)) {
        expect(l.newKeys.length, l.id).toBeLessThanOrEqual(2);
        for (const ch of l.newKeys) expect(known, l.id).not.toContain(ch);
        for (const ch of l.keys) if (!l.newKeys.includes(ch)) expect(known, l.id).toContain(ch);
        known += l.newKeys;
        fresh += l.newKeys;
        for (const t of l.tips) expect(t, l.id).not.toBe('');
        expect(l.tips.length, l.id).toBeGreaterThan(0);
      }
      expect(sorted(fresh), league).toBe(sorted(row));
    }
  });

  it('у каждого урока новые буквы или закрепление; буквы урока — все прежние и новые', () => {
    for (const [i, l] of lessons.entries()) {
      const prev = lessons[i - 1];
      for (const ch of l.newKeys) expect(l.keys, l.id).toContain(ch);
      if (prev) for (const ch of prev.keys) expect(l.keys, l.id).toContain(ch);
      if (prev) expect(sorted(l.keys), l.id).toBe(sorted(prev.keys + l.newKeys));
      // Закрепление — не разминка одних букв: хотя бы сочетания.
      if (l.newKeys === '') expect(atLeast(l, 'combos'), l.id).toBe(true);
    }
  });

  it('лига кончается финалом с соперником; до него — хотя бы два закрепления словами', () => {
    for (const { league } of LEAGUES) {
      const list = lessons.filter((l) => l.league === league);
      const final = list.at(-1);
      expect(final?.newKeys, league).toBe('');
      expect(final?.material, league).toBe('phrases');
      expect(final?.rival, league).toBeTruthy();
      const drills = list.slice(0, -1).filter((l) => l.newKeys === '' && atLeast(l, 'words'));
      expect(drills.length, league).toBeGreaterThanOrEqual(2);
    }
  });

  it('потолок материала не падает от урока к уроку; уроки 1–2 — буквы, 3–4 — пары, сочетания — с 5-го', () => {
    const yard = lessons.filter((l) => l.league === 'yard');
    const rank = (l: Lesson) => materials.indexOf(l.material);
    for (let i = 1; i < yard.length; i++) {
      const [prev, cur] = [yard[i - 1], yard[i]];
      if (prev && cur) expect(rank(cur), cur.id).toBeGreaterThanOrEqual(rank(prev));
    }
    expect(yard.slice(0, 5).map((l) => l.material)).toEqual(['letters', 'letters', 'pairs', 'pairs', 'combos']);
  });

  it('ошибки в lessons.json и words.json ловятся', () => {
    const ok = {
      id: 'a',
      league: 'yard',
      name: 'Урок',
      layout: 'ru',
      keys: 'фыва',
      newKeys: 'ф',
      focus: 'ф',
      material: 'pairs',
      tip: 'Совет',
    };
    expect(parseLessons({ lessons: [ok] }, keymap)).toHaveLength(1);
    expect(parseLessons({ lessons: [{ ...ok, rival: 'Фыва' }] }, keymap)[0]?.rival).toBe('Фыва');
    expect(() => parseLessons({ lessons: [{ ...ok, newKeys: 'о' }] }, keymap)).toThrow(/newKeys/);
    expect(() => parseLessons({ lessons: [{ ...ok, material: 'texts' }] }, keymap)).toThrow(/material/);
    expect(() => parseLessons({ lessons: [{ ...ok, tip: '' }] }, keymap)).toThrow(/tip/);
    // Совет — строка или список строк по очереди; пустой список, пустая строка в нём, не строка — ошибка.
    expect(parseLessons({ lessons: [ok] }, keymap)[0]?.tips).toEqual(['Совет']);
    expect(parseLessons({ lessons: [{ ...ok, tip: ['Раз', 'Два'] }] }, keymap)[0]?.tips).toEqual(['Раз', 'Два']);
    for (const tip of [[], ['Раз', ''], ['Раз', 2], undefined, 5]) {
      expect(() => parseLessons({ lessons: [{ ...ok, tip }] }, keymap), JSON.stringify(tip)).toThrow(/tip/);
    }
    expect(() => parseLessons({ lessons: [{ ...ok, rival: '' }] }, keymap)).toThrow(/rival/);
    expect(() => parseLessons({}, keymap)).toThrow(/lessons/);
    expect(() => parseLessons({ lessons: [ok, ok] }, keymap)).toThrow(/duplicate/);
    expect(() => parseLessons({ lessons: [{ ...ok, keys: 'фыf' }] }, keymap)).toThrow(/not on the ru/);
    expect(() => parseLessons({ lessons: [{ ...ok, focus: 'о' }] }, keymap)).toThrow(/focus/);
    expect(() => parseLessons({ lessons: [{ ...ok, layout: 'de' }] }, keymap)).toThrow(/layout/);
    expect(parseWords({ ru: ['вода'] }, keymap, 'ru')).toEqual(['вода']);
    expect(() => parseWords({ ru: ['Вода'] }, keymap, 'ru')).toThrow(/lowercase/);
    expect(() => parseWords({ ru: ['voda'] }, keymap, 'ru')).toThrow(/lowercase/);
    // Только строчные буквы (\p{Ll}): «вода.» в словаре дало бы «..» в строке с точкой (009).
    expect(() => parseWords({ ru: ['вода.'] }, keymap, 'ru')).toThrow(/lowercase/);
    expect(() => parseWords({ ru: ['вода', 'вода'] }, keymap, 'ru')).toThrow(/duplicate/);
  });
});

describe('советы тренера', () => {
  it('по кругу от матча к матчу; один совет — всегда он', () => {
    const l = { ...lesson('yard-1'), tips: ['раз', 'два', 'три'] };
    expect([0, 1, 2, 3, 4, -1, 7.5].map((n) => tipAt(l, n))).toEqual(['раз', 'два', 'три', 'раз', 'два', 'три', 'два']);
    expect(tipAt(lesson('yard-5'), 3)).toBe(lesson('yard-5').tips[0]);
  });

  it('уроки двора 1–4: несколько советов, среди них «сначала медленно» и «назови букву»; дальше «назови» нет', () => {
    const early = ['yard-1', 'yard-2', 'yard-3', 'yard-4'];
    for (const l of lessons) {
      const named = l.tips.some((t) => /назови букву/i.test(t));
      expect(named, l.id).toBe(early.includes(l.id));
      if (!early.includes(l.id)) continue;
      expect(new Set(l.tips).size, l.id).toBeGreaterThanOrEqual(3);
      expect(l.tips.some((t) => /медленно/i.test(t)), l.id).toBe(true);
      // Соседние матчи — разные советы.
      for (let n = 0; n < l.tips.length; n++) expect(tipAt(l, n), l.id).not.toBe(tipAt(l, n + 1));
    }
  });
});

describe('генератор упражнений', () => {
  it('строки — только буквы урока и одиночные пробелы, длина в пределах своей атаки', () => {
    for (const l of lessons) {
      const plan = attackPlan(l);
      for (let seed = 1; seed <= 30; seed++) {
        for (const [i, line] of makeHalf(l, wordsRu, keymap, seed).entries()) {
          const attack = plan[i];
          expect(line.length, line).toBeGreaterThanOrEqual(Math.max(LINE_MIN, attack?.min ?? 0));
          expect(line.length, line).toBeLessThanOrEqual(Math.min(LINE_MAX, attack?.max ?? 0));
          expect(line, line).toMatch(/^\S+( \S+)*$/);
          for (const ch of line.replaceAll(' ', '')) expect(l.keys, line).toContain(ch);
          expect(line, line).not.toMatch(/(.)\1\1/);
        }
      }
    }
  });

  it('одно зерно — тот же тайм, другое — другой', () => {
    const l = lesson('yard-2');
    expect(makeHalf(l, wordsRu, keymap, 5)).toEqual(makeHalf(l, wordsRu, keymap, 5));
    expect(makeHalf(l, wordsRu, keymap, 5)).not.toEqual(makeHalf(l, wordsRu, keymap, 6));
  });

  it('клавиша с ошибками выпадает заметно чаще', () => {
    const l = lesson('yard-5');
    const stats: TypingStats = { ...emptyStats, keyErrors: { KeyD: 5 } };
    const before = share(l, 'в');
    const after = share(l, 'в', stats);
    expect(after).toBeGreaterThan(before * 1.3);
  });

  it('новые клавиши урока — чаще средней буквы', () => {
    const l = lesson('yard-6');
    const average = 1 / new Set(l.keys).size;
    expect(share(l, 'п')).toBeGreaterThan(average * 1.3);
    expect(share(l, 'р')).toBeGreaterThan(average * 1.3);
  });

  it('Э не тонет: уроки двора 6–7 — сочетания, в тайме yard-7 «э» не меньше 12 % (007)', () => {
    // Словами «э» было 9 % тайма и 0,5 % решающей: в словаре двора одно слово с «э».
    expect(lesson('yard-6').material).toBe('combos');
    expect(lesson('yard-7').material).toBe('combos');
    expect(share(lesson('yard-7'), 'э')).toBeGreaterThanOrEqual(0.12);
  });
});

describe('лесенка атак', () => {
  it('6 атак: от простого к сложному, решающая — на потолке урока, строки длиннее к концу', () => {
    for (const l of lessons) {
      const plan = attackPlan(l);
      expect(plan, l.id).toHaveLength(HALF_LINES);
      const ranks = plan.map((a) => materials.indexOf(a.material));
      expect(ranks, l.id).toEqual([...ranks].sort((a, b) => a - b));
      expect(plan.at(-1)?.material, l.id).toBe(l.material);
      expect(plan[0]?.material, l.id).toBe('letters');
      expect((plan.at(-1)?.min ?? 0) > (plan[0]?.max ?? 0), l.id).toBe(true);
      // Чистые строки одной буквы — только у урока одиночных букв: по новой букве по порядку,
      // решающая — вперемешку.
      const pure = l.material === 'letters' ? [...l.newKeys] : [];
      expect(plan.map((a) => a.letter), l.id).toEqual(plan.map((_, i) => (i < HALF_LINES - 1 ? pure[i] : undefined)));
      expect(plan.at(-1)?.letter, l.id).toBeUndefined();
    }
    expect(attackPlan(lesson('yard-1')).map((a) => a.letter ?? '*')).toEqual(['а', 'о', '*', '*', '*', '*']);
    // Лесенка урока слов (yard-6 с 007 — сочетания, лесенку слов держит yard-8).
    expect(attackPlan(lesson('yard-8')).map((a) => a.material)).toEqual([
      'letters',
      'letters',
      'pairs',
      'combos',
      'words',
      'words',
    ]);
  });

  it('ступени: буквы — по одной, пары — 2–3 буквы, сочетания — 3–5, слова — из словаря', () => {
    const l = lesson('yard-8');
    const dict = new Set(wordsRu);
    for (let seed = 1; seed <= 20; seed++) {
      const [a1, , a3, a4, a5, a6] = makeHalf(l, wordsRu, keymap, seed).map((line) => line.split(' '));
      for (const t of a1 ?? []) expect(t).toHaveLength(1);
      for (const t of a3 ?? []) expect([2, 3]).toContain(t.length);
      for (const t of a4 ?? []) expect(t.length).toBeGreaterThanOrEqual(3);
      for (const t of a4 ?? []) expect(t.length).toBeLessThanOrEqual(5);
      for (const t of [...(a5 ?? []), ...(a6 ?? [])]) expect(dict.has(t), t).toBe(true);
    }
  });

  it('новая буква не тонет в большом уроке: «я» среди 30 букв — не реже чем каждая 12-я', () => {
    const l = lesson('city-6');
    let all = 0;
    let ya = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const line of makeHalf(l, wordsRu, keymap, seed)) {
        for (const ch of line.replaceAll(' ', '')) {
          all++;
          if (ch === 'я') ya++;
        }
      }
    }
    expect(ya / all).toBeGreaterThan(1 / 12);
  });

  it('пробежка в сочетаниях не перескакивает с ряда на ряд («зхъфы» пальцы так не бегут)', () => {
    const l = lesson('district-9');
    const rowOf = new Map<string, number>();
    const flat: string[] = [];
    for (const [r, row] of ['йцукенгшщзхъ', 'фывапролджэ'].entries()) {
      for (const ch of row) {
        rowOf.set(ch, r);
        flat.push(ch);
      }
    }
    // Пробежка — каждая следующая буква соседняя по клавиатуре в одну сторону.
    const isRun = (t: string): boolean => {
      const at = [...t].map((ch) => flat.indexOf(ch));
      const step = (at[1] ?? 0) - (at[0] ?? 0);
      return Math.abs(step) === 1 && at.every((p, i) => i === 0 || p - (at[i - 1] ?? 0) === step);
    };
    let runs = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const combos = makeHalf(l, wordsRu, keymap, seed)[3]?.split(' ') ?? [];
      for (const t of combos.filter(isRun)) {
        runs++;
        expect(new Set([...t].map((ch) => rowOf.get(ch))).size, t).toBe(1);
      }
    }
    expect(runs).toBeGreaterThan(10);
  });

  it('уроки 1–2 — одни буквы: чистая строка каждой новой буквы, потом буквы урока вперемешку', () => {
    for (const [id, pure] of [
      ['yard-1', ['а', 'о']],
      ['yard-2', ['в', 'л']],
    ] as const) {
      const l = lesson(id);
      for (let seed = 1; seed <= 20; seed++) {
        const half = makeHalf(l, wordsRu, keymap, seed);
        for (const [i, ch] of pure.entries()) expect(half[i], id).toMatch(new RegExp(`^${ch}( ${ch})+$`));
        const mixed = half.slice(pure.length);
        for (const line of mixed) {
          expect(line, id).toMatch(/^\S( \S)*$/);
          expect(new Set(line.replaceAll(' ', '')).size, line).toBeGreaterThanOrEqual(2);
        }
        // Каждая новая буква — и в смешанных строках, не только в своей чистой.
        for (const ch of l.newKeys) expect(mixed.join(''), `${id} ${seed}`).toContain(ch);
        // Второй тайм — тот же план, другое зерно: чистые строки те же, смешанные — другие.
        const second = makeHalf(l, wordsRu, keymap, seed + 1);
        expect(second.slice(0, pure.length)).toEqual(half.slice(0, pure.length));
        expect(second.slice(pure.length)).not.toEqual(mixed);
      }
    }
  });

  it('уроки 3–4 — до пар: пары из 2 разных букв или короткие слова словаря, сочетаний нет', () => {
    // Слова с «Ы и Д» (04.11): часть пар — короткие слова; проверки пар — как были.
    const dict = new Set(wordsRu);
    for (const id of ['yard-3', 'yard-4']) {
      const l = lesson(id);
      expect(attackPlan(l).map((a) => a.material)).toEqual(['letters', 'letters', 'pairs', 'pairs', 'pairs', 'pairs']);
      for (let seed = 1; seed <= 20; seed++) {
        for (const t of makeHalf(l, wordsRu, keymap, seed).slice(2).flatMap((line) => line.split(' '))) {
          if (dict.has(t)) {
            expect(t.length, `${id} ${t}`).toBeGreaterThanOrEqual(2);
            expect(t.length, `${id} ${t}`).toBeLessThanOrEqual(4);
            continue;
          }
          expect(t.length, `${id} ${t}`).toBe(2);
          expect(t, id).not.toMatch(/(.)\1/);
        }
      }
    }
  });

  it('уроки 3–5: короткие слова среди пар и сочетаний в каждом тайме, около трети кусков', () => {
    const dict = new Set(wordsRu);
    for (const id of ['yard-3', 'yard-4', 'yard-5']) {
      const l = lesson(id);
      const plan = attackPlan(l);
      let pieces = 0;
      let words = 0;
      for (let seed = 1; seed <= 20; seed++) {
        let found = 0;
        for (const [i, line] of makeHalf(l, wordsRu, keymap, seed).entries()) {
          const material = plan[i]?.material;
          if (material === 'letters') continue;
          const inLine = new Set<string>();
          for (const t of line.split(' ')) {
            pieces++;
            // Пара — 2 буквы; сочетание — 3–5: слово видно по длине или по словарю.
            const word = dict.has(t) && (material === 'combos' || t.length > 2);
            if (word) {
              found++;
              words++;
              // Слово в строке — один раз (сочетание может случайно совпасть со словом — его не считаем).
              if (material === 'pairs') expect(inLine.has(t), `${id} ${line}`).toBe(false);
              inLine.add(t);
              expect(t.length, `${id} ${t}`).toBeLessThanOrEqual(material === 'pairs' ? 4 : 5);
            } else if (material === 'pairs') {
              expect(t.length, `${id} ${t}`).toBe(2);
              expect(t, id).not.toMatch(/(.)\1/);
            } else {
              expect(t.length, `${id} ${t}`).toBeGreaterThanOrEqual(3);
              expect(t.length, `${id} ${t}`).toBeLessThanOrEqual(5);
            }
          }
        }
        expect(found, `${id} ${seed}`).toBeGreaterThan(0);
      }
      expect(words / pieces, id).toBeGreaterThan(0.15);
      expect(words / pieces, id).toBeLessThan(0.5);
    }
  });

  it('остальные уроки — как было: среди пар и сочетаний слов словаря почти нет (только случайные совпадения)', () => {
    const dict = new Set(wordsRu);
    for (const l of lessons.filter((x) => !['yard-3', 'yard-4', 'yard-5'].includes(x.id))) {
      const plan = attackPlan(l);
      let pieces = 0;
      let words = 0;
      for (let seed = 1; seed <= 20; seed++) {
        for (const [i, line] of makeHalf(l, wordsRu, keymap, seed).entries()) {
          const material = plan[i]?.material;
          if (material !== 'pairs' && material !== 'combos') continue;
          for (const t of line.split(' ').filter((x) => x.length >= 3)) {
            pieces++;
            if (dict.has(t)) words++;
          }
        }
      }
      if (pieces > 0) expect(words / pieces, l.id).toBeLessThan(0.1);
    }
  });

  it('ловушка смены: решающая уроков 1–2 — «в в в л л л», смена на 40–60 %, порядок и место по зерну', () => {
    for (const id of ['yard-1', 'yard-2']) {
      const l = lesson(id);
      expect(attackPlan(l, true).at(-1)?.trap, id).toEqual([...l.newKeys]);
      const [min, max] = LINE_RANGES[HALF_LINES - 1] ?? [0, 0];
      const firsts = new Set<string>();
      const switches = new Set<number>();
      for (let seed = 1; seed <= 20; seed++) {
        const half = makeHalf(l, wordsRu, keymap, seed, undefined, true);
        // До решающей — тот же тайм, что без ловушки.
        expect(half.slice(0, -1), `${id} ${seed}`).toEqual(makeHalf(l, wordsRu, keymap, seed).slice(0, -1));
        const last = half.at(-1) ?? '';
        expect(last.length, last).toBeGreaterThanOrEqual(min);
        expect(last.length, last).toBeLessThanOrEqual(max);
        const m = /^(\S)(?: \1)* (\S)(?: \2)*$/.exec(last);
        expect(m, last).not.toBeNull();
        const [, a = '', b = ''] = m ?? [];
        expect(sorted(a + b), last).toBe(sorted(l.newKeys));
        const letters = last.split(' ');
        const k = letters.indexOf(b);
        expect(k / letters.length, last).toBeGreaterThanOrEqual(TRAP_FROM);
        expect(k / letters.length, last).toBeLessThanOrEqual(TRAP_TO);
        firsts.add(a);
        switches.add(k);
      }
      expect(firsts.size, id).toBe(2);
      expect(switches.size, id).toBeGreaterThanOrEqual(2);
    }
  });

  it('ловушки нет без решающей и у остальных уроков: тайм с флагом — как без него', () => {
    for (const l of lessons) {
      if (l.id === 'yard-1' || l.id === 'yard-2') continue;
      expect(attackPlan(l, true), l.id).toEqual(attackPlan(l));
      for (const seed of [1, 2, 3]) {
        expect(makeHalf(l, wordsRu, keymap, seed, undefined, true), l.id).toEqual(makeHalf(l, wordsRu, keymap, seed));
      }
    }
    for (const id of ['yard-1', 'yard-2']) expect(attackPlan(lesson(id)).at(-1)?.trap, id).toBeUndefined();
  });

  it('фразы — 2–5 настоящих слов, без одного слова дважды подряд', () => {
    const l = lesson('yard-11');
    for (let seed = 1; seed <= 30; seed++) {
      const last = makeHalf(l, wordsRu, keymap, seed).at(-1)?.split(' ') ?? [];
      expect(last.length).toBeGreaterThanOrEqual(2);
      expect(last.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < last.length; i++) expect(last[i]).not.toBe(last[i - 1]);
    }
  });
});

describe('снимок генератора', () => {
  /** Отпечаток: sha256 разминок и таймов на зёрнах 1…50 — с решающей и без, со статистикой ошибок и без. */
  function fingerprint(list: readonly Lesson[]): string {
    const hash = createHash('sha256');
    const stats: TypingStats = { ...emptyStats, keyErrors: { KeyD: 2, Slash: 3 } };
    for (const l of list) {
      for (let seed = 1; seed <= 50; seed++) {
        hash.update(JSON.stringify(makeWarmup(l, seed)));
        for (const s of [undefined, stats]) {
          for (const decisive of [false, true]) hash.update(JSON.stringify(makeHalf(l, wordsRu, keymap, seed, s, decisive)));
        }
      }
    }
    return hash.digest('hex');
  }

  it('уроки до city-6 — те же строки на тех же зёрнах (009-Р8: разрез и точка их не меняют)', () => {
    const upTo = lessons.slice(0, lessons.findIndex((l) => l.id === 'city-6') + 1);
    expect(upTo.length).toBe(31);
    expect(fingerprint(upTo)).toBe('854d824a143b2fee202db8b4472036cf5e62133ffa30de7700bf7ecb13cf77ac');
  });
});
