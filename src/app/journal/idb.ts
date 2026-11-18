/** Единственное место, где журнал касается IndexedDB (065-Р14). Браузерная проверка — e2e, не юнит-тест. */
import type { JournalEntry } from '../../engine/journal';
import type { JournalDb } from './store';

const STORE = 'matches';

const wrap = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb'));
  });

const done = (t: IDBTransaction): Promise<void> =>
  new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error ?? new Error('idb tx'));
    t.onabort = () => rej(t.error ?? new Error('idb abort'));
  });

/** `null` — IndexedDB нет (приватный режим, старый браузер); фабрику даёт вызывающий: журнал тогда молчит. */
export function openIdb(factory: IDBFactory | null | undefined, dbName: string): Promise<JournalDb | null> {
  if (!factory) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const open = factory.open(dbName, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'matchId' });
    open.onerror = () => reject(open.error ?? new Error('idb open'));
    open.onsuccess = () => {
      const db = open.result;
      resolve({
        all: () => wrap(db.transaction(STORE, 'readonly').objectStore(STORE).getAll()),
        put: (e: JournalEntry) => {
          const t = db.transaction(STORE, 'readwrite');
          t.objectStore(STORE).put(e);
          return done(t);
        },
        remove: (ids: string[]) => {
          const t = db.transaction(STORE, 'readwrite');
          for (const id of ids) t.objectStore(STORE).delete(id);
          return done(t);
        },
      });
    };
  });
}

/** База открывается при первом обращении; нет IndexedDB — журнал молчит, сбой открытия уходит в `onFail` журнала. */
export function lazyDb(open: () => Promise<JournalDb | null>): JournalDb {
  let opened: Promise<JournalDb | null> | undefined;
  const db = (): Promise<JournalDb | null> => (opened ??= open());
  return {
    all: async () => (await (await db())?.all()) ?? [],
    put: async (e) => void (await (await db())?.put(e)),
    remove: async (ids) => void (await (await db())?.remove(ids)),
  };
}
