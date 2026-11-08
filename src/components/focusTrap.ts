/*
 * Ловушка фокуса для окна поверх страницы (017-Т9д): Tab и Shift+Tab ходят по кругу внутри окна, фокус не
 * уходит на то, что под ним. Окно с `aria-modal` без этого запирает только скринридер, а не клавиатуру.
 */

/** Куда пойдёт фокус: `current` — номер сейчас сфокусированного в окне (−1 — снаружи), `count` — сколько в окне фокусируемого. */
export function nextTabIndex(count: number, current: number, back: boolean): number {
  if (count <= 0) return -1;
  if (back) return current <= 0 ? count - 1 : current - 1;
  return current < 0 || current >= count - 1 ? 0 : current + 1;
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Обработчик `keydown` окна `root`: Tab запирает внутри; остальные клавиши не трогает. */
export function trapTab(root: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const at = items.indexOf(globalThis.document.activeElement as HTMLElement);
  const to = nextTabIndex(items.length, at, e.shiftKey);
  e.preventDefault();
  items[to]?.focus();
}
