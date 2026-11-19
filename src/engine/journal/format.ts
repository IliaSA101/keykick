/**
 * Формат журнала матчей (065-Т3, К-В; 060-Р8): матч = семя + события, по `matchId`. Чистые функции:
 * часы и хранилище — снаружи, Vue и DOM тут нет. Вместимость — 100 матчей, старые вытесняются.
 */
import type { MatchEvent } from '../match';

export const JOURNAL_LIMIT = 100;

/** Запись журнала: всё, что нужно, чтобы переиграть матч (`replay`). */
export interface JournalEntry {
  matchId: string;
  seed: number;
  events: MatchEvent[];
  /** Время последней записи, мс — порядок вытеснения (часы приходят снаружи). */
  at: number;
  /** Скорость доигранного матча, знаков в минуту (067 Т17: ставка учебных игр, ТЗ-3.3); у старых записей и брошенных матчей нет. */
  cpm?: number;
}

/** Запись из значения неизвестной формы; не похоже на запись — `null` (битое не роняет). */
export function parseEntry(raw: unknown): JournalEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.matchId !== 'string' || r.matchId === '') return null;
  if (typeof r.seed !== 'number' || !Number.isFinite(r.seed)) return null;
  if (!Array.isArray(r.events)) return null;
  if (typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  const entry: JournalEntry = { matchId: r.matchId, seed: r.seed, events: r.events as MatchEvent[], at: r.at };
  if (typeof r.cpm === 'number' && Number.isFinite(r.cpm) && r.cpm >= 0) entry.cpm = r.cpm;
  return entry;
}

/** `matchId` записей, не влезших в предел: самые старые по `at` (при равенстве — по id, чтобы порядок был однозначен). */
export function overflow(entries: readonly JournalEntry[], limit = JOURNAL_LIMIT): string[] {
  if (entries.length <= limit) return [];
  const sorted = [...entries].sort((a, b) => a.at - b.at || (a.matchId < b.matchId ? -1 : 1));
  return sorted.slice(0, entries.length - limit).map((e) => e.matchId);
}

/** Выгрузка: хорошие записи, старые первыми; битые молча отбрасываются. */
export function exportJournal(raw: readonly unknown[]): JournalEntry[] {
  const list: JournalEntry[] = [];
  for (const r of raw) {
    const e = parseEntry(r);
    if (e) list.push(e);
  }
  return list.sort((a, b) => a.at - b.at);
}
