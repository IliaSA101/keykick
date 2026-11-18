/**
 * Курс: урок и словарь в том виде, на котором строится план (060-Т9а). Урок собирает `parseLessons.ts` из файла уроков
 * пакета (`lessons.json`) и его текстов; словарь — `dictionary.ts` из `content/dictionary.json`.
 */
import type { Layout } from '../typing/keymap';
import type { Material } from './lessonModel';

export interface CourseLesson {
  id: string;
  league: string;
  /** Номер в лиге, с 1. */
  n: number;
  stage: number;
  name: string;
  friendly: boolean;
  control: boolean;
  keys: string;
  newKeys: string;
  focus: string;
  focusWeak: number;
  material: Material;
  wordLen?: [number, number];
  trap: boolean;
  noWords: boolean;
  chants: boolean;
  attacks: number[];
  rows: number;
  g: number;
  c: number;
  warmup: number;
  tips: string[];
  /** Id раскладки курса (`jcuken-win`), на которой написан урок. */
  layout: Layout;
  /** Ширина строки атаки в знаках (из файла уроков пакета). */
  rowWidth: number;
  /** Лесенка материала урока: `ladders[material]`, по одной ступени на атаку. */
  ladder: Material[];
}

export interface Dictionary {
  words: string[];
  phrases: string[];
  chants: string[];
}
