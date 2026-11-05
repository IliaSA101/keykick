/**
 * Разминка перед таймом, как в «Соло»: удары-блоки строк — буква, другая буква, пары.
 */
import { atLeast, HOME_KEYS, lettersOf, unique, type Lesson } from './lessonModel';
import { createRandom, randomInt } from './random';

/**
 * Букв в строке разминки «а а а …»: 15 букв — 29 знаков, ближе к строке «Соло» в 20 букв
 * (решение 04.11: строки без пауз между ними — длиннее; столько влезает крупным шрифтом
 * в одну строку на окне 1024×640).
 */
export const WARMUP_LETTERS = 15;
/** Пар в строке разминки «ао оа ао …»: почти те же 15 букв (14) — 20 знаков. */
export const WARMUP_PAIRS = 7;
/** Самая длинная строка разминки, знаков: столько помещается в поле без переноса. */
export const WARMUP_WIDTH = 2 * WARMUP_LETTERS - 1;
/**
 * Вся разминка — не длиннее стольких знаков (строки подряд, без переводов): самый длинный
 * план — два удара по 2 строки букв и удар пар в 3 строки, 4 · 29 + 3 · 20 = 176.
 */
export const WARMUP_MAX_CHARS = 180;
/** Букв фокуса в разминке — не больше: две строки удара их ещё покрывают. */
export const WARMUP_MAX_KEYS = 12;

/**
 * Удар разминки: блок строк, видимых сразу. letters — строки одиночных букв набора;
 * pairs — строки пар из двух разных букв набора.
 */
export interface WarmupKick {
  kind: 'letters' | 'pairs';
  letters: string;
  rows: number;
  /** Буква, которая есть в каждой паре (одна новая буква урока: «эж жэ»). */
  pivot?: string;
}

/**
 * План разминки как в «Соло»: буква → другая буква → пары, строк в ударе всё больше (2 → 3).
 * Буквы — новые буквы урока; без новых — фокус (до WARMUP_MAX_KEYS), без фокуса — основной ряд.
 * Много букв делятся на два удара по половине. Одна новая буква — её удар и пары с фокусом.
 * Пары — только если они есть в тайме урока (потолок pairs и выше): урок одиночных букв
 * разминается одними буквами, и тогда второй удар — сразу в 3 строки (решение 04.11).
 */
export function warmupPlan(lesson: Lesson): WarmupKick[] {
  const fresh = unique(lesson.newKeys);
  const base =
    fresh.length > 0
      ? fresh
      : lesson.focus
        ? unique(lesson.focus).slice(0, WARMUP_MAX_KEYS)
        : lettersOf(lesson).slice(0, HOME_KEYS);
  const pairs = atLeast(lesson, 'pairs');
  if (base.length === 1) {
    const ch = base.join('');
    const mates = unique(lesson.focus).filter((c) => c !== ch);
    const others = mates.length > 0 ? mates : lettersOf(lesson).filter((c) => c !== ch).slice(0, 2);
    // Урок из одной буквы: пар не из чего — второй удар той же буквой; без пар — буквы вперемешку.
    const second: WarmupKick =
      others.length === 0
        ? { kind: 'letters', letters: ch, rows: 3 }
        : pairs
          ? { kind: 'pairs', letters: ch + others.join(''), rows: 3, pivot: ch }
          : { kind: 'letters', letters: ch + others.join(''), rows: 3 };
    return [{ kind: 'letters', letters: ch, rows: 2 }, second];
  }
  const half = Math.ceil(base.length / 2);
  const first: WarmupKick = { kind: 'letters', letters: base.slice(0, half).join(''), rows: 2 };
  const rest = base.slice(half).join('');
  if (!pairs) return [first, { kind: 'letters', letters: rest, rows: 3 }];
  return [first, { kind: 'letters', letters: rest, rows: 2 }, { kind: 'pairs', letters: base.join(''), rows: 3 }];
}

/** Перемешанная копия: каждая буква набора появится, прежде чем какая-то повторится. */
function shuffled(rnd: () => number, items: readonly string[]): string[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rnd, i + 1);
    [out[i], out[j]] = [out[j] ?? '', out[i] ?? ''];
  }
  return out;
}

/** Одиночные буквы удара: круги по перемешанному набору, без одной буквы дважды подряд. */
function warmupLetters(rnd: () => number, letters: readonly string[], count: number): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const round = shuffled(rnd, letters);
    // Стык кругов: первая буква нового круга не повторяет последнюю прошлого.
    if (round.length > 1 && round[0] === out.at(-1)) round.push(round.shift() ?? '');
    out.push(...round);
  }
  return out.slice(0, count);
}

/**
 * Пары удара: две разные буквы, каждая буква набора хоть раз; одна и та же пара дважды подряд
 * не идёт — повтор переворачивается («ао оа ао оа»). С опорной буквой каждая пара — с ней.
 */
function warmupPairs(rnd: () => number, kick: WarmupKick, count: number): string[] {
  const { pivot } = kick;
  // Без опоры — поток букв без повторов подряд, нарезанный по две: соседние буквы и так разные.
  const stream = pivot
    ? warmupLetters(rnd, [...kick.letters].filter((c) => c !== pivot), count)
    : warmupLetters(rnd, [...kick.letters], count * 2);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = pivot ?? stream[i * 2] ?? '';
    const b = (pivot ? stream[i] : stream[i * 2 + 1]) ?? '';
    // С опорой — с какой стороны она стоит, случайно.
    let pair = pivot && rnd() < 0.5 ? b + a : a + b;
    if (pair === out.at(-1)) pair = [...pair].reverse().join('');
    out.push(pair);
  }
  return out;
}

/** Разминка: удары-блоки строк по плану. Одно зерно — та же разминка. */
export function makeWarmup(lesson: Lesson, seed: number): string[][] {
  const rnd = createRandom(seed ^ 0x5eed);
  return warmupPlan(lesson).map((kick) => {
    const per = kick.kind === 'letters' ? WARMUP_LETTERS : WARMUP_PAIRS;
    const parts =
      kick.kind === 'letters'
        ? warmupLetters(rnd, [...kick.letters], per * kick.rows)
        : warmupPairs(rnd, kick, per * kick.rows);
    return Array.from({ length: kick.rows }, (_, r) => parts.slice(r * per, (r + 1) * per).join(' '));
  });
}
