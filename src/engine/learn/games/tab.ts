/**
 * «Tab по защитникам» (057, игра 3): пас игроку с названным номером — Tab, Shift+Tab, Enter; пять пасов.
 * Промах — нажатие, уводящее от нужного номера дальше кратчайшего пути; Enter на чужом; щелчок мышью.
 */
import cfg from '../../../content/learn.json';
import { createRandom, randomInt, shuffle } from '../../random';
import type { Playing } from './common';

export interface TabState extends Playing {
  /** Номера игроков по кругу фокуса. */
  numbers: readonly number[];
  /** Где фокус (индекс). */
  focus: number;
  /** Кому пас (индекс). */
  target: number;
  /** Сколько пасов отдано. */
  passes: number;
  seed: number;
}

export type TabInput = 'tab' | 'shiftTab' | 'enter' | 'click';

/** Цель — не там, где фокус: иначе пас без единого движения. */
function nextTarget(n: number, focus: number, rnd: () => number): number {
  return (focus + 1 + randomInt(rnd, n - 1)) % n;
}

export function startTab(seed: number): TabState {
  const rnd = createRandom(seed);
  const { players, numberMax } = cfg.play.tab;
  const numbers = shuffle(rnd, Array.from({ length: numberMax - 1 }, (_, i) => i + 2)).slice(0, players);
  return { numbers, focus: 0, target: nextTarget(players, 0, rnd), passes: 0, seed, misses: 0, done: false };
}

export function inputTab(s: TabState, input: TabInput): TabState {
  if (s.done) return s;
  const n = s.numbers.length;
  const ahead = (s.target - s.focus + n) % n;
  const back = (s.focus - s.target + n) % n;
  if (input === 'click') return { ...s, misses: s.misses + 1 };
  if (input === 'tab' || input === 'shiftTab') {
    const forward = input === 'tab';
    // фокус уже на цели: любой Tab проскакивает её — промах
    const shortest = ahead !== 0 && (forward ? ahead <= back : back <= ahead);
    return { ...s, focus: (s.focus + (forward ? 1 : n - 1)) % n, misses: s.misses + (shortest ? 0 : 1) };
  }
  if (s.focus !== s.target) return { ...s, misses: s.misses + 1 };
  const passes = s.passes + 1;
  if (passes >= cfg.play.tab.passes) return { ...s, passes, done: true };
  const rnd = createRandom(s.seed * 17 + passes);
  return { ...s, passes, target: nextTarget(n, s.focus, rnd) };
}
