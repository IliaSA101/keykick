/** Общее для тестов модели навигации (063 Т3). */
import { navigate, type NavCtx, type NavInput, type NavResult, type NavState } from '../../src/engine/nav';

/** Контекст игрока: Двор, без ступеней Дома, без входов. */
export const ctxOf = (o: Partial<NavCtx> = {}): NavCtx => ({ league: 'yard', leagueDone: false, homeSteps: 0, entries: 0, reduced: false, ...o });
export const DISTRICT = ctxOf({ league: 'district', homeSteps: 2 });
export const CITY = ctxOf({ league: 'city', homeSteps: 2 });

/** Последовательность вводов `[ввод, момент]`; возвращает последний результат и все вызовы. */
export function play(ctx: NavCtx, from: NavState, steps: [NavInput, number][]): { last: NavResult; all: NavResult[] } {
  let st = from;
  const all: NavResult[] = [];
  for (const [input, at] of steps) {
    const r = navigate(ctx, st, input, at);
    all.push(r);
    st = r.state;
  }
  return { last: all[all.length - 1]!, all };
}

export const menu = (item: 'home' | 'map' | 'cup' | 'path' | 'club'): NavInput => ({ t: 'menu', item });
