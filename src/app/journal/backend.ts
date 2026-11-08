/**
 * Граница журнала игры (спека 018 design §5, 018-Р8): за ней — IndexedDB (`idb.ts`) или память (`memory.ts`).
 * Очередь, обрезка, выгрузка и слияние живут в `journal.ts` над этим интерфейсом.
 */

/** Хранилище: `records` (ключ `id`) и `keys` (ключ `match`); у обоих индекс `[player, t]`. */
export type JournalStore = 'records' | 'keys';

/** Ключ записи и её время — то, что отдаёт индекс без значений. */
export interface IndexEntry {
  key: string;
  t: number;
}

export interface JournalBackend {
  /** Записать пачку одной транзакцией; тот же ключ — перезапись. Значение копируется. */
  put(store: JournalStore, items: object[]): Promise<void>;
  /** Всё хранилище или только записи игрока. Пустая база — `[]`. */
  all(store: JournalStore, player?: string): Promise<object[]>;
  /** Ключи игрока по индексу, по возрастанию `t` (без значений — не грузить ≈ 10 МБ нажатий). */
  list(store: JournalStore, player: string): Promise<IndexEntry[]>;
  /** Удалить по ключам; нет ключа — не ошибка. */
  remove(store: JournalStore, keys: string[]): Promise<void>;
  close(): void;
}

/** Поле-ключ хранилища. */
export const KEY_FIELD: Record<JournalStore, 'id' | 'match'> = { records: 'id', keys: 'match' };

/** Ошибка «не хватило места» из IndexedDB (имя у браузеров одно). */
export function isQuotaError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'QuotaExceededError';
}
