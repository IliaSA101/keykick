/**
 * Раскладка клавиатуры (060 §2): физические клавиши по рядам и что на них напечатано.
 * Тип + рукописная проверка без зависимостей: пусто — годна, иначе список замечаний.
 */

/** Пальцы: l/r — рука, p/r/m/i — мизинец, безымянный, средний, указательный; th — большие. */
export const FINGERS = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp', 'th'] as const;
export type Finger = (typeof FINGERS)[number];

export type LayoutOs = 'win';

export interface LayoutKey {
  /** [без Shift, с Shift]; у служебных клавиш (Shift, Enter) нет — есть подпись `label`. */
  ch?: readonly [string, string];
  finger: Finger;
  /** Номер ряда в `rows`. */
  row: number;
  /** Ширина в долях обычной клавиши — для экранной клавиатуры. */
  width?: number;
  /** Засечка на клавише. */
  bump?: true;
  label?: string;
}

export interface Layout {
  id: string;
  os: LayoutOs;
  /** Коды `KeyboardEvent.code` по рядам. */
  rows: string[][];
  keys: Record<string, LayoutKey>;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const oneChar = (s: unknown): s is string => typeof s === 'string' && [...s].length === 1;

function checkKey(code: string, k: unknown, rowOf: Map<string, number>, errs: string[]): void {
  const at = `keys.${code}`;
  if (!isObj(k)) {
    errs.push(`${at}: ожидался объект`);
    return;
  }
  if (!rowOf.has(code)) errs.push(`${at}: клавиши нет в rows`);
  if (typeof k.finger !== 'string' || !(FINGERS as readonly string[]).includes(k.finger)) errs.push(`${at}.finger: неизвестный палец`);
  if (k.row !== rowOf.get(code)) errs.push(`${at}.row: не совпадает с рядом в rows`);
  if (k.ch !== undefined) {
    if (!Array.isArray(k.ch) || k.ch.length !== 2 || !oneChar(k.ch[0]) || !oneChar(k.ch[1])) {
      errs.push(`${at}.ch: ожидалась пара из двух одиночных знаков`);
    }
  } else if (typeof k.label !== 'string' || k.label === '') {
    errs.push(`${at}: нет ни ch, ни label`);
  }
  if (k.width !== undefined && (typeof k.width !== 'number' || !(k.width > 0))) errs.push(`${at}.width: ожидалось число больше 0`);
  if (k.bump !== undefined && k.bump !== true) errs.push(`${at}.bump: ожидалось true`);
  if (k.label !== undefined && typeof k.label !== 'string') errs.push(`${at}.label: ожидалась строка`);
}

/** Проверка раскладки: пусто — годна. */
export function check(x: unknown): string[] {
  if (!isObj(x)) return ['раскладка: ожидался объект'];
  const errs: string[] = [];
  if (typeof x.id !== 'string' || !/^[a-z0-9-]+$/.test(x.id)) errs.push('id: ожидалась латиница вида jcuken-win');
  if (x.os !== 'win') errs.push("os: пока только 'win'");

  const rowOf = new Map<string, number>();
  if (!Array.isArray(x.rows) || x.rows.length === 0) {
    errs.push('rows: ожидался непустой список рядов');
  } else {
    x.rows.forEach((row: unknown, i) => {
      if (!Array.isArray(row) || row.length === 0) {
        errs.push(`rows[${i}]: ожидался непустой ряд`);
        return;
      }
      for (const code of row as unknown[]) {
        if (typeof code !== 'string' || code === '') errs.push(`rows[${i}]: код клавиши — непустая строка`);
        else if (rowOf.has(code)) errs.push(`rows[${i}]: клавиша ${code} уже есть`);
        else rowOf.set(code, i);
      }
    });
  }

  if (!isObj(x.keys)) {
    errs.push('keys: ожидался объект');
    return errs;
  }
  for (const [code, k] of Object.entries(x.keys)) checkKey(code, k, rowOf, errs);
  for (const code of rowOf.keys()) if (!(code in x.keys)) errs.push(`keys.${code}: нет описания клавиши из rows`);

  // один знак — одна клавиша (пробел на одной клавише в обоих слоях — не в счёт)
  const owner = new Map<string, string>();
  for (const [code, k] of Object.entries(x.keys)) {
    const ch = isObj(k) ? k.ch : undefined;
    if (!Array.isArray(ch)) continue;
    for (const c of ch as unknown[]) {
      if (typeof c !== 'string') continue;
      const prev = owner.get(c);
      if (prev !== undefined && prev !== code) errs.push(`знак «${c}» на двух клавишах: ${prev} и ${code}`);
      owner.set(c, code);
    }
  }
  return errs;
}
