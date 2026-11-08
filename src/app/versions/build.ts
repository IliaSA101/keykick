/**
 * Версия сборки: канал и мажор определяют префикс ключей хранилища и имя базы IndexedDB
 * (спека 013). Так три адреса сайта на одном origin не видят данных друг друга:
 * `/keykick/` и `/keykick/v1/` — `keykick.`, `/keykick/v2/` — `keykick2.`, `/keykick/next/` — `keykick-next.`.
 * Функции чистые; константы внизу читают окружение сборки один раз.
 */
import { APP_VERSION } from '../version';

export type Channel = 'release' | 'next';

/** Мажор из номера версии ('0.10.1' → 0, '2.0.0' → 2). */
export function majorOf(version: string): number {
  return Number.parseInt(version, 10) || 0;
}

/** Канал из значения переменной сборки: 'release' — только если сборку запустили так явно, иначе 'next'. */
export function channelOf(raw: unknown): Channel {
  return raw === 'release' ? 'release' : 'next';
}

/**
 * next → 'keykick-next.'; выпуск: мажор ≤ 1 → 'keykick.' (линия v1, ключи сына прежние),
 * иначе `keykick${major}.`.
 */
export function storagePrefix(major: number, channel: Channel): string {
  if (channel === 'next') return 'keykick-next.';
  return major <= 1 ? 'keykick.' : `keykick${major}.`;
}

/** Имя базы IndexedDB журнала (для 018): префикс + 'journal'. */
export function dbName(prefix: string): string {
  return `${prefix}journal`;
}

/** Адрес старой версии от BASE_URL: '/keykick/', '/keykick/next/', '/keykick/v2/' → '/keykick/v1/'. */
export function oldVersionUrl(base: string): string {
  const root = base.replace(/(?:next|v\d+)\/$/, '');
  return `${root.endsWith('/') ? root : `${root}/`}v1/`;
}

export const CHANNEL: Channel = channelOf(import.meta.env.VITE_KK_CHANNEL);
export const MAJOR: number = majorOf(APP_VERSION);
export const PREFIX: string = storagePrefix(MAJOR, CHANNEL);
