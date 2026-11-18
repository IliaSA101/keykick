/**
 * Общие помощники стражей по исходникам (`tests/guards.test.ts`, `tests/guards/*.test.ts`): обход файлов и текст без
 * комментариев. Разрез guards — очередь п. 12 (585 из 600 строк, 18.11).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const root = join(import.meta.dirname, '..', '..');

export function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export const rel = (path: string) => relative(root, path).split(sep).join('/');
export const codeFiles = (dir: string) => walk(join(root, dir)).filter((p) => /\.(ts|vue|mjs)$/.test(p));


/**
 * Текст без комментариев и стилей: комментарии у нас по-русски законно,
 * а тексты интерфейса — нет. `//` после двоеточия не трогаем: это ссылка в строке.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}
