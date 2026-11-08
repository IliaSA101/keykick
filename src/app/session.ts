/**
 * Часы для перерыва (время игры по дням вернётся с 040, 018-Р28): движок (engine/session) часов не видит, их даёт этот слой.
 * Сутки — по местной дате устройства.
 */
import { computed, ref } from 'vue';
import { breakLeft } from '../engine/session';
import { beginDueBreak, endBreakIfOver, noteAction, shared } from './players/shared';

/** Местная дата «ГГГГ-ММ-ДД». */
export function localDay(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** «Сейчас» для показа: обновляется тиком раз в секунду и на каждое действие. */
export const now = ref(Date.now());

/** Сколько осталось перерыва, мс; 0 — перерыва нет. */
export const breakLeftMs = computed(() => breakLeft(shared.clock, now.value, shared.breakSettings));

/** Нажатие или клик ребёнка. */
export function action(): void {
  const t = Date.now();
  now.value = t;
  noteAction(t, localDay(t));
}

/** Переход экрана: назначенный перерыв начинается. */
export function screenChanged(): void {
  const t = Date.now();
  now.value = t;
  beginDueBreak(t);
}

/** Тик раз в секунду: отсчёт перерыва и его конец. */
export function tick(): void {
  const t = Date.now();
  now.value = t;
  endBreakIfOver(t);
}
