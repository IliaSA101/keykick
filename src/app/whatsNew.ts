/**
 * «Что нового» для экранов (спека 010): какую карточку показать и как подписать даты.
 * Отбор строк — в engine/news; здесь — контент news.json и выбор записи для «показать ещё раз».
 * Функции чистые: список новостей и номер версии приходят аргументами.
 */
import newsJson from '../content/news.json';
import { APP_VERSION } from './version';
import { parentNews, unseen, type NewsEntry } from '../engine/news';

/** Карточка для ребёнка: версия на плашке («0.10»; у исправления — «0.10.1») и строки. */
export interface NewsCard {
  version: string;
  lines: string[];
}

export const news: readonly NewsEntry[] = newsJson;

/** «0.10.0» → «0.10»; исправление «0.10.1» — целиком. */
export function shortVersion(v: string): string {
  return v.endsWith('.0') ? v.slice(0, -2) : v;
}

/** Самая новая запись не новее current, у которой есть строки для ребёнка; нет таких — null. */
function latestWithKid(list: readonly NewsEntry[], current: string): NewsEntry | null {
  return parentNews(list, current).find((n) => n.kid.length > 0) ?? null;
}

/**
 * Карточка после обновления: строки всех непросмотренных версий (до 6); всё увидено — null.
 * На плашке — версия самой свежей записи со строками.
 */
export function pendingCard(list: readonly NewsEntry[], seen: string, current: string): NewsCard | null {
  const lines = unseen(list, seen, current);
  const top = latestWithKid(list, current);
  if (lines.length === 0 || top === null) return null;
  return { version: shortVersion(top.version), lines };
}

/**
 * Карточка «ещё раз» (по ссылке в углу главной и из страницы родителя): строки текущей версии;
 * у неё нет строк для ребёнка (исправление) — последней версии, где они есть; таких нет — null.
 */
export function replayCard(list: readonly NewsEntry[], current: string): NewsCard | null {
  const top = latestWithKid(list, current);
  return top === null ? null : { version: shortVersion(top.version), lines: top.kid };
}

/** «2026-11-12» → «12.11.2026»; пусто или не дата — пустая строка (дата ещё не поставлена). */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m === null ? '' : `${m[3]}.${m[2]}.${m[1]}`;
}

/** То же для установленной версии игры: карточка после обновления, «ещё раз» и список родителя. */
export const pending = (seen: string): NewsCard | null => pendingCard(news, seen, APP_VERSION);
export const replay = (): NewsCard | null => replayCard(news, APP_VERSION);
export const parentList = (): NewsEntry[] => parentNews(news, APP_VERSION);
