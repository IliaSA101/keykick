/** Общие шаги модели: результат шага и переход на экран. */
import { NAV } from './config';
import { leagueIndex, type League, type Screen } from './leagues';
import { moveMs, settle } from './state';
import type { NavCtx, NavEffect, NavState, Via } from './types';

/** Результат одного ввода без очереди. */
export interface Step {
  state: NavState;
  effect: NavEffect;
}

export const NONE: NavEffect = { kind: 'none' };

/** Состояние без изменений, но с упором, сброшенным: любой не-колёсный ввод гасит упор. */
export const idle = (st: NavState, effect: NavEffect = NONE): Step => ({ state: { ...st, bump: null }, effect });

/**
 * Переход на экран. `league` — лига Карты или уровень Пути клуба; без него — L (054-Р7, Р13).
 * Лига не выше L — иначе Z3 (Карта лиги, в которую не переехали); выше L приводится к L.
 */
export function goTo(ctx: NavCtx, st: NavState, to: Screen, via: Via, now: number, league?: League): Step {
  const L = ctx.league;
  const target = league !== undefined && leagueIndex(league) <= leagueIndex(L) ? league : L;
  const next = settle(ctx, {
    ...st,
    screen: to,
    mapLeague: to === 'map' ? target : L,
    pathLevel: to === 'path' ? target : L,
    bump: null,
    busyUntil: now + moveMs(ctx),
    queued: null,
  });
  const effect: NavEffect =
    to === 'map' || to === 'path'
      ? { kind: 'go', from: st.screen, to, via, league: to === 'map' ? next.mapLeague : next.pathLevel }
      : { kind: 'go', from: st.screen, to, via };
  return { state: next, effect };
}

/** Вид входа в Путь клуба (054-Р10, Р11, Р17): из Дома — полный на первых входах, потом короткий; с Карты — снятие слоя. */
export function pathVia(ctx: NavCtx, from: Screen): Via {
  if (from === 'home') return ctx.entries < NAV.fullEntries ? 'full' : 'short';
  if (from === 'map') return 'layerOff';
  return 'cut';
}
