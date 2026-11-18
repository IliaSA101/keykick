/** Состояние → вид: что экран обязан показать и чего не может (запреты Z1–Z11 строятся здесь). */
import { LEAGUES, leagueIndex, shiftLeague, type League } from './leagues';
import { homeStepsOf } from './state';
import type { MainButton, NavCtx, NavState, NavView } from './types';

function mainButton(ctx: NavCtx, st: NavState): MainButton | null {
  const L = ctx.league;
  if (st.screen === 'home') return { kind: 'tz15' };
  if (st.screen === 'map') return st.mapLeague === L ? { kind: 'tz15' } : { kind: 'lesson' };
  if (st.screen === 'path') {
    return leagueIndex(st.pathLevel) < leagueIndex(L) ? { kind: 'toMap', league: st.pathLevel, back: L } : { kind: 'tz15' };
  }
  return null; // Кубок и Клуб — свои экраны вне модели лиг
}

/** «Ты здесь» — только про L: на Карте лиги L (у флага), на Пути клуба при C ≥ L; на Карте прошлой лиги — нет (R4, Z4). */
function here(ctx: NavCtx, st: NavState): League | null {
  if (st.screen === 'map') return st.mapLeague === ctx.league ? ctx.league : null;
  if (st.screen === 'path') return leagueIndex(st.pathLevel) >= leagueIndex(ctx.league) ? ctx.league : null;
  return null;
}

export function viewOf(ctx: NavCtx, st: NavState): NavView {
  const L = ctx.league;
  const s = st.screen;
  const onLeagueL = s === 'home' || (s === 'map' && st.mapLeague === L);
  const steps = homeStepsOf(ctx);
  return {
    screen: s,
    menuActive: s,
    league: s === 'home' ? L : s === 'map' ? st.mapLeague : null,
    level: s === 'path' ? st.pathLevel : null,
    selected: s === 'path' ? st.pathLevel : null,
    scaleLevels: s === 'path' ? LEAGUES : [],
    scaleHome: onLeagueL && steps > 0,
    homeStep: s === 'home' && steps > 0 ? st.homeStep : null,
    chipMap: s === 'home' && steps === 0,
    transport: s === 'map',
    here: here(ctx, st),
    pastPlaque: s === 'map' && st.mapLeague !== L ? L : null,
    main: mainButton(ctx, st),
    next: s === 'path' && ctx.leagueDone ? shiftLeague(L, 1) : null,
    bumped: st.bump?.to ?? null,
  };
}
