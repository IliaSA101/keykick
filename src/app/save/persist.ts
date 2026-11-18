/**
 * «Защитить сохранение» (063-Р8, ТЗ-12.17): единственное место с `navigator.storage.persist()/persisted()`.
 * Вызывается только кнопкой у родителя (Firefox спрашивает разрешение — не ребёнку); при загрузке игры не вызывается.
 * Адаптер внедряется: тест подменяет `PersistApi`. Не бросает и не отклоняется.
 */

/** Подмножество `StorageManager`, годное для подмены в тесте. */
export interface PersistApi {
  persist(): Promise<boolean>;
  persisted(): Promise<boolean>;
}

/**
 * - `persisted` — хранилище защищено от очистки;
 * - `not-persisted` — не защищено (можно нажать кнопку);
 * - `unsupported` — браузер не умеет или отказал в ответе: кнопку не показываем, остаётся выгрузка файлом.
 */
export type PersistState = 'persisted' | 'not-persisted' | 'unsupported';

export interface Persist {
  /** Сейчас: защищено ли. */
  state(): Promise<PersistState>;
  /** Просит защиту (кнопка родителя) и возвращает итоговое состояние: отказ браузера — `not-persisted`. */
  request(): Promise<PersistState>;
}

export function browserPersist(): PersistApi | undefined {
  try {
    const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    return s && typeof s.persist === 'function' && typeof s.persisted === 'function' ? s : undefined;
  } catch {
    return undefined;
  }
}

export function createPersist(api: PersistApi | undefined): Persist {
  async function state(): Promise<PersistState> {
    if (!api) return 'unsupported';
    try {
      return (await api.persisted()) ? 'persisted' : 'not-persisted';
    } catch {
      return 'unsupported';
    }
  }
  return {
    state,
    async request() {
      if (!api) return 'unsupported';
      try {
        // Ответ `persist()` — «разрешили или нет»; итог всё равно спрашиваем у `persisted()`: оно единственное, что знает правду.
        await api.persist();
      } catch {
        return 'unsupported';
      }
      return state();
    },
  };
}
