/**
 * Корзина игроков (063-Р62, 059-В10): что в ней лежит, кого можно удалить и вернуть, чем подтверждается очистка.
 * Чистые функции: хранилища, часов и Vue нет — день «сегодня» и сырое из `trash.<pid>` приходят снаружи (`app/save/bin.ts`).
 * Очистка корзины и есть удаление данных: только данные игроков на этом устройстве, по команде родителя и вводом имени.
 */
import type { Device } from './device';
import { MAX_PLAYERS } from './import';
import { dayNo } from './remind';
import { isDay } from './section';
import { isObj } from './snapshot';

/** Строка корзины: имя берётся из лежащего конверта (`null` — не читается), день удаления — из устройства (`null` — не записан). */
export interface BinEntry {
  pid: string;
  name: string | null;
  day: string | null;
  /** Сколько дней лежит (0 — удалён сегодня); дня нет — `null`. */
  days: number | null;
}

/** Имя из сырого конверта корзины; не JSON, не объект или имени нет — `null`. Конверт не открывается и не мигрирует: корзина хранит его как был. */
export function trashName(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isObj(parsed) && typeof parsed.name === 'string' && parsed.name !== '' ? parsed.name : null;
  } catch {
    return null;
  }
}

/** Раздел корзины: свежее удалённое выше, без дня — в конце (по `pid`, чтобы порядок не прыгал). `today` — день `ГГГГ-ММ-ДД` снаружи. */
export function binEntries(pids: readonly string[], raws: Readonly<Record<string, string | undefined>>, device: Pick<Device, 'bin'>, today: string): BinEntry[] {
  const list = pids.map((pid): BinEntry => {
    const day = device.bin?.[pid];
    const known = isDay(day) ? day : null;
    const raw = raws[pid];
    return { pid, name: raw === undefined ? null : trashName(raw), day: known, days: known !== null && isDay(today) ? Math.max(0, Math.round(dayNo(today) - dayNo(known))) : null };
  });
  return list.sort((a, b) => (a.day === b.day ? a.pid.localeCompare(b.pid) : a.day === null ? 1 : b.day === null ? -1 : b.day.localeCompare(a.day)));
}

/** Удалить игрока можно, пока он не последний: у последнего вместо удаления «Начать заново» (064 §3.5). */
export const canDelete = (device: Pick<Device, 'players'>): boolean => device.players.length > 1;

/** Вернуть можно, пока игроков меньше `MAX_PLAYERS` (063-Р11); уже в списке — `listed`. */
export function restoreCheck(device: Pick<Device, 'players'>, pid: string): 'ok' | 'limit' | 'listed' {
  if (device.players.some((p) => p.pid === pid)) return 'listed';
  return device.players.length >= MAX_PLAYERS ? 'limit' : 'ok';
}

/** Игроки, чьё удаление оборвалось между корзиной и записью устройства (перезагрузка посреди): конверт уже в корзине, а в списке устройства ещё есть. */
export const halfDeleted = (device: Pick<Device, 'players'>, trashed: readonly string[]): string[] =>
  device.players.map((p) => p.pid).filter((pid) => trashed.includes(pid));

/** Имя для сравнения при очистке корзины: без разницы регистр и лишние пробелы по краям и внутри. */
const folded = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Что нужно ввести, чтобы очистить корзину: имена игроков в порядке строк, через пробел (имя не читается — `pid`).
 * Один игрок — его имя, как шаг 2 удаления в v1.
 */
export const clearPhrase = (entries: readonly BinEntry[]): string => entries.map((e) => e.name ?? e.pid).join(' ');

/**
 * Единственное правило очистки корзины (063-Р66, Р70): введены ровно имена игроков из корзины (имя не читается — `pid`), каждое один раз,
 * в любом порядке; регистр и пробелы не важны. Имя может состоять из нескольких слов («Ваня Иванов»), поэтому разбираем не по пробелам,
 * а подбором: от начала строки откусываем любое ещё не взятое имя, пока строка не кончится. Одинаковые имена двух игроков нужно ввести
 * столько раз, сколько их в корзине. Корзина пуста — подтверждать нечего (`false`).
 */
export function clearConfirmed(entries: readonly BinEntry[], typed: string): boolean {
  if (entries.length === 0) return false;
  const take = (rest: string, left: readonly string[]): boolean => {
    if (left.length === 0) return rest === '';
    return left.some((n, i) => {
      if (rest !== n && !rest.startsWith(`${n} `)) return false;
      return take(rest.slice(n.length).trimStart(), [...left.slice(0, i), ...left.slice(i + 1)]);
    });
  };
  return take(folded(typed), entries.map((e) => folded(e.name ?? e.pid)));
}
