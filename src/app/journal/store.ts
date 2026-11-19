/**
 * Журнал матчей: адаптер хранилища + правила (065-Т3, К-В). Ошибка хранилища игру не роняет — она уходит в `onFail`
 * (в игре — строка в журнал сбоя `app/crash/log.ts`), а вызов возвращает `false` / пустой список.
 */
import { JOURNAL_LIMIT, exportJournal, overflow, type JournalEntry } from '../../engine/journal';
import type { MatchEvent } from '../../engine/match';

/** Низкий уровень: так выглядит IndexedDB (`idb.ts`) и её замена в памяти (`memory.ts`). */
export interface JournalDb {
  all(): Promise<unknown[]>;
  put(entry: JournalEntry): Promise<void>;
  remove(ids: string[]): Promise<void>;
}

export interface JournalEnv {
  /** `null` — хранилища нет (IndexedDB недоступна): журнал молчит. */
  db: JournalDb | null;
  now: () => number;
  onFail: (err: unknown) => void;
  limit?: number;
}

export function createJournal(env: JournalEnv) {
  const limit = env.limit ?? JOURNAL_LIMIT;
  const guarded = async <T>(fallback: T, run: (db: JournalDb) => Promise<T>): Promise<T> => {
    if (!env.db) return fallback;
    try {
      return await run(env.db);
    } catch (err) {
      env.onFail(err);
      return fallback;
    }
  };
  return {
    /** После свистка и при выходе: тот же `matchId` перезаписывает запись; сверх предела уходят старые. */
    put: (matchId: string, rec: { seed: number; events: MatchEvent[]; cpm?: number }): Promise<boolean> =>
      guarded(false, async (db) => {
        await db.put({ matchId, seed: rec.seed, events: rec.events, at: env.now(), ...(rec.cpm === undefined ? {} : { cpm: rec.cpm }) });
        const all = exportJournal(await db.all());
        const drop = overflow(all, limit);
        if (drop.length > 0) await db.remove(drop);
        return true;
      }),
    /** Для выгрузки (поле `journal` снимка): старые первыми. */
    all: (): Promise<JournalEntry[]> => guarded([], async (db) => exportJournal(await db.all())),
  };
}

export type Journal = ReturnType<typeof createJournal>;
