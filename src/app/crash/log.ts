/**
 * Журнал событий и правила окна сбоя — чистые функции (ТЗ-12.14, 12.15; 014 design §6–7).
 * Часы и среда приходят снаружи: тут нет ни `Date.now`, ни `window`.
 */

export type EventKind = 'error' | 'rejection' | 'vue' | 'action' | 'journal';

export interface EventRecord {
  t: number;
  kind: EventKind;
  text: string;
  stack?: string;
}

/** Предел журнала: последние 200 записей; текст до 300 знаков, стек до 2 КБ (014 design §6). */
export const LOG_LIMIT = 200;
export const TEXT_LIMIT = 300;
export const STACK_LIMIT = 2048;
/** Повторный сбой не позже этого срока после «На главную» — окно «Позови взрослого» (014 В8). */
export const AGAIN_WINDOW_MS = 30_000;

/** Добавляет запись в конец, старые выбрасывает по пределу. Исходный журнал не меняется. */
export function pushEvent(log: readonly EventRecord[], rec: EventRecord, limit = LOG_LIMIT): EventRecord[] {
  const clipped: EventRecord = { t: rec.t, kind: rec.kind, text: rec.text.slice(0, TEXT_LIMIT) };
  if (rec.stack !== undefined) clipped.stack = rec.stack.slice(0, STACK_LIMIT);
  return [...log, clipped].slice(-limit);
}

/** Безвредное: перерисовка `ResizeObserver`, «Script error.» чужого скрипта и ошибки файлов не нашего origin (расширения). */
export function isHarmless(message: string, filename: string, origin: string): boolean {
  if (message.startsWith('ResizeObserver loop')) return true;
  if (message === 'Script error.') return true;
  return filename !== '' && !filename.startsWith(origin);
}

/** Какое окно показать: первое — «Ой, что-то сломалось»; сбой вскоре после «На главную» — «Позови взрослого». */
export function crashStep(now: number, lastHomeAt: number | null): 1 | 2 {
  return lastHomeAt !== null && now - lastHomeAt < AGAIN_WINDOW_MS ? 2 : 1;
}

/** Текст и стек из того, что бросили (бросить можно что угодно). */
export function describeError(err: unknown): { text: string; stack?: string } {
  if (err instanceof Error) return err.stack ? { text: err.message, stack: err.stack } : { text: err.message };
  return { text: String(err) };
}
