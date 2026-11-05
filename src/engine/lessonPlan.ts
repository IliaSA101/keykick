/**
 * План тайма: атаки по лесенке потолка урока, длины строк, ловушка смены, веса букв.
 */
import { findChar, type Keymap } from './keymap';
import { lettersOf, unique, type Lesson, type Material } from './lessonModel';
import type { TypingStats } from './typing';

/** Атака тайма: ступень материала и длина строки в знаках. */
export interface Attack {
  material: Material;
  min: number;
  max: number;
  /** Чистая строка одной буквы («а а а…»): первые атаки урока одиночных букв (04.11). */
  letter?: string;
  /** Ловушка смены: «в в в … л л л», какая буква первая — по зерну (решающая уроков 1–2). */
  trap?: [string, string];
}

/** Атак в тайме; последняя — решающая. */
export const HALF_LINES = 6;

/**
 * Длина строки по атакам: первые короткие — новичок не теряет строку, к решающей длиннее.
 * Решение 04.11: первые атаки ~12–16 знаков, последние ~20–26.
 */
export const LINE_RANGES: readonly (readonly [number, number])[] = [
  [12, 16],
  [13, 17],
  [15, 20],
  [16, 22],
  [18, 24],
  [20, 26],
];
export const LINE_MIN = 12;
export const LINE_MAX = 26;

/** Лесенка тайма по потолку урока: от простого к сложному, решающая — на потолке. */
const LADDER: Readonly<Record<Material, readonly Material[]>> = {
  letters: ['letters', 'letters', 'letters', 'letters', 'letters', 'letters'],
  pairs: ['letters', 'letters', 'pairs', 'pairs', 'pairs', 'pairs'],
  combos: ['letters', 'letters', 'pairs', 'combos', 'combos', 'combos'],
  words: ['letters', 'letters', 'pairs', 'combos', 'words', 'words'],
  phrases: ['letters', 'pairs', 'combos', 'words', 'phrases', 'phrases'],
};

// Вес буквы: основа, прибавка новым клавишам урока, прибавка за каждую ошибку (с потолком).
const BASE_WEIGHT = 1;
const FOCUS_WEIGHT = 2;
/** Доля веса букв фокуса в уроке — не меньше этой (новые буквы не тонут среди 30 знакомых). */
const FOCUS_SHARE = 0.4;
const ERROR_WEIGHT = 1;
const ERROR_CAP = 3;
/** Ловушка смены: первая буква занимает от 40 до 60 % строки. */
export const TRAP_FROM = 0.4;
export const TRAP_TO = 0.6;

/** Вес каждой буквы урока с учётом прошлых ошибок ребёнка. Знаков («.») в весах нет (спека 009). */
export function letterWeights(lesson: Lesson, map: Keymap, stats?: TypingStats): Map<string, number> {
  const weights = new Map<string, number>();
  for (const ch of lettersOf(lesson)) {
    const code = findChar(map, lesson.layout, ch)?.key.code;
    const errors = code ? (stats?.keyErrors[code] ?? 0) : 0;
    const w = BASE_WEIGHT + (lesson.focus.includes(ch) ? FOCUS_WEIGHT : 0) + ERROR_WEIGHT * Math.min(ERROR_CAP, errors);
    weights.set(ch, w);
  }
  // Фокус — не меньше FOCUS_SHARE всего веса: среди 30 букв нижнего ряда прибавка +2 тонула,
  // и новая «я» встречалась в тайме 3 раза. В маленьких уроках доля и так больше — без изменений.
  const focus = [...weights].filter(([ch]) => lesson.focus.includes(ch));
  const inFocus = focus.reduce((sum, [, w]) => sum + w, 0);
  const total = [...weights.values()].reduce((sum, w) => sum + w, 0);
  if (inFocus > 0 && inFocus < FOCUS_SHARE * total) {
    const scale = (FOCUS_SHARE * (total - inFocus)) / ((1 - FOCUS_SHARE) * inFocus);
    for (const [ch, w] of focus) weights.set(ch, w * scale);
  }
  return weights;
}

/**
 * Атаки тайма: ступень по лесенке потолка урока и длина строки. Урок одиночных букв
 * (потолок letters) начинается чистыми строками каждой новой буквы по порядку («а а а…»,
 * потом «о о о…»), дальше — буквы урока вперемешку; решающая — всегда вперемешку.
 * Второй тайм — тот же план с другим зерном: чистые строки те же, смешанные — другие.
 * decisive — тайм с решающей атакой: у урока одиночных букв с двумя новыми она — ловушка смены.
 */
export function attackPlan(lesson: Lesson, decisive = false): Attack[] {
  const fresh = unique(lesson.newKeys);
  const pure = lesson.material === 'letters' ? fresh.slice(0, HALF_LINES - 1) : [];
  const [a, b] = fresh;
  const trap: [string, string] | null =
    decisive && lesson.material === 'letters' && fresh.length === 2 && a && b ? [a, b] : null;
  const ladder = LADDER[lesson.material];
  return ladder.map((material, i) => {
    const [min, max] = LINE_RANGES[i] ?? [LINE_MIN, LINE_MAX];
    const attack: Attack = { material, min, max };
    const letter = pure[i];
    if (letter) attack.letter = letter;
    if (trap && i === ladder.length - 1) attack.trap = trap;
    return attack;
  });
}
