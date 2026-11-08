/**
 * Куски строк по ступеням (буквы по весам, пара, сочетание, слово из пула, ловушка смены) — общие для генератора v2
 * (`course/attack.ts`). Сборка тайма v1 (makeHalf) убрана в 016-Т6.
 */
import { findChar, type Keymap } from './keymap';
import { fail, lettersOf, type Lesson } from './lessonModel';
import { TRAP_FROM, TRAP_TO, type Attack } from './lessonPlan';
import { randomInt } from './random';

/** Меньше настоящих слов из букв урока — строки слов разбавляются псевдословами. */
export const MIN_POOL = 8;
/**
 * Доля коротких слов среди пар и сочетаний у уроков основного ряда до слов (3–5): «да», «лад»,
 * «вода» вместо части бессмысленных пар (04.11).
 */
export const LESSON_WORD_SHARE = 1 / 3;

/** Буква по весам. */
export function weightedLetter(rnd: () => number, weights: ReadonlyMap<string, number>): string {
  let total = 0;
  for (const w of weights.values()) total += w;
  let x = rnd() * total;
  for (const [ch, w] of weights) {
    x -= w;
    if (x < 0) return ch;
  }
  return [...weights.keys()].at(-1) ?? fail('weights', 'empty');
}

/** Псевдослово: буквы по весам, без трёх одинаковых подряд — такое не печатают. */
export function pseudoWord(rnd: () => number, weights: ReadonlyMap<string, number>, length: number): string {
  let w = '';
  while (w.length < length) {
    const ch = weightedLetter(rnd, weights);
    if (w.length >= 2 && w.at(-1) === ch && w.at(-2) === ch) continue;
    w += ch;
  }
  return w;
}

/** Сочетание букв по весам без двух одинаковых подряд («ао», «вла»), если в уроке их больше одной. */
export function distinctWord(rnd: () => number, weights: ReadonlyMap<string, number>, length: number): string {
  let w = '';
  while (w.length < length) {
    const ch = weightedLetter(rnd, weights);
    if (weights.size > 1 && w.at(-1) === ch) continue;
    w += ch;
  }
  return w;
}

/** Пара букв: тройки — уже ступень сочетаний, на уроках «Ы и Д», «Ф и Ж» их рано. */
export function pairToken(rnd: () => number, weights: ReadonlyMap<string, number>, room: number): string {
  return distinctWord(rnd, weights, Math.min(room, 2));
}

/**
 * Буквы урока по рядам клавиатуры, в ряду — по месту («фываолдж»). Пробежка идёт только
 * внутри ряда: «зхъфы» — буквы урока, но пальцы так не бегут (стык верхнего и среднего ряда).
 * Знаков нет: точка в нижнем ряду дала бы пробежку «бю.» (спека 009).
 */
export function keyboardRows(lesson: Pick<Lesson, 'keys' | 'layout'>, map: Keymap): string[][] {
  const rows = new Map<number, { ch: string; at: number }[]>();
  for (const ch of lettersOf(lesson)) {
    const key = findChar(map, lesson.layout, ch)?.key;
    if (!key) continue;
    const row = rows.get(key.row) ?? [];
    row.push({ ch, at: map.rows[key.row]?.indexOf(key) ?? 0 });
    rows.set(key.row, row);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row.sort((a, b) => a.at - b.at).map((k) => k.ch));
}

/**
 * «Слово ряда» 3–5 букв: половина — пробежка соседних клавиш («ыва», «олдж», «ждло» в обратную),
 * от буквы по весам; половина — сочетание букв по весам без двух одинаковых подряд.
 */
export function comboToken(
  rnd: () => number,
  weights: ReadonlyMap<string, number>,
  rows: readonly (readonly string[])[],
  room: number,
): string {
  const length = Math.min(room, 3 + randomInt(rnd, 3));
  if (length >= 3 && rnd() < 0.5) {
    const first = weightedLetter(rnd, weights);
    const order = rows.find((r) => r.includes(first)) ?? [];
    const start = order.indexOf(first);
    let dir = rnd() < 0.5 ? 1 : -1;
    const span = (d: number): number => (d > 0 ? order.length - start : start + 1);
    if (span(dir) < 3) dir = -dir;
    const n = Math.min(length, span(dir));
    if (start >= 0 && n >= 3) return Array.from({ length: n }, (_, i) => order[start + dir * i]).join('');
  }
  return distinctWord(rnd, weights, length);
}

/** Из трёх случайных слов — самое «трудное» по весам букв: так подстройка работает и в словах. */
export function hardWord(rnd: () => number, pool: readonly string[], weights: ReadonlyMap<string, number>): string {
  let best = '';
  let bestScore = -1;
  for (let i = 0; i < 3; i++) {
    const w = pool[randomInt(rnd, pool.length)] ?? '';
    const score = [...w].reduce((s, ch) => s + (weights.get(ch) ?? 0), 0) / Math.max(1, w.length);
    if (score > bestScore) {
      best = w;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Ловушка смены: одна буква, потом другая («в в в в л л л»), смена на TRAP_FROM…TRAP_TO букв строки.
 * Какая первая и где смена — по зерну: место не заучить (003-Р9).
 */
export function trapLine(rnd: () => number, attack: Attack, [a, b]: [string, string]): string {
  // Букв n — строка 2n − 1 знаков в пределах атаки.
  const fewest = Math.ceil((attack.min + 1) / 2);
  const n = fewest + randomInt(rnd, Math.floor((attack.max + 1) / 2) - fewest + 1);
  const from = Math.ceil(n * TRAP_FROM);
  const k = from + randomInt(rnd, Math.floor(n * TRAP_TO) - from + 1);
  const [first, second] = rnd() < 0.5 ? [a, b] : [b, a];
  return [...Array<string>(k).fill(first), ...Array<string>(n - k).fill(second)].join(' ');
}
