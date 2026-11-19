/**
 * Модель Двора (065-Т5): ступень урока, двор-соперник, дома/в гостях, флажки Кубка. Числа и имена — `content/yard.json`.
 * Чистые функции: номер урока 1…32 (33 — Двор пройден). Макет-образец — `tools/mock-map/parts.mjs`, `yard.mjs`.
 */
import cfg from '../../content/yard.json';

export const YARD_LESSONS: number = cfg.lessons;

/** Ступень (двор-соперник 1…10) урока; Двор пройден (33) — ступень последнего урока. */
export const stageOf = (lesson: number): number => cfg.stageOfLesson[Math.min(Math.max(lesson, 1), YARD_LESSONS) - 1]!;

/** Уроки ступени по порядку. */
export const lessonsOf = (stage: number): number[] => Array.from({ length: YARD_LESSONS }, (_, i) => i + 1).filter((n) => stageOf(n) === stage);

/** Индекс улицы двора-соперника урока, 0…9; имя — `streetName`. */
export const streetOf = (lesson: number): number => stageOf(lesson) - 1;
export const streetName = (street: number): string => cfg.streets[street] ?? '';

/** Первый матч ступени — в гостях, дальше по очереди (012-Р38). */
export const isAway = (lesson: number): boolean => lessonsOf(stageOf(lesson)).indexOf(lesson) % 2 === 0;

/** Раунд Кубка — дома (9, 18, 24, 32), остальные — в гостях. */
export const isHomeRound = (flag: number): boolean => cfg.homeRounds.includes(flag);

export const isControl = (lesson: number): boolean => cfg.control.includes(lesson);

/** Ступень стадиона (id из `yard.json`), которая достраивается, когда пройден урок `lesson`; нет — `null`. Ключ — тот же `after`, что у `builtOf`. */
export const stepAfter = (lesson: number): string | null => cfg.steps.find((s) => s.after === lesson)?.id ?? null;

/** Урок-флажок раунда Кубка (ТЗ-1.5). */
export const ROUNDS: readonly number[] = cfg.rounds;

/** Двор, чьи уроки — вокруг урока `lesson`: номера первого и последнего. */
export const stageRange = (lesson: number): [number, number] => {
  const ls = lessonsOf(stageOf(lesson));
  return [ls[0]!, ls[ls.length - 1]!];
};
