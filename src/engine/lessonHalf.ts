/**
 * Строки тайма: куски по ступеням (буквы, пары, сочетания, слова, фразы) и сборка тайма по плану.
 */
import { findChar, type Keymap } from './keymap';
import { endMark, fail, HOME_KEYS, lettersOf, unique, wordsFor, type Lesson, type Material } from './lessonModel';
import { attackPlan, letterWeights, TRAP_FROM, TRAP_TO, type Attack } from './lessonPlan';
import { createRandom, randomInt } from './random';
import type { TypingStats } from './typing';

/** Меньше настоящих слов из букв урока — строки слов разбавляются псевдословами. */
export const MIN_POOL = 8;
/** Доля словарных слов в разбавленной строке. */
const WORD_SHARE = 0.45;
const MIN_WORDS = 3;
/** Слово короче или равно — «короткое»: ступень words берёт такие, фразы — любые. */
const SHORT_WORD = 5;
/**
 * Доля коротких слов среди пар и сочетаний у уроков основного ряда до слов (3–5): «да», «лад»,
 * «вода» вместо части бессмысленных пар (журнал 04.11, урок 4 «Соло»).
 */
export const LESSON_WORD_SHARE = 1 / 3;
/** Самое длинное такое слово: в ступени пар — 4 буквы, в ступени сочетаний — 5. */
export const LESSON_WORD_MAX: Readonly<Partial<Record<Material, number>>> = { pairs: 4, combos: 5 };
/**
 * Урок знака (точка в newKeys): знак — хвост такой доли кусков во всех ступенях, «бю. ж. вода.»
 * (009-Р4) — иначе за тайм одна точка против десятка новой буквы.
 */
export const MARK_TAIL_SHARE = 1 / 3;
/** После урока знака: доля строк ступени, которые кончаются знаком — фразы всегда, слова — часть (009-Р2). */
export const MARK_END_SHARE: Readonly<Partial<Record<Material, number>>> = { words: 0.5, phrases: 1 };

function weightedLetter(rnd: () => number, weights: ReadonlyMap<string, number>): string {
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
function pseudoWord(rnd: () => number, weights: ReadonlyMap<string, number>, length: number): string {
  let w = '';
  while (w.length < length) {
    const ch = weightedLetter(rnd, weights);
    if (w.length >= 2 && w.at(-1) === ch && w.at(-2) === ch) continue;
    w += ch;
  }
  return w;
}

/** Сочетание букв по весам без двух одинаковых подряд («ао», «вла»), если в уроке их больше одной. */
function distinctWord(rnd: () => number, weights: ReadonlyMap<string, number>, length: number): string {
  let w = '';
  while (w.length < length) {
    const ch = weightedLetter(rnd, weights);
    if (weights.size > 1 && w.at(-1) === ch) continue;
    w += ch;
  }
  return w;
}

/** Пара букв: тройки — уже ступень сочетаний, на уроках «Ы и Д», «Ф и Ж» их рано. */
function pairToken(rnd: () => number, weights: ReadonlyMap<string, number>, room: number): string {
  return distinctWord(rnd, weights, Math.min(room, 2));
}

/**
 * Буквы урока по рядам клавиатуры, в ряду — по месту («фываолдж»). Пробежка идёт только
 * внутри ряда: «зхъфы» — буквы урока, но пальцы так не бегут (стык верхнего и среднего ряда).
 * Знаков нет: точка в нижнем ряду дала бы пробежку «бю.» (спека 009).
 */
function keyboardRows(lesson: Lesson, map: Keymap): string[][] {
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
function comboToken(
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
function hardWord(rnd: () => number, pool: readonly string[], weights: ReadonlyMap<string, number>): string {
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

interface Source {
  rnd: () => number;
  weights: ReadonlyMap<string, number>;
  /** Буквы урока по рядам клавиатуры — для пробежек в сочетаниях. */
  rows: readonly (readonly string[])[];
  /** Все слова из букв урока. */
  pool: readonly string[];
  /** Короткие слова для ступени words (или весь pool, если коротких мало). */
  short: readonly string[];
  /** Слова 3–5 букв среди пар и сочетаний (уроки 3–5); пусто — пары и сочетания как были. */
  early: readonly string[];
  /** Знак конца урока («.»); пусто — строки без знаков, случайность на знак не тратится. */
  mark: string;
  /** Доля кусков со знаком-хвостом: MARK_TAIL_SHARE на уроке знака, иначе 0. */
  tail: number;
}

/** Кончится ли строка знаком: после урока знака — по доле ступени (MARK_END_SHARE). */
function endsWithMark(src: Source, material: Material): boolean {
  if (!src.mark || src.tail > 0) return false;
  const share = MARK_END_SHARE[material] ?? 0;
  return share >= 1 || (share > 0 && src.rnd() < share);
}

/**
 * Урок основного ряда до слов: потолок — пары или сочетания, букв не больше основного ряда,
 * слов хватает. Дальше (районная лига и позже) сочетания отрабатывают шаги пальцев и слова идут
 * своими уроками — там как было (003-Р11). Слова от 3 букв: «да», «ад» и так выпадают парой (003-Р12).
 */
function earlyWords(lesson: Lesson, pool: readonly string[]): string[] {
  const early = lesson.material === 'pairs' || lesson.material === 'combos';
  if (!early || unique(lesson.keys).length > HOME_KEYS || pool.length < MIN_POOL) return [];
  return pool.filter((w) => w.length >= 3 && w.length <= SHORT_WORD);
}

/** Короткое слово вместо пары или сочетания — в доле LESSON_WORD_SHARE кусков; null — кусок как был. */
function earlyWord(src: Source, material: Material, room: number, parts: readonly string[]): string | null {
  // Без слов случайность не тратится: строки остальных уроков — те же, что до спеки 003.
  if (src.early.length === 0 || src.rnd() >= LESSON_WORD_SHARE) return null;
  const longest = Math.min(room, LESSON_WORD_MAX[material] ?? 0);
  // Слово в строке — один раз: «ложа фол ложа» скучно.
  const fits = src.early.filter((w) => w.length <= longest && !parts.includes(w));
  return fits.length > 0 ? hardWord(src.rnd, fits, src.weights) : null;
}

/** Слово из словаря, которое влезает в room и не повторяет предыдущее; иначе псевдослово. */
function realWord(src: Source, list: readonly string[], room: number, prev: string | undefined): string {
  const fits = list.filter((w) => w.length <= room && w !== prev);
  if (fits.length > 0) return hardWord(src.rnd, fits, src.weights);
  return pseudoWord(src.rnd, src.weights, Math.min(room, 4));
}

/** Слово, когда настоящих мало: часть — из словаря, часть — псевдослова (как в круге 1). */
function mixedWord(src: Source, room: number, prev: string | undefined): string {
  if (src.pool.length >= MIN_WORDS && src.rnd() < WORD_SHARE) return realWord(src, src.pool, room, prev);
  return pseudoWord(src.rnd, src.weights, Math.min(room, 2 + randomInt(src.rnd, 4)));
}

function token(src: Source, material: Material, room: number, parts: readonly string[]): string {
  const prev = parts.at(-1);
  switch (material) {
    case 'letters': {
      // Одиночные буквы; не три одинаковые подряд, если в уроке есть из чего выбрать.
      for (;;) {
        const ch = weightedLetter(src.rnd, src.weights);
        if (src.weights.size === 1 || !(prev === ch && parts.at(-2) === ch)) return ch;
      }
    }
    case 'pairs':
      return earlyWord(src, material, room, parts) ?? pairToken(src.rnd, src.weights, room);
    case 'combos':
      return earlyWord(src, material, room, parts) ?? comboToken(src.rnd, src.weights, src.rows, room);
    case 'words':
      return src.pool.length >= MIN_POOL ? realWord(src, src.short, room, prev) : mixedWord(src, room, prev);
    case 'phrases':
      return src.pool.length >= MIN_POOL ? realWord(src, src.pool, room, prev) : mixedWord(src, room, prev);
  }
}

/**
 * Ловушка смены: одна буква, потом другая («в в в в л л л»), смена на TRAP_FROM…TRAP_TO букв строки.
 * Какая первая и где смена — по зерну: место не заучить (003-Р9).
 */
function trapLine(rnd: () => number, attack: Attack, [a, b]: [string, string]): string {
  // Букв n — строка 2n − 1 знаков в пределах атаки.
  const fewest = Math.ceil((attack.min + 1) / 2);
  const n = fewest + randomInt(rnd, Math.floor((attack.max + 1) / 2) - fewest + 1);
  const from = Math.ceil(n * TRAP_FROM);
  const k = from + randomInt(rnd, Math.floor(n * TRAP_TO) - from + 1);
  const [first, second] = rnd() < 0.5 ? [a, b] : [b, a];
  return [...Array<string>(k).fill(first), ...Array<string>(n - k).fill(second)].join(' ');
}

/**
 * Строка атаки: куски через одиночный пробел, длина в пределах [min, max].
 * Знак не клеится к куску в parts (там слова чистые — проверки повторов те же): хвост куска
 * берёт у него место (room − 1), строка со знаком в конце строится до max − 1 (спека 009).
 */
function makeLine(base: Source, attack: Attack): string {
  if (attack.trap) return trapLine(base.rnd, attack, attack.trap);
  // Чистая строка одной буквы: та же ступень letters, но в весах — одна эта буква, без знаков.
  const src = attack.letter ? { ...base, weights: new Map([[attack.letter, 1]]), mark: '', tail: 0 } : base;
  const end = endsWithMark(src, attack.material);
  const max = end ? attack.max - 1 : attack.max;
  const parts: string[] = [];
  const tails: boolean[] = [];
  // Длина строки с пробелами; −1 — чтобы у первого куска не считался пробел перед ним.
  let length = -1;
  while (length < attack.min) {
    // Пока строка короче min, места ещё не меньше max − min знаков (от 3 с хвостом).
    const room = max - length - 1;
    const tail = src.tail > 0 && src.rnd() < src.tail;
    const part = token(src, attack.material, tail ? room - 1 : room, parts);
    parts.push(part);
    tails.push(tail);
    length += part.length + 1 + (tail ? 1 : 0);
  }
  const line = parts.map((p, i) => (tails[i] ? p + src.mark : p)).join(' ');
  return end ? line + src.mark : line;
}

/**
 * Тайм: строки-атаки урока по лесенке. Одно зерно и те же ошибки — тот же тайм.
 * decisive — тайм с решающей атакой (второй): у уроков 1–2 она — ловушка смены.
 */
export function makeHalf(
  lesson: Lesson,
  words: readonly string[],
  map: Keymap,
  seed: number,
  stats?: TypingStats,
  decisive = false,
): string[] {
  const pool = wordsFor(lesson, words);
  const short = pool.filter((w) => w.length <= SHORT_WORD);
  const mark = endMark(lesson) ?? '';
  const src: Source = {
    rnd: createRandom(seed),
    weights: letterWeights(lesson, map, stats),
    rows: keyboardRows(lesson, map),
    pool,
    short: short.length >= MIN_POOL ? short : pool,
    early: earlyWords(lesson, pool),
    mark,
    tail: mark && lesson.newKeys.includes(mark) ? MARK_TAIL_SHARE : 0,
  };
  return attackPlan(lesson, decisive).map((attack) => makeLine(src, attack));
}
