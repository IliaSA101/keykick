/** `JournalDb` в памяти — для тестов (065-Р14: без `fake-indexeddb`). */
import type { JournalEntry } from '../../engine/journal';
import type { JournalDb } from './store';

export function memoryDb(): JournalDb & { rows: Map<string, unknown> } {
  const rows = new Map<string, unknown>();
  return {
    rows,
    all: () => Promise.resolve([...rows.values()]),
    put: (e: JournalEntry) => {
      rows.set(e.matchId, structuredClone(e));
      return Promise.resolve();
    },
    remove: (ids: string[]) => {
      for (const id of ids) rows.delete(id);
      return Promise.resolve();
    },
  };
}
