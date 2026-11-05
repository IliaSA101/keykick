/**
 * Урок: модель и разбор из lessons.json, словарь, советы тренера. Общие помощники частей генератора.
 */
import { findChar, isLetter, layouts, type Keymap, type Layout } from './keymap';

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
  /** Советы тренера перед матчем: по очереди от матча к матчу (tipAt). */
  tips: string[];
  /** Соперник-персонаж урока (буквосочетание); нет — соперник случайный. */
  rival?: string;
}

/** Урок без фокуса разминается основным рядом: буквы урока начинаются с ФЫВА ОЛДЖ. */
export const HOME_KEYS = 8;

export function fail(where: string, what: string): never {
  throw new Error(`${where}: ${what}`);
}

export const unique = (s: string): string[] => [...new Set(s)];

/** Буквы урока без знаков: из них веса, пробежки по ряду и разминка (спека 009). */
export const lettersOf = (lesson: Lesson): string[] => unique(lesson.keys).filter(isLetter);

/**
 * Знак конца урока — первый знак в keys, не буква (точка, спека 009); нет — строки без знаков.
 * Знак стоит в конце keys: разминка урока без фокуса берёт первые буквы основного ряда.
 */
export const endMark = (lesson: Lesson): string | undefined => unique(lesson.keys).find((ch) => !isLetter(ch));

/** Строчная буква (\p{Ll}): «вода.» или «т.д.» в словаре дали бы «..» в строке с точкой. */
const isLowercase = (ch: string): boolean => /^\p{Ll}$/u.test(ch);

export function parseLessons(raw: unknown, map: Keymap): Lesson[] {
  const list = (raw as { lessons?: unknown } | null)?.lessons;
  if (!Array.isArray(list) || list.length === 0) fail('lessons', 'expected lessons');
  const ids = new Set<string>();
  return list.map((item: unknown, n): Lesson => {
    const r = (item ?? {}) as Record<string, unknown>;
    const where = `lessons[${n}]`;
    const str = (key: string, allowEmpty = false): string => {
      const v = r[key];
      if (typeof v !== 'string' || (!allowEmpty && v === '')) fail(where, `expected ${key}`);
      return v;
    };
    const id = str('id');
    if (ids.has(id)) fail(where, `duplicate id ${id}`);
    ids.add(id);
    const layout = str('layout');
    if (!(layouts as readonly string[]).includes(layout)) fail(where, `bad layout ${layout}`);
    const keys = str('keys');
    for (const ch of keys) {
      if (!findChar(map, layout as Layout, ch)) fail(where, `key ${ch} is not on the ${layout} layout`);
    }
    const subset = (key: string): string => {
      const v = str(key, true);
      for (const ch of v) if (!keys.includes(ch)) fail(where, `${key} ${ch} is not in keys`);
      return v;
    };
    const material = str('material');
    if (!(materials as readonly string[]).includes(material)) fail(where, `bad material ${material}`);
    // Совет — строка или список строк; пустой список или пустая строка — ошибка.
    const tip: unknown = r.tip;
    const tips: unknown[] = Array.isArray(tip) ? tip : [tip];
    if (tips.length === 0 || tips.some((t) => typeof t !== 'string' || t === '')) fail(where, 'expected tip');
    const lesson: Lesson = {
      id,
      league: str('league'),
      name: str('name'),
      layout: layout as Layout,
      keys,
      newKeys: subset('newKeys'),
      focus: subset('focus'),
      material: material as Material,
      tips: tips as string[],
    };
    if (r.rival !== undefined) lesson.rival = str('rival');
    return lesson;
  });
}

export function parseWords(raw: unknown, map: Keymap, layout: Layout): string[] {
  const list = (raw as Partial<Record<Layout, unknown>> | null)?.[layout];
  if (!Array.isArray(list)) fail('words', `expected ${layout} list`);
  const seen = new Set<string>();
  return list.map((w: unknown, n) => {
    if (typeof w !== 'string' || w === '') fail(`words.${layout}[${n}]`, 'expected word');
    if (seen.has(w)) fail(`words.${layout}[${n}]`, `duplicate ${w}`);
    seen.add(w);
    for (const ch of w) {
      const hit = findChar(map, layout, ch);
      if (!hit || hit.shift || !isLowercase(ch)) fail(`words.${layout}[${n}]`, `${w}: ${ch} is not a lowercase letter`);
    }
    return w;
  });
}

/** Совет n-го матча урока: по кругу, следующий матч — следующий совет. */
export function tipAt(lesson: Lesson, n: number): string {
  const count = lesson.tips.length;
  return lesson.tips[((Math.trunc(n) % count) + count) % count] ?? fail(lesson.id, 'no tips');
}

/** Слова словаря, целиком набираемые буквами урока. */
export function wordsFor(lesson: Lesson, words: readonly string[]): string[] {
  return words.filter((w) => [...w].every((ch) => lesson.keys.includes(ch)));
}

/** Потолок урока — не ниже ступени m. */
export function atLeast(lesson: Lesson, m: Material): boolean {
  return materials.indexOf(lesson.material) >= materials.indexOf(m);
}
