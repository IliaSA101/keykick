/**
 * Один ввод игрока на экранах модели лиг — решения про Путь клуба в одном месте (067 К-З, Т10; 054-Р10, Р11, Р16, Р17).
 * Чистая функция: сохранение (раздел `path`), упор колёсика, часы и «меньше движения» приходят снаружи; приложение (`useNav`)
 * только исполняет результат: пишет раздел, показывает упор, запоминает вид входа и толкает роутер.
 */
import { navigate, openAt, type NavCtx, type NavEffect, type NavInput, type Screen, type Via } from '../nav';
import { countEntry, entriesOf, entryVia } from './entries';
import type { Path } from './section';
import { pastYard, stopStep, type Stop } from './stop';

export interface PathInputEnv {
  /** «Меньше движения» (N7). */
  reduced: boolean;
  /** Предыдущий переход ещё не закончен (роутер не сменил адрес): новый ввод не считается, иначе вход посчитается дважды. */
  busy: boolean;
}

export interface PathStep {
  /** Что произошло; `go` — приложению толкнуть роутер, `bump` — показать упор. */
  effect: NavEffect;
  /** Раздел `path` после ввода: тот же объект, если писать в сохранение нечего. */
  path: Path;
  /** Упор колёсика после ввода: любой переход его гасит. */
  stop: Stop | null;
  /** Вид входа в Путь клуба, с которым экран начнёт движение; не вход в Путь — `null`. */
  via: Via | null;
}

const NONE: NavEffect = { kind: 'none' };

export function pathInput(path: Path, stop: Stop | null, screen: Screen, input: NavInput, now: number, env: PathInputEnv): PathStep {
  if (env.busy && input.t !== 'hover') return { effect: { kind: 'dropped' }, path, stop, via: null };
  const ctx: NavCtx = { league: 'yard', leagueDone: false, homeSteps: 0, entries: entriesOf(path, 'yard'), reduced: env.reduced };
  const state = openAt(ctx, { screen });
  if (pastYard(state, input)) {
    const step = stopStep(stop, now);
    return { effect: step.effect === 'bump' ? { kind: 'bump', to: 'path' } : NONE, path, stop: step.stop, via: null };
  }
  const effect = navigate(ctx, state, input, now).effects.at(-1) ?? NONE;
  if (effect.kind !== 'go') return { effect, path, stop, via: null };
  return { effect, path: countEntry(path, 'yard', effect), stop: null, via: entryVia(effect) };
}
