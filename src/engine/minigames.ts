/**
 * Мини-игры перерыва между таймами: «смежные вещи владения компьютером» — заглавные с Shift,
 * стрелки, мышь (щелчок и перетаскивание), Tab по кнопкам, «Собери клавиатуру» (engine/keyboardPuzzle).
 * Без проигрыша: задание кончается,
 * когда сделано, ошибка — только подсказка. Здесь — задания и проверка; рисунок — в
 * src/components/minigames. Случайность — по зерну снаружи, часов движок не видит.
 */
import { findChar, shiftFor, type Keymap } from './keymap';
import { createRandom, randomInt } from './random';
import { step, type KeyPress, type TypingState } from './typing';

/**
 * Порядок — от простой к сложной: заглавные требуют букв, которых новичок ещё не учил.
 * «Собери клавиатуру» — в конце (001-Р5): самая «учебная», порядок первых четырёх прежний.
 */
export const minigames = ['arrows', 'mouse', 'tab', 'capitals', 'puzzle'] as const;
export type MinigameId = (typeof minigames)[number];

/** Мини-игры по очереди: turn — номер перерыва (например, сыгранные матчи). */
export function minigameAt(turn: number): MinigameId {
  const n = Number.isSafeInteger(turn) && turn > 0 ? turn : 0;
  return minigames[n % minigames.length] ?? 'arrows';
}

export function isMinigame(v: unknown): v is MinigameId {
  return typeof v === 'string' && (minigames as readonly string[]).includes(v);
}

/** Перемешать копию (Фишер — Йейтс) по генератору. */
export function shuffled<T>(rnd: () => number, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rnd, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

// ——— «Заглавная»: имена и города с большой буквы, Shift — другой рукой ———

/** Слов в строке «Заглавной»: около 25 знаков, полминуты печати. */
export const CAPITAL_WORDS = 4;

/**
 * Слова для «Заглавной» из content: заглавная буква и строчные русской раскладки, 3–9 букв.
 * Ошибка в данных падает в тесте, а не на экране ребёнка.
 */
export function parseCapitals(raw: unknown, map: Keymap): string[] {
  const list = (raw as { capitals?: unknown } | null)?.capitals;
  if (!Array.isArray(list) || list.length < CAPITAL_WORDS) throw new Error('minigames.capitals: expected list');
  const seen = new Set<string>();
  return list.map((w: unknown, i) => {
    const where = `minigames.capitals[${i}]`;
    if (typeof w !== 'string' || w.length < 3 || w.length > 9) throw new Error(`${where}: expected 3–9 letters`);
    const [first, ...rest] = [...w];
    if (first === undefined || !findChar(map, 'ru', first)?.shift) throw new Error(`${where}: must start with a capital`);
    for (const ch of rest) {
      const hit = findChar(map, 'ru', ch);
      if (!hit || hit.shift || hit.key.code === 'Space') throw new Error(`${where}: bad letter ${ch}`);
    }
    if (seen.has(w)) throw new Error(`${where}: duplicate`);
    seen.add(w);
    return w;
  });
}

/**
 * Строка «Заглавной»: CAPITAL_WORDS слов по зерну, сначала — из знакомых букв (known — буквы урока):
 * новичку легче. Хотя бы одна заглавная — под левую руку и одна — под правую, если такие есть:
 * так в строке нужны оба Shift.
 */
export function capitalLine(words: readonly string[], map: Keymap, known: string, seed: number): string {
  const rnd = createRandom(seed);
  const unknown = (w: string) => [...w.toLowerCase()].filter((ch) => !known.includes(ch)).length;
  // Перемешиваем, потом устойчиво сортируем по незнакомым буквам: среди равных порядок случайный.
  const order = shuffled(rnd, words).sort((a, b) => unknown(a) - unknown(b));
  const side = (w: string) => capitalShift(map, w[0] ?? '');
  const picked = order.slice(0, CAPITAL_WORDS);
  for (const need of ['ShiftLeft', 'ShiftRight'] as const) {
    if (picked.some((w) => side(w) === need)) continue;
    const swap = order.find((w) => side(w) === need && !picked.includes(w));
    if (swap) picked[picked.length - 1] = swap;
  }
  return picked.join(' ');
}

/** Какой Shift нужен для символа: другой руки, чем буква; null — Shift не нужен. */
export function capitalShift(map: Keymap, ch: string): 'ShiftLeft' | 'ShiftRight' | null {
  const hit = findChar(map, 'ru', ch);
  return hit?.shift ? shiftFor(hit.key.finger) : null;
}

export interface CapitalStep {
  state: TypingState;
  /** Буква верная, но Shift зажат не той рукой (или не зажат) — курсор стоит, подсказка. */
  wrongShift: boolean;
}

/**
 * Шаг «Заглавной»: как обычная печать (typing.step), но заглавную принимаем, только если зажат
 * Shift другой руки (held — зажатые сейчас клавиши Shift по code). Иначе курсор стоит — так же,
 * как при ошибке в тайме, только без ошибки в счёте: это мини-игра, а не матч.
 */
export function capitalStep(map: Keymap, state: TypingState, press: KeyPress, held: readonly string[]): CapitalStep {
  const expected = state.text[state.pos];
  const need = expected === undefined ? null : capitalShift(map, expected);
  if (need !== null && !press.repeat && !press.mod && press.key === expected && !held.includes(need)) {
    return { state: { ...state, last: 'hint' }, wrongShift: true };
  }
  return { state: step(map, state, press), wrongShift: false };
}

// ——— «Пас стрелками»: провести мяч по клеткам к воротам ———

export interface Cell {
  x: number;
  y: number;
}

export interface ArrowField {
  width: number;
  height: number;
  start: Cell;
  /** Ворота — клетка в правом столбце. */
  goal: Cell;
  /** Защитники: в их клетку мяч не пройдёт. */
  defenders: readonly Cell[];
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export const ARROW_WIDTH = 8;
export const ARROW_HEIGHT = 5;
/** Поля «Паса стрелками» по очереди: защитников всё больше. */
export const ARROW_ROUNDS = [5, 7, 9] as const;

const STEP: Readonly<Record<Dir, Cell>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const DIR_BY_KEY: Readonly<Record<string, Dir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Стрелка по KeyboardEvent.code; не стрелка — null. */
export function arrowDir(code: string): Dir | null {
  return DIR_BY_KEY[code] ?? null;
}

const same = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

function blocked(field: ArrowField, c: Cell): boolean {
  return c.x < 0 || c.y < 0 || c.x >= field.width || c.y >= field.height || field.defenders.some((d) => same(d, c));
}

/** Шаг мяча: в стену или защитника — мяч стоит на месте. */
export function moveBall(field: ArrowField, at: Cell, dir: Dir): Cell {
  const next = { x: at.x + STEP[dir].x, y: at.y + STEP[dir].y };
  return blocked(field, next) ? at : next;
}

/** Во что упёрся шаг: защитник (подсказка «обойди») или край поля; шаг свободен — null. */
export function bumpInto(field: ArrowField, at: Cell, dir: Dir): 'defender' | 'edge' | null {
  const next = { x: at.x + STEP[dir].x, y: at.y + STEP[dir].y };
  if (next.x < 0 || next.y < 0 || next.x >= field.width || next.y >= field.height) return 'edge';
  return field.defenders.some((d) => same(d, next)) ? 'defender' : null;
}

export function atGoal(field: ArrowField, at: Cell): boolean {
  return same(field.goal, at);
}

/** Кратчайший путь от старта до ворот в шагах (поиск в ширину); пути нет — -1. */
export function shortestPath(field: ArrowField): number {
  const dist = new Map<string, number>([[`${field.start.x},${field.start.y}`, 0]]);
  const queue: Cell[] = [field.start];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i] as Cell;
    const d = dist.get(`${at.x},${at.y}`) ?? 0;
    if (atGoal(field, at)) return d;
    for (const dir of Object.keys(STEP) as Dir[]) {
      const next = moveBall(field, at, dir);
      const key = `${next.x},${next.y}`;
      if (!dist.has(key)) {
        dist.set(key, d + 1);
        queue.push(next);
      }
    }
  }
  return -1;
}

/**
 * Поле по зерну: мяч — в левом столбце, ворота — посередине правого, защитники — между ними.
 * Путь к воротам есть всегда: расстановку без пути отбрасываем и берём следующую.
 */
export function makeArrowField(seed: number, defenders: number): ArrowField {
  const rnd = createRandom(seed);
  const width = ARROW_WIDTH;
  const height = ARROW_HEIGHT;
  const goal = { x: width - 1, y: Math.floor(height / 2) };
  for (let tries = 0; ; tries++) {
    const start = { x: 0, y: randomInt(rnd, height) };
    const cells: Cell[] = [];
    for (let x = 1; x < width - 1; x++) for (let y = 0; y < height; y++) cells.push({ x, y });
    // После многих неудач — меньше защитников: поле должно быть всегда, даже при неудачном зерне.
    const n = Math.max(0, defenders - Math.floor(tries / 20));
    const field = { width, height, start, goal, defenders: shuffled(rnd, cells).slice(0, n) };
    if (shortestPath(field) > 0) return field;
  }
}

// ——— «Точный пас мышью»: щёлкнуть по партнёру, потом перетащить мяч ———

/** Точка на поле в процентах ширины и высоты (0–100): экран сам переводит в пиксели. */
export interface Spot {
  x: number;
  y: number;
}

/** Партнёров для щелчка и для перетаскивания. */
export const MOUSE_CLICKS = 5;
export const MOUSE_DRAGS = 3;
/** Мяч для перетаскивания лежит здесь. */
export const BALL_SPOT: Spot = { x: 12, y: 50 };
/** Мяч засчитан, если отпущен не дальше этого от партнёра (в процентах поля). */
export const DROP_RADIUS = 11;
/** Партнёры не ближе друг к другу и к мячу, чем это: мишени не налезают одна на другую. */
const SPOT_GAP = 18;

const distance = (a: Spot, b: Spot): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Точки по зерну внутри поля (с отступом от краёв), не ближе SPOT_GAP друг к другу и к мячу. */
export function makeSpots(seed: number, n: number): Spot[] {
  const rnd = createRandom(seed);
  const out: Spot[] = [];
  for (let tries = 0; out.length < n && tries < 2000; tries++) {
    const spot = { x: 30 + Math.round(rnd() * 58), y: 16 + Math.round(rnd() * 68) };
    const far = (s: Spot) => distance(s, spot) >= SPOT_GAP;
    // Подряд идущие партнёры — далеко друг от друга: щелчок за щелчком мышь ведут через поле.
    if (out.every(far) && far(BALL_SPOT)) out.push(spot);
  }
  return out;
}

export interface MouseGame {
  clicks: readonly Spot[];
  drags: readonly Spot[];
}

export function makeMouseGame(seed: number): MouseGame {
  return { clicks: makeSpots(seed, MOUSE_CLICKS), drags: makeSpots(seed + 1, MOUSE_DRAGS) };
}

/** Мяч отпущен у партнёра? */
export function droppedOn(target: Spot, drop: Spot): boolean {
  return distance(target, drop) <= DROP_RADIUS;
}

// ——— «Tab по защитникам»: фокус по кнопкам-игрокам, Enter — пас нужному ———

/** Игроков в ряду и пасов в игре. */
export const TAB_PLAYERS = 6;
export const TAB_ROUNDS = 5;
/** Пасов, где короче назад (Shift+Tab), не меньше этого. */
const MIN_BACK = 2;

export interface TabGame {
  /** Номера на футболках, по порядку кнопок. */
  numbers: readonly number[];
  /** Кому пас в каждом раунде — индекс кнопки. */
  targets: readonly number[];
}

/** Сколько нажатий Tab (ahead) и Shift+Tab (back) от игрока at до игрока i: фокус ходит по кругу. */
export function tabSteps(at: number, i: number, count = TAB_PLAYERS): { ahead: number; back: number } {
  return { ahead: (((i - at) % count) + count) % count, back: (((at - i) % count) + count) % count };
}

/**
 * Фокус по кругу внутри шеренги: Tab с последнего — на первого, Shift+Tab с первого — на последнего.
 * Возвращает, куда перевести фокус; null — не крайний игрок, браузер сам сдвинет фокус к соседу.
 */
export function tabWrap(index: number, count: number, back: boolean): number | null {
  if (count <= 0 || index < 0 || index >= count) return null;
  if (back && index === 0) return count - 1;
  if (!back && index === count - 1) return 0;
  return null;
}

/**
 * Игра по зерну. Фокус в начале — на первом игроке и ходит по кругу (tabWrap); каждый пас — не
 * соседу (хотя бы два нажатия в любую сторону) и новому игроку: из шести в ряду мяч побывает у всех.
 * Хотя бы MIN_BACK пасов — к игроку, до которого короче назад: Shift+Tab быстрее, чем Tab.
 * Путей мало (не больше 3⁵), поэтому перебираем все и берём случайный из подходящих.
 */
export function makeTabGame(seed: number): TabGame {
  const rnd = createRandom(seed);
  const numbers = shuffled(
    rnd,
    Array.from({ length: 98 }, (_, i) => i + 2),
  ).slice(0, TAB_PLAYERS);
  const isBack = (at: number, i: number) => tabSteps(at, i).back < tabSteps(at, i).ahead;
  const fresh: number[][] = [];
  const walk = (path: number[]): void => {
    if (path.length === TAB_ROUNDS) {
      fresh.push(path);
      return;
    }
    const at = path.at(-1) ?? 0;
    for (let i = 1; i < TAB_PLAYERS; i++) {
      const steps = tabSteps(at, i);
      if (Math.min(steps.ahead, steps.back) >= 2 && !path.includes(i)) walk([...path, i]);
    }
  };
  walk([]);
  const backs = (p: number[]) => p.filter((t, round) => isBack(p[round - 1] ?? 0, t)).length;
  const rhythm = fresh.filter((p) => backs(p) >= MIN_BACK);
  const pool = rhythm.length > 0 ? rhythm : fresh;
  return { numbers, targets: pool[randomInt(rnd, pool.length)] ?? [] };
}
