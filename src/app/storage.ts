/**
 * Единственное место с localStorage и sessionStorage. Хранилище недоступно или бросает
 * (приватное окно, запрет сайта, переполнение) — игра идёт дальше, просто без сохранения:
 * чтение даёт «ключа нет», запись — false.
 */

import { PREFIX } from './versions/build';

/** Ключ сохранения одного игрока до 04.11 (без номера игрока): префикс ключей `save.<id>`; сам старый ключ v2 не читает. */
export const LEGACY_KEY = `${PREFIX}save`;
/** Список игроков и последний выбранный. */
export const PLAYERS_KEY = `${PREFIX}players`;
/** Общая на компьютер часть: часы перерыва и его настройки. */
export const SHARED_KEY = `${PREFIX}session`;
/** Кто играет в этой вкладке (sessionStorage): две вкладки — могут быть два игрока. */
export const TAB_KEY = `${PREFIX}player`;

/** Звук выключен (выбор ребёнка): пишет sound.ts через readJson/writeJson. */
export const MUTE_KEY = `${PREFIX}muted`;

const SAVE_PREFIX = `${LEGACY_KEY}.`;

export function saveKey(id: string): string {
  return SAVE_PREFIX + id;
}

function local(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function tab(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Значение из JSON; undefined — ключа нет или хранилище недоступно, null — битый JSON. */
export function readJson(key: string): unknown {
  let text: string | null | undefined;
  try {
    text = local()?.getItem(key);
  } catch {
    return undefined;
  }
  if (text === null || text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    const s = local();
    if (!s) return false;
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): boolean {
  try {
    const s = local();
    if (!s) return false;
    s.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** id игроков, чьи сохранения лежат в хранилище: из них чинится пропавший список. */
export function savedPlayerIds(): string[] {
  const out: string[] = [];
  try {
    const s = local();
    const n = s?.length ?? 0;
    for (let i = 0; i < n; i++) {
      const key = s?.key(i);
      if (key?.startsWith(SAVE_PREFIX)) out.push(key.slice(SAVE_PREFIX.length));
    }
  } catch {
    // Хранилище не перечисляется — чинить не из чего.
  }
  return out;
}

export function readTabPlayer(): string | null {
  try {
    return tab()?.getItem(TAB_KEY) ?? null;
  } catch {
    return null;
  }
}

/** null — выбор вкладки снят. */
export function writeTabPlayer(id: string | null): void {
  try {
    if (id === null) tab()?.removeItem(TAB_KEY);
    else tab()?.setItem(TAB_KEY, id);
  } catch {
    // Без sessionStorage вкладка просто спросит «Кто играет?» ещё раз после перезагрузки.
  }
}

/** Ключ поменяла другая вкладка (событие storage); в своей вкладке событие не приходит. */
export function onKeyChange(key: string, fn: () => void): void {
  try {
    globalThis.addEventListener?.('storage', (e: StorageEvent) => {
      if (e.key === key || e.key === null) fn();
    });
  } catch {
    // Без событий — увидим при следующей загрузке страницы.
  }
}

// ───────────────────────────── блок 014: произвольные ключи под префиксом ─────────────────────────────
// Для слоя app/save/store.ts: копии, снимки, карантин. `readJson` выше не меняется.

/** Ключ копии или служебного значения под префиксом сборки: `PREFIX + имя`. Имя не начинается с `save.`. */
export function copyKey(name: string): string {
  return PREFIX + name;
}

/** Чтение сырого текста: ok:false — хранилище недоступно или бросило (это не «ключа нет»); text:null — ключа нет. */
export type TextRead = { ok: true; text: string | null } | { ok: false };

export function readText(key: string): TextRead {
  try {
    const s = local();
    if (!s) return { ok: false };
    return { ok: true, text: s.getItem(key) };
  } catch {
    return { ok: false };
  }
}

/** Запись сырого текста; false — не влезло или хранилище недоступно. */
export function writeText(key: string, text: string): boolean {
  try {
    const s = local();
    if (!s) return false;
    s.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

/** Все ключи хранилища, начинающиеся с prefix (полные, с префиксом). */
export function listKeys(prefix: string): string[] {
  const out: string[] = [];
  try {
    const s = local();
    const n = s?.length ?? 0;
    for (let i = 0; i < n; i++) {
      const key = s?.key(i);
      if (key?.startsWith(prefix)) out.push(key);
    }
  } catch {
    // Хранилище не перечисляется — копий «нет».
  }
  return out;
}

/**
 * Флаг этой вкладки (sessionStorage, ключ `PREFIX + name`): без value — прочитать; со строкой — записать;
 * с null — снять. Недоступно — null.
 */
export function tabFlag(name: string, value?: string | null): string | null {
  try {
    const s = tab();
    if (!s) return null;
    if (value === undefined) return s.getItem(copyKey(name));
    if (value === null) s.removeItem(copyKey(name));
    else s.setItem(copyKey(name), value);
    return value;
  } catch {
    return null;
  }
}

/** Любой ключ поменяла другая вкладка (key: null — хранилище очищено целиком). */
export function onAnyKeyChange(fn: (key: string | null) => void): void {
  try {
    globalThis.addEventListener?.('storage', (e: StorageEvent) => fn(e.key));
  } catch {
    // Без событий — увидим при следующей загрузке страницы.
  }
}
