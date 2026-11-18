/**
 * Курс v2: тексты атак урока (спека 016, design §3). Чистые функции без Vue и DOM:
 * случайность — от зерна (`createRandom`), статистика ошибок приходит снаружи.
 * Материал атаки — по `lesson.ladder`, длина — `attacks[i]` (допуск 3 знака вниз), перенос — `rowWidth` и `rows`.
 * Куски v1 (буква по весам, пара, сочетание, слово из пула) не копируются — берутся из `lessonHalf.ts`.
 */
import { findChar, type Keymap } from '../typing/keymap';
import { MIN_POOL, comboToken, hardWord, keyboardRows, LESSON_WORD_SHARE, pairToken, pseudoWord, trapLine, weightedLetter } from './lessonHalf';
import { HOME_KEYS, lettersOf, unique, type Material } from './lessonModel';
import { letterWeights } from './lessonPlan';
import { createRandom, randomInt } from '../random';
import type { TypingStats } from '../typing/typing';
import type { CourseLesson, Dictionary } from './lesson';

/** На сколько знаков атака может быть короче своей длины. */
export const ATTACK_SLACK = 3;
/** Доля кричалок среди фраз уроков с `chants`. */
const CHANT_SHARE = 0.3;
/** Кандидатов на пару или сочетание (и на слово по весам): берётся «самый фокусный» из трёх. */
const PICKS = 3;
/** Сколько раз пересобрать атаку, если она не легла в `rows` строк, прежде чем взять запасной вариант. */
const ATTEMPTS = 40;
/** Соли зерна: тайм, доп. время и разминка не повторяют текст друг друга. */
const SALT_SECOND = 0x51ed27;
const SALT_EXTRA = 0x2c9277b5;

/** Разбивка текста по пробелам на строки не длиннее `width`; слово длиннее строки остаётся одно на строке. */
export function wrapRows(text: string, width: number): string[] {
  const rows: string[] = [];
  let row = '';
  for (const word of text.split(' ')) {
    if (row !== '' && row.length + 1 + word.length > width) {
      rows.push(row);
      row = word;
    } else row = row === '' ? word : `${row} ${word}`;
  }
  if (row !== '') rows.push(row);
  return rows;
}

/** Фокус урока плюс `focusWeak` самых ошибочных клавиш игрока (из букв урока, с ошибками > 0). */
export function focusFor(l: CourseLesson, map: Keymap, stats?: TypingStats): string {
  if (l.focusWeak <= 0 || !stats) return l.focus;
  const errors = (ch: string): number => {
    const code = findChar(map, l.layout, ch)?.key.code;
    return code ? (stats.keyErrors[code] ?? 0) : 0;
  };
  const weak = lettersOf(l)
    .filter((ch) => errors(ch) > 0)
    .sort((a, b) => errors(b) - errors(a))
    .slice(0, l.focusWeak);
  return unique(l.focus + weak.join('')).join('');
}

interface Ctx {
  l: CourseLesson;
  weights: ReadonlyMap<string, number>;
  rows: readonly (readonly string[])[];
  /** Слова из букв урока (при `wordLen` — нужной длины, если их хватает). */
  words: readonly string[];
  phrases: readonly string[];
  chants: readonly string[];
  /** Все слова урока без учёта wordLen — запас на последних попытках. */
  any: readonly string[];
  /** Слова 3–5 букв среди пар и сочетаний (как в v1); пусто — `noWords`, много букв или мало слов. */
  early: readonly string[];
  /** Фразы и кричалки, уже вошедшие в матч (016-Р12): повтор в матче не идёт, пока есть свежие. */
  used: Set<string>;
}

const typable = (keys: string, text: string): boolean => [...text].every((ch) => ch === ' ' || keys.includes(ch));

function makeCtx(l: CourseLesson, d: Dictionary, map: Keymap, stats?: TypingStats): Ctx {
  const own = d.words.filter((w) => typable(l.keys, w));
  const ranged = l.wordLen ? own.filter((w) => w.length >= l.wordLen![0] && w.length <= l.wordLen![1]) : own;
  const words = ranged.length >= MIN_POOL ? ranged : own;
  const early = l.noWords || unique(l.keys).length > HOME_KEYS || own.length < MIN_POOL ? [] : own.filter((w) => w.length >= 3 && w.length <= 5);
  const focus = focusFor(l, map, stats);
  return {
    l,
    weights: letterWeights({ keys: l.keys, layout: l.layout, focus }, map, stats),
    rows: keyboardRows(l, map),
    words,
    any: own,
    phrases: d.phrases.filter((p) => typable(l.keys, p)),
    chants: d.chants.filter((p) => typable(l.keys, p)),
    early,
    used: new Set(),
  };
}

/**
 * Материал, который можно дать на самом деле: пустой пул слов — сочетания, фраз мало — слова,
 * `noWords` — никаких слов (design §3).
 */
function usable(c: Ctx, material: Material): Material {
  if (material === 'phrases') {
    if (c.l.noWords || c.phrases.length < MIN_POOL) return usable(c, 'words');
    return material;
  }
  if (material === 'words' && (c.l.noWords || c.words.length < MIN_POOL)) return 'combos';
  return material;
}

/**
 * Слово или фраза из пула, влезающая в room и не повторяющая предыдущую. Нет такой — null (атака пересобирается);
 * на последних попытках (`loose` ≥ 1) берётся любое слово урока, на самой последней (≥ 2) — псевдослово.
 */
function fromPool(c: Ctx, rnd: () => number, pool: readonly string[], room: number, parts: readonly string[], loose: number): string | null {
  const fit = (list: readonly string[]) => list.filter((w) => w.length <= room && !parts.includes(w));
  const strict = fit(pool);
  if (strict.length > 0) return hardWord(rnd, strict, c.weights);
  const any = loose >= 1 ? fit(c.any) : [];
  if (any.length > 0) return hardWord(rnd, any, c.weights);
  return loose >= 2 ? pseudoWord(rnd, c.weights, Math.min(room, 4)) : null;
}

/** Из кандидатов — с наибольшим весом букв на знак: фокус и слабые клавиши не тонут в пробежках «ыва». */
function hardest(c: Ctx, items: readonly string[]): string {
  const score = (w: string) => [...w].reduce((a, ch) => a + (c.weights.get(ch) ?? 0), 0) / w.length;
  return items.reduce((best, w) => (score(w) > score(best) ? w : best));
}

function token(c: Ctx, rnd: () => number, material: Material, room: number, parts: readonly string[], loose: number): string | null {
  const prev = parts.at(-1);
  const early = (): string | null => {
    if (c.early.length === 0 || rnd() >= LESSON_WORD_SHARE) return null;
    const fits = c.early.filter((w) => w.length <= Math.min(room, material === 'pairs' ? 4 : 5) && !parts.includes(w));
    return fits.length > 0 ? hardWord(rnd, fits, c.weights) : null;
  };
  switch (material) {
    case 'letters':
      for (;;) {
        const ch = weightedLetter(rnd, c.weights);
        if (c.weights.size === 1 || !(prev === ch && parts.at(-2) === ch)) return ch;
      }
    case 'pairs':
    case 'combos': {
      const word = early();
      if (word) return word;
      // Один и тот же кусок дважды подряд не идёт.
      for (let i = 0; ; i++) {
        const t = hardest(c, Array.from({ length: PICKS }, () => (material === 'pairs' ? pairToken(rnd, c.weights, room) : comboToken(rnd, c.weights, c.rows, room))));
        if (t !== prev || i >= 8) return t;
      }
    }
    case 'words':
      return fromPool(c, rnd, c.words, room, parts, loose);
    case 'phrases': {
      // Выбор равномерный: вес «по буквам» тянул к коротким фразам без пробелов (016-Р12).
      const pool = c.chants.length > 0 && c.l.chants && rnd() < CHANT_SHARE ? c.chants : c.phrases;
      const fresh = pool.filter((p) => p.length <= room && !c.used.has(p) && !parts.includes(p));
      const phrase = fresh[randomInt(rnd, fresh.length)];
      if (phrase === undefined) return fromPool(c, rnd, c.words, room, parts, loose); // свежих фраз нет — слова
      c.used.add(phrase);
      return phrase;
    }
  }
}

/** Запасной вариант: одиночные буквы (всегда ложатся в `rows`), длина — ровно `max`, если нечётная не мешает. */
function fallbackLine(c: Ctx, rnd: () => number, min: number, max: number): string {
  const parts: string[] = [];
  while (parts.length * 2 - 1 < min) parts.push(token(c, rnd, 'letters', 1, parts, 2) ?? '');
  const line = parts.join(' ');
  return line.length > max ? line.slice(0, max).trimEnd() : line;
}

function makeLine(c: Ctx, rnd: () => number, i: number, trap: boolean): string {
  const { l } = c;
  // Явное усечение (016-Р10): атака длиннее `rows·rowWidth` не ляжет в строки; разбор такие уроки не пропускает,
  // а копия тренера (017) обязана укладываться — иначе длина сжимается, а не выходит россыпью одиночных букв.
  const max = Math.min(l.attacks[i] ?? 1, l.rows * l.rowWidth);
  const min = Math.max(1, max - ATTACK_SLACK);
  const [a, b] = unique(l.newKeys);
  // Ловушка — две новые буквы (разбор `parseLeagueFile` требует этого у `trap`); иначе обычная атака.
  if (trap && l.newKeys.length === 2 && a && b) return trapLine(rnd, { material: 'letters', min, max }, [a, b]);
  // Лесенка урока — по одной ступени на атаку; у копии с другим числом атак (017) материал — `material` копии.
  const step = l.ladder.length === l.attacks.length ? l.ladder[i] : l.material;
  const material = usable(c, step ?? l.material);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const parts: string[] = [];
    let length = -1;
    while (length < min) {
      const part = token(c, rnd, material, max - length - 1, parts, Math.floor((attempt * 3) / ATTEMPTS));
      if (part === null) break;
      parts.push(part);
      length += part.length + 1;
    }
    if (length < min) continue;
    const line = parts.join(' ');
    if (line.length <= max && wrapRows(line, l.rowWidth).length <= l.rows) return line;
  }
  return fallbackLine(c, rnd, min, max);
}

/** Строки одного тайма с общим на матч списком уже занятых фраз (`c.used`). */
function halfLines(c: Ctx, seed: number, second: boolean): string[] {
  const { l } = c;
  const rnd = createRandom(second ? seed + SALT_SECOND : seed);
  return l.attacks.map((_, i) => makeLine(c, rnd, i, second && l.trap && i === l.attacks.length - 1));
}

/**
 * Тайм: строка на атаку урока. `second` — 2-й тайм: другое зерно и ловушка смены (`trap`) в последней атаке.
 * Фразы 1-го тайма во 2-м не повторяются (016-Р12): 1-й тайм пересобирается тем же зерном и теми же ошибками.
 */
export function makeCourseHalf(l: CourseLesson, d: Dictionary, map: Keymap, seed: number, stats?: TypingStats, second = false): string[] {
  const c = makeCtx(l, d, map, stats);
  if (second) halfLines(c, seed, false);
  return halfLines(c, seed, second);
}

/** Доп. время (011-Р12): одна атака длиной последней и её ступени; фраз обоих таймов она тоже не повторяет. */
export function makeExtraAttack(l: CourseLesson, d: Dictionary, map: Keymap, seed: number, stats?: TypingStats): string {
  const c = makeCtx(l, d, map, stats);
  halfLines(c, seed, false);
  halfLines(c, seed, true);
  return makeLine(c, createRandom(seed + SALT_EXTRA), l.attacks.length - 1, false);
}
