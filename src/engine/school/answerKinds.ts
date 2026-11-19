/**
 * Типы и проверки по видам: число, дробь, выбор, галочки, порядок, слово, выпадающие списки, соединялка, выбор картинок,
 * поля в выражении. Объединение видов, ввод и раздача по виду (`checkAnswer`, `correctInput`, …) — в answers.ts.
 * Здесь нет импорта значений из answers.ts: слои «общее» → «виды» без круга.
 */
import { shuffle } from '../random';
import type { AnswerVerdict, CheckResult } from './answers';

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

/** Ввод дроби: целая часть (если есть), числитель, знаменатель — как набрано. */
export interface FractionInput {
  whole: string;
  num: string;
  den: string;
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

/**
 * Выпадающие списки в строке: row — части по порядку, строка — текст, массив — список вариантов
 * («6 [+ − ×] 4 = [19 22 24]»); correct — номер верного варианта в каждом списке по порядку (с нуля).
 */
export interface SelectAnswer {
  kind: 'select';
  row: readonly (string | readonly string[])[];
  correct: readonly number[];
}

/** Соединялка: pairs[i] — номер правой строки, парной левой строке i; pairs — перестановка номеров правых. */
export interface MatchAnswer {
  kind: 'match';
  left: readonly string[];
  right: readonly string[];
  pairs: readonly number[];
}

/** Выбор картинок: pictures — SVG-рисунки из контента, correct — номера верных (с нуля, по возрастанию). */
export interface PicturesAnswer {
  kind: 'pictures';
  pictures: readonly string[];
  correct: readonly number[];
}

/** Поля в строке выражения: parts — части по порядку, null — поле; values — числа полей по порядку. */
export interface ExprAnswer {
  kind: 'expr';
  parts: readonly (string | null)[];
  values: readonly number[];
}

// Минус: обычный дефис, математический «−» и короткое тире — их подставляют разные клавиатуры.
const MINUS = /^[-−–]/;
// Цифры подряд или разряды через пробел: «1000», «1 000», «12 345 678».
const PLAIN = /^\d+$/;
const GROUPED = /^\d{1,3}( \d{3})+$/;

export const blank = (s: string): boolean => s.trim() === '';

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

/** Причина «неверно» при верном значении (см. WrongReason): ввод не разобран или запись верна — null. */
export function fractionReason(answer: FractionAnswer, input: FractionInput): WrongReason | null {
  const f = parseFraction(answer, input);
  if (typeof f === 'string') return null;
  const form = fractionForm(answer, f);
  return form === 'value' ? null : form;
}

/**
 * Целые числа в полях: пусто — empty, заполнено не всё — incomplete, не целое — format (попытка цела).
 * unordered — числа можно вписать в любом порядке.
 */
export function checkIntegers(want: readonly number[], input: readonly string[], unordered: boolean): CheckResult {
  const filled = input.filter((s) => !blank(s)).length;
  if (filled === 0) return 'empty';
  if (filled < want.length || input.length !== want.length) return 'incomplete';
  const values = input.map(parseInteger);
  if (values.some((v) => v === null)) return 'format';
  const got = values as number[];
  const need = [...want];
  if (unordered) {
    got.sort((a, b) => a - b);
    need.sort((a, b) => a - b);
  }
  return got.every((v, i) => v === need[i]) ? 'correct' : 'wrong';
}

/** Ровно то же множество номеров: лишняя или пропущенная галочка — ответ неверный. */
export function sameSet(a: readonly number[], b: readonly number[]): boolean {
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

/** Выбор одного: ничего не выбрано — empty. */
export function checkChoice(answer: ChoiceAnswer, input: number | null): CheckResult {
  if (input === null) return 'empty';
  return input === answer.correct ? 'correct' : 'wrong';
}

/** Галочки или картинки: ни одной — empty, иначе точное совпадение множества. */
export function checkMulti(answer: MultiAnswer | PicturesAnswer, input: readonly number[]): CheckResult {
  if (input.length === 0) return 'empty';
  return sameSet(input, answer.correct) ? 'correct' : 'wrong';
}

/** Порядок: расстановка не полная — incomplete, иначе верна только та, что совпала с эталоном. */
export function checkOrder(answer: OrderAnswer, input: readonly number[]): CheckResult {
  const n = answer.items.length;
  if (input.length !== n || !sameSet(input, [...Array(n).keys()])) return 'incomplete';
  return input.every((item, place) => item === place) ? 'correct' : 'wrong';
}

/** Выпадающие списки: ничего не выбрано — empty, выбраны не все — incomplete. */
export function checkSelect(answer: SelectAnswer, input: readonly (number | null)[]): CheckResult {
  const chosen = input.filter((v) => v !== null).length;
  if (chosen === 0) return 'empty';
  if (chosen < answer.correct.length || input.length !== answer.correct.length) return 'incomplete';
  return input.every((v, i) => v === answer.correct[i]) ? 'correct' : 'wrong';
}

/**
 * Соединялка: input[i] — правая строка, соединённая с левой i (или null). Нет ни одной связи — empty,
 * связаны не все левые — incomplete; две левые на одной правой — format (так не бывает: подсказка, попытка цела).
 */
export function checkMatch(answer: MatchAnswer, input: readonly (number | null)[]): CheckResult {
  const linked = input.filter((v): v is number => v !== null);
  if (linked.length === 0) return 'empty';
  if (linked.length < answer.left.length || input.length !== answer.left.length) return 'incomplete';
  if (new Set(linked).size !== linked.length) return 'format';
  return linked.every((v, i) => v === answer.pairs[i]) ? 'correct' : 'wrong';
}

/** Пустой ввод соединялки и выпадающих списков: n позиций, ничего не выбрано. */
export const noneChosen = (n: number): null[] => Array<null>(n).fill(null);

/** Число списков в строке выбора. */
export const selectCount = (row: SelectAnswer['row']): number => row.filter((p) => typeof p !== 'string').length;

/** Строка выбора с вариантами, подставленными по номерам: «6 × 4 + 5 = 22». */
export function selectText(answer: SelectAnswer): string {
  let k = 0;
  return answer.row.map((p) => (typeof p === 'string' ? p : (p[answer.correct[k++] ?? 0] ?? ''))).join(' ');
}

/** Выражение с вписанными числами: «4 × ( 4 + 2 ) = 24». */
export function exprText(answer: ExprAnswer): string {
  let k = 0;
  return answer.parts.map((p) => (p === null ? String(answer.values[k++] ?? '') : p)).join(' ');
}

/** Пары соединялки строкой: «1/2 — 0,5; 1/4 — 0,25». */
export function matchText(answer: MatchAnswer): string {
  return answer.left.map((l, i) => `${l} — ${answer.right[answer.pairs[i] ?? 0] ?? ''}`).join('; ');
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
  const sorted = [...Array(n).keys()];
  if (n < 2) return sorted;
  let order: number[];
  do order = shuffle(rnd, sorted);
  while (order.every((item, place) => item === place));
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
