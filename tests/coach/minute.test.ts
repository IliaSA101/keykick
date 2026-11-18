/**
 * Минута тренера (К1, ТЗ-2.9, 3.4): две клавиши, строки пар, конец на конце строки после `coach.ms`, итог — нажатия и верные.
 */
import { describe, expect, it } from 'vitest';
import { coachKeys, idleMinute, minuteResult, minuteStep, type MinuteState } from '../../src/engine/coach/minute';
import { expectedHit } from '../../src/engine/typing/typing';
import { courseLessons, dictionary, keymap } from '../course/yard';

const lesson = courseLessons.find((l) => !l.friendly)!;

/** Игрок набирает минуту: по знаку раз в `gap` мс; каждый `missEvery`-й знак — промах. */
function playMinute(ms: number, gap: number, missEvery = 0): MinuteState {
  let state = minuteStep(idleMinute, { type: 'start', seed: 3, lesson, keys: 'ап', dict: dictionary, keymap, ms }).state;
  let t = 0;
  let n = 0;
  while (state.phase === 'run' && n < 5000) {
    const typing = state.typing!;
    const hit = expectedHit(keymap, typing);
    n += 1;
    const miss = missEvery > 0 && n > 1 && n % missEvery === 0;
    t += gap;
    state = minuteStep(state, miss ? { type: 'key', code: '', key: '§', t } : { type: 'key', code: hit?.key.code ?? '', key: typing.text[typing.pos] ?? '', t }).state;
  }
  return state;
}

describe('К1: минута тренера', () => {
  it('К1: клавиши — две самые ошибочные; не хватает — добираем из фокуса урока', () => {
    expect(coachKeys({ KeyA: 9, KeyF: 3, KeyJ: 1 }, keymap, lesson)).toHaveLength(2);
    expect(coachKeys({}, keymap, lesson)).toHaveLength(Math.min(2, lesson.focus.length));
  });

  it('К1: кончается на конце строки после coach.ms (не раньше); итог — нажатия и верные', () => {
    // Ловит: минуту, оборванную посреди строки, или бесконечную; потерю счёта нажатий.
    const done = playMinute(3000, 100);
    expect(done.phase).toBe('done');
    const r = minuteResult(done);
    expect(r.correct).toBeGreaterThan(30);
    expect(r.presses).toBe(r.correct);
    expect(r.list).toHaveLength(r.presses);
  });

  it('К1: ошибки идут в нажатия и в список для формы, но не в верные', () => {
    const r = minuteResult(playMinute(3000, 100, 7));
    expect(r.presses).toBeGreaterThan(r.correct);
    expect(r.list.filter((p) => !p.ok).length).toBe(r.presses - r.correct);
  });

  it('К1: до start и после конца события игнорируются; один шаг — одно состояние', () => {
    const done = playMinute(500, 100);
    expect(minuteStep(idleMinute, { type: 'key', code: 'KeyA', key: 'а', t: 1 }).state).toBe(idleMinute);
    expect(minuteStep(done, { type: 'key', code: 'KeyA', key: 'а', t: 1 }).state).toBe(done);
    expect(minuteResult(idleMinute)).toEqual({ presses: 0, correct: 0, list: [] });
  });
});
