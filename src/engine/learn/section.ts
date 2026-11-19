/**
 * Раздел `learn` (067 design §7): учебные игры — ступень, число игр, лучшее время, последний день; последние три игры.
 * Id игр — из `learn.json` (как `shop` сверяет с `yard.json`).
 */
import cfg from '../../content/learn.json';
import { isDay, isInt, isRecord, type SectionDef } from '../save/section';

export interface LearnGame {
  /** Ступень до игры, 0…3 (ТЗ-7.5). */
  step: number;
  plays: number;
  /** Лучшее время, мс; `null` — не было. */
  best: number | null;
  /** Последний день игры; `null` — не было. */
  last: string | null;
}

export interface Learn {
  games: Record<string, LearnGame>;
  /** Последние игры, не больше трёх. */
  recent: string[];
  /** Дробный остаток ставки в сотых монеты, 0…99 (ТЗ-3.3); нет — 0. */
  rest?: number;
}

export const RECENT_MAX = 3;

const IDS: readonly string[] = cfg.games.map((g) => g.id);

function gameOk(g: unknown): boolean {
  if (!isRecord(g)) return false;
  return isInt(g.step) && g.step >= 0 && g.step <= 3 && isInt(g.plays) && g.plays >= 0 && (g.best === null || (isInt(g.best) && g.best >= 0)) && (g.last === null || isDay(g.last));
}

export const learnDef: SectionDef<Learn> = {
  name: 'learn',
  v: 1,
  empty: () => ({ games: {}, recent: [] }),
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const why: string[] = [];
    if (!isRecord(d.games) || Object.entries(d.games).some(([id, g]) => !IDS.includes(id) || !gameOk(g))) why.push('games');
    if (!Array.isArray(d.recent) || d.recent.length > RECENT_MAX || !d.recent.every((id) => IDS.includes(id as string))) why.push('recent');
    if (d.rest !== undefined && (!isInt(d.rest) || d.rest < 0 || d.rest > 99)) why.push('rest');
    return why;
  },
};
