/**
 * Нажатие клавиши в строке для машин без матча (минута тренера, серия ударов Кубка): шаг печати, звук, подсказка и запись нажатия
 * для формы клавиш. Одна функция вместо копий в каждой машине (общее место, не повтор).
 */
import type { Press } from '../match/types';
import type { Keymap } from './keymap';
import { step, type Hint, type KeyPress, type TypingState } from './typing';

export interface KeyInput {
  code: string;
  key: string;
  /** Время нажатия, мс. */
  t: number;
  repeat?: boolean;
  mod?: boolean;
  caps?: boolean;
}

export type KeyEffect = { kind: 'sound'; sound: 'key' | 'miss' } | { kind: 'hint'; hint: Hint };

export const keyPress = (e: KeyInput): KeyPress => ({ code: e.code, key: e.key, repeat: e.repeat ?? false, mod: e.mod ?? false, caps: e.caps ?? false, time: e.t });

/** Шаг печати строки: новое состояние, эффекты (звук верного и ошибочного, новая подсказка) и список нажатий с этим нажатием, если оно засчитано. */
export function typeKey(map: Keymap, before: TypingState, e: KeyInput, presses: readonly Press[]): { typed: TypingState; effects: KeyEffect[]; presses: readonly Press[] } {
  const typed = step(map, before, keyPress(e));
  const effects: KeyEffect[] = [];
  if (typed.last === 'ok') effects.push({ kind: 'sound', sound: 'key' });
  if (typed.last === 'error') effects.push({ kind: 'sound', sound: 'miss' });
  if (typed.hint !== null && typed.hint !== before.hint) effects.push({ kind: 'hint', hint: typed.hint });
  const counted = typed.last === 'ok' || typed.last === 'error';
  return { typed, effects, presses: counted ? [...presses, { ch: (before.text[before.pos] ?? '').toLowerCase(), ok: typed.last === 'ok' }] : presses };
}
