/**
 * Переигровка матча (060-Т9б, 059 С-24): семя и запись нажатий дают то же финальное состояние бит в бит.
 * Журнал матча — `start` (с семенем) и события в порядке прихода; сам журнал пишет Э1.
 */
import { idleMatch, step } from './machine';
import type { Effect, MatchEvent, MatchState, StartEvent } from './types';

/** Финальное состояние матча по его началу и записи событий. */
export function replay(start: StartEvent, events: readonly MatchEvent[]): MatchState {
  return replayWithEffects(start, events).state;
}

/** То же вместе со всеми эффектами по порядку (для проверок и для «повтора голов»). */
export function replayWithEffects(start: StartEvent, events: readonly MatchEvent[]): { state: MatchState; effects: Effect[] } {
  let { state, effects } = step(idleMatch, start);
  const all = [...effects];
  for (const event of events) {
    ({ state, effects } = step(state, event));
    all.push(...effects);
  }
  return { state, effects: all };
}
