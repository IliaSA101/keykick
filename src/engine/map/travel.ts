/**
 * Переезд на матч (065 Т8, 054 «Управление»): первый матч двора — в гостях (автобус едет к ним), следующий — дома (к нам едет
 * автобус соперника). Автобус — только по Enter (К3). Ракурс — по направлению движения по карте (Э2.42: 6 ракурсов + зеркало).
 */
import { isAway, stageOf, streetName, streetOf } from '../home/yard';

export type BusMode = 'idle' | 'away' | 'incoming';
export interface Travel {
  lesson: number;
  stage: number;
  street: string;
  /** В гостях: автобус едет от нашего двора к ним; дома — от них к нам. */
  away: boolean;
  bus: Exclude<BusMode, 'idle'>;
}

export const travelOf = (lesson: number): Travel => {
  const away = isAway(lesson);
  return { lesson, stage: stageOf(lesson), street: streetName(streetOf(lesson)), away, bus: away ? 'away' : 'incoming' };
};

/**
 * Шаг переезда (054 «Управление», 012-Р39, К3): на Карте Enter сначала показывает переезд — автобус и плашку «Едем…» (`travel`),
 * второй Enter ведёт в матч, Esc из переезда — назад на Дом (строка плашки «Esc — назад, на Дом»). Автобус и матч — только по Enter.
 * Холостое нажатие (другая клавиша; Esc вне переезда — его разбирает экран: окно, пузырь, Дом) состояния не меняет.
 */
export type TravelPhase = 'idle' | 'travel';
export type TravelGo = 'match' | 'home' | null;
export function travelKey(phase: TravelPhase, key: 'enter' | 'escape' | 'other'): { phase: TravelPhase; go: TravelGo } {
  if (key === 'enter') return phase === 'idle' ? { phase: 'travel', go: null } : { phase, go: 'match' };
  if (key === 'escape' && phase === 'travel') return { phase, go: 'home' };
  return { phase, go: null };
}

export type BusView = 'front' | 'front34' | 'side' | 'back34' | 'back';
const FACING: Record<number, { view: BusView; flip: boolean }> = {
  0: { view: 'side', flip: false },
  1: { view: 'front34', flip: false },
  2: { view: 'front', flip: false },
  3: { view: 'front34', flip: true },
  4: { view: 'side', flip: true },
  [-4]: { view: 'side', flip: true },
  [-3]: { view: 'back34', flip: true },
  [-2]: { view: 'back', flip: false },
  [-1]: { view: 'back34', flip: false },
};
/** Ракурс автобуса и зеркало по вектору движения (экранные оси: y вниз). Нулевой вектор — ракурс спереди. */
export function busFacing(dx: number, dy: number): { view: BusView; flip: boolean } {
  if (dx === 0 && dy === 0) return { view: 'front', flip: false };
  return FACING[Math.round((Math.atan2(dy, dx) / Math.PI) * 4)]!;
}
