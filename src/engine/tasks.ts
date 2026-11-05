/**
 * Олимпиадные задачи для пенальти: разбор из content и выбор задачи на матч.
 * Чистые функции: случайность приходит зерном снаружи, поэтому выбор повторяется в тесте.
 */
import { gcd, normalizeWord, type TaskAnswer } from './answers';
import { createRandom, pick } from './random';

export const taskLevels = [1, 2, 3] as const;
/** 1 — разминка, 2 — средняя, 3 — трудная. */
export type TaskLevel = (typeof taskLevels)[number];

/** Задача с ответом одного из видов (answers.ts). verified — ответ перерешан независимо и совпал. */
export interface Task {
  id: string;
  text: string;
  answer: TaskAnswer;
  solution: string;
  verified: boolean;
  level: TaskLevel;
}

/** Сколько вариантов у выбора: букв А–Е шесть, меньше двух — не выбор. */
export const MAX_OPTIONS = 6;

type Raw = Record<string, unknown>;

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

/** Список непустых различных строк длиной от min до max. */
function textList(v: unknown, min: number, max: number, where: string): string[] {
  if (!Array.isArray(v) || v.length < min || v.length > max || !v.every(isText)) {
    throw new Error(`${where}: expected ${min}–${max} strings`);
  }
  if (new Set(v.map(normalizeWord)).size !== v.length) throw new Error(`${where}: duplicate`);
  return v;
}

/** Номер варианта из списка длины n. */
function index(v: unknown, n: number, where: string): number {
  if (!isInt(v) || v < 0 || v >= n) throw new Error(`${where}: expected option index`);
  return v;
}

/** Флаг: отсутствует — false. */
function flag(r: Raw, key: string, where: string): boolean {
  const v = r[key];
  if (v === undefined) return false;
  if (typeof v !== 'boolean') throw new Error(`${where}.${key}: expected boolean`);
  return v;
}

const allowedKeys: Record<TaskAnswer['kind'], readonly string[]> = {
  integer: ['value'],
  fraction: ['num', 'den', 'mixed', 'reduced'],
  fields: ['fields', 'unordered'],
  choice: ['options', 'correct'],
  multi: ['options', 'correct'],
  order: ['items'],
  text: ['accepted'],
};

/**
 * Ответ задачи. Целое можно записать просто числом («answer»: 15) — так записаны первые задачи.
 * Лишний ключ — ошибка: опечатка в «reduced» иначе молча сделала бы проверку мягкой.
 */
export function parseAnswer(v: unknown, where: string): TaskAnswer {
  if (typeof v === 'number') {
    if (!isInt(v)) throw new Error(`${where}: expected integer`);
    return { kind: 'integer', value: v };
  }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where}: expected integer or object`);
  const r = v as Raw;
  const kind = r.kind;
  if (typeof kind !== 'string' || !(kind in allowedKeys)) throw new Error(`${where}.kind: unknown answer kind`);
  const k = kind as TaskAnswer['kind'];
  const extra = Object.keys(r).filter((key) => key !== 'kind' && !allowedKeys[k].includes(key));
  if (extra.length > 0) throw new Error(`${where}: unknown key ${extra.join(', ')}`);

  switch (k) {
    case 'integer':
      if (!isInt(r.value)) throw new Error(`${where}.value: expected integer`);
      return { kind: 'integer', value: r.value };

    case 'fraction': {
      const { num, den } = r;
      if (!isInt(num) || num < 1) throw new Error(`${where}.num: expected positive integer`);
      if (!isInt(den) || den < 2) throw new Error(`${where}.den: expected integer ≥ 2`);
      // Целое значение — это не задача на дробь, а у смешанного числа без дробной части нет записи.
      if (num % den === 0) throw new Error(`${where}: fraction equals an integer`);
      const reduced = flag(r, 'reduced', where);
      if (reduced && gcd(num, den) !== 1) throw new Error(`${where}: reduced answer must be irreducible`);
      return { kind: 'fraction', num, den, mixed: flag(r, 'mixed', where), reduced };
    }

    case 'fields': {
      const list = r.fields;
      if (!Array.isArray(list) || list.length < 2 || list.length > 4) throw new Error(`${where}.fields: expected 2–4 fields`);
      const fields = list.map((f: unknown, i) => {
        const fr = (f ?? {}) as Raw;
        if (!isText(fr.label)) throw new Error(`${where}.fields[${i}].label: expected string`);
        if (!isInt(fr.value)) throw new Error(`${where}.fields[${i}].value: expected integer`);
        return { label: fr.label, value: fr.value };
      });
      if (new Set(fields.map((f) => f.label)).size !== fields.length) throw new Error(`${where}.fields: duplicate label`);
      return { kind: 'fields', fields, unordered: flag(r, 'unordered', where) };
    }

    case 'choice': {
      const options = textList(r.options, 2, MAX_OPTIONS, `${where}.options`);
      return { kind: 'choice', options, correct: index(r.correct, options.length, `${where}.correct`) };
    }

    case 'multi': {
      const options = textList(r.options, 2, MAX_OPTIONS, `${where}.options`);
      const c = r.correct;
      if (!Array.isArray(c) || c.length === 0) throw new Error(`${where}.correct: expected non-empty list`);
      const correct = c.map((x: unknown) => index(x, options.length, `${where}.correct`));
      if (new Set(correct).size !== correct.length) throw new Error(`${where}.correct: duplicate`);
      return { kind: 'multi', options, correct: correct.sort((a, b) => a - b) };
    }

    case 'order':
      return { kind: 'order', items: textList(r.items, 3, 7, `${where}.items`) };

    case 'text':
      return { kind: 'text', accepted: textList(r.accepted, 1, 10, `${where}.accepted`) };
  }
}

/** Разбор списка задач из content: ошибка в данных должна падать в тесте, а не на экране ребёнка. */
export function parseTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) throw new Error('tasks: expected array');
  const ids = new Set<string>();
  return raw.map((item: unknown, n) => {
    const r = (item ?? {}) as Raw;
    const str = (key: string): string => {
      const v = r[key];
      if (!isText(v)) throw new Error(`tasks[${n}].${key}: expected string`);
      return v;
    };
    const id = str('id');
    if (ids.has(id)) throw new Error(`tasks[${n}]: duplicate id ${id}`);
    ids.add(id);
    const { verified, level } = r;
    const answer = parseAnswer(r.answer, `tasks[${n}].answer`);
    if (typeof verified !== 'boolean') throw new Error(`tasks[${n}].verified: expected boolean`);
    if (!(taskLevels as readonly unknown[]).includes(level)) throw new Error(`tasks[${n}].level: expected 1, 2 or 3`);
    return {
      id,
      text: str('text'),
      answer,
      solution: str('solution'),
      verified,
      level: level as TaskLevel,
    };
  });
}

/**
 * Задача на пенальти по зерну. Показываем только проверенные задачи: неверный «правильный
 * ответ» на экране хуже, чем повтор. Сначала — ещё не решённые; среди них — нужного уровня,
 * если такие есть. Всё решено — берём из всех проверенных (тем же порядком: уровень, если есть).
 */
export function pickTask(
  tasks: readonly Task[],
  seed: number,
  solved: readonly string[],
  level?: TaskLevel,
): Task {
  const verified = tasks.filter((t) => t.verified);
  if (verified.length === 0) throw new Error('pickTask: no verified tasks');
  const done = new Set(solved);
  const fresh = verified.filter((t) => !done.has(t.id));
  const pool = fresh.length > 0 ? fresh : verified;
  const sameLevel = level === undefined ? [] : pool.filter((t) => t.level === level);
  return pick(createRandom(seed), sameLevel.length > 0 ? sameLevel : pool);
}

/**
 * Задачи серии пенальти по зерну: n разных проверенных задач, кроме уже взятых в серию (exclude).
 * Сначала — нерешённые; среди них — вид ответа, которого в серии ещё нет: серия учит разным
 * олимпиадным полям. Задач меньше n — сколько есть. Порядок — от лёгкой к трудной.
 */
export function pickSeries(
  tasks: readonly Task[],
  seed: number,
  solved: readonly string[],
  n: number,
  exclude: readonly string[] = [],
): Task[] {
  const rnd = createRandom(seed);
  const done = new Set(solved);
  const taken = new Set(exclude);
  const kinds = new Set(tasks.filter((t) => taken.has(t.id)).map((t) => t.answer.kind));
  const out: Task[] = [];
  while (out.length < n) {
    const left = tasks.filter((t) => t.verified && !taken.has(t.id));
    if (left.length === 0) break;
    const fresh = left.filter((t) => !done.has(t.id));
    const pool = fresh.length > 0 ? fresh : left;
    const newKind = pool.filter((t) => !kinds.has(t.answer.kind));
    const task = pick(rnd, newKind.length > 0 ? newKind : pool);
    out.push(task);
    taken.add(task.id);
    kinds.add(task.answer.kind);
  }
  return out.sort((a, b) => a.level - b.level);
}

/** Быстрая задача — для пенальти посреди тайма (спека 005, 005-Р4): короткое условие, уровень не выше. */
export const QUICK_TEXT_MAX = 120;
export const QUICK_LEVEL_MAX = 2;

/** Задача быстрая: условие не длиннее QUICK_TEXT_MAX знаков и уровень не выше QUICK_LEVEL_MAX; вид ответа любой. */
export function isQuick(task: Task): boolean {
  return [...task.text].length <= QUICK_TEXT_MAX && task.level <= QUICK_LEVEL_MAX;
}

/**
 * Задача пенальти посреди матча по зерну: проверенная и быстрая. Сначала — не взятые в этом матче
 * (exclude: промах в первом тайме не повторится во втором), среди них — нерешённые. Нерешённые
 * кончились — повтор решённых, как в серии. Быстрых проверенных нет — null: пенальти не будет.
 */
export function pickQuick(
  tasks: readonly Task[],
  seed: number,
  solved: readonly string[],
  exclude: readonly string[] = [],
): Task | null {
  const quick = tasks.filter((t) => t.verified && isQuick(t));
  if (quick.length === 0) return null;
  const taken = new Set(exclude);
  const done = new Set(solved);
  const notTaken = quick.filter((t) => !taken.has(t.id));
  const base = notTaken.length > 0 ? notTaken : quick;
  const fresh = base.filter((t) => !done.has(t.id));
  return pick(createRandom(seed), fresh.length > 0 ? fresh : base);
}
