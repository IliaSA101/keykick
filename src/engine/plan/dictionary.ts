/**
 * Курс: словарь — слова, фразы и кричалки (`content/dictionary.json`, раздел по коду курса). Разбор с проверками (060-Т9а).
 * Чистые функции без Vue и DOM.
 */
import { findChar, isLetter, type Keymap, type Layout } from '../typing/keymap';
import type { Dictionary } from './lesson';
import { fail } from './lessonModel';
import { rec } from './read';

/** Слова, фразы и кричалки курса `course` из `dictionary.json`. Всё строчными буквами раскладки `layout`. */
export function parseDictionary(raw: unknown, map: Keymap, layout: Layout, course: string): Dictionary {
  const part = rec(rec(raw)[course]);
  const read = (key: keyof Dictionary, multi: boolean): string[] => {
    const v = part[key];
    if (!Array.isArray(v)) fail(`dictionary.${course}`, `expected ${key} list`);
    const seen = new Set<string>();
    return v.map((entry: unknown, n) => {
      const where = `dictionary.${course}.${key}[${n}]`;
      if (typeof entry !== 'string' || entry === '') fail(where, 'expected string');
      if (seen.has(entry)) fail(where, `duplicate ${entry}`);
      seen.add(entry);
      if (multi && (entry.startsWith(' ') || entry.endsWith(' ') || entry.includes('  '))) fail(where, `${entry}: bad spaces`);
      for (const ch of entry) {
        if (multi && ch === ' ') continue;
        const hit = findChar(map, layout, ch);
        if (!hit || hit.shift || !isLetter(ch) || ch !== ch.toLowerCase()) fail(where, `${entry}: ${ch} is not a lowercase letter`);
      }
      return entry;
    });
  };
  return { words: read('words', false), phrases: read('phrases', true), chants: read('chants', true) };
}

/** Фраза и кричалка не длиннее строки атаки (design §1.3): `width` — наименьший `rowWidth` курса. */
export function checkDictionaryFits(d: Dictionary, width: number): void {
  for (const key of ['phrases', 'chants'] as const) {
    d[key].forEach((entry, n) => {
      if (entry.length > width) fail(`dictionary.${key}[${n}]`, `${entry}: longer than ${width}`);
    });
  }
}
