/**
 * Раздел `base` (067 design §7): База — день открытия, игры на интерес за сегодня (0…2), рекорды, последний счёт по играм, увиденные игры.
 * Id игр — из `base.json` (Т6).
 */
import { isDay, isInt, isRecord, type SectionDef } from '../save/section';
import { FUN_IDS } from './open';

/** Предел игр на интерес в день (ТЗ-7.10) — постоянная, не зависит от `base.json`. */
export const TODAY_MAX = 2;

/** Рекорд игры: `n` — счёт, `t` — время Штрафного, с («2 из 5 · 0:47»), `day` — дата рекорда. */
export interface FunRecord {
  n: number;
  t?: number;
  day: string;
}

/** Последний счёт игры (Э4.08: «в прошлый раз N · до рекорда M»): `n` — счёт, `t` — время Штрафного, с. */
export interface LastScore {
  n: number;
  t?: number;
}

/** Последняя сыгранная игра: `run` — защита от повтора (непустой). */
export interface LastFun {
  run: string;
  id: string;
}

/** «Последняя игра — рекорд» (Э4.08): считаем, а не храним — последний счёт игры равен рекорду (счёт и время). */
export function lastIsRecord(base: Base, id: string): boolean {
  const l = base.lastN[id];
  const r = base.records[id];
  return l !== undefined && r !== undefined && l.n === r.n && l.t === r.t;
}

export interface Base {
  /** День, на который посчитан `today`; `null` — База ещё не открывалась. */
  day: string | null;
  /** Игр на интерес сегодня, 0…2 (ТЗ-7.12). */
  today: number;
  records: Record<string, FunRecord>;
  /** Последний счёт по каждой игре (рядом с рекордом). */
  lastN: Record<string, LastScore>;
  /** Игры, сыгранные в `day` (метка «сегодня сыграна»). */
  played: string[];
  last: LastFun | null;
  seen: string[];
}

const okScore = (r: Record<string, unknown>): boolean => isInt(r.n) && r.n >= 0 && (r.t === undefined || (isInt(r.t) && r.t >= 0));
const okRecord = (r: unknown): boolean => isRecord(r) && okScore(r) && isDay(r.day);
const okLast = (r: unknown): boolean => isRecord(r) && okScore(r);

export const baseDef: SectionDef<Base> = {
  name: 'base',
  v: 1,
  empty: () => ({ day: null, today: 0, records: {}, lastN: {}, played: [], last: null, seen: [] }),
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const why: string[] = [];
    if (d.day !== null && !isDay(d.day)) why.push('day');
    if (!isInt(d.today) || d.today < 0 || d.today > TODAY_MAX) why.push('today');
    if (!isRecord(d.records) || Object.entries(d.records).some(([id, r]) => !FUN_IDS.includes(id) || !okRecord(r))) why.push('records');
    if (!isRecord(d.lastN) || Object.entries(d.lastN).some(([id, r]) => !FUN_IDS.includes(id) || !okLast(r))) why.push('lastN');
    if (!Array.isArray(d.played) || !d.played.every((id) => typeof id === 'string' && FUN_IDS.includes(id))) why.push('played');
    if (d.last !== null && !(isRecord(d.last) && typeof d.last.run === 'string' && d.last.run !== '' && typeof d.last.id === 'string' && FUN_IDS.includes(d.last.id))) why.push('last');
    if (!Array.isArray(d.seen) || !d.seen.every((id) => typeof id === 'string' && FUN_IDS.includes(id))) why.push('seen');
    return why;
  },
};
