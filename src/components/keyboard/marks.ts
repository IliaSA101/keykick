/**
 * Метка пальца на ногте руки (065 Т9, кадры Э1.03–Э1.05; правило владельца 08.11): метка ставится, только когда клавиша цели
 * не лежит под пальцем основного ряда (Э1.04) — иначе метка и подсветка клавиши закрывали бы друг друга; пробел — метка
 * на большом пальце всегда (Э1.05). Чистые функции, без DOM: проверяются тестом.
 */
import type { Finger, KeyDef, Thumb } from '../../engine/typing/keymap';

/** Клавиши основной позиции (ФЫВА ОЛДЖ) по физическим кодам — от раскладки не зависят. */
export const HOME_CODES: readonly string[] = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];

export type NailMark = { finger: Exclude<Finger, 'th'> } | { finger: 'th'; thumb: Thumb };

/** Куда ставить метку: палец цели; `null` — метки нет (цель на основном ряду или клавиатура без цели). */
export function nailMark(target: KeyDef | null, thumb: Thumb | null): NailMark | null {
  if (target === null) return null;
  if (target.finger === 'th') return { finger: 'th', thumb: thumb ?? 'right' };
  if (HOME_CODES.includes(target.code)) return null;
  return { finger: target.finger };
}
