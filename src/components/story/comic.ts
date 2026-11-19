/**
 * Правила окна комикса (068 Т7, Э6.14–.21): какая клавиша что делает. Vue и DOM тут нет — компонент передаёт события, тест гоняет в node.
 * Enter и → — следующая панель, на последней — закрыть; Esc — пропустить (закрыть) сразу. Enter — не раньше паузы после открытия и не при удержании
 * (двойной Enter прошлого окна не пролетает); → паузе не подчиняется, но удержание не листает.
 */
import { enterAllowed, ENTER_DELAY } from '../panel/focusCycle';

/** Панелей в комиксе (068-Р27). */
export const PANELS = 2;

export type ComicAction = 'next' | 'close' | null;

/** Действие по клавише: `shown` — сколько панелей открыто сейчас (1…`PANELS`). */
export function comicKey(press: { key: string; repeat: boolean; openedAt: number; now: number; shown: number }): ComicAction {
  if (press.key === 'Escape') return press.repeat ? null : 'close';
  const forward = press.key === 'ArrowRight' ? !press.repeat : press.key === 'Enter' && enterAllowed({ repeat: press.repeat, openedAt: press.openedAt, now: press.now, delay: ENTER_DELAY });
  if (!forward) return null;
  return press.shown >= PANELS ? 'close' : 'next';
}
