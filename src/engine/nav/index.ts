/**
 * Модель навигации Двора: «сохранение + адрес + ввод → вид» (054 §2, 063 Т3). Чистые функции: время `now` (мс)
 * приходит снаружи, Vue и DOM не нужны. Экран зовёт `navigate` на каждый ввод и `advance` по таймеру конца перехода.
 */
import { openAt, type NavAddress } from './address';
import { applyInput } from './apply';
import { settle } from './state';
import type { NavCtx, NavEffect, NavInput, NavResult, NavState } from './types';
import { viewOf } from './view';

export { NAV } from './config';
export { LEAGUES, SCREENS, isLeague, isScreen, leagueIndex, shiftLeague, type League, type Screen } from './leagues';
export { addressOf, formatAddress, openAt, parseAddress, type NavAddress } from './address';
export { initialState, settle } from './state';
export { viewOf } from './view';
export type { Bump, MainButton, NavCtx, NavEffect, NavInput, NavResult, NavSave, NavState, NavView, Via } from './types';

const result = (ctx: NavCtx, state: NavState, effects: NavEffect[]): NavResult => ({ state, view: viewOf(ctx, state), effects });

/** Конец перехода: ввод, ждавший в очереди, применяется в момент конца (не позже `now`). */
export function advance(ctx: NavCtx, state: NavState, now: number): NavResult {
  const st = settle(ctx, state);
  if (!st.queued || now < st.busyUntil) return result(ctx, st, []);
  const step = applyInput(ctx, settle(ctx, { ...st, queued: null, busyUntil: 0 }), st.queued, st.busyUntil);
  return result(ctx, settle(ctx, step.state), [step.effect]);
}

/**
 * Один ввод. Идёт переход — ввод встаёт в очередь (не больше одного шага, 052-Р4), остальные отбрасываются.
 * Наведение мыши (`hover`) очереди не занимает. Состояние `state` может быть старым относительно сохранения —
 * оно приводится к нормальному виду (переезд: Карта и Дом не показывают лигу, в которую не переехали).
 */
export function navigate(ctx: NavCtx, state: NavState, input: NavInput, now: number): NavResult {
  const flushed = advance(ctx, state, now);
  const st = flushed.state;
  if (input.t !== 'hover' && now < st.busyUntil) {
    if (st.queued) return result(ctx, st, [...flushed.effects, { kind: 'dropped' }]);
    return result(ctx, { ...st, queued: input }, [...flushed.effects, { kind: 'queued' }]);
  }
  const step = applyInput(ctx, st, input, now);
  return result(ctx, settle(ctx, step.state), [...flushed.effects, step.effect]);
}

/** Начало сеанса: Дом лиги L, или экран из адреса. */
export function start(ctx: NavCtx, addr: NavAddress | null = null): NavResult {
  return result(ctx, openAt(ctx, addr), []);
}
