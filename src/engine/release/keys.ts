/**
 * Префикс ключей хранилища (060-Р3). Выпуск мажорной версии N — `keykickN.`, канал `next` — `keykickN-next.`.
 * Ключи v1 (`keykick.*`) и тестовые v2 (`keykick-next.*`) под этот префикс не попадают — их не читаем и не стираем.
 */

/** Канал сборки: выпуск (`/keykick/`, `/vN/`) или готовящаяся версия (`/next/`). */
export type Channel = 'release' | 'next';

/** Первая мажорная версия с этим префиксом: v1 живёт под `keykick.` и сюда не входит. */
export const FIRST_PREFIXED_MAJOR = 2;

/** `prefix(2, 'release')` → `keykick2.`; `prefix(2, 'next')` → `keykick2-next.`. */
export function prefix(major: number, channel: Channel): string {
  if (!Number.isInteger(major) || major < FIRST_PREFIXED_MAJOR) {
    throw new RangeError(`prefix: major must be an integer >= ${FIRST_PREFIXED_MAJOR}, got ${String(major)}`);
  }
  return channel === 'next' ? `keykick${major}-next.` : `keykick${major}.`;
}
