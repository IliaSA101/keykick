/**
 * Движок печати: таблица событий клавиатуры и цепочка случайных нажатий с инвариантами.
 * Нажатия строятся по настоящей карте ноутбука ребёнка (src/content/keyboard.json).
 */
import { describe, expect, it } from 'vitest';
import { keymap } from '../src/app/keymap';
import { findChar } from '../src/engine/keymap';
import { createRandom, pick, randomInt } from '../src/engine/random';
import {
  FINGER_HINT_AFTER,
  accuracy,
  charsPerMinute,
  countedInterval,
  emptyStats,
  evenness,
  expectedHit,
  expectedKey,
  expectedThumb,
  formatClock,
  halfTime,
  isDone,
  startLine,
  step,
  typeLine,
  type KeyPress,
  type TypingState,
  type TypingStats,
} from '../src/engine/typing';

let clock = 0;

/** Нажатие символа в раскладке ребёнка: code берётся из карты, как его дал бы браузер. */
function press(ch: string, extra: Partial<KeyPress> = {}): KeyPress {
  const hit = findChar(keymap, 'ru', ch) ?? findChar(keymap, 'en', ch);
  clock += 200;
  return { code: hit?.key.code ?? 'Unknown', key: ch, repeat: false, mod: false, caps: false, time: clock, ...extra };
}

const type = (s: TypingState, keys: KeyPress[]) => keys.reduce((st, k) => step(keymap, st, k), s);
/** Тайм уже начат (было засчитанное нажатие): первая ошибка здесь не прощается. */
const begun: TypingStats = { ...emptyStats, correct: 1 };
const enter = (): KeyPress => ({ ...press('x'), code: 'Enter', key: 'Enter' });

describe('движок печати: события', () => {
  it('верная буква двигает курсор, неверная — нет, ошибка записана на ожидаемую клавишу и палец', () => {
    let s = startLine('фы', 'ru');
    s = step(keymap, s, press('ф'));
    expect([s.pos, s.last]).toEqual([1, 'ok']);
    s = step(keymap, s, press('в'));
    expect([s.pos, s.last, s.lineErrors]).toEqual([1, 'error', 1]);
    expect(s.stats.keyErrors).toEqual({ KeyS: 1 });
    expect(s.stats.fingerErrors).toEqual({ lr: 1 });
    s = step(keymap, s, press('ы'));
    expect(isDone(s)).toBe(true);
    expect(s.stats).toMatchObject({ correct: 2, errors: 1 });
  });

  it('та же клавиша в латинской раскладке — подсказка «переключи», не ошибка', () => {
    const s = step(keymap, startLine('ф', 'ru'), press('a'));
    expect([s.pos, s.last, s.hint, s.stats.errors]).toEqual([0, 'hint', 'layout', 0]);
  });

  it('другая клавиша в латинской раскладке — ошибка', () => {
    const s = step(keymap, startLine('ф', 'ru', begun), press('s'));
    expect([s.last, s.stats.errors]).toEqual(['error', 1]);
  });

  it('точка в русской раскладке — клавиша Slash; «/» с неё — подсказка раскладки', () => {
    const s = step(keymap, startLine('.', 'ru'), { ...press('/'), code: 'Slash' });
    expect(s.hint).toBe('layout');
  });

  it('Caps Lock и не тот регистр — подсказка; без Caps Lock — ошибка (забыт Shift)', () => {
    const caps = step(keymap, startLine('ф', 'ru'), press('Ф', { caps: true }));
    expect([caps.last, caps.hint, caps.stats.errors]).toEqual(['hint', 'caps', 0]);
    const noShift = step(keymap, startLine('Ф', 'ru', begun), press('ф'));
    expect([noShift.last, noShift.stats.errors]).toEqual(['error', 1]);
  });

  it('numpad не засчитывается — подсказка про верхний ряд', () => {
    const s = step(keymap, startLine('5', 'ru'), { ...press('5'), code: 'Numpad5' });
    expect([s.pos, s.hint, s.stats.errors]).toEqual([0, 'numpad', 0]);
  });

  it('автоповтор, сочетания, Shift, Alt+Shift, Backspace — без последствий', () => {
    const start = startLine('ф', 'ru');
    const noise: KeyPress[] = [
      press('в', { repeat: true }),
      press('c', { mod: true }),
      { ...press('x'), code: 'ShiftLeft', key: 'Shift' },
      { ...press('x'), code: 'AltLeft', key: 'Alt', mod: true },
      { ...press('x'), code: 'Backspace', key: 'Backspace' },
      { ...press('x'), code: 'CapsLock', key: 'CapsLock' },
    ];
    for (const k of noise) {
      const s = step(keymap, start, k);
      expect([s.pos, s.last, s.stats.errors, s.stats.startedAt], k.key).toEqual([0, 'ignored', 0, null]);
    }
  });

  it(`после ${FINGER_HINT_AFTER} ошибок подряд — подсказка пальца; верная клавиша её снимает`, () => {
    let s = type(startLine('ж', 'ru', begun), [press('д'), press('д')]);
    expect(s.hint).toBeNull();
    s = step(keymap, s, press('д'));
    expect(s.hint).toBe('finger');
    s = step(keymap, s, press('ж'));
    expect([s.hint, s.streak]).toEqual([null, 0]);
  });

  it('пробел — большой палец; ожидаемая клавиша для подсветки', () => {
    const s = startLine(' ф', 'ru');
    expect(expectedKey(keymap, s)?.finger).toBe('th');
    expect(expectedKey(keymap, step(keymap, s, press(' ')))?.code).toBe('KeyA');
    expect(expectedKey(keymap, type(s, [press(' '), press('ф')]))).toBeNull();
  });

  it('ожидаемая клавиша знает про Shift: заглавная — с Shift, строчная — без', () => {
    const s = startLine('Фф', 'ru');
    expect(expectedHit(keymap, s)).toMatchObject({ key: { code: 'KeyA' }, shift: true });
    expect(expectedHit(keymap, step(keymap, s, press('Ф')))).toMatchObject({ key: { code: 'KeyA' }, shift: false });
  });

  it('после конца строки нажатия игнорируются', () => {
    const s = type(startLine('ф', 'ru'), [press('ф'), press('ы')]);
    expect([s.pos, s.last, s.stats.errors]).toEqual([1, 'ignored', 0]);
  });

  it('счётчики переходят в следующую строку, ошибки строки — нет', () => {
    const first = type(startLine('ф', 'ru', begun), [press('ы'), press('ф')]);
    const second = startLine('ы', 'ru', first.stats);
    expect([second.lineErrors, second.stats.errors, second.stats.correct]).toEqual([0, 1, 2]);
  });

  it('первое неверное нажатие тайма прощается: ни в строку, ни в ошибки клавиш; второе — ошибка', () => {
    // Начало разминки — пустые счётчики; начало тайма — пустые, но с ошибками клавиш разминки.
    for (const stats of [emptyStats, { ...emptyStats, keyErrors: { KeyA: 2 } }]) {
      let s = step(keymap, startLine('фы', 'ru', stats), press('ы'));
      expect([s.pos, s.last, s.lineErrors, s.stats.errors, s.stats.startedAt]).toEqual([0, 'ignored', 0, 0, null]);
      expect(s.stats.keyErrors).toEqual(stats.keyErrors);
      s = step(keymap, s, press('ы'));
      expect([s.last, s.lineErrors, s.stats.errors]).toEqual(['error', 1, 1]);
    }
    // Первое нажатие верное — прощение сгорело: следующая ошибка засчитана.
    const ok = type(startLine('фы', 'ru'), [press('ф'), press('в')]);
    expect([ok.last, ok.stats.errors]).toEqual(['error', 1]);
    // Следующая строка того же тайма начинается без прощения.
    expect(startLine('в', 'ru', ok.stats).forgive).toBe(false);
  });

  it('прощённое нажатие буквой другой раскладки — подсказка раскладки; подсказки и Enter прощение не тратят', () => {
    const foreign = step(keymap, startLine('ф', 'ru'), press('s'));
    expect([foreign.last, foreign.hint, foreign.stats.errors, foreign.forgive]).toEqual(['hint', 'layout', 0, false]);
    // Та же клавиша в латинице и Caps Lock — подсказки, как раньше; потом первая ошибка всё ещё прощается.
    let s = type(startLine('ф', 'ru'), [press('a'), press('Ф', { caps: true }), enter()]);
    expect([s.hint, s.stats.errors, s.forgive]).toEqual(['caps', 0, true]);
    s = step(keymap, s, press('ы'));
    expect([s.last, s.stats.errors]).toEqual(['ignored', 0]);
    expect(step(keymap, s, press('ы')).stats.errors).toBe(1);
  });

  it('Enter на стыке строк — молча мимо: не ошибка, курсор и счётчики на месте', () => {
    const first = type(startLine('ф', 'ru', begun), [press('ф')]);
    const next = startLine('ы', 'ru', first.stats, true);
    const s = step(keymap, next, enter());
    expect([s.pos, s.last, s.lineErrors, s.hint]).toEqual([0, 'ignored', 0, null]);
    expect(s.stats).toBe(first.stats);
    expect(isDone(step(keymap, s, press('ы')))).toBe(true);
  });

  it('пробел — большим другой руки: после А (левая) — правым, после О (правая) — левым, в начале — правым', () => {
    const s = startLine(' а о', 'ru');
    expect(expectedThumb(keymap, s)).toBe('right');
    const afterA = type(s, [press(' '), press('а')]);
    expect(expectedThumb(keymap, afterA)).toBe('right');
    const afterO = type(afterA, [press(' '), press('о')]);
    expect(expectedThumb(keymap, afterO)).toBeNull();
    expect(expectedThumb(keymap, step(keymap, afterA, press(' ')))).toBeNull();
    expect(expectedThumb(keymap, type(startLine('о а', 'ru'), [press('о')]))).toBe('left');
    // Буква латиницы в русской строке — по её клавише: J — правая рука.
    expect(expectedThumb(keymap, type(startLine('j ', 'ru'), [press('j')]))).toBe('left');
  });

  it('точность и скорость', () => {
    expect(accuracy(startLine('ф', 'ru').stats)).toBe(1);
    // 40 промежутков по 1,5 с — минута печати, 30 верных знаков.
    const stats: TypingStats = { ...emptyStats, correct: 30, errors: 10, intervals: Array(40).fill(1500) };
    expect(accuracy(stats)).toBe(0.75);
    expect(charsPerMinute(stats)).toBe(30);
    expect(charsPerMinute({ ...stats, intervals: [500] })).toBe(0);
    expect(charsPerMinute({ ...stats, intervals: [] })).toBe(0);
  });

  it('скорость без наказания за паузы: промежуток длиннее 2,5 с — за 1 с', () => {
    expect([2500, 2501, 60000, 300].map(countedInterval)).toEqual([2500, 1000, 1000, 300]);
    const even: TypingStats = { ...emptyStats, correct: 10, intervals: Array(10).fill(500) };
    // Одна пауза на минуту стоит секунду, а не минуту.
    const paused: TypingStats = { ...even, intervals: [...even.intervals.slice(1), 60000] };
    expect(charsPerMinute(even)).toBe(120);
    expect(charsPerMinute(paused)).toBe(Math.round((10 * 60000) / (9 * 500 + 1000)));
    expect(halfTime(paused)).toBe(9 * 500 + 60000);
  });

  it('ровность: одинаковые промежутки — 100 %, рывки — меньше, не ниже нуля', () => {
    const at = (intervals: number[]) => evenness({ ...emptyStats, intervals });
    expect(at([400, 400, 400])).toBe(1);
    expect(at([])).toBe(1);
    // Среднее 400, отклонение 200 — ровность 0,5.
    expect(at([200, 600])).toBeCloseTo(0.5);
    // Длинная пауза усечена до 1 с: [200, 1000] — среднее 600, отклонение 400.
    expect(at([200, 9000])).toBeCloseTo(1 - 400 / 600);
    // Отклонение больше среднего — ноль, а не минус.
    expect(at([1, 1, 1, 1, 2400])).toBe(0);
  });

  it('строка сразу за прошлой (без надписи) — промежуток стыка идёт в темп', () => {
    clock = 0;
    const first = type(startLine('фы', 'ru', begun), [press('ф'), press('ы')]);
    clock += 300;
    const second = type(startLine('ва', 'ru', first.stats, true), [press('в'), press('а')]);
    expect(second.stats.intervals).toEqual([200, 500, 200]);
    expect(halfTime(second.stats)).toBe(900);
  });

  it('промежутки — только внутри строки: удар между строками в время тайма не идёт', () => {
    clock = 0;
    const first = type(startLine('фы', 'ru'), [press('ф'), press('в'), press('ы')]);
    expect(first.stats.intervals).toEqual([200, 200]);
    // Пауза на удар — 5 секунд, потом следующая строка.
    clock += 5000;
    const second = type(startLine('ва', 'ru', first.stats), [press('в'), press('а')]);
    expect(second.stats.intervals).toEqual([200, 200, 200]);
    expect(halfTime(second.stats)).toBe(600);
  });

  it('строка после пенальти (005): без склейки и с прощением — пауза на задачу и первое неверное не видны', () => {
    clock = 0;
    const first = type(startLine('фы', 'ru', begun), [press('ф'), press('ы')]);
    // Задача на пенальти — минута; потом строка без склейки и с прощением посреди тайма.
    clock += 60_000;
    let s = startLine('ва', 'ru', first.stats, false, true);
    expect([s.forgive, s.joined]).toEqual([true, false]);
    s = type(s, [press('ы'), press('в'), press('а')]);
    expect([s.lineErrors, s.stats.errors, s.missed, s.stats.correct]).toEqual([0, 0, [], 5]);
    // Секундомер, скорость и ровность: в промежутках только печать, минуты на задачу нет.
    expect(s.stats.intervals).toEqual([200, 200]);
    expect([halfTime(s.stats), evenness(s.stats)]).toEqual([400, 1]);
    // Без флага посреди тайма прощения нет: та же ошибка засчитана.
    expect(step(keymap, startLine('ва', 'ru', first.stats), press('ы')).last).toBe('error');
    expect(startLine('ва', 'ru', emptyStats, false, false).forgive).toBe(false);
  });

  it('двойной Пробел после пенальти (005-Р26): пробел до начала строки — мимо, прощение цело', () => {
    const first = type(startLine('фы', 'ru', begun), [press('ф'), press('ы')]);
    let s = startLine('ва', 'ru', first.stats, false, true);
    s = type(s, [press(' '), press(' ')]);
    expect([s.pos, s.last, s.lineErrors, s.stats.errors, s.forgive]).toEqual([0, 'ignored', 0, 0, true]);
    expect(s.stats.intervals).toBe(first.stats.intervals);
    // Первое неверное после пробелов всё ещё прощается; дальше — как обычно.
    s = type(s, [press('ы'), press('в')]);
    expect([s.pos, s.lineErrors, s.stats.errors, s.forgive]).toEqual([1, 0, 0, false]);
    // Без прощения пробел вместо буквы — ошибка, как раньше.
    expect(step(keymap, startLine('ва', 'ru', first.stats), press(' ')).last).toBe('error');
  });

  it('секундомер «мм:сс»', () => {
    expect([0, 999, 61_000, 754_500, -5].map(formatClock)).toEqual(['00:00', '00:00', '01:01', '12:34', '00:00']);
  });

  it('след ошибок: позиция с засчитанной ошибкой отмечена один раз; прощённое и подсказки — без отметки', () => {
    // Начало тайма: первое неверное прощается — следа нет.
    let s = step(keymap, startLine('фы ва', 'ru'), press('в'));
    expect(s.missed).toEqual([]);
    s = type(s, [press('ф'), press('в'), press('в'), press('ы')]);
    // Две ошибки на «ы» — одна отметка; курсор ушёл дальше, отметка осталась.
    expect([s.missed, s.lineErrors, s.pos]).toEqual([[1], 2, 2]);
    // Ошибка на пробеле — отмечен пробел.
    s = type(s, [press('в'), press(' ')]);
    expect(s.missed).toEqual([1, 2]);
    // Латиница на той же клавише, Caps Lock, numpad, Enter — подсказки, не след.
    s = type(s, [press('d'), press('В', { caps: true }), { ...press('1'), code: 'Numpad1' }, enter()]);
    expect([s.missed, s.stats.errors]).toEqual([[1, 2], 3]);
    s = type(s, [press('в'), press('ы'), press('а')]);
    expect([s.missed, isDone(s)]).toEqual([[1, 2, 4], true]);
    // Новая строка — след с чистого листа, счётчики тайма идут дальше.
    expect(startLine('ф', 'ru', s.stats, true).missed).toEqual([]);
    expect(typeLine(keymap, startLine('фыва', 'ru'), 2, 0, 100).missed).toEqual([1]);
  });

  it('набор строки без клавиатуры (проверки при разработке): до конца, с заданным числом ошибок', () => {
    // Начало тайма: первое нажатие верное, иначе промах простился бы и ошибок вышло бы меньше.
    const s = typeLine(keymap, startLine('фыва Фыва', 'ru'), 2, 1000, 250);
    expect(isDone(s)).toBe(true);
    expect([s.lineErrors, s.stats.errors, s.stats.correct]).toEqual([2, 2, 9]);
    expect(s.stats.keyErrors).toEqual({ KeyS: 2 });
    expect([s.stats.startedAt, s.stats.lastAt, halfTime(s.stats)]).toEqual([1000, 3500, 2500]);
    expect(typeLine(keymap, startLine('олдж', 'ru', begun), 0, 0, 100).lineErrors).toBe(0);
  });
});

describe('движок печати: 200 случайных нажатий', () => {
  // Лента из букв строки, соседних букв, латиницы и шума — как у ребёнка, который путается.
  const TEXT = 'фыва олдж фыва';
  const POOL = [...'фываолджпрэ ', ...'asdf', '5'];

  for (const seed of [1, 7, 42]) {
    it(`зерно ${seed}: инварианты держатся на каждом шаге`, () => {
      const rnd = createRandom(seed);
      let s = startLine(TEXT, 'ru');
      let time = 0;
      /** Где были засчитанные ошибки — след должен совпасть с ними. */
      const errorsAt = new Set<number>();
      for (let i = 0; i < 200; i++) {
        time += 50 + randomInt(rnd, 400);
        const want = s.text[s.pos];
        const ch = want !== undefined && rnd() < 0.6 ? want : pick(rnd, POOL);
        const k = press(ch, { repeat: rnd() < 0.05, caps: rnd() < 0.05 });
        const prev = s;
        s = step(keymap, s, { ...k, time });

        expect(s.pos).toBeGreaterThanOrEqual(prev.pos);
        expect(s.pos - prev.pos).toBeLessThanOrEqual(1);
        expect(s.pos).toBeLessThanOrEqual(TEXT.length);
        expect(s.stats.correct).toBe(s.pos);
        expect(accuracy(s.stats)).toBeGreaterThanOrEqual(0);
        expect(accuracy(s.stats)).toBeLessThanOrEqual(1);
        const sum = (r: object) => Object.values(r as Record<string, number>).reduce((a, b) => a + b, 0);
        expect(sum(s.stats.keyErrors)).toBe(s.stats.errors);
        expect(sum(s.stats.fingerErrors)).toBe(s.stats.errors);
        expect(s.lineErrors).toBe(s.stats.errors);
        if (s.last === 'error') errorsAt.add(prev.pos);
        expect(s.missed).toEqual([...errorsAt].sort((a, b) => a - b));
        for (const [j, at] of s.missed.entries()) {
          expect(at).toBeLessThanOrEqual(s.pos);
          if (j > 0) expect(at).toBeGreaterThan(s.missed[j - 1] ?? -1);
        }
        if (s.stats.startedAt !== null && s.stats.lastAt !== null) {
          expect(s.stats.lastAt).toBeGreaterThanOrEqual(s.stats.startedAt);
          expect(halfTime(s.stats)).toBe(s.stats.lastAt - s.stats.startedAt);
        }
        expect(s.stats.intervals.length).toBe(Math.max(0, s.stats.correct + s.stats.errors - 1));
        expect(evenness(s.stats)).toBeGreaterThanOrEqual(0);
        expect(evenness(s.stats)).toBeLessThanOrEqual(1);
      }
    });
  }
});
