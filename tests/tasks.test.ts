/**
 * Задачи для пенальти: данные из content, проверка ответов всех видов и выбор задачи по зерну.
 */
import { describe, expect, it } from 'vitest';
import { tasks } from '../src/app/tasks';
import {
  answerKinds,
  answerText,
  checkAnswer,
  checkNumberAnswer,
  correctInput,
  initialOrder,
  moveItem,
  parseInteger,
  seedFromText,
  unquote,
  wrongReason,
} from '../src/engine/answers';
import { createRandom } from '../src/engine/random';
import {
  QUICK_TEXT_MAX,
  isQuick,
  parseTasks,
  pickQuick,
  pickSeries,
  pickTask,
  type Task,
} from '../src/engine/tasks';

describe('задачи из content', () => {
  it('все разбираются, уровни 1–3 представлены', () => {
    expect(tasks.length).toBeGreaterThanOrEqual(15);
    for (const level of [1, 2, 3] as const) {
      expect(tasks.filter((t) => t.level === level).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('у каждой проверенной задачи записанный ответ проходит проверку', () => {
    const verified = tasks.filter((t) => t.verified);
    expect(verified.length).toBeGreaterThan(0);
    const bad = verified.filter((t) => checkAnswer(t.answer, correctInput(t.answer)) !== 'correct');
    expect(bad.map((t) => t.id)).toEqual([]);
    // Целые — и прежней проверкой: старые задачи не изменили поведения.
    const ints = verified.flatMap((t) => (t.answer.kind === 'integer' ? [t.answer.value] : []));
    expect(ints.length).toBeGreaterThanOrEqual(16);
    expect(ints.filter((n) => checkNumberAnswer(String(n), n) !== 'correct')).toEqual([]);
  });

  it('каждый вид ответа есть среди проверенных задач — хотя бы по две', () => {
    const verified = tasks.filter((t) => t.verified);
    const short = answerKinds.filter((kind) => verified.filter((t) => t.answer.kind === kind).length < 2);
    expect(short).toEqual([]);
  });
});

describe('ответ-целое число', () => {
  it.each([
    ['12', 12, 'correct'],
    ['13', 12, 'wrong'],
    [' 12 ', 12, 'correct'],
    ['1 000', 1000, 'correct'],
    ['1000', 1000, 'correct'],
    ['12 345 678', 12345678, 'correct'],
    ['1 000', 1000, 'correct'],
    ['-7', -7, 'correct'],
    ['−7', -7, 'correct'],
    ['7', -7, 'wrong'],
    ['-0', 0, 'correct'],
    // Ведущие нули не мешают: число то же.
    ['012', 12, 'correct'],
    // «+12» — не запись целого на олимпиаде; подсказка формата, попытка цела.
    ['+12', 12, 'format'],
    ['12,5', 12, 'format'],
    ['12.5', 12, 'format'],
    ['12.', 12, 'format'],
    ['1/2', 12, 'format'],
    ['', 12, 'format'],
    ['   ', 12, 'format'],
    ['12a', 12, 'format'],
    ['двенадцать', 12, 'format'],
    ['-', 12, 'format'],
    ['- 7', -7, 'format'],
    // Разряды — только по три цифры.
    ['10 00', 1000, 'format'],
    ['1 0000', 10000, 'format'],
    ['1e3', 1000, 'format'],
    ['99999999999999999999', 0, 'format'],
  ] as const)('«%s» при ответе %d — %s', (input, answer, verdict) => {
    expect(checkNumberAnswer(input, answer)).toBe(verdict);
  });

  it('разбор возвращает число или null', () => {
    expect(parseInteger('  1  000 ')).toBe(1000);
    expect(parseInteger('–5')).toBe(-5);
    expect(parseInteger('abc')).toBeNull();
  });
});

const task = (id: string, level: Task['level'], verified = true): Task => ({
  id,
  text: 'text',
  answer: { kind: 'integer', value: 1 },
  solution: 'solution',
  verified,
  level,
});

describe('выбор задачи', () => {
  const list = [task('a', 1), task('b', 1), task('c', 2), task('d', 3), task('x', 1, false)];

  it('по одному зерну — одна и та же задача, разные зёрна дают разные', () => {
    expect(pickTask(list, 42, []).id).toBe(pickTask(list, 42, []).id);
    const seen = new Set(Array.from({ length: 40 }, (_, s) => pickTask(list, s, []).id));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('непроверенную задачу не показывает', () => {
    const ids = Array.from({ length: 60 }, (_, s) => pickTask(list, s, []).id);
    expect(ids).not.toContain('x');
    expect(() => pickTask([task('x', 1, false)], 1, [])).toThrow(/verified/);
  });

  it('сначала нерешённые', () => {
    for (let s = 0; s < 30; s++) expect(pickTask(list, s, ['a', 'b', 'c']).id).toBe('d');
  });

  it('уровень: берёт задачу этого уровня, если такая есть', () => {
    for (let s = 0; s < 30; s++) {
      expect(pickTask(list, s, [], 2).id).toBe('c');
      expect(['a', 'b']).toContain(pickTask(list, s, ['c'], 1).id);
    }
    // Нерешённых нужного уровня нет — нерешённая другого уровня важнее повтора.
    for (let s = 0; s < 30; s++) expect(['c', 'd']).toContain(pickTask(list, s, ['a', 'b'], 1).id);
  });

  it('всё решено — всё равно выдаёт задачу (и уровень учитывает)', () => {
    const all = ['a', 'b', 'c', 'd'];
    expect(['a', 'b', 'c', 'd']).toContain(pickTask(list, 7, all).id);
    for (let s = 0; s < 30; s++) expect(pickTask(list, s, all, 3).id).toBe('d');
  });

  it('работает на настоящих задачах', () => {
    expect(tasks).toContain(pickTask(tasks, 2026, [], 1));
  });
});

describe('задачи серии пенальти', () => {
  const choice = (id: string, level: Task['level']): Task => ({
    ...task(id, level),
    answer: { kind: 'choice', options: ['да', 'нет'], correct: 0 },
  });
  const list = [task('a', 2), task('b', 1), task('c', 3), choice('k', 3), task('x', 1, false)];

  it('разные проверенные задачи, сначала нерешённые; одно зерно — та же серия', () => {
    for (let s = 0; s < 30; s++) {
      const ids = pickSeries(list, s, ['a'], 3).map((t) => t.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids).not.toContain('x');
      expect(ids).not.toContain('a');
    }
    expect(pickSeries(list, 9, [], 3)).toEqual(pickSeries(list, 9, [], 3));
  });

  it('разные виды ответа, если есть: выбор попадает в каждую серию', () => {
    for (let s = 0; s < 30; s++) expect(pickSeries(list, s, [], 2).map((t) => t.answer.kind)).toContain('choice');
  });

  it('от лёгкой к трудной; уже взятые в серию не повторяются; задач мало — сколько есть', () => {
    for (let s = 0; s < 30; s++) {
      const levels = pickSeries(list, s, [], 3).map((t) => t.level);
      expect(levels).toEqual([...levels].sort((p, q) => p - q));
      expect(pickSeries(list, s, [], 3, ['b', 'c']).map((t) => t.id).sort()).toEqual(['a', 'k']);
    }
    expect(pickSeries(list, 1, [], 9)).toHaveLength(4);
    // Всё решено — повторы решённых лучше пустой серии.
    expect(pickSeries(list, 1, ['a', 'b', 'c', 'k'], 3)).toHaveLength(3);
  });

  it('работает на настоящих задачах: три разных вида ответа', () => {
    const series = pickSeries(tasks, 2026, [], 3);
    expect(new Set(series.map((t) => t.answer.kind)).size).toBe(3);
  });
});

describe('быстрые задачи: пенальти посреди матча (005)', () => {
  const long = { ...task('long', 1), text: 'я'.repeat(QUICK_TEXT_MAX + 1) };
  const edge = { ...task('edge', 2), text: 'я'.repeat(QUICK_TEXT_MAX) };
  const list = [task('a', 1), task('b', 2), task('c', 3), long, edge, task('x', 1, false)];

  it('быстрая — условие не длиннее 120 знаков и уровень не выше 2; вид ответа любой', () => {
    expect(list.filter(isQuick).map((t) => t.id)).toEqual(['a', 'b', 'edge', 'x']);
  });

  it('только проверенные быстрые; сначала нерешённые; одно зерно — та же задача', () => {
    const seen = new Set<string | undefined>();
    for (let s = 0; s < 40; s++) {
      seen.add(pickQuick(list, s, [])?.id);
      expect(pickQuick(list, s, ['a', 'b'])?.id).toBe('edge');
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'edge']);
    expect(pickQuick(list, 5, [])).toEqual(pickQuick(list, 5, []));
  });

  it('взятые в этом матче — в последнюю очередь; всё решено — повтор решённых; быстрых нет — null', () => {
    for (let s = 0; s < 30; s++) {
      expect(pickQuick(list, s, [], ['a', 'b'])?.id).toBe('edge');
      // Не взятая, хоть и решённая, — раньше взятой в этом матче.
      expect(pickQuick(list, s, ['a'], ['b', 'edge'])?.id).toBe('a');
      expect(['a', 'b', 'edge']).toContain(pickQuick(list, s, ['a', 'b', 'edge'])?.id);
      expect(['a', 'b', 'edge']).toContain(pickQuick(list, s, [], ['a', 'b', 'edge'])?.id);
    }
    expect(pickQuick([task('c', 3), long, task('x', 1, false)], 1, [])).toBeNull();
  });

  it('на настоящих задачах: быстрых не меньше 30, все виды ответа; нерешённые идут без повторов', () => {
    const quick = tasks.filter((t) => t.verified && isQuick(t));
    expect(quick.length).toBeGreaterThanOrEqual(30);
    expect(new Set(quick.map((t) => t.answer.kind)).size).toBe(answerKinds.length);
    const solved: string[] = [];
    for (let s = 0; s < quick.length; s++) {
      const t = pickQuick(tasks, s, solved);
      expect(t !== null && t.verified && isQuick(t)).toBe(true);
      expect(solved).not.toContain(t?.id);
      solved.push(t?.id ?? '');
    }
    expect(quick.map((t) => t.id)).toEqual(expect.arrayContaining(solved));
    expect(pickQuick(tasks, 1, solved)).not.toBeNull();
  });
});

describe('ошибки в данных задач', () => {
  const ok = { id: 't-1', text: 'text', answer: 12, solution: 'solution', verified: true, level: 1 };

  it('разбор ловит ошибки', () => {
    // Целое можно записать просто числом — внутри оно становится ответом вида integer.
    expect(parseTasks([ok])).toEqual([{ ...ok, answer: { kind: 'integer', value: 12 } }]);
    expect(() => parseTasks({})).toThrow(/array/);
    expect(() => parseTasks([ok, ok])).toThrow(/duplicate/);
    expect(() => parseTasks([{ ...ok, id: '' }])).toThrow(/id/);
    expect(() => parseTasks([{ ...ok, text: '  ' }])).toThrow(/text/);
    expect(() => parseTasks([{ ...ok, solution: undefined }])).toThrow(/solution/);
    expect(() => parseTasks([{ ...ok, answer: 12.5 }])).toThrow(/answer/);
    expect(() => parseTasks([{ ...ok, answer: '12' }])).toThrow(/answer/);
    expect(() => parseTasks([{ ...ok, verified: 'yes' }])).toThrow(/verified/);
    expect(() => parseTasks([{ ...ok, level: 4 }])).toThrow(/level/);
    expect(() => parseTasks([{ ...ok, level: '1' }])).toThrow(/level/);
    expect(() => parseTasks([null])).toThrow(/id/);
  });

  // Ошибка в ответе задачи — по одной на правило разбора.
  const bad = (answer: unknown): (() => Task[]) => () => parseTasks([{ ...ok, answer }]);

  it('разбор ответа: вид и лишние ключи', () => {
    expect(bad(null)).toThrow(/answer/);
    expect(bad([1, 2])).toThrow(/answer/);
    expect(bad({ kind: 'essay' })).toThrow(/kind/);
    expect(bad({ value: 3 })).toThrow(/kind/);
    expect(bad({ kind: 'integer', value: 1.5 })).toThrow(/value/);
    // Опечатка в флаге не должна молча смягчить проверку.
    expect(bad({ kind: 'fraction', num: 1, den: 4, reduce: true })).toThrow(/unknown key reduce/);
    expect(parseTasks([{ ...ok, answer: { kind: 'integer', value: -3 } }])[0]?.answer).toEqual({
      kind: 'integer',
      value: -3,
    });
  });

  it('разбор дроби', () => {
    expect(parseTasks([{ ...ok, answer: { kind: 'fraction', num: 6, den: 8 } }])[0]?.answer).toEqual({
      kind: 'fraction',
      num: 6,
      den: 8,
      mixed: false,
      reduced: false,
    });
    expect(bad({ kind: 'fraction', num: 0, den: 4 })).toThrow(/num/);
    expect(bad({ kind: 'fraction', num: 1, den: 1 })).toThrow(/den/);
    expect(bad({ kind: 'fraction', num: 1, den: 0 })).toThrow(/den/);
    expect(bad({ kind: 'fraction', num: 8, den: 4 })).toThrow(/integer/);
    expect(bad({ kind: 'fraction', num: 6, den: 8, reduced: true })).toThrow(/irreducible/);
    expect(bad({ kind: 'fraction', num: 3, den: 8, mixed: 'yes' })).toThrow(/mixed/);
  });

  it('разбор полей, вариантов, порядка и слова', () => {
    const f = (label: string, value: unknown) => ({ label, value });
    expect(bad({ kind: 'fields', fields: [f('a =', 1)] })).toThrow(/2–4/);
    expect(bad({ kind: 'fields', fields: [f('a =', 1), f('a =', 2)] })).toThrow(/duplicate label/);
    expect(bad({ kind: 'fields', fields: [f('a =', 1), f('', 2)] })).toThrow(/label/);
    expect(bad({ kind: 'fields', fields: [f('a =', 1), f('b =', '2')] })).toThrow(/value/);
    expect(bad({ kind: 'choice', options: ['1'], correct: 0 })).toThrow(/options/);
    expect(bad({ kind: 'choice', options: ['1', '2', '3', '4', '5', '6', '7'], correct: 0 })).toThrow(/options/);
    expect(bad({ kind: 'choice', options: ['1', ' 1 '], correct: 0 })).toThrow(/duplicate/);
    expect(bad({ kind: 'choice', options: ['1', '2'], correct: 2 })).toThrow(/correct/);
    expect(bad({ kind: 'multi', options: ['1', '2'], correct: [] })).toThrow(/correct/);
    expect(bad({ kind: 'multi', options: ['1', '2'], correct: [1, 1] })).toThrow(/duplicate/);
    expect(parseTasks([{ ...ok, answer: { kind: 'multi', options: ['1', '2', '3'], correct: [2, 0] } }])[0]?.answer)
      .toEqual({ kind: 'multi', options: ['1', '2', '3'], correct: [0, 2] });
    expect(bad({ kind: 'order', items: ['a', 'b'] })).toThrow(/items/);
    expect(bad({ kind: 'order', items: ['a', 'b', 'A'] })).toThrow(/duplicate/);
    expect(bad({ kind: 'text', accepted: [] })).toThrow(/accepted/);
    expect(bad({ kind: 'text', accepted: ['Ёж', 'еж'] })).toThrow(/duplicate/);
  });
});

describe('ответ-дробь', () => {
  const frac = (num: number, den: number, mixed = false, reduced = false) =>
    ({ kind: 'fraction', num, den, mixed, reduced }) as const;
  const input = (num: string, den: string, whole = '') => ({ kind: 'fraction', value: { whole, num, den } }) as const;

  it('по значению: любая запись того же числа', () => {
    expect(checkAnswer(frac(3, 4), input('3', '4'))).toBe('correct');
    expect(checkAnswer(frac(3, 4), input('6', '8'))).toBe('correct');
    expect(checkAnswer(frac(3, 4), input(' 03 ', '4'))).toBe('correct');
    expect(checkAnswer(frac(3, 4), input('4', '3'))).toBe('wrong');
    expect(checkAnswer(frac(3, 4), input('3', '5'))).toBe('wrong');
  });

  it('несократимая: сократимая запись — неверно', () => {
    expect(checkAnswer(frac(3, 4, false, true), input('3', '4'))).toBe('correct');
    expect(checkAnswer(frac(3, 4, false, true), input('6', '8'))).toBe('wrong');
  });

  it('смешанное число', () => {
    const a = frac(7, 3, true, true);
    expect(checkAnswer(a, input('1', '3', '2'))).toBe('correct');
    // Без целой части то же значение — неправильная дробь, а просили смешанное число.
    expect(checkAnswer(a, input('7', '3'))).toBe('wrong');
    expect(checkAnswer(a, input('2', '6', '2'))).toBe('wrong');
    expect(checkAnswer(a, input('4', '3', '1'))).toBe('wrong');
    expect(checkAnswer(a, input('1', '3', '1'))).toBe('wrong');
    // Не строгое смешанное — по значению.
    const loose = frac(7, 3, true, false);
    expect(['7/3', '1 4/3', '2 2/6'].map((s) => {
      const [w, f] = s.includes(' ') ? s.split(' ') : ['', s];
      const [n, d] = (f ?? '').split('/');
      return checkAnswer(loose, input(n ?? '', d ?? '', w ?? ''));
    })).toEqual(['correct', 'correct', 'correct']);
    // Целая часть у обычной дроби не показывается и не учитывается.
    expect(checkAnswer(frac(3, 4), input('3', '4', '5'))).toBe('correct');
  });

  it('неверно, но значение верное: причина для пояснения', () => {
    const a = frac(7, 3, true, true);
    expect(wrongReason(a, input('2', '6', '2'))).toBe('unreduced');
    expect(wrongReason(a, input('14', '6'))).toBe('unreduced');
    expect(wrongReason(a, input('7', '3'))).toBe('improper');
    expect(wrongReason(a, input('4', '3', '1'))).toBe('improper');
    expect(wrongReason(frac(3, 4, false, true), input('6', '8'))).toBe('unreduced');
    // Неверное значение, верный ответ, пустой ввод и нестрогая дробь — без пояснения.
    expect(wrongReason(a, input('1', '3', '1'))).toBeNull();
    expect(wrongReason(a, input('1', '3', '2'))).toBeNull();
    expect(wrongReason(a, input('', ''))).toBeNull();
    expect(wrongReason(frac(3, 4), input('6', '8'))).toBeNull();
    expect(wrongReason({ kind: 'integer', value: 5 }, { kind: 'integer', value: '5' })).toBeNull();
  });

  it('пусто, неполно, неверный формат — попытка цела', () => {
    expect(checkAnswer(frac(3, 4), input('', ' '))).toBe('empty');
    expect(checkAnswer(frac(7, 3, true), input('', '', '2'))).toBe('incomplete');
    expect(checkAnswer(frac(3, 4), input('3', ''))).toBe('incomplete');
    expect(checkAnswer(frac(3, 4), input('', '4'))).toBe('incomplete');
    expect(checkAnswer(frac(3, 4), input('3', '0'))).toBe('format');
    expect(checkAnswer(frac(3, 4), input('-3', '-4'))).toBe('format');
    expect(checkAnswer(frac(3, 4), input('3,0', '4'))).toBe('format');
    expect(checkAnswer(frac(3, 4), input('3/4', '1'))).toBe('format');
    expect(checkAnswer(frac(7, 3, true), input('1', '3', 'два'))).toBe('format');
  });

  it('длинный ввод не теряет точность', () => {
    // 7 · 5000000000000002 и 5 · 7000000000000003 отличаются на 1, а в обычных числах совпали бы.
    expect(checkAnswer(frac(5, 7), input('5000000000000002', '7000000000000003'))).toBe('wrong');
    expect(checkAnswer(frac(5, 7), input('5000000000000000', '7000000000000000'))).toBe('correct');
    expect(checkAnswer(frac(1, 3), input('1', '99999999999999999999'))).toBe('format');
  });
});

describe('ответ — несколько полей', () => {
  const fields = (unordered = false) =>
    ({ kind: 'fields', fields: [{ label: 'a =', value: 3 }, { label: 'b =', value: 6 }], unordered }) as const;
  const input = (...value: string[]) => ({ kind: 'fields', value }) as const;

  it('порядок важен, если не сказано иное', () => {
    expect(checkAnswer(fields(), input('3', '6'))).toBe('correct');
    expect(checkAnswer(fields(), input(' 3', '06 '))).toBe('correct');
    expect(checkAnswer(fields(), input('6', '3'))).toBe('wrong');
    expect(checkAnswer(fields(true), input('6', '3'))).toBe('correct');
    expect(checkAnswer(fields(true), input('6', '6'))).toBe('wrong');
  });

  it('пусто, неполно, формат', () => {
    expect(checkAnswer(fields(), input('', ' '))).toBe('empty');
    expect(checkAnswer(fields(), input('3', ''))).toBe('incomplete');
    expect(checkAnswer(fields(), input('3'))).toBe('incomplete');
    expect(checkAnswer(fields(), input('3', '+6'))).toBe('format');
    expect(checkAnswer(fields(), input('3', 'шесть'))).toBe('format');
  });
});

describe('ответ — выбор вариантов', () => {
  const choice = { kind: 'choice', options: ['1', '2', '3'], correct: 1 } as const;
  const multi = { kind: 'multi', options: ['1', '2', '3', '4'], correct: [0, 2] } as const;

  it('один вариант', () => {
    expect(checkAnswer(choice, { kind: 'choice', value: 1 })).toBe('correct');
    expect(checkAnswer(choice, { kind: 'choice', value: 0 })).toBe('wrong');
    expect(checkAnswer(choice, { kind: 'choice', value: null })).toBe('empty');
  });

  it('несколько: только точное совпадение множества', () => {
    expect(checkAnswer(multi, { kind: 'multi', value: [0, 2] })).toBe('correct');
    expect(checkAnswer(multi, { kind: 'multi', value: [2, 0] })).toBe('correct');
    expect(checkAnswer(multi, { kind: 'multi', value: [0] })).toBe('wrong');
    expect(checkAnswer(multi, { kind: 'multi', value: [0, 2, 3] })).toBe('wrong');
    expect(checkAnswer(multi, { kind: 'multi', value: [1, 3] })).toBe('wrong');
    expect(checkAnswer(multi, { kind: 'multi', value: [] })).toBe('empty');
  });

  it('вид ввода не того вида — ошибка программы, а не ответ', () => {
    expect(() => checkAnswer(choice, { kind: 'multi', value: [1] })).toThrow(/multi input/);
  });
});

describe('ответ — порядок', () => {
  const order = { kind: 'order', items: ['a', 'b', 'c', 'd'] } as const;

  it('засчитывается только верная расстановка', () => {
    expect(checkAnswer(order, { kind: 'order', value: [0, 1, 2, 3] })).toBe('correct');
    expect(checkAnswer(order, { kind: 'order', value: [1, 0, 2, 3] })).toBe('wrong');
    expect(checkAnswer(order, { kind: 'order', value: [0, 1, 2] })).toBe('incomplete');
    expect(checkAnswer(order, { kind: 'order', value: [0, 1, 1, 3] })).toBe('incomplete');
  });

  it('стартовая расстановка перемешана, полна и не равна ответу', () => {
    for (let s = 0; s < 50; s++) {
      for (const n of [2, 3, 5]) {
        const o = initialOrder(n, createRandom(s));
        expect([...o].sort()).toEqual([...Array(n).keys()]);
        expect(o).not.toEqual([...Array(n).keys()]);
      }
    }
    expect(initialOrder(1, createRandom(1))).toEqual([0]);
    // Одна задача — одна и та же стартовая расстановка.
    const seed = seedFromText('penalty-t-order-time');
    expect(initialOrder(5, createRandom(seed))).toEqual(initialOrder(5, createRandom(seed)));
    expect(seedFromText('a')).not.toBe(seedFromText('b'));
  });

  it('перестановка пункта', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
    // За край — без изменений (кнопка «выше» у первого пункта ничего не ломает).
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 3)).toEqual(['a', 'b', 'c']);
  });

  it('пункт-название без своих кавычек: шаблон подсказки не удвоит их', () => {
    expect(unquote('«Заря»')).toBe('Заря');
    expect(unquote('Заря')).toBe('Заря');
    expect(unquote('«')).toBe('«');
    expect(unquote('«Маяк» и Заря')).toBe('«Маяк» и Заря');
  });
});

describe('ответ — слово', () => {
  const text = { kind: 'text', accepted: ['ёжик', 'еж'] } as const;
  const word = (value: string) => checkAnswer(text, { kind: 'text', value });

  it('без регистра, Ё = Е, пробелы по краям не мешают', () => {
    expect(word('ёжик')).toBe('correct');
    expect(word('ЕЖИК')).toBe('correct');
    expect(word('  Ежик ')).toBe('correct');
    expect(word('Ёж')).toBe('correct');
    expect(word('ежи')).toBe('wrong');
  });

  it('пусто — не ответ, несколько слов вместо одного — подсказка формата', () => {
    expect(word('   ')).toBe('empty');
    expect(word('это ежик')).toBe('format');
    // Если в списке есть ответ из двух слов, пробел — не ошибка формата.
    expect(checkAnswer({ kind: 'text', accepted: ['в среду'] }, { kind: 'text', value: 'В  среду' })).toBe('correct');
  });
});

describe('ответ-целое через общую проверку', () => {
  it('пустое поле — empty, остальное — как checkNumberAnswer', () => {
    const a = { kind: 'integer', value: 12 } as const;
    expect(checkAnswer(a, { kind: 'integer', value: '  ' })).toBe('empty');
    expect(checkAnswer(a, { kind: 'integer', value: '012' })).toBe('correct');
    expect(checkAnswer(a, { kind: 'integer', value: '+12' })).toBe('format');
    expect(checkAnswer(a, { kind: 'integer', value: '13' })).toBe('wrong');
  });
});

describe('правильный ответ строкой', () => {
  const letters = ['А', 'Б', 'В'];

  it('для каждого вида', () => {
    expect(answerText({ kind: 'integer', value: -5 }, letters)).toBe('-5');
    expect(answerText({ kind: 'fraction', num: 3, den: 8, mixed: false, reduced: false }, letters)).toBe('3/8');
    expect(answerText({ kind: 'fraction', num: 7, den: 3, mixed: true, reduced: true }, letters)).toBe('2 1/3');
    expect(answerText({ kind: 'fraction', num: 2, den: 3, mixed: true, reduced: true }, letters)).toBe('2/3');
    expect(
      answerText({ kind: 'fields', fields: [{ label: 'Петя:', value: 8 }, { label: 'Вася:', value: 5 }], unordered: false }, letters),
    ).toBe('Петя: 8, Вася: 5');
    expect(answerText({ kind: 'choice', options: ['x', 'y'], correct: 1 }, letters)).toBe('Б) y');
    expect(answerText({ kind: 'multi', options: ['x', 'y', 'z'], correct: [0, 2] }, letters)).toBe('А) x; В) z');
    expect(answerText({ kind: 'order', items: ['a', 'b', 'c'] }, letters)).toBe('a → b → c');
    expect(answerText({ kind: 'text', accepted: ['среда', 'среду'] }, letters)).toBe('среда');
  });
});
