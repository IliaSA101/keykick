/** Колёсико и стрелки: ступени Дома, уровни Пути клуба, упор на краю (054-Р3, Р4, Р16). */
import { NAV } from './config';
import { shiftLeague } from './leagues';
import { goTo, idle, NONE, type Step } from './moves';
import { homeStepsOf, moveMs } from './state';
import type { Bump, NavCtx, NavState } from './types';

/** Путь клуба: уровень ±1 (колёсико, +/−, ← →); у Двора «ближе» и у Мира «дальше» — ничего, деление не мигает (052-Р30 а). */
export function shiftLevel(ctx: NavCtx, st: NavState, d: -1 | 1, now: number): Step {
  const to = shiftLeague(st.pathLevel, d);
  if (!to) return idle(st);
  return {
    state: { ...st, pathLevel: to, bump: null, busyUntil: now + moveMs(ctx) },
    effect: { kind: 'level', from: st.pathLevel, to },
  };
}

/**
 * Упор (054-Р16 в): первая прокрутка на краю — только упор; вторая в ту же сторону не раньше паузы
 * (`bumpPauseMs`, 061-Р3) и не позже `bumpTtlMs` — переход. Вторая раньше паузы — нечаянный хвост тачпада: ничего.
 */
function bumpOrGo(st: NavState, to: Bump['to'], now: number, go: () => Step): Step {
  const b = st.bump;
  if (b && b.to === to && now - b.at <= NAV.bumpTtlMs) {
    return now - b.at >= NAV.bumpPauseMs ? go() : { state: st, effect: NONE };
  }
  return { state: { ...st, bump: { to, at: now } }, effect: { kind: 'bump', to } };
}

/** Колёсико: `in` — «ближе», `out` — «дальше». Во Дворе Дом ↔ Карта колёсиком нет (054-Р4, Z11). */
export function wheel(ctx: NavCtx, st: NavState, dir: 'in' | 'out', now: number): Step {
  if (st.screen === 'path') return shiftLevel(ctx, st, dir === 'in' ? -1 : 1, now);
  if (st.screen !== 'home' && st.screen !== 'map') return idle(st);
  if (ctx.league === 'yard') return idle(st);

  if (st.screen === 'home') {
    const top = Math.max(0, homeStepsOf(ctx) - 1);
    if (dir === 'in') {
      if (st.homeStep <= 0) return idle(st);
      return { state: { ...st, homeStep: st.homeStep - 1, bump: null, busyUntil: now + moveMs(ctx) }, effect: { kind: 'homeStep', from: st.homeStep, to: st.homeStep - 1 } };
    }
    if (st.homeStep < top) {
      return { state: { ...st, homeStep: st.homeStep + 1, bump: null, busyUntil: now + moveMs(ctx) }, effect: { kind: 'homeStep', from: st.homeStep, to: st.homeStep + 1 } };
    }
    return bumpOrGo(st, 'map', now, () => goTo(ctx, st, 'map', 'camera', now));
  }

  // Карта лиги выше Двора: «ближе» — Дом, «дальше» — Путь клуба на уровне этой лиги (как Esc, 054-Р13).
  if (dir === 'in') return bumpOrGo(st, 'home', now, () => goTo(ctx, st, 'home', 'camera', now));
  return bumpOrGo(st, 'path', now, () => goTo(ctx, st, 'path', 'layerOff', now, st.mapLeague));
}

/** Стрелки ← → — уровень на Пути клуба; на Доме и Карте это выбор ярлыков и дворов, его делает экран (054-Р3). */
export function arrow(ctx: NavCtx, st: NavState, dir: 'left' | 'right', now: number): Step {
  if (st.screen !== 'path') return idle(st);
  return shiftLevel(ctx, st, dir === 'left' ? -1 : 1, now);
}
