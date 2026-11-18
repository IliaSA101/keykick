/**
 * Адрес экрана (054-Р9): в адресе живут экран и лига Карты; ступень Дома и камера Пути клуба — по правилу входа.
 * Пути без решётки: `/home`, `/map`, `/map?league=district`, `/cup`, `/path`, `/club`. Имена хэш-маршрутов роутера (Т4)
 * сопоставляет приложение; модель знает только эти.
 */
import { isLeague, isScreen, leagueIndex, type League, type Screen } from './leagues';
import { initialState, settle } from './state';
import type { NavCtx, NavState } from './types';

export interface NavAddress {
  screen: Screen;
  /** Только у Карты прошлой лиги; без него — L. */
  league?: League;
}

/** Разбор адреса; незнакомое — `null` (приложение решит: Дом). */
export function parseAddress(raw: string): NavAddress | null {
  const m = /^#?\/([a-z]+)(?:\?league=([a-z]+))?$/.exec(raw.trim());
  if (!m || !isScreen(m[1])) return null;
  const screen = m[1];
  if (screen === 'map' && isLeague(m[2])) return { screen, league: m[2] };
  return { screen };
}

export function formatAddress(a: NavAddress): string {
  return a.screen === 'map' && a.league ? `/map?league=${a.league}` : `/${a.screen}`;
}

/** Адрес текущего вида: Карта лиги L — без параметра (R2). */
export function addressOf(ctx: NavCtx, st: NavState): NavAddress {
  if (st.screen === 'map' && st.mapLeague !== ctx.league) return { screen: 'map', league: st.mapLeague };
  return { screen: st.screen };
}

/**
 * Открытие по адресу (перезагрузка, ссылка): Дом — ступень входа, Путь клуба — уровень L (Р7), Карта — лига из адреса,
 * если она не выше L (Z3), иначе L. Адрес `null` — Дом.
 */
export function openAt(ctx: NavCtx, addr: NavAddress | null): NavState {
  const base = initialState(ctx);
  if (!addr) return base;
  const league = addr.league && leagueIndex(addr.league) <= leagueIndex(ctx.league) ? addr.league : ctx.league;
  return settle(ctx, { ...base, screen: addr.screen, mapLeague: addr.screen === 'map' ? league : ctx.league });
}
