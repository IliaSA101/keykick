/**
 * Серия ударов Кубка на экране матча (068 Т6-2, ТЗ-8.6, кадры Э5.30–.33): ход серии поверх чистой машины `engine/cup/series.ts`.
 * Здесь — когда серия нужна после свистка, как клавиша двигает серию, что звучит и что кричит над воротами. Часы (`t` клавиши) —
 * снаружи; Vue и DOM не знает: тест без браузера (`tests/cup/series.test.ts`).
 */
import { extraTime, idleSeries, seriesResult, seriesStep, type RoundKey, type SeriesResult, type SeriesState } from '../../engine/cup';
import type { CourseLesson, Dictionary } from '../../engine/plan/lesson';
import type { KeyInput } from '../../engine/typing/keystep';
import { SFX } from '../match/effects';
import { isWhistle, type Run } from '../match/run';

/** Серия на экране: состояние машины и возглас над воротами (`goal` — гол, `save` — вратарь взял) до следующей клавиши. */
export interface SeriesUi {
  state: SeriesState;
  shout: 'goal' | 'save' | null;
}

/**
 * Серия нужна, когда матч свистнул вничью в плей-офф: доп. время не решило (ТЗ-8.6). Группа ничью принимает (К1 запретов),
 * а матч без результата серии не требует.
 */
export function needsSeries(run: Run, round: RoundKey): boolean {
  if (!isWhistle(run) || run.state.result === null || !extraTime(round)) return false;
  const total = run.state.result.total;
  return total.me === total.opp;
}

/** Начало серии: урок и раскладка — те же, что у матча; слова — по зерну матча. */
export function beginSeries(run: Run, lesson: CourseLesson, dict: Dictionary): SeriesUi {
  const { state } = seriesStep(idleSeries, { type: 'start', seed: run.start.seed, lesson, dict, keymap: run.start.keymap });
  return { state, shout: null };
}

/** Клавиша серии: новое состояние, звуки (файлы по порядку; `mute` — тишина) и признак «серия кончилась». */
export function seriesKey(ui: SeriesUi, key: KeyInput, mute = false): { ui: SeriesUi; sounds: string[]; ended: boolean } {
  const out = seriesStep(ui.state, { type: 'key', ...key });
  const sounds: string[] = [];
  let shout: SeriesUi['shout'] = null; // новая клавиша гасит прошлый возглас
  for (const e of out.effects) {
    if (e.kind === 'kick' && e.side === 'me') shout = e.goal ? 'goal' : 'save';
    if (e.kind === 'sound') {
      const file = SFX[e.sound];
      if (file !== undefined && !mute) sounds.push(file);
    }
  }
  return { ui: { state: out.state, shout }, sounds, ended: seriesResult(out.state) !== null };
}

/** Исход серии для `finishCup`; серия не кончена — `null`. */
export const resultOf = (ui: SeriesUi): SeriesResult | null => seriesResult(ui.state);
