/**
 * Хранилище строк (060 design §3, 059 С-19): единственное место, где живут localStorage и sessionStorage.
 * Любой отказ — результатом, не исключением. Хранилище внедряется: тест подменяет `Backend`.
 */

import { prefix, type Channel } from '../../engine/release/keys';

/** Что нужно от хранилища: подмножество `Storage`, годное для подмены в тесте. */
export type Backend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** `quota` — места нет; `denied` — доступа нет (режим без хранилища, запрет, сбой); `absent` — ключа нет. */
export type StorageErr = 'quota' | 'denied' | 'absent';

export interface Fail<E extends string> {
  ok: false;
  err: E;
}

/** Результат с полезным значением. */
export type Got<T, E extends string = StorageErr> = { ok: true; value: T } | Fail<E>;
/** Результат без значения. */
export type Done<E extends string = StorageErr> = { ok: true } | Fail<E>;

export interface KeyValue {
  read(key: string): Got<string>;
  write(key: string, value: string): Done;
  /** Удаление ключа, которого нет, — успех. */
  remove(key: string): Done;
  /** Ключи, начинающиеся с `prefix`; порядок не определён. */
  keys(prefix: string): Got<string[], 'denied'>;
}

/** Ошибка записи — квота? Имена и коды у браузеров разные (Chrome, Safari, старый Firefox). */
function isQuota(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

const DENIED = { ok: false, err: 'denied' } as const;

/** Обёртка над хранилищем; `backend === undefined` (хранилища нет) — всё `denied`. */
export function createKeyValue(backend: Backend | undefined): KeyValue {
  return {
    read(key) {
      if (!backend) return DENIED;
      try {
        const v = backend.getItem(key);
        return v === null ? { ok: false, err: 'absent' } : { ok: true, value: v };
      } catch {
        return DENIED;
      }
    },
    write(key, value) {
      if (!backend) return DENIED;
      try {
        backend.setItem(key, value);
        return { ok: true };
      } catch (e) {
        return isQuota(e) ? { ok: false, err: 'quota' } : DENIED;
      }
    },
    remove(key) {
      if (!backend) return DENIED;
      try {
        backend.removeItem(key);
        return { ok: true };
      } catch {
        return DENIED;
      }
    },
    keys(prefix) {
      if (!backend) return DENIED;
      try {
        const found: string[] = [];
        for (let i = 0; i < backend.length; i++) {
          const k = backend.key(i);
          if (k !== null && k.startsWith(prefix)) found.push(k);
        }
        return { ok: true, value: found };
      } catch {
        return DENIED;
      }
    },
  };
}

/** Постоянное хранилище браузера. Само обращение к `localStorage` может бросить (запрет cookies) — тогда `undefined`. */
export function browserLocal(): Backend | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

/** IndexedDB браузера или `null`, если её нет (приватный режим, старый браузер); не бросает (065-Р30). */
export function browserIdb(): IDBFactory | null {
  try {
    return globalThis.indexedDB ?? null;
  } catch {
    return null;
  }
}

/** Имя базы журнала матчей: префикс как у ключей хранилища (мажор + канал) — `keykick2.journal`, `keykick2-next.journal`. */
export function journalDbName(major: number, channel: Channel): string {
  return `${prefix(major, channel)}journal`;
}

/** Хранилище вкладки (только `<p>tab`). */
export function browserSession(): Backend | undefined {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
}
