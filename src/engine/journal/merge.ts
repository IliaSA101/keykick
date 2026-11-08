/** Слияние журнала из файла с лежащим (design §6, 018-Р7): ничего не удаляется, побеждает полнее. */
import type { JournalRecord, KeysLog } from './records';

export interface JournalPart {
  records: readonly JournalRecord[];
  keys: readonly KeysLog[];
}

export interface MergePlan {
  records: JournalRecord[];
  keys: KeysLog[];
}

function matchPart(r: JournalRecord): { open: boolean; at: number } | null {
  if (r.kind !== 'match' || typeof r.data !== 'object' || r.data === null) return null;
  const d = r.data as { outcome?: unknown; at?: unknown };
  return { open: d.outcome === 'open', at: typeof d.at === 'number' ? d.at : 0 };
}

/** Запись из файла полнее лежащей: итог против `open`; при равном состоянии — больший `at`. */
export function recordIsFuller(file: JournalRecord, have: JournalRecord): boolean {
  const f = matchPart(file);
  const h = matchPart(have);
  if (!f || !h) return false;
  if (h.open !== f.open) return h.open;
  return f.at > h.at;
}

/** Нажатия из файла полнее: длиннее `typed`. */
export function keysIsFuller(file: KeysLog, have: KeysLog): boolean {
  return file.typed.length > have.typed.length;
}

function pickFuller<T>(
  file: readonly T[],
  keyOf: (x: T) => string,
  have: Map<string, T>,
  fuller: (a: T, b: T) => boolean,
): T[] {
  const best = new Map<string, T>();
  for (const x of file) {
    const k = keyOf(x);
    const cur = best.get(k) ?? have.get(k);
    if (cur === undefined || fuller(x, cur)) best.set(k, x);
  }
  return [...best.values()];
}

/** Что записать в базу: новые по `id` / `match` и более полные того же ключа. */
export function mergeJournal(have: JournalPart, file: JournalPart): MergePlan {
  return {
    records: pickFuller(file.records, (r) => r.id, new Map(have.records.map((r) => [r.id, r])), recordIsFuller),
    keys: pickFuller(file.keys, (k) => k.match, new Map(have.keys.map((k) => [k.match, k])), keysIsFuller),
  };
}
