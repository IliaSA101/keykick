/** Журнал на IndexedDB (design §5): голый API, только запрос → промис. Версия базы 1; подъём версии не пересоздаёт хранилища. */
import { KEY_FIELD, type IndexEntry, type JournalBackend, type JournalStore } from './backend';

const INDEX = 'player_t';
const STORES: JournalStore[] = ['records', 'keys'];

/** Причина отказа IndexedDB — всегда `Error` (у `DOMException` он и есть). */
function asError(e: unknown): Error {
  return e instanceof Error ? e : new Error('journal: idb error');
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(asError(req.error));
  });
}

/** Открыть базу; заблокирована или недоступна — отказ (журнал уйдёт в память). */
export function openIdb(name: string, version = 1): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('journal: no indexedDB'));
    const req = indexedDB.open(name, version);
    // Подъём версии: создаём только недостающие хранилища — повторное `createObjectStore` бросает ConstraintError (018-Р24).
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (db.objectStoreNames.contains(s)) continue;
        const os = db.createObjectStore(s, { keyPath: KEY_FIELD[s] });
        os.createIndex(INDEX, ['player', 't']);
      }
    };
    req.onblocked = () => reject(new Error('journal: blocked'));
    req.onerror = () => reject(asError(req.error));
    req.onsuccess = () => {
      const db = req.result;
      // Будущий подъём версии в другой вкладке не должен висеть на нашем соединении (В6).
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function idbBackend(db: IDBDatabase): JournalBackend {
  const range = (player: string): IDBKeyRange => IDBKeyRange.bound([player, -Infinity], [player, Infinity]);
  const run = (store: JournalStore, mode: IDBTransactionMode, fn: (os: IDBObjectStore) => void): Promise<void> =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(asError(tx.error));
      tx.onabort = () => reject(asError(tx.error));
      fn(tx.objectStore(store));
    });
  const objectStore = (store: JournalStore): IDBObjectStore => db.transaction(store, 'readonly').objectStore(store);

  return {
    put: (store, items) =>
      run(store, 'readwrite', (os) => {
        for (const item of items) os.put(item);
      }),
    all(store, player) {
      const os = objectStore(store);
      return (player === undefined ? wrap(os.getAll()) : wrap(os.index(INDEX).getAll(range(player)))) as Promise<object[]>;
    },
    list(store, player) {
      return new Promise<IndexEntry[]>((resolve, reject) => {
        const out: IndexEntry[] = [];
        const req = objectStore(store).index(INDEX).openKeyCursor(range(player));
        req.onerror = () => reject(asError(req.error));
        req.onsuccess = () => {
          const c = req.result;
          if (c === null) return resolve(out);
          out.push({ key: typeof c.primaryKey === 'string' ? c.primaryKey : '', t: (c.key as [string, number])[1] });
          c.continue();
        };
      });
    },
    remove: (store, keys) =>
      run(store, 'readwrite', (os) => {
        for (const k of keys) os.delete(k);
      }),
    close: () => db.close(),
  };
}
