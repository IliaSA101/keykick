/**
 * «Разобрано» битовой строкой (спека 018 design §3.2, Р14): бит `no − 1` — задача с номером `no`.
 * 6 бит на знак base64url, младший бит первым; хвостовые нули не пишутся. Не обрезается: потолок — `TASK_NO_MAX`.
 * Чистые функции, без Vue и DOM.
 */
import { TASK_NO_MAX } from '../tasks';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** Знаков в строке на потолке номера. */
export const SOLVED_CHARS_MAX = Math.ceil(TASK_NO_MAX / 6);

const VALID = new RegExp(`^[A-Za-z0-9_-]{0,${SOLVED_CHARS_MAX}}$`);

/** Строка годится: base64url не длиннее потолка. */
export function validSolved(bits: unknown): bits is string {
  return typeof bits === 'string' && VALID.test(bits);
}

/** Разбор из сохранения: годная строка без хвостовых нулей, иначе `''` (битое не «разбирает» задач). */
export function parseSolved(raw: unknown): string {
  return validSolved(raw) ? raw.replace(/A+$/, '') : '';
}

/** Номер годится: целое 1…TASK_NO_MAX. */
const validNo = (no: number): boolean => Number.isInteger(no) && no >= 1 && no <= TASK_NO_MAX;

/** Задача с номером `no` разобрана. Негодный номер или строка — нет. */
export function hasSolved(bits: string, no: number): boolean {
  if (!validNo(no) || !validSolved(bits)) return false;
  const i = Math.floor((no - 1) / 6);
  if (i >= bits.length) return false;
  return ((ALPHABET.indexOf(bits.charAt(i)) >> ((no - 1) % 6)) & 1) === 1;
}

/** Строка с добавленной задачей. Негодный номер — строка прежняя; битая строка считается пустой. */
export function addSolved(bits: string, no: number): string {
  const base = parseSolved(bits);
  if (!validNo(no)) return base;
  const i = Math.floor((no - 1) / 6);
  const chars = base.padEnd(i + 1, 'A').split('');
  const old = ALPHABET.indexOf(chars[i] ?? 'A');
  chars[i] = ALPHABET.charAt(old | (1 << ((no - 1) % 6)));
  return chars.join('');
}

/** Сколько задач разобрано. Битая строка — 0. */
export function solvedCount(bits: string): number {
  let n = 0;
  for (const ch of parseSolved(bits)) {
    for (let v = ALPHABET.indexOf(ch); v > 0; v >>= 1) n += v & 1;
  }
  return n;
}
