/**
 * Клавиатура карты (спека 019, design §5.3, ТЗ-0.16): куда уходит фокус. Чистая функция без DOM.
 * Идентификаторы: id урока, `gate`, `flag:<после урока>`, `building:<id>`, `header`.
 */
import { isPlayablePoint, type MapModel } from './model';

export type FocusKey = 'left' | 'right' | 'tab' | 'shiftTab';

export const HEADER_FOCUS = 'header';
export const flagFocus = (after: number): string => `flag:${after}`;
export const buildingFocus = (id: string): string => `building:${id}`;

/** Фокус при открытии карты. */
export const defaultFocus = (model: MapModel): string => model.focus;

/** Стрелки ходят по играемым точкам и по воротам, если они не в тумане. */
function arrowRing(model: MapModel): string[] {
  const ids = model.points.filter(isPlayablePoint).map((p) => p.id);
  if (model.gate.state !== 'fog') ids.push('gate');
  return ids;
}

/** Порядок Tab: точки (вход — фокус по умолчанию) → ближайший флажок → флажки → здания → шапка. */
function tabOrder(model: MapModel): string[] {
  const near = model.flags.find((f) => f.big);
  const rest = model.flags.filter((f) => f !== near);
  return [
    defaultFocus(model),
    ...(near ? [flagFocus(near.after)] : []),
    ...rest.map((f) => flagFocus(f.after)),
    ...model.buildings.map((b) => buildingFocus(b.id)),
    HEADER_FOCUS,
  ];
}

/** Следующий фокус; `null` — остаться на месте (край). Незнакомый `from` — фокус по умолчанию. */
export function nextFocus(model: MapModel, from: string, key: FocusKey): string | null {
  if (key === 'left' || key === 'right') {
    const ring = arrowRing(model);
    const i = ring.indexOf(from);
    if (i === -1) return defaultFocus(model);
    return ring[key === 'left' ? i - 1 : i + 1] ?? null;
  }
  const order = tabOrder(model);
  // Любая точка или ворота — это группа «точки»: её место в порядке Tab — вход.
  const inPoints = model.points.some((p) => p.id === from) || from === 'gate';
  const i = inPoints ? 0 : order.indexOf(from);
  if (i === -1) return defaultFocus(model);
  return order[key === 'tab' ? i + 1 : i - 1] ?? null;
}
