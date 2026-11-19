/** Лист задачи (ЭБ.21): общие типы и чистые шаги ввода компонентов `components/paper/` (тест — tests/school/answers.test.ts). */
import type { AnswerKind } from '../../engine/school/answers';
import { ru } from '../../i18n/ru';

/** Строка клавиш под листом по виду ответа: у цифр, соединялки и списка свои клавиши (Школа берёт её отсюда). */
export function keysOf(kind: AnswerKind, digits: boolean): string {
  if (digits && (kind === 'pictures' || kind === 'choice' || kind === 'multi')) return ru.paper.keysMore.digits;
  if (kind === 'match') return ru.paper.keysMore.match;
  if (kind === 'select') return ru.paper.keysMore.select;
  return kind === 'choice' || kind === 'multi' ? ru.paper.keysChoice : ru.paper.keys;
}

/** Полоса итога на листе после ответа. */
export interface PaperVerdict {
  /** `goal` — верно (зелёная полоса), `miss` — неверно (красная). */
  kind: 'goal' | 'miss';
  text: string;
  badge?: string;
  next: string;
}

/** Какое поле рисует вид ответа: по одному на вид, кроме «выбор одного/нескольких/картинок» — они делят поле вариантов. */
export type FieldName = 'text' | 'fraction' | 'fields' | 'options' | 'order' | 'select' | 'match' | 'expr';

/** Виды ответа → поле. Запись обязана быть у каждого вида (тип `Record`): вид без поля не соберётся. */
export const FIELD_OF: Record<AnswerKind, FieldName> = {
  integer: 'text',
  text: 'text',
  fraction: 'fraction',
  fields: 'fields',
  choice: 'options',
  multi: 'options',
  pictures: 'options',
  order: 'order',
  select: 'select',
  match: 'match',
  expr: 'expr',
};

/** Поля, которые рисует свой компонент (а не сам AnswerField): список, соединялка, окошки выражения. */
export type ComponentField = 'select' | 'match' | 'expr';
export const isComponentField = (f: FieldName): f is ComponentField => f === 'select' || f === 'match' || f === 'expr';

/** Картинка из контента для `<img src>`: SVG как данные, не разметка страницы (ревью 067 Т3: безопасность). */
export const svgSrc = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

/** Цифра-клавиша 1…6 → номер варианта с нуля; нет такой цифры, не хватает вариантов или зажат модификатор — null. */
export function digitIndex(e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }, count: number): number | null {
  if (e.ctrlKey === true || e.altKey === true || e.metaKey === true || !/^[1-6]$/.test(e.key)) return null;
  const i = Number(e.key) - 1;
  return i < count ? i : null;
}

/** Галочка включается и снимается; номера — по возрастанию. */
export const toggleIndex = (list: readonly number[], i: number): number[] =>
  (list.includes(i) ? list.filter((x) => x !== i) : [...list, i]).sort((a, b) => a - b);

/** Новый массив с заменённым местом `i` (ввод списков и полей выражения). */
export const setAt = <T>(list: readonly T[], i: number, v: T): T[] => list.map((x, k) => (k === i ? v : x));

/** Соединить левую строку `l` с правой `r`: прежняя связь `l` и чужая связь на `r` снимаются — две левые на одной правой не бывает. */
export function linkMatch(links: readonly (number | null)[], l: number, r: number): (number | null)[] {
  return links.map((v, i) => (i === l ? r : v === r ? null : v));
}

/** Снять связь левой строки `l`. */
export const unlinkMatch = (links: readonly (number | null)[], l: number): (number | null)[] => setAt(links, l, null);

/** Что выбрано и ждёт пары: левая или правая строка соединялки (одна из двух). */
export interface MatchPending {
  l: number | null;
  r: number | null;
}

/**
 * Клик по строке соединялки. Первый клик выбирает строку, второй — по другой стороне — соединяет пару;
 * повторный клик по выбранной снимает выбор; клик по той же стороне переносит выбор.
 */
export function matchPick(
  links: readonly (number | null)[],
  pending: MatchPending,
  side: 'l' | 'r',
  i: number,
): { links: (number | null)[]; pending: MatchPending } {
  const none: MatchPending = { l: null, r: null };
  if (pending[side] === i) return { links: [...links], pending: none };
  const other = side === 'l' ? pending.r : pending.l;
  if (other === null) return { links: [...links], pending: side === 'l' ? { l: i, r: null } : { l: null, r: i } };
  return { links: side === 'l' ? linkMatch(links, i, other) : linkMatch(links, other, i), pending: none };
}

/** Цвета пальцев для дорожек соединялки; верная пара после ответа берёт зелёный листа, неверная — красный (025-Р20, Э3.36). */
export const FINGER_COLORS = ['#ef4b4b', '#3cb85c', '#2f80ed', '#b84ad6'] as const;

/** Цвет пары `l`: до ответа — цвет пальца, после — зелёный (верная) или красный (неверная). */
export function pairColor(l: number, closed: boolean, bad: boolean): string {
  if (closed) return bad ? 'var(--paper-wrong)' : 'var(--paper-correct)';
  return FINGER_COLORS[l % FINGER_COLORS.length] ?? '#2f80ed';
}

/** Выбор, ждущий пары, живёт только до ответа: на закрытом листе (`locked`) его нет. */
export const pendingFor = (pending: MatchPending, locked: boolean): MatchPending => (locked ? { l: null, r: null } : pending);

/** Ширина столбца соединялки, px: по самой длинной строке (≈ 9,5 px на знак при 16 px жирным + поля), не уже `min` и не шире `max`. */
export function columnWidth(texts: readonly string[], min: number, max: number, pad = 26): number {
  const longest = texts.reduce((m, s) => Math.max(m, s.length), 0);
  return Math.min(max, Math.max(min, Math.ceil(longest * 9.5) + pad));
}

/** Меню списка (Э3.34): открыто ли и какая строка подсвечена. */
export interface MenuState {
  open: boolean;
  hl: number;
}

/** Итог клавиши в меню: новое состояние, выбранная строка (если Enter) и «клавиша съедена» (не пускать наверх: Esc не уходит в паузу). */
export interface MenuStep {
  state: MenuState;
  pick: number | null;
  handled: boolean;
}

/**
 * Клавиша на списке. Закрытый: ↓, ↑, Пробел — открыть (Enter не трогаем — уходит наверх «ответить»). Открытый: ↑↓ — подсветка
 * (по кругу не идёт, упирается в края), Enter или Пробел — выбрать подсвеченную и закрыть, Esc — закрыть меню (наверх не пускать),
 * Tab — закрыть и идти дальше.
 */
export function menuStep(state: MenuState, key: string, count: number): MenuStep {
  const same = (handled: boolean): MenuStep => ({ state, pick: null, handled });
  if (!state.open) {
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === ' ') return { state: { open: true, hl: state.hl }, pick: null, handled: true };
    return same(false);
  }
  if (key === 'ArrowDown') return { state: { open: true, hl: Math.min(count - 1, state.hl + 1) }, pick: null, handled: true };
  if (key === 'ArrowUp') return { state: { open: true, hl: Math.max(0, state.hl - 1) }, pick: null, handled: true };
  if (key === 'Enter' || key === ' ') return { state: { open: false, hl: state.hl }, pick: state.hl, handled: true };
  if (key === 'Escape') return { state: { open: false, hl: state.hl }, pick: null, handled: true };
  if (key === 'Tab') return { state: { open: false, hl: state.hl }, pick: null, handled: false };
  return same(false);
}
