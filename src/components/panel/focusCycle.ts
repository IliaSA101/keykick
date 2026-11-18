/**
 * Круговой перебор фокуса внутри модалки (Tab / Shift+Tab). Чистая функция: DOM не трогает — компонент передаёт число
 * доступных элементов и номер того, что в фокусе (−1 — фокус вне окна).
 * Из окна фокус не уходит: после последнего — первый, перед первым — последний.
 */
export function cycleIndex(count: number, current: number, back: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return back ? count - 1 : 0;
  return (current + (back ? count - 1 : 1)) % count;
}

/** Что можно взять в фокус внутри окна. */
export const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Сколько мс после открытия окна Enter не засчитывается (быстрый двойной Enter не пролетает цепочку окон, 063 Т6а). */
export const ENTER_DELAY = 400;

/**
 * Засчитывать ли Enter окну, которое открылось в `openedAt` (мс, часы страницы; `now` — время нажатия).
 * Нет, если клавишу держат (повтор) или нажатие началось раньше, чем прошла пауза `delay` после открытия.
 */
export function enterAllowed(press: { repeat: boolean; openedAt: number; now: number; delay: number }): boolean {
  return !press.repeat && press.now - press.openedAt >= press.delay;
}
