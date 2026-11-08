/** Журнал в памяти: запасной режим, когда IndexedDB недоступна (design §5), и бэкенд тестов. */
import { KEY_FIELD, type IndexEntry, type JournalBackend, type JournalStore } from './backend';

interface Row {
  t: number;
  player: string;
}

export interface MemoryOptions {
  /** Сколько последних матчей держать в `keys`; по умолчанию без предела (запасной режим: 50). */
  keysKeep?: number;
}

export function memoryBackend(opts: MemoryOptions = {}): JournalBackend {
  const stores: Record<JournalStore, Map<string, object>> = { records: new Map(), keys: new Map() };
  const keyOf = (store: JournalStore, item: object): string => String((item as Record<string, unknown>)[KEY_FIELD[store]]);
  const rowOf = (item: object): Row => item as Row;

  function dropOldKeys(): void {
    const keep = opts.keysKeep;
    if (keep === undefined || stores.keys.size <= keep) return;
    const byAge = [...stores.keys.entries()].sort((a, b) => rowOf(a[1]).t - rowOf(b[1]).t);
    for (const [k] of byAge.slice(0, byAge.length - keep)) stores.keys.delete(k);
  }

  return {
    put(store, items) {
      for (const item of items) stores[store].set(keyOf(store, item), structuredClone(item));
      if (store === 'keys') dropOldKeys();
      return Promise.resolve();
    },
    all(store, player) {
      const out = [...stores[store].values()].filter((x) => player === undefined || rowOf(x).player === player);
      return Promise.resolve(structuredClone(out));
    },
    list(store, player) {
      const out: IndexEntry[] = [];
      for (const [key, x] of stores[store]) if (rowOf(x).player === player) out.push({ key, t: rowOf(x).t });
      return Promise.resolve(out.sort((a, b) => a.t - b.t));
    },
    remove(store, keys) {
      for (const k of keys) stores[store].delete(k);
      return Promise.resolve();
    },
    close() {},
  };
}
