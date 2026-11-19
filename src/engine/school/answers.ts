/**
 * Проверка ответов, как на олимпиадах: неверный формат — не ошибка, а подсказка,
 * попытка при этом не списывается. Виды ответа — как в интерфейсах олимпиад: число, дробь,
 * несколько полей, выбор одного и нескольких вариантов, порядок, слово, выпадающие списки,
 * соединялка, выбор картинок, поля в выражении. Здесь — вид ввода, раздача проверки по виду и
 * текст верного ответа; разбор числа и дроби, выборы, слово, порядок и новые виды — в answerKinds.ts.
 */
import {
  blank,
  checkChoice,
  checkFraction,
  checkIntegers,
  checkNumberAnswer,
  fractionReason,
  checkMatch,
  checkMulti,
  checkOrder,
  checkSelect,
  checkText,
  exprText,
  initialOrder,
  matchText,
  noneChosen,
  selectCount,
  selectText,
  type ChoiceAnswer,
  type ExprAnswer,
  type FractionAnswer,
  type FractionInput,
  type MatchAnswer,
  type MultiAnswer,
  type OrderAnswer,
  type PicturesAnswer,
  type SelectAnswer,
  type TextAnswer,
  type WrongReason,
} from './answerKinds';

// Виды выбора живут в answerKinds.ts; остальной код берёт всё отсюда, как раньше.
export {
  checkFraction,
  checkNumberAnswer,
  checkText,
  gcd,
  initialOrder,
  moveItem,
  normalizeWord,
  parseInteger,
  parseNatural,
  seedFromText,
  unquote,
  type ChoiceAnswer,
  type ExprAnswer,
  type FractionAnswer,
  type FractionInput,
  type MatchAnswer,
  type MultiAnswer,
  type OrderAnswer,
  type PicturesAnswer,
  type SelectAnswer,
  type TextAnswer,
  type WrongReason,
} from './answerKinds';

export type AnswerVerdict = 'correct' | 'wrong' | 'format';

/**
 * Итог проверки любого вида ответа. empty — ничего не введено, incomplete — заполнено не всё:
 * оба, как и format, попытку не тратят.
 */
export type CheckResult = AnswerVerdict | 'empty' | 'incomplete';

export const answerKinds = [
  'integer',
  'fraction',
  'fields',
  'choice',
  'multi',
  'order',
  'text',
  'select',
  'match',
  'pictures',
  'expr',
] as const;
export type AnswerKind = (typeof answerKinds)[number];

/** Одно целое число. */
export interface IntegerAnswer {
  kind: 'integer';
  value: number;
}

/** Несколько подписанных полей, в каждом — целое. unordered — числа можно вписать в любом порядке. */
export interface FieldsAnswer {
  kind: 'fields';
  fields: readonly { label: string; value: number }[];
  unordered: boolean;
}

export type TaskAnswer =
  | IntegerAnswer
  | FractionAnswer
  | FieldsAnswer
  | ChoiceAnswer
  | MultiAnswer
  | OrderAnswer
  | TextAnswer
  | SelectAnswer
  | MatchAnswer
  | PicturesAnswer
  | ExprAnswer;

/**
 * Что ввёл ребёнок. order — номера пунктов (из items) в том порядке, как он их расставил; select — номер
 * выбранного варианта в каждом списке (null — не выбран); match — для каждой левой строки номер правой (null — не соединена);
 * pictures — номера выбранных картинок; expr — числа полей строкой, как набрано.
 */
export type AnswerInput =
  | { kind: 'integer'; value: string }
  | { kind: 'fraction'; value: FractionInput }
  | { kind: 'fields'; value: string[] }
  | { kind: 'choice'; value: number | null }
  | { kind: 'multi'; value: number[] }
  | { kind: 'order'; value: number[] }
  | { kind: 'text'; value: string }
  | { kind: 'select'; value: (number | null)[] }
  | { kind: 'match'; value: (number | null)[] }
  | { kind: 'pictures'; value: number[] }
  | { kind: 'expr'; value: string[] };

/**
 * Пояснение к «неверно»: значение верное, но запись не та, что просили (только у дроби с reduced).
 * Для любого другого ответа и для верного или неверного по значению — null.
 */
export function wrongReason(answer: TaskAnswer, input: AnswerInput): WrongReason | null {
  if (answer.kind !== 'fraction' || input.kind !== 'fraction') return null;
  return fractionReason(answer, input.value);
}

/** Несколько полей: каждое — целое; порядок важен, если задача не сказала иного. */
export function checkFields(answer: FieldsAnswer, input: readonly string[]): CheckResult {
  return checkIntegers(
    answer.fields.map((f) => f.value),
    input,
    answer.unordered,
  );
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
      return checkChoice(answer as ChoiceAnswer, input.value);
    case 'multi':
      return checkMulti(answer as MultiAnswer, input.value);
    case 'order':
      return checkOrder(answer as OrderAnswer, input.value);
    case 'text':
      return checkText(answer as TextAnswer, input.value);
    case 'select':
      return checkSelect(answer as SelectAnswer, input.value);
    case 'match':
      return checkMatch(answer as MatchAnswer, input.value);
    case 'pictures':
      return checkMulti(answer as PicturesAnswer, input.value);
    case 'expr':
      return checkIntegers((answer as ExprAnswer).values, input.value, false);
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
    case 'select':
      return { kind: 'select', value: [...answer.correct] };
    case 'match':
      return { kind: 'match', value: [...answer.pairs] };
    case 'pictures':
      return { kind: 'pictures', value: [...answer.correct] };
    case 'expr':
      return { kind: 'expr', value: answer.values.map(String) };
  }
}

/**
 * Пустое поле ответа под вид задачи (лист задачи открыт, ничего не введено). order — стартовая расстановка
 * «по порядку»: перемешанные номера (`initialOrder`), поэтому генератор нужен снаружи.
 */
export function emptyInput(answer: TaskAnswer, rnd: () => number): AnswerInput {
  switch (answer.kind) {
    case 'integer':
      return { kind: 'integer', value: '' };
    case 'fraction':
      return { kind: 'fraction', value: { whole: '', num: '', den: '' } };
    case 'fields':
      return { kind: 'fields', value: answer.fields.map(() => '') };
    case 'choice':
      return { kind: 'choice', value: null };
    case 'multi':
      return { kind: 'multi', value: [] };
    case 'order':
      return { kind: 'order', value: initialOrder(answer.items.length, rnd) };
    case 'text':
      return { kind: 'text', value: '' };
    case 'select':
      return { kind: 'select', value: noneChosen(selectCount(answer.row)) };
    case 'match':
      return { kind: 'match', value: noneChosen(answer.left.length) };
    case 'pictures':
      return { kind: 'pictures', value: [] };
    case 'expr':
      return { kind: 'expr', value: answer.values.map(() => '') };
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
    case 'select':
      return selectText(answer);
    case 'match':
      return matchText(answer);
    case 'pictures':
      return answer.correct.map(letter).join(', ');
    case 'expr':
      return exprText(answer);
  }
}
