/**
 * Вход в тур «Школы» (067 Т14, Ш-З4, Р97): пускать ли ребёнка и что сказать, если нет. Чистые функции без Vue:
 * сеанс обязан быть в состоянии `ok` (иначе итог тура некуда записать), тур новой нумерации открывается после первого матча дня.
 * Матч дня считает экран тура сам — по разделу `day`, а не по входу Дома (он `null` без пакета).
 */
import type { Day } from '../../engine/day/section';
import { ru } from '../../i18n/ru';
import type { SaveResult, Status } from '../save/session';

export type Gate = { kind: 'open' } | { kind: 'afterMatch' } | { kind: 'blocked'; text: string };

const NOTICE: Record<Exclude<Status, 'ok'>, string> = {
  busy: ru.frame.notice.busyAnon,
  readonly: ru.frame.notice.readonly,
  quota: ru.frame.notice.quota,
  conflict: ru.frame.notice.conflict,
  broken: ru.frame.notice.broken,
};

/** Блокирующий текст по состоянию сеанса; `ok` — null. */
export const blockText = (status: Status): string | null => (status === 'ok' ? null : NOTICE[status]);

/** Сыгран ли сегодня хотя бы один матч (ТЗ-6.1): `day.today` — игровой день последнего матча. */
export const matchPlayed = (day: Pick<Day, 'today' | 'todayN'>, today: string): boolean => day.today === today && day.todayN >= 1;

/** Вход в тур: сеанс не `ok` — закрыто с причиной; матча дня нет — «после матча»; иначе открыто. */
export function tourGate(status: Status, played: boolean): Gate {
  const text = blockText(status);
  if (text !== null) return { kind: 'blocked', text };
  return played ? { kind: 'open' } : { kind: 'afterMatch' };
}

/** Что показать после записи: отказ — текст причины (состояние сеанса или «не получается сохранить»), успех — null. */
export const saveFail = (res: SaveResult): string | null => (res.ok ? null : (blockText(res.status) ?? ru.frame.notice.quota));
