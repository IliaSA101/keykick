/**
 * Мини-игра перерыва «Собери клавиатуру» (спека docs/specs/001-keyboard-puzzle.md): в одном ряду
 * знакомые по уроку клавиши пустые, их буквы — фишки в лотке; ребёнок ставит каждую на свою клавишу.
 * Без проигрыша: чужая клавиша фишку не принимает, штрафа нет. Время движок не видит —
 * миллисекунды даёт экран; случайность — по зерну снаружи.
 */
import type { KeyBox } from './keyboardLayout';
import { isLetter, type KeyDef, type Keymap } from './keymap';
import { shuffled } from './minigames';
import { createRandom } from './random';

/** Ряды, которые собираем: ряд цифр и пробел — не входят (спека, «Не входит»). */
export const PUZZLE_ROWS = ['top', 'home', 'bottom'] as const;
export type PuzzleRow = (typeof PUZZLE_ROWS)[number];

/** Дольше этого — не рекорд, а мусор или забытая вкладка (10 минут). */
export const PUZZLE_TIME_MAX = 600_000;

/**
 * Запас вокруг клавиши при броске, в долях шага клавиши: на окне 1024 клавиша меньше 44 px,
 * и фишку, отпущенную у самого края, засчитываем той клавише, к которой она ближе.
 */
export const DROP_SLACK = 0.3;

export interface PuzzleTile {
  /** Клавиша, на которую встаёт фишка (KeyboardEvent.code); она же — имя фишки. */
  code: string;
  /** Буква на фишке, строчная (как в буквах урока). */
  char: string;
}

export interface Puzzle {
  row: PuzzleRow;
  /** Номер ряда в раскладке (map.rows). */
  rowIndex: number;
  /** Ключ рекорда: ряд и буквы фишек (puzzleKey). */
  key: string;
  /** Фишки в лотке — в том порядке, в каком они лежат. */
  tiles: readonly PuzzleTile[];
  /** Уже поставленные фишки (code). */
  placed: readonly string[];
}

const isDigit = (ch: string): boolean => /^\p{Nd}$/u.test(ch);
const plain = (key: KeyDef): string => key.chars?.ru[0] ?? '';

/** Ряды раскладки, которые можно собирать: с буквами, без цифр. По имени — сдвиг от основного ряда. */
export function puzzleRows(map: Keymap): { row: PuzzleRow; rowIndex: number; keys: readonly KeyDef[] }[] {
  const home = map.rows.findIndex((r) => r.some((k) => k.bump));
  if (home < 0) throw new Error('keyboardPuzzle: need a home row with bumps');
  const out: { row: PuzzleRow; rowIndex: number; keys: readonly KeyDef[] }[] = [];
  PUZZLE_ROWS.forEach((row, i) => {
    const rowIndex = home + i - 1;
    const keys = map.rows[rowIndex];
    if (!keys) return;
    const chars = keys.map(plain).filter((ch) => ch !== '');
    if (chars.some(isLetter) && !chars.some(isDigit)) out.push({ row, rowIndex, keys });
  });
  return out;
}

/** Буквы ряда, знакомые по уроку (known — буквы урока). */
const knownIn = (keys: readonly KeyDef[], known: string): KeyDef[] =>
  keys.filter((k) => isLetter(plain(k)) && known.toLowerCase().includes(plain(k)));

/**
 * Какой ряд собирать и какие буквы в лоток (001-Р1, 001-Р2): ряд, где больше всего знакомых букв,
 * при равенстве — основной, потом верхний; незнакомые буквы ряда стоят на месте. Знакомых нет
 * ни в одном ряду — основной ряд целиком (001-Р7): игра не бывает пустой.
 */
function choose(map: Keymap, known: string): { row: PuzzleRow; rowIndex: number; tiles: KeyDef[] } {
  const rows = puzzleRows(map);
  const order = [...rows].sort((a, b) => (a.row === 'home' ? -1 : b.row === 'home' ? 1 : 0));
  let best: { row: PuzzleRow; rowIndex: number; tiles: KeyDef[] } | null = null;
  for (const r of order) {
    const tiles = knownIn(r.keys, known);
    if (tiles.length > (best?.tiles.length ?? 0)) best = { row: r.row, rowIndex: r.rowIndex, tiles };
  }
  if (best) return best;
  const home = order[0];
  if (!home) throw new Error('keyboardPuzzle: no letter rows');
  return { row: home.row, rowIndex: home.rowIndex, tiles: home.keys.filter((k) => isLetter(plain(k))) };
}

/**
 * Ключ рекорда: ряд и буквы фишек по порядку ряда, например «home:аовл». Не просто ряд (001-Р8):
 * с каждым уроком фишек в ряду больше, и рекорд урока 1 (две фишки) иначе не побить никогда.
 */
export function puzzleKey(map: Keymap, known: string): string {
  const c = choose(map, known);
  return `${c.row}:${c.tiles.map(plain).join('')}`;
}

/** Ключ рекорда из сохранения похож на настоящий: ряд из PUZZLE_ROWS и строчные буквы. */
export function isPuzzleKey(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^([a-z]+):(\p{Ll}{1,20})$/u.exec(v);
  return m !== null && (PUZZLE_ROWS as readonly string[]).includes(m[1] ?? '');
}

/** Время годится в рекорд: число больше нуля и не дольше PUZZLE_TIME_MAX. */
export function isPuzzleTime(ms: unknown): ms is number {
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 && ms <= PUZZLE_TIME_MAX;
}

/** Секунды для итога и рекорда: целые, не меньше одной. */
export function puzzleSeconds(ms: number): number {
  return Math.max(1, Math.round(ms / 1000));
}

/** Итог по рекорду: время мусорное; первый рекорд; новый; почти (целые секунды совпали); не побит. */
export type PuzzleVerdict = 'none' | 'first' | 'new' | 'near' | 'old';

export interface PuzzleOutcome {
  verdict: PuzzleVerdict;
  /** Время для итога, секунды. */
  seconds: number;
  /** Прежний рекорд в тех же единицах — когда он не побит ('near', 'old'), иначе null. */
  best: number | null;
  /** Секунды с десятыми: целые совпали с рекордом, иначе «38 с. Рекорд — 38 с» непонятно. */
  tenths: boolean;
}

const tenthsOf = (ms: number): number => Math.max(0.1, Math.round(ms / 100) / 10);

/**
 * Что сказать в итоге (ms — время игры, bestBefore — рекорд до неё). Новый — как в
 * applyPuzzleRecord (save.ts): целые миллисекунды строго меньше прежних.
 */
export function puzzleOutcome(ms: number, bestBefore: number | undefined): PuzzleOutcome {
  if (!isPuzzleTime(ms)) return { verdict: 'none', seconds: puzzleSeconds(ms), best: null, tenths: false };
  if (bestBefore === undefined) return { verdict: 'first', seconds: puzzleSeconds(ms), best: null, tenths: false };
  const isNew = Math.max(1, Math.round(ms)) < bestBefore;
  const tenths = puzzleSeconds(ms) === puzzleSeconds(bestBefore);
  const sec = tenths ? tenthsOf : puzzleSeconds;
  return {
    verdict: isNew ? 'new' : tenths ? 'near' : 'old',
    seconds: sec(ms),
    best: isNew ? null : sec(bestBefore),
    tenths,
  };
}

/**
 * Задание по зерну. Фишки перемешаны и никогда не лежат в порядке ряда (иначе ряд читается
 * прямо из лотка): совпало — сдвигаем по кругу на одну. Одна фишка — порядок один.
 */
export function makePuzzle(map: Keymap, known: string, seed: number): Puzzle {
  const c = choose(map, known);
  const inRow = c.tiles.map((k): PuzzleTile => ({ code: k.code, char: plain(k) }));
  let tiles = shuffled(createRandom(seed), inRow);
  if (tiles.length > 1 && tiles.every((t, i) => t === inRow[i])) tiles = [...tiles.slice(1), ...tiles.slice(0, 1)];
  return { row: c.row, rowIndex: c.rowIndex, key: `${c.row}:${inRow.map((t) => t.char).join('')}`, tiles, placed: [] };
}

/** Фишки, которые ещё в лотке, по порядку лотка. */
export function trayOf(puzzle: Puzzle): PuzzleTile[] {
  return puzzle.tiles.filter((t) => !puzzle.placed.includes(t.code));
}

/** Все фишки на местах. */
export function isSolved(puzzle: Puzzle): boolean {
  return puzzle.tiles.every((t) => puzzle.placed.includes(t.code));
}

/** Итог хода: встала; не та клавиша (фишка — назад в лоток); фишка уже стоит или её нет — ничего. */
export type PlaceResult = 'placed' | 'wrong' | 'again';

/**
 * Поставить фишку tile (её code) на клавишу code. Своя — встаёт; чужая — нет. Повтор (двойной
 * щелчок, фишка уже стоит) и неизвестная фишка состояние не меняют — тот же объект.
 */
export function placeTile(puzzle: Puzzle, tile: string, code: string): { puzzle: Puzzle; result: PlaceResult } {
  if (puzzle.placed.includes(tile) || !puzzle.tiles.some((t) => t.code === tile)) {
    return { puzzle, result: 'again' };
  }
  if (tile !== code) return { puzzle, result: 'wrong' };
  return { puzzle: { ...puzzle, placed: [...puzzle.placed, tile] }, result: 'placed' };
}

/**
 * Клавиша под отпущенной фишкой (x, y — в единицах клавиатуры, как KeyBox). Внутри клавиши —
 * она; рядом — ближайшая не дальше slack; дальше — null (мимо клавиатуры).
 */
export function keyUnder(boxes: readonly KeyBox[], x: number, y: number, slack = DROP_SLACK): KeyBox | null {
  let best: KeyBox | null = null;
  let bestDist = Infinity;
  for (const b of boxes) {
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
    const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
    const d = Math.hypot(dx, dy);
    if (d <= slack && d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}
