/**
 * Курс: разбор сырых данных руками — чтение полей с понятной ошибкой. Общее для разбора уроков и словаря.
 * Чистые функции без Vue и DOM.
 */
import { findChar, type Keymap, type Layout } from '../typing/keymap';
import { fail } from './lessonModel';

export type Rec = Record<string, unknown>;

export const rec = (item: unknown): Rec => (item && typeof item === 'object' && !Array.isArray(item) ? (item as Rec) : {});

/** Белый список ключей: опечатка в имени поля не должна молча пропадать. */
export function known(r: Rec, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(r)) if (!allowed.includes(key)) fail(where, `unknown field ${key}`);
}

export function str(r: Rec, key: string, where: string, allowEmpty = false): string {
  const v = r[key];
  if (typeof v !== 'string' || (!allowEmpty && v === '')) fail(where, `expected ${key}`);
  return v;
}

export function int(r: Rec, key: string, where: string, min: number, max = Infinity): number {
  const v = r[key];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) fail(where, `expected integer ${key} in ${min}..${max}`);
  return v;
}

export function flag(r: Rec, key: string, where: string): boolean {
  const v = r[key];
  if (v !== undefined && typeof v !== 'boolean') fail(where, `expected boolean ${key}`);
  return v === true;
}

/** Каждый знак `text` есть на раскладке `layout`. */
export function onLayout(map: Keymap, layout: Layout, text: string, where: string): void {
  for (const ch of text) if (!findChar(map, layout, ch)) fail(where, `key ${ch} is not on the ${layout} layout`);
}

/** Непустой список в поле `key` корня файла. */
export function list(raw: unknown, key: string): unknown[] {
  const v = rec(raw)[key];
  if (!Array.isArray(v) || v.length === 0) fail('file', `expected ${key}`);
  return v;
}
