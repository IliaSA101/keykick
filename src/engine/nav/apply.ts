/** Один ввод → новое состояние и что произошло (054 §2, правила R1–R8). Очередь шагов — в `index.ts`. */
import { leagueIndex, type Screen } from './leagues';
import { goTo, idle, NONE, pathVia, type Step } from './moves';
import type { NavCtx, NavInput, NavState, Via } from './types';
import { arrow, wheel } from './wheel';

/** Как выглядит переход меж двумя экранами, если ни Путь клуба, ни Кубок с Клубом не заданы особо. */
function viaBetween(from: Screen, to: Screen): Via {
  return (from === 'home' && to === 'map') || (from === 'map' && to === 'home') ? 'camera' : 'cut';
}

/** Пункт меню (054-Р8: пункт меняется вместе с экраном; Р13: «Дом» и «Карта» ведут в лигу L). */
function menu(ctx: NavCtx, st: NavState, item: Screen, now: number): Step {
  const L = ctx.league;
  if (item === st.screen && !(item === 'map' && st.mapLeague !== L)) return idle(st); // холостое: уже здесь
  if (item === 'path') return goTo(ctx, st, 'path', pathVia(ctx, st.screen), now, L); // Р7: уровень L; Р10, Р11, Р17: вид входа
  if (item === 'map' && st.screen === 'path') return goTo(ctx, st, 'map', 'layerOn', now, L);
  if (item === 'map' && st.screen === 'map') return goTo(ctx, st, 'map', 'cut', now, L); // из Карты прошлой лиги — в L
  return goTo(ctx, st, item, viaBetween(st.screen, item), now, L);
}

/** Esc (054 §2, «Управление»): Карта — Дом; Карта прошлой лиги — Путь клуба на её уровне (Р7, Р13); Путь клуба — Дом. */
function esc(ctx: NavCtx, st: NavState, now: number): Step {
  if (st.screen === 'map') {
    if (st.mapLeague !== ctx.league) return goTo(ctx, st, 'path', 'layerOff', now, st.mapLeague);
    return goTo(ctx, st, 'home', 'camera', now);
  }
  if (st.screen === 'path') return goTo(ctx, st, 'home', 'cut', now);
  return idle(st); // Дом: Esc закрывает карточку — дело экрана; Кубок и Клуб — вне модели лиг
}

/** Enter: на Пути клуба при C < L — «На карту <C>» (Р6); везде в модели лиг прочее — главная кнопка, функция ТЗ-1.5 (Р12). */
function enter(ctx: NavCtx, st: NavState, now: number): Step {
  if (st.screen === 'path' && leagueIndex(st.pathLevel) < leagueIndex(ctx.league)) {
    return goTo(ctx, st, 'map', 'layerOn', now, st.pathLevel);
  }
  if (st.screen === 'home' || st.screen === 'map' || st.screen === 'path') return idle(st, { kind: 'main' });
  return idle(st);
}

/** Ввод без очереди; `st` уже нормален (`settle`). */
export function applyInput(ctx: NavCtx, st: NavState, input: NavInput, now: number): Step {
  switch (input.t) {
    case 'hover':
      return { state: st, effect: NONE }; // подсказка, не выбор: камера и выбор на Пути клуба не меняются (054-Р1, Z1)
    case 'menu':
      return menu(ctx, st, input.item, now);
    case 'chipMap':
      return st.screen === 'home' ? goTo(ctx, st, 'map', 'camera', now) : idle(st);
    case 'esc':
      return esc(ctx, st, now);
    case 'enter':
      return enter(ctx, st, now);
    case 'wheel':
      return wheel(ctx, st, input.dir, now);
    case 'arrow':
      return arrow(ctx, st, input.dir, now);
  }
}
