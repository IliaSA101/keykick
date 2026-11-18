/** Состояние навигации: начало, нормализация (Z3, Z8), ступени Дома. */
import { NAV } from './config';
import { leagueIndex } from './leagues';
import type { NavCtx, NavState } from './types';

/** Ступеней Дома без «Карты»; во Дворе шкалы нет (054-Р4, Z7). */
export function homeStepsOf(ctx: NavCtx): number {
  return ctx.league === 'yard' ? 0 : Math.max(0, Math.floor(ctx.homeSteps));
}

/** Ступень входа в Дом — верхняя перед «Картой»: Район «Школа», Город «Клуб» (053-Р2, Р8); Двор — 0. */
export function topStep(ctx: NavCtx): number {
  return Math.max(0, homeStepsOf(ctx) - 1);
}

/** Длительность шага перехода (052-Р4; «меньше движения» — 0,2 с). */
export const moveMs = (ctx: NavCtx): number => (ctx.reduced ? NAV.reducedMs : NAV.stepMs);

/** Дом лиги L на ступени входа — состояние нового игрока и вход по адресу `/home`. */
export function initialState(ctx: NavCtx): NavState {
  return settle(ctx, {
    screen: 'home',
    mapLeague: ctx.league,
    homeStep: topStep(ctx),
    pathLevel: ctx.league,
    bump: null,
    busyUntil: 0,
    queued: null,
  });
}

/**
 * Нормальный вид состояния при данном сохранении: Карта — только лиги не выше L (Z3), вне Карты `mapLeague` = L,
 * Дом — всегда лиги L (Z8: «в гостях» не бывает), ступень в пределах шкалы. Зовётся после каждого ввода и при
 * смене L («переезд»): так Карта и Дом не показывают лигу, в которую не переехали.
 */
export function settle(ctx: NavCtx, st: NavState): NavState {
  const L = ctx.league;
  const mapOk = st.screen === 'map' && leagueIndex(st.mapLeague) <= leagueIndex(L);
  const top = topStep(ctx);
  return {
    ...st,
    mapLeague: mapOk ? st.mapLeague : L,
    pathLevel: st.screen === 'path' ? st.pathLevel : L,
    homeStep: st.screen === 'home' ? Math.min(Math.max(0, Math.floor(st.homeStep)), top) : top,
  };
}
