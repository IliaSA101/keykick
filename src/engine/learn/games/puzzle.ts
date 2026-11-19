/**
 * «Собери клавиатуру» (057, игра 4): разложить выученные буквы по гнёздам клавиатуры. Промах — буква не в своё гнездо.
 * Гнездо буквы — сама буква (какую клавишу она занимает, знает экран по карте клавиатуры). У-З2 (067 design §4):
 * в лоток попадают только выученные буквы — их приносит вызывающий (урок игрока), здесь других нет.
 */
import cfg from '../../../content/learn.json';
import { createRandom, shuffle } from '../../random';
import type { Playing } from './common';

export interface PuzzleState extends Playing {
  /** Лоток: буквы в порядке показа. */
  tray: readonly string[];
  /** Уже на своих местах. */
  placed: readonly string[];
}

/** Лоток из выученных букв по зерну: не больше `tray` штук. Ни одной выученной — игра не открыта (урок 6): `null`. */
export function startPuzzle(learned: readonly string[], seed: number): PuzzleState | null {
  const letters = [...new Set(learned)];
  if (letters.length === 0) return null;
  const tray = shuffle(createRandom(seed), letters).slice(0, cfg.play.keyboard.tray);
  return { tray, placed: [], misses: 0, done: false };
}

/** Буква брошена в гнездо. Буквы нет в лотке или она уже стоит — ничего. */
export function placeLetter(s: PuzzleState, letter: string, socket: string): PuzzleState {
  if (s.done || !s.tray.includes(letter) || s.placed.includes(letter)) return s;
  if (letter !== socket) return { ...s, misses: s.misses + 1 };
  const placed = [...s.placed, letter];
  return { ...s, placed, done: placed.length === s.tray.length };
}
