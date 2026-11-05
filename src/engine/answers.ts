/**
 * Проверка ответов, как на олимпиадах: неверный формат — не ошибка, а подсказка,
 * попытка при этом не списывается. Виды ответа — как в интерфейсах олимпиад: число, дробь,
 * несколько полей, выбор одного и нескольких вариантов, порядок, слово.
 */

export type AnswerVerdict = 'correct' | 'wrong' | 'format';

/**
 * Итог проверки любого вида ответа. empty — ничего не введено, incomplete — заполнено не всё:
 * оба, как и format, попытку не тратят.
 */
export type CheckResult = AnswerVerdict | 'empty' | 'incomplete';

export const answerKinds = ['integer', 'fraction', 'fields', 'choice', 'multi', 'order', 'text'] as const;
export type AnswerKind = (typeof answerKinds)[number];

/** Одно целое число. */
export interface IntegerAnswer {
  kind: 'integer';
  value: number;
}

/**
 * Обыкновенная дробь num/den (неправильная, если больше 1). mixed — показать поле целой части
 * (смешанное число). reduced — засчитывать только несократимую запись (у смешанного числа —
 * ещё и правильную дробную часть), иначе — любую запись того же значения.
 */
export interface FractionAnswer {
  kind: 'fraction';
  num: number;
  den: number;
  mixed: boolean;
  reduced: boolean;
}

/** Несколько подписанных полей, в каждом — целое. unordered — числа можно вписать в любом порядке. */
export interface FieldsAnswer {
  kind: 'fields';
  fields: readonly { label: string; value: number }[];
  unordered: boolean;
}

/** Выбор одного варианта: correct — номер верного (с нуля). */
export interface ChoiceAnswer {
  kind: 'choice';
  options: readonly string[];
  correct: number;
}

/** Выбор нескольких: correct — номера верных (с нуля, по возрастанию). */
export interface MultiAnswer {
  kind: 'multi';
  options: readonly string[];
  correct: readonly number[];
}

/** Расставить по порядку: items записаны в верном порядке, показываются перемешанными. */
export interface OrderAnswer {
  kind: 'order';
  items: readonly string[];
}

/** Короткий ответ словом: подходит любое из accepted. */
export interface TextAnswer {
  kind: 'text';
  accepted: readonly string[];
}

export type TaskAnswer =
  | IntegerAnswer
  | FractionAnswer
  | FieldsAnswer
  | ChoiceAnswer
  | MultiAnswer
  | OrderAnswer
  | TextAnswer;

/** Ввод дроби: целая часть (если есть), числитель, знаменатель — как набрано. */
export interface FractionInput {
  whole: string;
  num: string;
  den: string;
}

/** Что ввёл ребёнок. order — номера пунктов (из items) в том порядке, как он их расставил. */
export type AnswerInput =
  | { kind: 'integer'; value: string }
  | { kind: 'fraction'; value: FractionInput }
  | { kind: 'fields'; value: string[] }
  | { kind: 'choice'; value: number | null }
  | { kind: 'multi'; value: number[] }
  | { kind: 'order'; value: number[] }
  | { kind: 'text'; value: string };

// Минус: обычный дефис, математический «−» и короткое тире — их подставляют разные клавиатуры.
const MINUS = /^[-−–]/;
// Цифры подряд или разряды через пробел: «1000», «1 000», «12 345 678».
const PLAIN = /^\d+$/;
const GROUPED = /^\d{1,3}( \d{3})+$/;

const blank = (s: string): boolean => s.trim() === '';

/**
 * Целое число из ввода или null, если формат неверный.
 * Пробелы по краям убираются, повторные — схлопываются (неразрывные тоже).
 * Ведущие нули допустимы («012» — это 12). Знак «+», запятая, точка, дробь — не целое число.
 */
export function parseInteger(input: string): number | null {
  let s = input.replace(/\s+/g, ' ').trim();
  let sign = 1;
  if (MINUS.test(s)) {
    sign = -1;
    s = s.slice(1);
  }
  if (!PLAIN.test(s) && !GROUPED.test(s)) return null;
  const n = Number(s.replace(/ /g, ''));
  if (!Number.isSafeInteger(n)) return null;
  return n === 0 ? 0 : sign * n;
}

/** Ответ-целое: верно, неверно или неверный формат (тогда попытка не тратится). */
export function checkNumberAnswer(input: string, answer: number): AnswerVerdict {
  const n = parseInteger(input);
  if (n === null) return 'format';
  return n === answer ? 'correct' : 'wrong';
}

/** Наибольший общий делитель неотрицательных целых. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/** Целое без знака (для частей дроби) или null. */
export function parseNatural(input: string): number | null {
  const n = parseInteger(input);
  return n === null || n < 0 || MINUS.test(input.trim()) ? null : n;
}

/** Разобранная дробь: целая часть, числитель, знаменатель — или итог, который не даёт сравнивать. */
type ParsedFraction = { w: number; n: number; d: number } | Exclude<CheckResult, 'correct' | 'wrong'>;

function parseFraction(answer: FractionAnswer, input: FractionInput): ParsedFraction {
  const whole = answer.mixed ? input.whole : '';
  if (blank(whole) && blank(input.num) && blank(input.den)) return 'empty';
  if (blank(input.num) || blank(input.den)) return 'incomplete';
  const w = blank(whole) ? 0 : parseNatural(whole);
  const n = parseNatural(input.num);
  const d = parseNatural(input.den);
  if (w === null || n === null || d === null || d === 0) return 'format';
  return { w, n, d };
}

/**
 * Почему верное по значению число всё же неверно: unreduced — дробь сократима (2 2/6 вместо 2 1/3),
 * improper — у смешанного числа дробная часть не меньше 1 (7/3 или 1 4/3 вместо 2 1/3).
 */
export type WrongReason = 'unreduced' | 'improper';

/** Значение совпало, запись — нет: причина; совпало и запись верна — null. Значения сравниваются в BigInt. */
function fractionForm(answer: FractionAnswer, f: { w: number; n: number; d: number }): WrongReason | null | 'value' {
  const left = (BigInt(f.w) * BigInt(f.d) + BigInt(f.n)) * BigInt(answer.den);
  const right = BigInt(answer.num) * BigInt(f.d);
  if (left !== right) return 'value';
  if (!answer.reduced) return null;
  // Несократимая запись: дробная часть не сокращается, у смешанного числа она ещё и меньше 1.
  // Значение дроби не целое (это стережёт разбор задач), поэтому n > 0 и целая часть при n < d — верная.
  if (gcd(f.n, f.d) !== 1) return 'unreduced';
  if (answer.mixed && f.n >= f.d) return 'improper';
  return null;
}

/**
 * Дробь: пусто — empty; есть что-то, но нет числителя или знаменателя — incomplete;
 * не целые без знака или знаменатель 0 — format. Значения сравниваются крест-накрест в BigInt:
 * длинный ввод не теряет точность. Верное значение в несократимой задаче, записанное не так, — wrong
 * (как на олимпиаде); почему — скажет wrongReason.
 */
export function checkFraction(answer: FractionAnswer, input: FractionInput): CheckResult {
  const f = parseFraction(answer, input);
  if (typeof f === 'string') return f;
  return fractionForm(answer, f) === null ? 'correct' : 'wrong';
}

/**
 * Пояснение к «неверно»: значение верное, но запись не та, что просили (только у дроби с reduced).
 * Для любого другого ответа и для верного или неверного по значению — null.
 */
export function wrongReason(answer: TaskAnswer, input: AnswerInput): WrongReason | null {
  if (answer.kind !== 'fraction' || input.kind !== 'fraction') return null;
  const f = parseFraction(answer, input.value);
  if (typeof f === 'string') return null;
  const form = fractionForm(answer, f);
  return form === 'value' ? null : form;
}

/** Несколько полей: каждое — целое; порядок важен, если задача не сказала иного. */
export function checkFields(answer: FieldsAnswer, input: readonly string[]): CheckResult {
  const filled = input.filter((s) => !blank(s)).length;
  if (filled === 0) return 'empty';
  if (filled < answer.fields.length || input.length !== answer.fields.length) return 'incomplete';
  const values = input.map(parseInteger);
  if (values.some((v) => v === null)) return 'format';
  const got = values as number[];
  const want = answer.fields.map((f) => f.value);
  if (answer.unordered) {
    got.sort((a, b) => a - b);
    want.sort((a, b) => a - b);
  }
  return got.every((v, i) => v === want[i]) ? 'correct' : 'wrong';
}

/** Ровно то же множество номеров: лишняя или пропущенная галочка — ответ неверный. */
function sameSet(a: readonly number[], b: readonly number[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

// Ё → Е кодами, а не буквами: кириллица в коде вне i18n и content запрещена стражем.
const YO = new RegExp(String.fromCharCode(0x451), 'g');
const YE = String.fromCharCode(0x435);
// Дефис, тире (U+2010…U+2015) и математический минус.
const DASHES = new RegExp(`[${String.fromCharCode(0x2010)}-${String.fromCharCode(0x2015)}${String.fromCharCode(0x2212)}]`, 'g');

/**
 * Слово для сравнения: регистр не важен, Ё = Е, пробелы по краям убираются, повторные — схлопываются,
 * дефисы-тире приводятся к одному. Так «Ёжик», « ежик » и «ЕЖИК» — одно слово.
 */
export function normalizeWord(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(YO, YE)
    .replace(DASHES, '-');
}

/** Слово: ответ из одного слова, а набрано несколько — подсказка формата, попытка цела. */
export function checkText(answer: TextAnswer, input: string): CheckResult {
  const word = normalizeWord(input);
  if (word === '') return 'empty';
  const accepted = answer.accepted.map(normalizeWord);
  if (word.includes(' ') && !accepted.some((a) => a.includes(' '))) return 'format';
  return accepted.includes(word) ? 'correct' : 'wrong';
}

/** Проверка ответа любого вида. Вид ввода обязан совпадать с видом ответа задачи. */
export function checkAnswer(answer: TaskAnswer, input: AnswerInput): CheckResult {
  if (answer.kind !== input.kind) throw new Error(`checkAnswer: ${input.kind} input for ${answer.kind} answer`);
  switch (input.kind) {
    case 'integer':
      if (blank(input.value)) return 'empty';
      return checkNumberAnswer(input.value, (answer as IntegerAnswer).value);
    case 'fraction':
      return checkFraction(answer as FractionAnswer, input.value);
    case 'fields':
      return checkFields(answer as FieldsAnswer, input.value);
    case 'choice':
      if (input.value === null) return 'empty';
      return input.value === (answer as ChoiceAnswer).correct ? 'correct' : 'wrong';
    case 'multi':
      if (input.value.length === 0) return 'empty';
      return sameSet(input.value, (answer as MultiAnswer).correct) ? 'correct' : 'wrong';
    case 'order': {
      const n = (answer as OrderAnswer).items.length;
      if (input.value.length !== n || !sameSet(input.value, [...Array(n).keys()])) return 'incomplete';
      return input.value.every((item, place) => item === place) ? 'correct' : 'wrong';
    }
    case 'text':
      return checkText(answer as TextAnswer, input.value);
  }
}

/** Ввод, который даёт верный ответ: для теста «записанный ответ проходит свою же проверку». */
export function correctInput(answer: TaskAnswer): AnswerInput {
  switch (answer.kind) {
    case 'integer':
      return { kind: 'integer', value: String(answer.value) };
    case 'fraction': {
      const { whole, num } = splitFraction(answer);
      return { kind: 'fraction', value: { whole: whole === 0 ? '' : String(whole), num: String(num), den: String(answer.den) } };
    }
    case 'fields':
      return { kind: 'fields', value: answer.fields.map((f) => String(f.value)) };
    case 'choice':
      return { kind: 'choice', value: answer.correct };
    case 'multi':
      return { kind: 'multi', value: [...answer.correct] };
    case 'order':
      return { kind: 'order', value: answer.items.map((_, i) => i) };
    case 'text':
      return { kind: 'text', value: answer.accepted[0] ?? '' };
  }
}

/** Дробь для показа: у смешанного числа выделена целая часть, у обычной — нет. */
function splitFraction(a: FractionAnswer): { whole: number; num: number } {
  if (!a.mixed) return { whole: 0, num: a.num };
  return { whole: Math.floor(a.num / a.den), num: a.num % a.den };
}

/** Правильный ответ строкой — для «Правильный ответ: …». letters — буквы вариантов (А, Б, …). */
export function answerText(answer: TaskAnswer, letters: readonly string[]): string {
  const letter = (i: number): string => letters[i] ?? String(i + 1);
  switch (answer.kind) {
    case 'integer':
      return String(answer.value);
    case 'fraction': {
      const { whole, num } = splitFraction(answer);
      if (whole === 0) return `${answer.num}/${answer.den}`;
      return num === 0 ? String(whole) : `${whole} ${num}/${answer.den}`;
    }
    case 'fields':
      return answer.fields.map((f) => `${f.label} ${f.value}`).join(', ');
    case 'choice':
      return `${letter(answer.correct)}) ${answer.options[answer.correct] ?? ''}`;
    case 'multi':
      return answer.correct.map((i) => `${letter(i)}) ${answer.options[i] ?? ''}`).join('; ');
    case 'order':
      return answer.items.join(' → ');
    case 'text':
      return answer.accepted[0] ?? '';
  }
}

/** Зерно из строки (id задачи): одна задача — одна и та же стартовая расстановка. */
export function seedFromText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * Стартовая расстановка для «по порядку»: перемешанные номера 0…n−1, никогда не готовый ответ
 * (иначе задача решена без единого движения). rnd — генератор из random.ts.
 */
export function initialOrder(n: number, rnd: () => number): number[] {
  const order = [...Array(n).keys()];
  if (n < 2) return order;
  do {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j] as number, order[i] as number];
    }
  } while (order.every((item, place) => item === place));
  return order;
}

/** Текст без внешних кавычек-ёлочек: «Заря» → Заря. Так шаблон с кавычками не удвоит их. */
export function unquote(s: string): string {
  const t = s.trim();
  return t.length >= 2 && t.startsWith('«') && t.endsWith('»') ? t.slice(1, -1) : s;
}

/** Переставить пункт с места from на место to (остальные сдвигаются). Новый массив. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
