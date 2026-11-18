/**
 * Каркас лиг курса (060 §2): сколько уроков, какой слой клавиш, кубок, готовность и пакет.
 * Файл — список `LeagueFrame` в порядке прохождения.
 */

/** Слой клавиатуры, который осваивает лига (черновик 060-Т2: по `part` старого leagues.json). */
export const LAYERS = ['home', 'top', 'bottom', 'shift', 'digits', 'text'] as const;
export type Layer = (typeof LAYERS)[number];

export const STATUSES = ['ready', 'building'] as const;
export type LeagueStatus = (typeof STATUSES)[number];

export interface LeagueFrame {
  id: string;
  /** Число уроков лиги. */
  lessons: number;
  layer: Layer;
  /** Id кубка лиги — название в `text/<язык>.json`, раздел `cups`. */
  cup: string;
  status: LeagueStatus;
  /** Id пакета с уроками (`ru.yard`) или `null`, пока лига строится. */
  pack: string | null;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Проверка одной лиги; `at` — подпись места для замечаний. */
export function checkFrame(x: unknown, at = 'лига'): string[] {
  if (!isObj(x)) return [`${at}: ожидался объект`];
  const errs: string[] = [];
  if (typeof x.id !== 'string' || !/^[a-z0-9-]+$/.test(x.id)) errs.push(`${at}.id: ожидалась латиница`);
  if (typeof x.lessons !== 'number' || !Number.isInteger(x.lessons) || x.lessons <= 0) errs.push(`${at}.lessons: ожидалось целое больше 0`);
  if (typeof x.layer !== 'string' || !(LAYERS as readonly string[]).includes(x.layer)) errs.push(`${at}.layer: неизвестный слой`);
  if (typeof x.cup !== 'string' || !/^[a-z0-9-]+$/.test(x.cup)) errs.push(`${at}.cup: ожидался id кубка латиницей`);
  if (x.status !== 'ready' && x.status !== 'building') errs.push(`${at}.status: ready или building`);
  if (x.pack !== null && (typeof x.pack !== 'string' || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(x.pack))) {
    errs.push(`${at}.pack: ожидалось null или id вида ru.yard`);
  }
  if (x.status === 'ready' && x.pack === null) errs.push(`${at}: готовая лига без пакета`);
  if (x.status === 'building' && x.pack !== null) errs.push(`${at}: строящаяся лига уже с пакетом`);
  return errs;
}

/** Проверка файла каркаса: список лиг без повторов id и кубков. Сумму уроков проверяет тест курса. */
export function check(x: unknown): string[] {
  if (!Array.isArray(x) || x.length === 0) return ['leagues: ожидался непустой список лиг'];
  const errs: string[] = [];
  const ids = new Set<string>();
  const cups = new Set<string>();
  x.forEach((f: unknown, i) => {
    const id = isObj(f) && typeof f.id === 'string' ? f.id : `#${i}`;
    errs.push(...checkFrame(f, id));
    if (!isObj(f)) return;
    if (typeof f.id === 'string') {
      if (ids.has(f.id)) errs.push(`${id}: id повторяется`);
      ids.add(f.id);
    }
    if (typeof f.cup === 'string') {
      if (cups.has(f.cup)) errs.push(`${id}: кубок ${f.cup} уже у другой лиги`);
      cups.add(f.cup);
    }
  });
  return errs;
}
