/**
 * Общие помощники генератора строк (v2): ступени материала, буквы урока. Разбор уроков v1 (lessons.json) ушёл
 * с 018-Т6б; уроки v2 разбирает `course/model.ts`.
 */
import { isLetter, type Layout } from './keymap';

/** Ступени материала, от простой к сложной. */
export const materials = ['letters', 'pairs', 'combos', 'words', 'phrases'] as const;
export type Material = (typeof materials)[number];

export interface Lesson {
  id: string;
  league: string;
  name: string;
  layout: Layout;
  /** Все буквы, которые урок разрешает. */
  keys: string;
  /** Новые буквы урока: для каждой — строка разминки; пусто — урок без новых букв. */
  newKeys: string;
  /** Буквы, которые урок отрабатывает: генератор даёт их чаще (обычно — те же новые). */
  focus: string;
  /** Потолок лесенки: самая сложная ступень материала в тайме. */
  material: Material;
}

/** Урок без фокуса разминается основным рядом: буквы урока начинаются с ФЫВА ОЛДЖ. */
export const HOME_KEYS = 8;

export function fail(where: string, what: string): never {
  throw new Error(`${where}: ${what}`);
}

export const unique = (s: string): string[] => [...new Set(s)];

/** Буквы урока без знаков: из них веса, пробежки по ряду и разминка (спека 009). */
export const lettersOf = (lesson: Pick<Lesson, 'keys'>): string[] => unique(lesson.keys).filter(isLetter);
