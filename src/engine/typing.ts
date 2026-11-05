/**
 * Движок печати одной строки: чистая функция step(состояние, нажатие) → новое состояние.
 *
 * Подсветка и пальцы — по физической клавише (code), верность — по символу (key).
 * Курсор при ошибке стоит, пока не нажата верная клавиша (docs/design.md, 04.11).
 * Время приходит снаружи в нажатии: движок не смотрит на часы.
 * Первое неверное нажатие тайма прощается: чаще всего это не та раскладка или Caps Lock (04.11).
 */
import {
  findChar,
  layouts,
  thumbAfter,
  type Finger,
  type KeyDef,
  type KeyHit,
  type Keymap,
  type Layout,
  type Thumb,
} from './keymap';

/** Нажатие — то, что экран берёт из KeyboardEvent. */
export interface KeyPress {
  code: string;
  key: string;
  /** Клавиша зажата и повторяется сама. */
  repeat: boolean;
  /** Зажат Ctrl, Alt или Meta: это сочетание, а не печать. */
  mod: boolean;
  /** Включён Caps Lock. */
  caps: boolean;
  /** Время нажатия, мс. */
  time: number;
}

/**
 * Подсказка вместо ошибки или в дополнение к ней:
 * layout — переключи раскладку; caps — выключи Caps Lock; numpad — цифры с верхнего ряда;
 * finger — три ошибки подряд на одной клавише, показать, каким пальцем её бить.
 */
export type Hint = 'layout' | 'caps' | 'numpad' | 'finger';

export type StepResult = 'ok' | 'error' | 'ignored' | 'hint';

/** Счётчики, которые копятся через все строки матча. */
export interface TypingStats {
  correct: number;
  errors: number;
  keyErrors: Readonly<Partial<Record<string, number>>>;
  fingerErrors: Readonly<Partial<Record<Finger, number>>>;
  /** Время первого и последнего засчитанного нажатия, мс; null — ещё не печатали. */
  startedAt: number | null;
  lastAt: number | null;
  /**
   * Промежутки между засчитанными нажатиями, мс. Переход к строке, которая идёт сразу (без надписи),
   * входит — ребёнок печатает подряд; переход через надпись или перерыв — нет: это пауза игры.
   */
  intervals: readonly number[];
}

export interface TypingState {
  text: string;
  layout: Layout;
  pos: number;
  /** Ошибок в этой строке — для счёта атаки. */
  lineErrors: number;
  /** След: позиции строки с засчитанной ошибкой, по возрастанию, без повторов (видно, где споткнулся). */
  missed: readonly number[];
  /** Ошибок подряд на текущей позиции. */
  streak: number;
  hint: Hint | null;
  last: StepResult | null;
  stats: TypingStats;
  /** Засчитанных нажатий тайма ещё не было: первое неверное — не ошибка. */
  forgive: boolean;
  /** Строка идёт сразу за прошлой, без паузы: промежуток от прошлого нажатия — в темп. */
  joined: boolean;
}

/** Сколько ошибок подряд на одной клавише до подсказки тренера. */
export const FINGER_HINT_AFTER = 3;

export const emptyStats: TypingStats = {
  correct: 0,
  errors: 0,
  keyErrors: {},
  fingerErrors: {},
  startedAt: null,
  lastAt: null,
  intervals: [],
};

/**
 * Новая строка. Счётчики без нажатий (начало разминки или тайма) — первое неверное нажатие простится.
 * joined — строка сразу за прошлой, без паузы игры. forgive: true — простить и посреди тайма:
 * строка после пенальти (спека 005, 005-Р7) — руки ушли к цифрам и мыши; её ставят с joined = false,
 * и пауза на задачу в секундомер, скорость и ровность не идёт.
 */
export function startLine(
  text: string,
  layout: Layout,
  stats: TypingStats = emptyStats,
  joined = false,
  forgive = stats.correct + stats.errors === 0,
): TypingState {
  if (text === '') throw new Error('empty line');
  return { text, layout, pos: 0, lineErrors: 0, missed: [], streak: 0, hint: null, last: null, stats, forgive, joined };
}

export function isDone(state: TypingState): boolean {
  return state.pos >= state.text.length;
}

/** Клавиша, которую ждём сейчас (для подсветки), или null, если строка набрана. */
export function expectedKey(map: Keymap, state: TypingState): KeyDef | null {
  return expectedHit(map, state)?.key ?? null;
}

/** То же с Shift: экран подсвечивает и Shift другой руки. */
export function expectedHit(map: Keymap, state: TypingState): KeyHit | null {
  const ch = state.text[state.pos];
  if (ch === undefined) return null;
  return keyFor(map, state.layout, ch) ?? null;
}

/** Каким большим бить пробел, если ждём пробел (по прошлому знаку строки); иначе null. */
export function expectedThumb(map: Keymap, state: TypingState): Thumb | null {
  if (expectedHit(map, state)?.key.finger !== 'th') return null;
  const prev = state.text[state.pos - 1];
  return thumbAfter(prev === undefined ? undefined : keyFor(map, state.layout, prev)?.key.finger);
}

function keyFor(map: Keymap, layout: Layout, ch: string) {
  const own = findChar(map, layout, ch);
  if (own) return own;
  const other = layouts.find((l) => l !== layout);
  return other ? findChar(map, other, ch) : undefined;
}

/** Нажатие, которое не печать: служебные клавиши, сочетания, автоповтор. */
function isNoise(press: KeyPress): boolean {
  return press.repeat || press.mod || [...press.key].length !== 1;
}

function bump<K extends string>(counts: Readonly<Partial<Record<K, number>>>, key: K): Partial<Record<K, number>> {
  return { ...counts, [key]: (counts[key] ?? 0) + 1 };
}

/** Время нажатия; промежуток от прошлого — если в этой строке уже нажимали или она идёт без паузы. */
function stamp(state: TypingState, time: number): Pick<TypingStats, 'startedAt' | 'lastAt' | 'intervals'> {
  const { stats } = state;
  const inLine = state.pos > 0 || state.lineErrors > 0 || state.joined;
  const intervals =
    inLine && stats.lastAt !== null ? [...stats.intervals, Math.max(0, time - stats.lastAt)] : stats.intervals;
  return { startedAt: stats.startedAt ?? time, lastAt: time, intervals };
}

export function step(map: Keymap, state: TypingState, press: KeyPress): TypingState {
  const expected = state.text[state.pos];
  if (expected === undefined || isNoise(press)) return { ...state, last: 'ignored' };

  if (press.code.startsWith('Numpad')) return { ...state, hint: 'numpad', last: 'hint' };

  const target = keyFor(map, state.layout, expected);
  const pressed = map.byCode.get(press.code);
  const otherLayout = layouts.find((l) => l !== state.layout);
  // Символ другой раскладки с этой клавиши: в латинице «.» — на клавише Ю, а в русской точка только на Slash.
  const foreignChar = Boolean(
    otherLayout &&
      pressed?.chars?.[otherLayout].includes(press.key) &&
      !pressed.chars[state.layout].includes(press.key),
  );

  // Знак совпал, клавиша нет: «.» с клавиши Ю в латинице — палец не тот, это ошибка, как другая клавиша
  // в латинице; с ней — подсказка раскладки, иначе непонятно, почему «.» не засчитана (009-Р20).
  // Латинская буква в русской строке ищется в латинице — там клавиша её же, это не подмена.
  const mimic = press.key === expected && foreignChar && pressed !== target?.key;

  if (press.key === expected && !mimic) {
    return {
      ...state,
      pos: state.pos + 1,
      streak: 0,
      hint: null,
      last: 'ok',
      forgive: false,
      stats: { ...state.stats, correct: state.stats.correct + 1, ...stamp(state, press.time) },
    };
  }

  // Та же клавиша, но символ другой раскладки — пальцы правы, раскладка нет.
  if (target && pressed === target.key && foreignChar) {
    return { ...state, hint: 'layout', last: 'hint' };
  }
  // Не тот регистр при включённом Caps Lock — не ошибка пальцев.
  if (!mimic && press.caps && press.key.toLowerCase() === expected.toLowerCase()) {
    return { ...state, hint: 'caps', last: 'hint' };
  }
  // Первое нажатие тайма неверное — прощаем: ни в строку, ни в ошибки клавиш. Буква другой
  // раскладки — сразу подсказка её переключить.
  if (state.forgive) {
    // Пробел до начала строки (строки с пробела не начинаются) — молча мимо, прощение цело:
    // второй быстрый Пробел после «Пробел — играем дальше» у пенальти (спека 005, 005-Р26).
    if (press.key === ' ') return { ...state, last: 'ignored' };
    const foreign = mimic || (otherLayout && !findChar(map, state.layout, press.key) && findChar(map, otherLayout, press.key));
    return foreign
      ? { ...state, forgive: false, hint: 'layout', last: 'hint' }
      : { ...state, forgive: false, last: 'ignored' };
  }

  const streak = state.streak + 1;
  const code = target?.key.code ?? press.code;
  const finger = target?.key.finger;
  return {
    ...state,
    lineErrors: state.lineErrors + 1,
    // Курсор при ошибке стоит: повтор на той же позиции — та же отметка.
    missed: state.missed.at(-1) === state.pos ? state.missed : [...state.missed, state.pos],
    streak,
    hint: streak >= FINGER_HINT_AFTER ? 'finger' : mimic ? 'layout' : null,
    last: 'error',
    stats: {
      ...state.stats,
      errors: state.stats.errors + 1,
      keyErrors: bump(state.stats.keyErrors, code),
      fingerErrors: finger ? bump(state.stats.fingerErrors, finger) : state.stats.fingerErrors,
      ...stamp(state, press.time),
    },
  };
}

/** Точность: доля верных нажатий среди засчитанных; до первого нажатия — 1. */
export function accuracy(stats: TypingStats): number {
  const total = stats.correct + stats.errors;
  return total === 0 ? 1 : stats.correct / total;
}

/** Пауза длиннее — «задумался»: в скорость и ровность идёт за PAUSE_COUNTS_AS (как в «СОЛО»). */
export const PAUSE_LONG_MS = 2500;
export const PAUSE_COUNTS_AS_MS = 1000;

/** Промежуток для скорости и ровности: длинная пауза не обрушивает темп. */
export function countedInterval(ms: number): number {
  return ms > PAUSE_LONG_MS ? PAUSE_COUNTS_AS_MS : ms;
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Время тайма, мс: сумма промежутков между нажатиями, без пауз на удары между строками. */
export function halfTime(stats: TypingStats): number {
  return sum(stats.intervals);
}

/**
 * Знаков в минуту по верным нажатиям; длинные паузы — по секунде.
 * Меньше секунды печати — 0, чтобы не было «тысяч».
 */
export function charsPerMinute(stats: TypingStats): number {
  const ms = sum(stats.intervals.map(countedInterval));
  return ms < 1000 ? 0 : Math.round((stats.correct * 60000) / ms);
}

/**
 * Ровность темпа, 0…1: 1 − стандартное отклонение / среднее промежутков (длинные паузы усечены).
 * Меньше двух промежутков — 1: неровности ещё не видно.
 */
export function evenness(stats: TypingStats): number {
  const xs = stats.intervals.map(countedInterval);
  if (xs.length < 2) return 1;
  const mean = sum(xs) / xs.length;
  if (mean <= 0) return 1;
  const sd = Math.sqrt(sum(xs.map((x) => (x - mean) ** 2)) / xs.length);
  return Math.max(0, 1 - sd / mean);
}

/** Секундомер «мм:сс». */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(Math.floor(total / 60))}:${two(total % 60)}`;
}

/** Знак, которого нет ни в одной строке: им «промахивается» typeLine. */
const MISS_KEY = '§';

/**
 * Набрать строку до конца через step, без клавиатуры: errors промахов сразу после первого верного
 * знака (первое неверное нажатие тайма прощается — до него промахов нет), нажатия раз в gapMs
 * с времени time. Для быстрых проверок (app/matchJump): экран подставляет готовое состояние матча.
 */
export function typeLine(map: Keymap, state: TypingState, errors: number, time: number, gapMs: number): TypingState {
  let s = state;
  let t = time;
  let left = errors;
  while (!isDone(s)) {
    const miss = left > 0 && s.pos > 0;
    s = step(map, s, {
      code: miss ? '' : (expectedHit(map, s)?.key.code ?? ''),
      key: miss ? MISS_KEY : (s.text[s.pos] ?? ''),
      repeat: false,
      mod: false,
      caps: false,
      time: t,
    });
    if (miss) left -= 1;
    t += gapMs;
  }
  return s;
}
