/**
 * Курс v2, генератор атак (спека 016, Т4, К7–К8): свойства текста на 32 уроках Двора × зёрна 0–9,
 * материал по лесенке, фокус и слабые клавиши, разминка, снимок. Лесенка и словарь — в course.test.ts.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { courseLessons, dictionary } from '../src/app/course/load';
import { keymap } from '../src/app/keymap';
import { focusFor, makeCourseHalf, makeCourseWarmup, makeExtraAttack, wrapRows } from '../src/engine/course/attack';
import type { CourseLesson, Dictionary } from '../src/engine/course/model';
import { isLetter } from '../src/engine/keymap';
import { letterWeights } from '../src/engine/lessonPlan';
import { ru } from '../src/i18n/ru';
import { emptyStats, type TypingStats } from '../src/engine/typing';

const yard = courseLessons.filter((x) => x.league === 'yard');
const seeds = Array.from({ length: 10 }, (_, i) => i);
const lesson = (n: number): CourseLesson => yard[n - 1]!;
const stats: TypingStats = { ...emptyStats, keyErrors: { KeyA: 4, Semicolon: 3, Quote: 2, KeyF: 1 } };
const tokens = (lines: string[]) => lines.flatMap((x) => x.split(' '));
const both = (l: CourseLesson, seed: number, s?: TypingStats) => [
  ...makeCourseHalf(l, dictionary, keymap, seed, s),
  ...makeCourseHalf(l, dictionary, keymap, seed, s, true),
];
/** Доля знаков из набора среди букв (без пробелов) всех атак двух таймов, зёрна 0–9. */
function share(l: CourseLesson, keys: string, s?: TypingStats): number {
  const letters = seeds.flatMap((seed) => both(l, seed, s)).join('').replaceAll(' ', '');
  return [...letters].filter((ch) => keys.includes(ch)).length / letters.length;
}

describe('генератор: свойства на 32 уроках × зёрна 0–9', () => {
  it('атака: длина len−3…len, только буквы урока и одиночные пробелы, перенос не больше rows строк по rowWidth', () => {
    // Ловит: короткую или длинную атаку, чужую букву, двойной пробел, пробел по краям, перенос в лишнюю строку (ТЗ-0.14, ТЗ-13.12).
    const bad: string[] = [];
    for (const l of yard) {
      for (const seed of seeds) {
        for (const s of [undefined, stats]) {
          const halves = [makeCourseHalf(l, dictionary, keymap, seed, s), makeCourseHalf(l, dictionary, keymap, seed, s, true)];
          const extra = makeExtraAttack(l, dictionary, keymap, seed, s);
          const lines = [...halves.flat(), extra];
          const wants = [...l.attacks, ...l.attacks, l.attacks.at(-1)!];
          lines.forEach((line, i) => {
            const len = wants[i]!;
            const rows = wrapRows(line, l.rowWidth);
            const ok =
              halves.every((h) => h.length === l.attacks.length) &&
              line.length >= len - 3 &&
              line.length <= len &&
              /^\S+( \S+)*$/.test(line) &&
              [...line.replaceAll(' ', '')].every((ch) => l.keys.includes(ch)) &&
              rows.length <= l.rows &&
              rows.every((r) => r.length <= l.rowWidth);
            if (!ok) bad.push(`${l.id} зерно ${seed}.${i}: «${line}»`);
          });
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('буквы Двора — основной ряд ЙЦУКЕН из keyboard.json', () => {
    // Ловит: лишнюю или потерянную букву Двора (ТЗ-0.14): урок 32 знает ровно основной ряд.
    const home = keymap.rows[2]!.map((k) => k.chars?.ru[0] ?? '').filter(isLetter).sort().join('');
    expect([...lesson(32).keys].sort().join('')).toBe(home);
  });

  it('одно зерно — тот же текст, другое зерно и второй тайм — другой', () => {
    // Ловит: Math.random в генераторе и тайм, повторяющий первый.
    const l = lesson(24);
    expect(both(l, 3)).toEqual(both(l, 3));
    expect(makeCourseHalf(l, dictionary, keymap, 3)).not.toEqual(makeCourseHalf(l, dictionary, keymap, 4));
    expect(makeCourseHalf(l, dictionary, keymap, 3)).not.toEqual(makeCourseHalf(l, dictionary, keymap, 3, undefined, true));
    expect(makeExtraAttack(l, dictionary, keymap, 3)).toBe(makeExtraAttack(l, dictionary, keymap, 3));
  });

  it('материал — по ступеням лесенки: буквы — одиночные, слова — из словаря, фразы — из фраз, слово не дважды подряд', () => {
    // Ловит: атаку не той ступени (design §3) и «слово слово» подряд в словах и фразах.
    const bad: string[] = [];
    for (const l of yard.filter((x) => !x.chants)) {
      for (const seed of seeds) {
        makeCourseHalf(l, dictionary, keymap, seed).forEach((line, i) => {
          const step = l.ladder[i];
          const t = line.split(' ');
          if (step === 'letters' && !t.every((x) => x.length === 1)) bad.push(`${l.id} буквы: «${line}»`);
          if (step === 'words' && !l.noWords && !t.every((x) => dictionary.words.includes(x))) bad.push(`${l.id} слова: «${line}»`);
          if (step === 'phrases' && !dictionary.phrases.some((p) => line.includes(p))) bad.push(`${l.id} фразы: «${line}»`);
          if ((step === 'words' || step === 'phrases') && t.some((x, k) => k > 0 && x === t[k - 1])) bad.push(`${l.id} повтор: «${line}»`);
        });
      }
    }
    expect(bad).toEqual([]);
  });

  it('noWords: без слов словаря ступени слов и фраз становятся сочетаниями; wordLen: слова нужной длины', () => {
    // Ловит: слова в уроке «пальцы, а не слова» (30) и длинные слова в уроке коротких слов (22).
    const inDict = (l: CourseLesson) => seeds.flatMap((s) => tokens(makeCourseHalf(l, dictionary, keymap, s, undefined, true)));
    const words: CourseLesson = { ...lesson(30), noWords: false, ladder: ['words', 'words', 'words', 'words'] };
    expect(inDict(words).every((x) => dictionary.words.includes(x))).toBe(true);
    const barred = inDict({ ...words, noWords: true });
    expect(barred.filter((x) => dictionary.words.includes(x)).length).toBeLessThan(barred.length / 4);
    const wordLines = (l: CourseLesson) => seeds.flatMap((s) => tokens(makeCourseHalf(l, dictionary, keymap, s).filter((_, i) => l.ladder[i] === 'words')));
    expect(wordLines(lesson(22)).every((x) => x.length <= 4)).toBe(true);
    const long = wordLines(lesson(23));
    expect(long.filter((x) => x.length < 5).length).toBeLessThan(long.length / 10);
  });

  it('пустой пул: слов меньше восьми — сочетания, фраз меньше восьми — слова; ни один урок не падает', () => {
    // Ловит: падение или зацикливание на уроке, для которого в словаре почти нет материала (ТЗ-13.12).
    const poor: Dictionary = { words: ['ад', 'лад'], phrases: ['ад лад'], chants: [] };
    const bad: string[] = [];
    for (const l of yard) {
      for (const seed of seeds) {
        for (const line of makeCourseHalf(l, poor, keymap, seed, undefined, true)) if (!/^\S+( \S+)*$/.test(line)) bad.push(`${l.id}: «${line}»`);
      }
    }
    expect(bad).toEqual([]);
    // Урок 13 (слова): без пула в решающей атаке больше сочетаний, чем двух слов.
    const last = seeds.flatMap((s) => tokens(makeCourseHalf(lesson(13), poor, keymap, s).slice(-1)));
    expect(last.filter((x) => poor.words.includes(x)).length).toBeLessThan(last.length / 2);
  });

  it('ловушка смены: урок 1 — последняя атака 2-го тайма «а а а о о о», в 1-м тайме её нет', () => {
    // Ловит: потерянную ловушку смены (design §2, особое trap) и ловушку в первом тайме.
    const l = lesson(1);
    expect(l.trap).toBe(true);
    const changes = (line: string) => line.split(' ').filter((x, i, a) => i > 0 && x !== a[i - 1]).length;
    for (const seed of seeds) {
      const second = makeCourseHalf(l, dictionary, keymap, seed, undefined, true).at(-1)!;
      expect(new Set(second.split(' ')).size, second).toBe(2);
      expect(changes(second), second).toBe(1);
    }
    expect(seeds.some((s) => changes(makeCourseHalf(l, dictionary, keymap, s).at(-1)!) > 1)).toBe(true);
  });

  it('ступени пар и сочетаний на 32 уроках: пара — 2 разные буквы, сочетание — 3–5 букв без двух одинаковых подряд (кроме слов словаря)', () => {
    // Ловит: пару из трёх букв, повтор «аа» в паре и сочетании, сочетание короче 3 и длиннее 5 (куски pairToken, comboToken, distinctWord).
    const bad: string[] = [];
    for (const l of yard.filter((x) => x.ladder.length === x.attacks.length)) {
      for (const seed of seeds) {
        for (const second of [false, true]) {
          makeCourseHalf(l, dictionary, keymap, seed, undefined, second).forEach((line, i) => {
            const step = l.ladder[i];
            if (step !== 'pairs' && step !== 'combos') return;
            for (const t of line.split(' ')) {
              if (dictionary.words.includes(t) && t.length <= (step === 'pairs' ? 4 : 5)) continue;
              const doubled = [...t].some((ch, k) => k > 0 && ch === t[k - 1]);
              const ok = step === 'pairs' ? t.length === 2 && !doubled : t.length >= 3 && t.length <= 5 && !doubled;
              if (!ok) bad.push(`${l.id} ${step} зерно ${seed}.${i}: «${t}» в «${line}»`);
            }
          });
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('ловушка смены, урок 1: место смены — в доле 0,4–0,6 строки (TRAP_FROM, TRAP_TO); первая буква и место различаются по зёрнам', () => {
    // Ловит: смену в начале или в конце строки («а о о о о»), одну и ту же первую букву и одно место на всех зёрнах.
    const l = lesson(1);
    const firsts = new Set<string>();
    const places = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const letters = makeCourseHalf(l, dictionary, keymap, seed, undefined, true).at(-1)!.split(' ');
      const k = letters.findIndex((x) => x !== letters[0]);
      expect(k / letters.length, letters.join(' ')).toBeGreaterThanOrEqual(0.4);
      expect(k / letters.length, letters.join(' ')).toBeLessThanOrEqual(0.6);
      firsts.add(letters[0]!);
      places.add(k);
    }
    expect([...firsts].sort()).toEqual(['а', 'о']);
    expect(places.size).toBeGreaterThanOrEqual(2);
  });

  it('Э не тонет: в атаках уроков 19–21 доля «э» не меньше 12 %', () => {
    // Ловит: потерю «э» в весах: в словаре одно слово с «э», держится она на фокусе и сочетаниях (016-Р14).
    for (const n of [19, 20, 21]) expect(share(lesson(n), 'э'), lesson(n).id).toBeGreaterThanOrEqual(0.12);
  });

  it('фокус из двух клавиш даёт не меньше 40 % знаков атаки (на этом держится «минута тренера» 017)', () => {
    // Ловит: подмену весов, при которой две клавиши фокуса тонут среди остальных букв ряда.
    for (const [n, keys] of [[12, 'фж'], [19, 'эж']] as const) {
      expect(lesson(n).focus, lesson(n).id).toBe(keys);
      expect(share(lesson(n), keys), lesson(n).id).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('focusWeak: самые ошибочные клавиши игрока выпадают чаще, чем без статистики', () => {
    // Ловит: focusWeak, который ничего не делает (ответные матчи 25–26 и урок 30).
    for (const n of [25, 30]) {
      expect(share(lesson(n), 'фжэ', stats), lesson(n).id).toBeGreaterThan(share(lesson(n), 'фжэ') + 0.03);
    }
  });

  it('focusWeak 3 против 0 при одних stats: фокус шире и слабые клавиши выпадают чаще', () => {
    // Ловит: focusWeak, который не доходит до фокуса (ответные матчи 25–26, урок 30): при тех же ошибках игрока текст не меняется.
    for (const n of [25, 26]) {
      const l = lesson(n);
      const on: CourseLesson = { ...l, focusWeak: 3 };
      const off: CourseLesson = { ...l, focusWeak: 0 };
      const added = [...focusFor(on, keymap, stats)].filter((ch) => !focusFor(off, keymap, stats).includes(ch));
      expect(added.length, l.id).toBeGreaterThan(0);
      expect(share(on, added.join(''), stats), l.id).toBeGreaterThan(share(off, added.join(''), stats) + 0.03);
    }
  });

  it('двое игроков с разными ошибками: фокус у каждого — свои слабые клавиши и не чужие (уроки 25 и 30)', () => {
    // Ловит: focusFor, который не читает статистику, или слабые клавиши, зашитые строкой «фжэ» (016, край «Двое игроков»).
    const errs = (...codes: string[]): TypingStats => ({ ...emptyStats, keyErrors: Object.fromEntries(codes.map((c, i) => [c, 9 - i])) });
    const [a, b] = [errs('KeyK', 'KeyL'), errs('KeyA', 'Quote')]; // A: л, д; B: ф, э
    for (const n of [25, 30]) {
      const l = lesson(n);
      const fa = focusFor(l, keymap, a);
      const fb = focusFor(l, keymap, b);
      for (const ch of 'лд') expect([fa.includes(ch), fb.includes(ch)], `${l.id} ${ch}`).toEqual([true, false]);
      for (const ch of 'фэ') expect([fb.includes(ch), fa.includes(ch) && !l.focus.includes(ch)], `${l.id} ${ch}`).toEqual([true, false]);
    }
  });

  it('нижняя граница доли фокуса: урок 12, сильные ошибки вне фокуса — «ф» и «ж» не тонут (≥ 30 % в среднем, ≥ 20 % на зерне)', () => {
    // Ловит: FOCUS_SHARE = 0 (в lessonPlan.ts) — при тяжёлых ошибках на «а», «о», «в», «л» новые клавиши урока тонут (016-Р11). С ошибками доля ниже, чем без них (≈33 %).
    const heavy: TypingStats = { ...emptyStats, keyErrors: { KeyF: 30, KeyJ: 30, KeyD: 20, KeyK: 20 } };
    const l = lesson(12);
    const letters = (seed: number) => both(l, seed, heavy).join('').replaceAll(' ', '');
    for (const seed of seeds) expect([...letters(seed)].filter((ch) => 'фж'.includes(ch)).length / letters(seed).length, `зерно ${seed}`).toBeGreaterThanOrEqual(0.2);
    expect(share(l, 'фж', heavy)).toBeGreaterThanOrEqual(0.3);
  });

  it('копия урока в форме 017 (фокус из двух клавиш, material pairs, noWords, одна атака, лесенка урока) даёт ≥ 40 % знаков фокуса', () => {
    // Ловит: лесенку урока, которая не по числу атак копии, берёт ступень по номеру (016-Р10): вместо пар выходят одиночные буквы и слова.
    // Лесенка — своя у урока и «чужая» (начинается с одиночных букв и слов): с атакой, одной на копию, ступень брать нельзя.
    for (const n of [12, 19]) {
      for (const ladder of [lesson(n).ladder, lesson(32).ladder, lesson(1).ladder]) {
        const l = lesson(n);
        const copy: CourseLesson = { ...l, focusWeak: 0, material: 'pairs', noWords: true, attacks: [l.attacks.at(-1)!], ladder };
        const lines = seeds.flatMap((s) => makeCourseHalf(copy, dictionary, keymap, s));
        expect(lines.every((x) => x.split(' ').some((t) => t.length > 1)), `${l.id} ${ladder.join()}`).toBe(true);
        expect(share(copy, l.focus), `${l.id} ${ladder.join()}`).toBeGreaterThanOrEqual(0.4);
      }
    }
  });

  it('кричалки: в уроках 31–32 они выпадают, в уроках без chants — нет', () => {
    // Ловит: кричалки, потерянные при выборе фразы (ТЗ-2.16: «кричалки» в финальных уроках).
    const lines = (l: CourseLesson) => seeds.flatMap((s) => both(l, s)).join('\n');
    for (const n of [31, 32]) {
      expect(lesson(n).chants, `yard-${n}`).toBe(true);
      expect(dictionary.chants.some((c) => lines(lesson(n)).includes(c)), `yard-${n}`).toBe(true);
    }
    expect(dictionary.chants.some((c) => lines(lesson(27)).includes(c))).toBe(false);
  });

  it('wrapRows на краях: слово ровно в rowWidth остаётся строкой, длиннее — отдельной строкой, пробел не теряется', () => {
    // Ловит: ошибку на единицу в переносе (≤ и <) и потерю слова, не влезающего в строку.
    expect(wrapRows('аб вгд', 3)).toEqual(['аб', 'вгд']);
    expect(wrapRows('аб вг', 5)).toEqual(['аб вг']);
    expect(wrapRows('аб вг', 4)).toEqual(['аб', 'вг']);
    expect(wrapRows('абвгд', 5)).toEqual(['абвгд']);
    expect(wrapRows('аб вгдежз ик', 4)).toEqual(['аб', 'вгдежз', 'ик']);
    expect(wrapRows('', 5)).toEqual([]);
  });

  it('фразы: в матче урока 27 фраза не повторяется ни в таймах, ни в доп. атаке (зёрна 0–99); фраз не хватает — идут слова', () => {
    // Ловит: «права форварда» по 4 раза за матч (016-Р12, design §5): вес по буквам и 2-й тайм, не знающий 1-го.
    // Словарь синтетический: фраза — два уникальных «слова», поэтому вхождение в строку однозначно (в настоящем словаре
    // «папа ждал» + «парад» склеились бы в чужую фразу). Уроку нужны только его буквы.
    const l = lesson(27);
    const letters = [...l.keys];
    const tok = (i: number) => [i, Math.floor(i / letters.length), Math.floor(i / letters.length ** 2)].map((d) => letters[d % letters.length]).join('');
    const make = (count: number): Dictionary => ({
      words: Array.from({ length: 30 }, (_, i) => tok(1000 + i)),
      phrases: Array.from({ length: count }, (_, i) => `${tok(2 * i)} ${tok(2 * i + 1)}`),
      chants: [],
    });
    const wide = Array.from({ length: 100 }, (_, i) => i);
    for (const count of [60, 12]) {
      const dict = make(count);
      const bad: string[] = [];
      for (const seed of wide) {
        const text = ` ${[...makeCourseHalf(l, dict, keymap, seed), ...makeCourseHalf(l, dict, keymap, seed, undefined, true), makeExtraAttack(l, dict, keymap, seed)].join(' ')} `;
        for (const p of dict.phrases) if (text.split(` ${p} `).length - 1 > 1) bad.push(`${count} фраз, зерно ${seed}: «${p}»`);
      }
      expect(bad.slice(0, 5), `${count} фраз`).toEqual([]);
    }
    // Фразы кончились — атака всё равно есть (слова), а не обрыв.
    const lines = makeCourseHalf(l, make(12), keymap, 5, undefined, true);
    expect(lines.every((x) => /^\S+( \S+)*$/.test(x))).toBe(true);
  });
});

describe('генератор: разминка и снимок', () => {
  it('разминка: ровно warmup знаков, строки не длиннее rowWidth, буквы урока; зерно повторяет', () => {
    // Ловит: разминку не той длины (матч выйдет из полосы ТЗ-2.14), перенос и чужие буквы.
    const bad: string[] = [];
    for (const l of yard) {
      for (const seed of seeds) {
        const blocks = makeCourseWarmup(l, dictionary, keymap, seed);
        const rows = blocks.flat();
        const total = rows.reduce((s, r) => s + r.length, 0);
        const ok =
          total === l.warmup &&
          rows.every((r) => r.length <= l.rowWidth && /^\S+( \S+)*$/.test(r) && [...r.replaceAll(' ', '')].every((ch) => l.keys.includes(ch)));
        if (!ok || JSON.stringify(blocks) !== JSON.stringify(makeCourseWarmup(l, dictionary, keymap, seed))) bad.push(`${l.id} ${seed}: ${total}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('разминка: два удара по 2–3 строки (урок 1 тоже); одна новая буква — удар и пары с соседом по фокусу, не одна «э»', () => {
    // Ловит: разминку «э э э…» в 5–6 строк (016-Р12) и удар в 4 строки; правило v1: «эж жэ».
    for (const l of yard.filter((x) => x.warmup > 0)) {
      for (const seed of seeds) {
        const blocks = makeCourseWarmup(l, dictionary, keymap, seed);
        expect(blocks.length, l.id).toBe(2);
        expect(blocks.every((b) => b.length >= 2 && b.length <= 3), `${l.id} ${seed}: ${JSON.stringify(blocks)}`).toBe(true);
      }
    }
    const l = lesson(19);
    expect(l.newKeys).toBe('э');
    for (const seed of seeds) {
      const [hit, pairs] = makeCourseWarmup(l, dictionary, keymap, seed);
      expect(hit!.join(' ').split(' ').every((t) => t === 'э'), `${seed}`).toBe(true);
      const t = pairs!.join(' ').split(' ');
      expect(t.filter((x) => x.length === 2 && x.includes('э') && x.includes('ж')).length, `${seed}: ${pairs?.join(' ')}`).toBeGreaterThan(t.length / 2);
      expect(t.every((x) => x.includes('э')), `${seed}: ${pairs?.join(' ')}`).toBe(true);
    }
  });

  it('снимок v2: отпечаток 32 уроков × 10 зёрен (разминка, оба тайма, доп. атака, с ошибками и без)', () => {
    // Ловит: любое изменение текстов атак — его делают осознанно, меняя отпечаток (К8).
    // Сдвиг 016-Т4д: доля фокуса 0,6 → 0,4; разминка — два удара по 2–3 строки, одна буква — с парами; фразы равномерно и без повтора в матче.
    const hash = createHash('sha256');
    for (const l of yard) {
      for (const seed of seeds) {
        hash.update(JSON.stringify(makeCourseWarmup(l, dictionary, keymap, seed)));
        for (const s of [undefined, stats]) {
          hash.update(JSON.stringify(both(l, seed, s)));
          hash.update(makeExtraAttack(l, dictionary, keymap, seed, s));
        }
      }
    }
    expect(hash.digest('hex')).toBe('0fab1b243f3c23ac051825e09619880296a3b79ae3ee5587c0e4114947e99f3e');
  });
});

// Бывшие кейсы tests/lessons.test.ts (018-Т6б): веса букв берёт и генератор v2. Уроки v1 заданы литералами — их файл ушёл.
describe('веса букв генератора (letterWeights)', () => {
  const ru30 = 'фываолджпрэкгенушцщйзхмьитсбчюя';
  const sum = (m: Map<string, number>, keys: string): number => [...keys].reduce((acc, ch) => acc + (m.get(ch) ?? 0), 0);

  it('клавиша с ошибками весит заметно больше, чем без ошибок; прибавка за ошибки с потолком', () => {
    // Ловит: ошибки не влияют на вес, нет потолка прибавки, ошибки чужой клавиши двигают вес «в».
    const l = { keys: 'фываолдж', layout: 'ru', focus: '' } as const;
    const before = letterWeights(l, keymap).get('в') ?? 0;
    const few: TypingStats = { ...emptyStats, keyErrors: { KeyD: 5 } };
    const many: TypingStats = { ...emptyStats, keyErrors: { KeyD: 50 } };
    const after = letterWeights(l, keymap, few).get('в') ?? 0;
    expect(after).toBeGreaterThan(before * 1.3);
    expect(letterWeights(l, keymap, many).get('в')).toBe(after);
    expect(letterWeights(l, keymap, { ...emptyStats, keyErrors: { KeyF: 5 } }).get('в')).toBe(before);
  });

  it('знаков в весах нет: ошибки на клавише точки не добавляют «.» (009)', () => {
    // Ловит: знак препинания попал в веса букв — генератор дал бы «.» в слово.
    const l = { keys: `${ru30}.`, layout: 'ru', focus: '.жю' } as const;
    const w = letterWeights(l, keymap, { ...emptyStats, keyErrors: { Slash: 3 } });
    expect([...w.keys()]).not.toContain('.');
    expect([...w.keys()].sort()).toEqual([...new Set(l.keys)].filter((ch) => ch !== '.').sort());
  });

  it('новые клавиши урока — тяжелее средней буквы (урок «пр» и уроки Двора v2)', () => {
    // Ловит: фокус урока не тяжелее остальных букв.
    const w = letterWeights({ keys: 'фываолджпр', layout: 'ru', focus: 'пр' }, keymap);
    const average = [...w.values()].reduce((acc, x) => acc + x, 0) / w.size;
    expect(w.get('п')).toBeGreaterThan(average * 1.3);
    expect(w.get('р')).toBeGreaterThan(average * 1.3);
    for (const c of yard) {
      const cw = letterWeights({ keys: c.keys, layout: c.layout, focus: c.focus }, keymap);
      // Уроки, где фокус — все буквы, пропускаем: среднее равно самому себе.
      if (!c.focus || [...cw.keys()].every((ch) => c.focus.includes(ch))) continue;
      const avg = [...cw.values()].reduce((acc, x) => acc + x, 0) / cw.size;
      for (const ch of c.focus) if (cw.has(ch)) expect(cw.get(ch), `${c.id} ${ch}`).toBeGreaterThan(avg);
    }
  });

  it('новая буква не тонет в большом уроке: «я» среди 30 букв — не меньше 40 % веса фокуса', () => {
    // Ловит: в уроке из 30 букв вес фокуса растворяется.
    const l = { keys: ru30, layout: 'ru', focus: 'яф' } as const;
    const w = letterWeights(l, keymap);
    const total = [...w.values()].reduce((acc, x) => acc + x, 0);
    expect(sum(w, l.focus) / total).toBeGreaterThanOrEqual(0.4 - 1e-9);
    expect(w.get('я') ?? 0).toBeGreaterThan(total / w.size);
  });

  it('у каждого знака в newKeys уроков есть имя для вступления и статистики (009-Р22)', () => {
    // Ловит: урок с новым знаком, которому нет названия в ru.keyboard.marks (родитель увидел бы пустое имя).
    const marks = [...new Set(courseLessons.flatMap((l) => [...l.newKeys]).filter((ch) => ch.toLowerCase() === ch.toUpperCase()))];
    for (const ch of marks) expect(ru.keyboard.marks[ch], ch).toBeTruthy();
    expect(ru.keyboard.marks['.']).toBe('точка');
  });
});
