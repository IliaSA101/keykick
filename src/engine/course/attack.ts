/**
 * Курс v2: тексты атак урока (спека 016, design §3). Чистые функции без Vue и DOM:
 * случайность — от зерна (`createRandom`), статистика ошибок приходит снаружи.
 * Материал атаки — по `lesson.ladder`, длина — `attacks[i]` (допуск 3 знака вниз), перенос — `rowWidth` и `rows`.
 * Куски v1 (буква по весам, пара, сочетание, слово из пула) не копируются — берутся из `lessonHalf.ts`.
 */
import { findChar, type Keymap } from '../keymap';
import { MIN_POOL, comboToken, hardWord, keyboardRows, LESSON_WORD_SHARE, pairToken, pseudoWord, trapLine, weightedLetter } from '../lessonHalf';
import { HOME_KEYS, lettersOf, unique, type Material } from '../lessonModel';
import { letterWeights } from '../lessonPlan';
import { createRandom, randomInt } from '../random';
import type { TypingStats } from '../typing';
import type { CourseLesson, Dictionary } from './model';

/** На сколько знаков атака может быть короче своей длины. */
export const ATTACK_SLACK = 3;
/** Доля кричалок среди фраз уроков с `chants`. */
const CHANT_SHARE = 0.3;
/** Кандидатов на пару или сочетание (и на слово по весам): берётся «самый фокусный» из трёх. */
const PICKS = 3;
/** Сколько раз пересобрать атаку, если она не легла в `rows` строк, прежде чем взять запасной вариант. */
const ATTEMPTS = 40;
/** Букв фокуса в разминке — не больше. */
const WARMUP_MAX_KEYS = 12;
/** Соли зерна: тайм, доп. время и разминка не повторяют текст друг друга. */
const SALT_SECOND = 0x51ed27;
const SALT_EXTRA = 0x2c9277b5;
const SALT_WARMUP = 0x5eed;

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

/** Перемешанные круги букв: каждая буква появится, прежде чем какая-то повторится. */
function letterStream(rnd: () => number, letters: readonly string[], count: number): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const round = [...letters];
    for (let i = round.length - 1; i > 0; i--) {
      const j = randomInt(rnd, i + 1);
      [round[i], round[j]] = [round[j] ?? '', round[i] ?? ''];
    }
    if (round.length > 1 && round[0] === out.at(-1)) round.push(round.shift() ?? '');
    out.push(...round);
  }
  return out.slice(0, count);
}

/** Удар разминки: буквы, пары (с «осью» — буквой, которая есть в каждой паре) и сколько знаков он занимает. */
interface Kick {
  kind: 'letters' | 'pairs';
  letters: string[];
  pivot?: string;
}

/**
 * План ударов (правило v1 `warmupPlan`, 016-Р12): новые буквы урока, без них — фокус (до 12), без фокуса — основной
 * ряд. Одна буква — её удар и пары с соседями по фокусу («эж жэ»), а не шесть строк «э э э». Несколько букв: пары
 * идут вторым ударом, если лесенка их знает; без пар — два удара буквами по половине набора.
 */
function warmupKicks(l: CourseLesson): Kick[] {
  const fresh = unique(l.newKeys);
  const base = fresh.length > 0 ? fresh : l.focus ? unique(l.focus).slice(0, WARMUP_MAX_KEYS) : lettersOf(l).slice(0, HOME_KEYS);
  const pairs = l.ladder.some((m) => m !== 'letters');
  if (base.length === 1) {
    const ch = base[0] ?? '';
    const mates = unique(l.focus).filter((c) => c !== ch);
    const others = mates.length > 0 ? mates : lettersOf(l).filter((c) => c !== ch).slice(0, 2);
    if (others.length === 0) return [{ kind: 'letters', letters: [ch] }, { kind: 'letters', letters: [ch] }];
    return [{ kind: 'letters', letters: [ch] }, pairs ? { kind: 'pairs', letters: others, pivot: ch } : { kind: 'letters', letters: [ch, ...others] }];
  }
  if (pairs) return [{ kind: 'letters', letters: base }, { kind: 'pairs', letters: base }];
  const half = Math.ceil(base.length / 2);
  return [{ kind: 'letters', letters: base.slice(0, half) }, { kind: 'letters', letters: base.slice(half) }];
}

/** Строки удара ровно на `budget` знаков (пробелы считаются), каждая не длиннее `cap`; зерно `seed` даёт тот же текст. */
function fillKick(kick: Kick, seed: number, budget: number, cap: number): string[] {
  const rnd = createRandom(seed);
  const isPairs = kick.kind === 'pairs';
  // С осью поток — «соседи» по кругу, пара собирается с осью в случайном порядке.
  const stream = letterStream(rnd, kick.letters, budget * 2);
  const rows: string[] = [];
  let left = budget;
  let at = 0;
  while (left > 0) {
    const tokens: string[] = [];
    let length = 0;
    while (left > 0) {
      const gap = tokens.length > 0 ? 1 : 0;
      if (left - gap < 1) break;
      const size = isPairs && left - gap >= 2 ? 2 : 1;
      let t: string;
      if (kick.pivot !== undefined && size === 2) t = rnd() < 0.5 ? kick.pivot + (stream[at] ?? '') : (stream[at] ?? '') + kick.pivot;
      else if (kick.pivot !== undefined) t = kick.pivot;
      else t = stream.slice(at, at + size).join('');
      // Та же пара дважды подряд не идёт — повтор переворачивается («вл лв вл»).
      if (size === 2 && t === tokens.at(-1)) t = [...t].reverse().join('');
      if (gap > 0 && length + 1 + t.length > cap) break;
      tokens.push(t);
      at += kick.pivot !== undefined ? 1 : size;
      length += gap + t.length;
      left -= gap + t.length;
    }
    rows.push(tokens.join(' '));
  }
  return rows;
}

/**
 * Удар в 2–3 строки (016-Р12): ширина строки подбирается так, чтобы знаки легли ровно в 2 строки (иначе в 3), а
 * последняя строка вышла самой длинной — без хвоста из одной буквы. Не легло — null.
 */
function fitKick(kick: Kick, seed: number, budget: number, rowWidth: number): string[] | null {
  for (const n of [2, 3]) {
    let best: string[] | null = null;
    for (let cap = Math.max(1, Math.ceil(budget / n)); cap <= rowWidth; cap++) {
      const rows = fillKick(kick, seed, budget, cap);
      if (rows.length <= n && (best === null || (rows.at(-1)?.length ?? 0) > (best.at(-1)?.length ?? 0))) best = rows;
    }
    if (best) return best;
  }
  return null;
}

/**
 * Разминка: ровно `warmup` знаков строками не длиннее `rowWidth`, два удара по 2–3 строки (урок 1 тоже).
 * Состав ударов — `warmupKicks`. Знаки делятся пополам; если ряд из одиночных букв так не ложится (строка из
 * одиночных букв всегда нечётной длины), доля одного удара сдвигается на несколько знаков.
 * Результат — удары-блоки строк, как в v1 (`makeWarmup`).
 * `_d`, `_map`, `_stats` — зарезервировано контрактом §3 (разминка пока не зависит от словаря и ошибок).
 */
export function makeCourseWarmup(l: CourseLesson, _d: Dictionary, _map: Keymap, seed: number, _stats?: TypingStats): string[][] {
  if (l.warmup <= 0) return [];
  const rnd = createRandom(seed ^ SALT_WARMUP);
  const kicks = warmupKicks(l);
  const seeds = kicks.map(() => randomInt(rnd, 0x7fffffff));
  const first = Math.ceil(l.warmup / 2);
  for (const shift of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    const budgets = [first + shift, l.warmup - first - shift];
    const blocks = kicks.map((kick, k) => (budgets[k]! > 0 ? fitKick(kick, seeds[k]!, budgets[k]!, l.rowWidth) : []));
    if (blocks.every((b) => b !== null)) return blocks;
  }
  // Не легло и так (узкая строка или очень длинная разминка): ровные удары по ширине строки, строк — сколько выйдет.
  return kicks.map((kick, k) => fillKick(kick, seeds[k]!, k === 0 ? first : l.warmup - first, l.rowWidth));
}
