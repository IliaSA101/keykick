/**
 * Схемы тактик на карточках выбора (067-Р22, кадры Э4.50, 51; макет `tools/mock-games/e4-tactic.mjs`): расстановка и стрелки в координатах П4 (как `SPOTS`),
 * окно газона без трибун и наконечник стрелки в пикселях картинки поля. Правил игры здесь нет — они в `engine/base/games/mini`.
 */
import { at } from './miniGeo';

type XY = readonly [number, number];
type Px = { x: number; y: number };
/** Стрелка схемы: пас (пунктир) или бег; `from` — номер нашего игрока, `to` — номер нашего или точка П4. */
export interface SchemeArrow {
  kind: 'pass' | 'run';
  from: number;
  to: number | XY;
}
export interface Scheme {
  our: readonly XY[];
  rv: readonly XY[];
  arrows: readonly SchemeArrow[];
}

/** Окно картинки поля для схемы: газон с воротами без трибун (отношение 3:2). */
export const TURF_VIEW = '395 200 1130 753';

const FOES_4: readonly XY[] = [[360, 250], [520, 190], [520, 330], [680, 330]];
/** Схемы по id тактики (`engine/base/games/mini` `TACTIC_IDS`). */
export const SCHEMES: Readonly<Record<string, Scheme>> = {
  wing: { our: [[250, 250], [430, 90], [640, 70], [740, 250]], rv: FOES_4, arrows: [{ kind: 'pass', from: 0, to: 1 }, { kind: 'run', from: 1, to: 2 }, { kind: 'pass', from: 2, to: 3 }] },
  press: { our: [[430, 250], [520, 120], [520, 380], [330, 250]], rv: [[610, 250], [660, 160], [660, 340], [750, 250]], arrows: [{ kind: 'run', from: 0, to: [548, 250] }, { kind: 'run', from: 1, to: [584, 150] }, { kind: 'run', from: 2, to: [584, 350] }] },
  short: { our: [[250, 250], [390, 160], [530, 280], [670, 190]], rv: FOES_4, arrows: [{ kind: 'pass', from: 0, to: 1 }, { kind: 'pass', from: 1, to: 2 }, { kind: 'pass', from: 2, to: 3 }] },
  counter: { our: [[230, 250], [330, 140], [330, 360], [650, 250]], rv: [[420, 200], [480, 300], [540, 160], [560, 340]], arrows: [{ kind: 'pass', from: 0, to: 3 }, { kind: 'run', from: 3, to: [780, 250] }] },
};

/** Точка конца стрелки: наш игрок по номеру (`our` — уже в пикселях картинки) или точка П4. */
export const endOf = (our: readonly Px[], to: number | XY): Px => (typeof to === 'number' ? (our[to] ?? { x: 0, y: 0 }) : at(to));

/** Наконечник стрелки, что кончается в `b` (идёт от `a`): точки треугольника — длина 52 px, раскрыв ±0,5 рад. */
export function headOf(a: Px, b: Px): string {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const pt = (k: number): string => `${Math.round(b.x - 52 * Math.cos(ang + k))},${Math.round(b.y - 52 * Math.sin(ang + k))}`;
  return `${b.x},${b.y} ${pt(0.5)} ${pt(-0.5)}`;
}
