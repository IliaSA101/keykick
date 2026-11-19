/**
 * Открытие и лимит игр на интерес (ТЗ-7.10, 7.12, 10.1): чистые функции, день и состояние игрока приходят снаружи.
 * Лимит — 2 игры на интерес в день; исчерпан — игры на интерес «завтра», учебные и «минута тренера» открыты всегда.
 */
import cfg from '../../content/base.json';
import type { Learn } from '../learn/section';
import { lastIsRecord, type Base, type FunRecord, type LastScore } from './section';

export type FunId = 'keepy' | 'mini' | 'free' | 'memo' | 'keeper';

export interface OpenRule {
  kind: 'base' | 'lesson' | 'cup';
  after: number;
}

export interface FunGame {
  id: FunId;
  open: OpenRule;
  better: 'high' | 'low';
}

export const FUN_GAMES = cfg.games as FunGame[];
export const FUN_IDS: readonly string[] = FUN_GAMES.map((g) => g.id);
export const FUN_PER_DAY: number = cfg.perDay;

export interface BaseCtx {
  /** Календарный день `ГГГГ-ММ-ДД`. */
  day: string;
  /** Номер текущего (не пройденного) урока Двора, 1…32; 33 — Двор пройден. */
  cur: number;
  /** База открыта по замку (`systemOpen('base', …)`, ТЗ-1.9). */
  open: boolean;
  /** Матчей сыграно сегодня: База — после первого матча дня (ТЗ-7.10). */
  matchesToday: number;
  /** Сыгран первый матч Кубка (Штрафной, ТЗ-7.12). */
  cupPlayed: boolean;
}

/** Почему игра закрыта: `later` — веха не достигнута (или База закрыта), `afterMatch` — после матча дня, `tomorrow` — лимит. */
export type Wait = 'later' | 'afterMatch' | 'tomorrow';

export interface FunView {
  id: FunId;
  open: boolean;
  /** Веха достигнута, игру ещё не открывали — метка «новая». */
  newMark: boolean;
  /** Рекорд; `null` — не было. */
  record: FunRecord | null;
  /** Последний счёт игры; `null` — не играли. */
  last: LastScore | null;
  /** Последняя игра — рекорд (Э4.08). */
  lastRecord: boolean;
  /** Сыграна сегодня (метка «сегодня сыграна»): `played` относится к `base.day`. */
  played: boolean;
  wait: Wait | null;
}

export interface BaseView {
  fun: FunView[];
  /** Сколько игр на интерес осталось сегодня. */
  left: number;
  /** Сколько сыграно сегодня. */
  spent: number;
}

/** Сыграно игр на интерес в день `day` (счётчик другого дня — не считается). */
export function spentOn(base: Base, day: string): number {
  return base.day === day ? base.today : 0;
}

/** Достигнута ли веха игры (без замка Базы и лимита). */
export function milestone(g: FunGame, ctx: BaseCtx): boolean {
  if (g.open.kind === 'base') return true;
  const passed = ctx.cur > g.open.after;
  return g.open.kind === 'cup' ? passed && ctx.cupPlayed : passed;
}

export function baseView(base: Base, _learn: Learn, ctx: BaseCtx): BaseView {
  const spent = spentOn(base, ctx.day);
  const left = Math.max(0, FUN_PER_DAY - spent);
  const fun = FUN_GAMES.map((g): FunView => {
    const reached = ctx.open && milestone(g, ctx);
    const wait: Wait | null = !reached ? 'later' : ctx.matchesToday < 1 ? 'afterMatch' : left === 0 ? 'tomorrow' : null;
    return { id: g.id, open: wait === null, newMark: reached && !base.seen.includes(g.id), record: base.records[g.id] ?? null, last: base.lastN[g.id] ?? null, lastRecord: lastIsRecord(base, g.id), played: base.day === ctx.day && base.played.includes(g.id), wait };
  });
  return { fun, left, spent };
}
