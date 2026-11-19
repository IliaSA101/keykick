/**
 * Упор колёсика на Пути клуба в этапе Э1 (М7, 054-Р16; 067 design §4): выше Двора ничего нет — Район «строится», выше него туман.
 * Колёсико «дальше» (и →) один раз показывает упор «Район строится»; следующие в пределах `bumpTtlMs` — ничего (Района нет, переходить некуда);
 * поздняя — снова упор. «Ближе» на Дворе — ничего (модель навигации, 052-Р30 а). Часы приходят снаружи.
 */
import { NAV, type NavInput, type NavState } from '../nav';

export interface Stop {
  /** Время (мс) последнего показанного упора. */
  at: number;
}

/** Ввод идёт «дальше Двора»: колёсико «дальше» или → на Пути клуба. Только его и перехватывает упор — остальное ведёт модель. */
export const pastYard = (st: Pick<NavState, 'screen'>, input: NavInput): boolean =>
  st.screen === 'path' && ((input.t === 'wheel' && input.dir === 'out') || (input.t === 'arrow' && input.dir === 'right'));

export interface StopStep {
  stop: Stop | null;
  /** `bump` — упор показан (плашка «Район строится» вздрогнет); `none` — холостое. */
  effect: 'bump' | 'none';
}

export function stopStep(stop: Stop | null, now: number): StopStep {
  if (stop && now - stop.at <= NAV.bumpTtlMs) return { stop, effect: 'none' };
  return { stop: { at: now }, effect: 'bump' };
}
