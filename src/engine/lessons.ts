/**
 * Уроки и генератор упражнений по методике «СОЛО» (docs/research-solo.md, docs/design.md 04.11):
 * перед таймом — разминка: удары-блоки строк (буква через пробел, потом пары); тайм — лесенка атак от простого к сложному:
 * буквы → пары → сочетания-«слова ряда» → настоящие слова → фразы, до потолка урока.
 * Первые уроки — медленнее (04.11): уроки 1–2 — одни буквы, начиная с чистых строк новой буквы.
 * Подстройка: новые клавиши урока и клавиши с ошибками выпадают чаще.
 * Уроки основного ряда до слов (3–5) — с короткими словами среди пар и сочетаний; решающая уроков 1–2 —
 * ловушка смены букв (спека 003, журнал 04.11, урок 4 «Соло»).
 * Случайность — по зерну (random.ts), поэтому тайм можно повторить и проверить тестом.
 *
 * Части: lessonModel (разбор), lessonPlan (план тайма), lessonWarmup (разминка), lessonHalf (строки тайма).
 */
export { materials, parseLessons, parseWords, tipAt, wordsFor } from './lessonModel';
export type { Lesson, Material } from './lessonModel';
export { HALF_LINES, LINE_MAX, LINE_MIN, LINE_RANGES, TRAP_FROM, TRAP_TO, attackPlan, letterWeights } from './lessonPlan';
export type { Attack } from './lessonPlan';
export {
  WARMUP_LETTERS,
  WARMUP_MAX_CHARS,
  WARMUP_MAX_KEYS,
  WARMUP_PAIRS,
  WARMUP_WIDTH,
  makeWarmup,
  warmupPlan,
} from './lessonWarmup';
export type { WarmupKick } from './lessonWarmup';
export { LESSON_WORD_MAX, LESSON_WORD_SHARE, MIN_POOL, makeHalf } from './lessonHalf';
