/**
 * Матч v2 (спека 017, design §7): доигранные матчи, скорость по лиге, возврат после перерыва.
 * Чистые функции; часы приходят снаружи (`now`, мс).
 */
import { isPaid } from './coins';
import type { Help } from '../match/verdict';

/** Чем была игровая сессия: матчем считается только доигранная (и переигровка тайма). */
export type Session = 'match' | 'replay' | 'abandoned' | 'coach' | 'micro';

/** ТЗ-10.9: доигранный матч и переигровка тайма — да; брошенный, минута тренера, микроразминка — нет. */
export const countsAsPlayed = (s: Session): boolean => s === 'match' || s === 'replay';

export interface PlayedMatch {
  at: number;
  lessonId: string;
  league: string;
  kind: 'lesson' | 'cup';
  /** Знаков в минуту (`charsPerMinute`). */
  cpm: number;
  accuracy: number;
  passed: boolean;
  stars: number;
  help: Help;
}

/** Доигранные матчи: по лиге не больше `keep` последних, плюс время последнего (для возврата). */
export interface PlayedLog {
  byLeague: Readonly<Record<string, readonly PlayedMatch[]>>;
  lastFinishedAt: number | null;
}

export const emptyPlayed: PlayedLog = { byLeague: {}, lastFinishedAt: null };

/** Запись сессии: недоигранная — журнал тот же. */
export function recordPlayed(log: PlayedLog, session: Session, rec: PlayedMatch, keep: number): PlayedLog {
  if (!countsAsPlayed(session)) return log;
  const list = [...(log.byLeague[rec.league] ?? []), rec].slice(-keep);
  return { byLeague: { ...log.byLeague, [rec.league]: list }, lastFinishedAt: rec.at };
}

/** Матч открывает игровой день: кубок — всегда, урок — текущей или прошлой лиги (ТЗ-10.9). */
export function opensDay(
  rec: Pick<PlayedMatch, 'kind' | 'league'>,
  playerLeague: string,
  leagues: readonly string[],
): boolean {
  return rec.kind === 'cup' || isPaid(rec.league, playerLeague, leagues);
}

/**
 * Скорость по лиге — медиана `cpm` последних `n` доигранных матчей лиги; нет матчей — null.
 * Если их меньше `n`, берётся медиана имеющихся.
 */
export function speedFor(log: PlayedLog, league: string, n: number): number | null {
  const last = (log.byLeague[league] ?? []).slice(-n).map((m) => m.cpm).sort((a, b) => a - b);
  if (last.length === 0) return null;
  const mid = last.length >> 1;
  return last.length % 2 === 1 ? (last[mid] ?? null) : Math.round(((last[mid - 1] ?? 0) + (last[mid] ?? 0)) / 2);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Возврат (ТЗ-2.11): прошло не меньше `days` × 24 ч (не календарные дни). Матчей не было — не возврат. */
export function comebackDue(log: PlayedLog, now: number, days: number): boolean {
  return log.lastFinishedAt !== null && now - log.lastFinishedAt >= days * DAY_MS;
}
