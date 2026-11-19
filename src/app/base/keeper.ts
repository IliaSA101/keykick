/**
 * Вратарь на экране (067 Т20, кадры Э4.37–40): связь движка `engine/base/games/keeper` с кадром — клавиша сектора, ход серии по ударам
 * (для ряда из 20 точек), доля полёта мяча, итог серии. Чистые функции: часы, зерно, день и разделы приходят снаружи.
 * Правил здесь нет: что считается сейвом и пропуском — в движке; рекорд (больше сейвов — лучше) и счётчик дня — `finishGame`.
 */
import cfg from '../../content/base.json';
import { sectors, type KeeperState } from '../../engine/base/games/keeper';
import { finishGame, pressedChar, seriesResults, type FunEnd } from './play';
import type { baseOf } from './run';

type Sections = Parameters<typeof baseOf>[0];

/** Сколько ударов в серии — из контента. */
export const keeperShots: number = cfg.keeper.shots;

/** Клавиша сектора: буква ряда ФЫВА ОЛДЖ по месту клавиши (`code`); остальное — `null`. */
export const keeperChar = (e: Parameters<typeof pressedChar>[0]): string | null => pressedChar(e, (ch) => cfg.homeRow.includes(ch));

/**
 * Исход каждого удара серии: `true` — сейв, `false` — пропуск. Сравнивает состояние до и после шага движка: удар сменился — прошлый кончился,
 * сейвов стало больше — это был сейв. Последний удар серии закрывает `over`. Шаг без смены удара ряд не меняет.
 */
export const keeperResults = (res: readonly boolean[], prev: KeeperState, next: KeeperState): boolean[] => seriesResults(res, prev, next, next.saves > prev.saves);

/** Сколько мяч уже летит: 0 — только пробит, 1 — долетел (окно `windowMs` кончилось). */
export const keeperFlight = (s: KeeperState, t: number): number => Math.max(0, Math.min(1, (t - s.since) / cfg.keeper.windowMs));

/** Пример закрытого сектора на старте (036-Р15): ряд, где первая и последняя клавиши ещё не выучены. */
export const keeperDemo = sectors(cfg.homeRow.slice(1, -1));

/** Записать итог серии: счёт — сейвы (см. `finishGame`). */
export const finishKeeper = (sections: Sections, save: (patch: Record<string, unknown>) => { ok: boolean }, saves: number, run: string, day: string): FunEnd => finishGame('keeper', sections, save, saves, run, day);

/** Кадр стенда (только в разработке, фикстура `base.keeper`): серия «замерзла» на нужном ударе, итог — экран не тикает и ничего не пишет. */
export interface KeeperStand {
  phase: 'start' | 'play' | 'end';
  /** Игра: исходы уже сыгранных ударов, сектор текущего удара, доля полёта мяча, прыжок вратаря в этот сектор. */
  results?: boolean[];
  target?: string;
  flight?: number;
  dive?: boolean;
  end?: FunEnd;
}
