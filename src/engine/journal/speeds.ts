/**
 * Скорости доигранных матчей из журнала (067 Т17, ТЗ-3.3): по ним учебные игры считают ставку (`LearnCtx.speeds`, `engine/learn/rate.ts`).
 * Чистая функция: записи приходят снаружи. Запись без скорости (старая или брошенный матч) не считается.
 */
import type { JournalEntry } from './format';

/** Id записи матча игрока `pid` в `t0`: журнал один на устройство, игрок угадывается по приставке id (`MatchScreen`). */
export const matchIdOf = (pid: string, t0: number): string => `m-${pid}-${t0}`;

/** Записи только этого игрока (по приставке id): чужие скорости на ставку не влияют. Формат записи не меняется. */
export function ownEntries(entries: readonly JournalEntry[], pid: string): JournalEntry[] {
  const prefix = matchIdOf(pid, 0).slice(0, -1);
  return entries.filter((e) => e.matchId.startsWith(prefix));
}

/** Скорости (знаков в минуту) записей, у которых она есть и не нулевая, — старые первыми (порядок `at`, при равенстве — по id). */
export function speedsOf(entries: readonly JournalEntry[]): number[] {
  return [...entries]
    .filter((e) => e.cpm !== undefined && e.cpm > 0)
    .sort((a, b) => a.at - b.at || (a.matchId < b.matchId ? -1 : 1))
    .map((e) => e.cpm as number);
}
