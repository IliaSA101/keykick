/**
 * Кадр стенда матча Кубка (068 Т6, К-Г): итог строит настоящий свисток `finishCup` по разделам фикстуры (до матча) и счёту кадра,
 * а не готовая картинка итога. Только стенд кадров: в игре итог приходит со свистка матча. Чистая функция, времени и случайности нет.
 */
import { anchorOf, finishCup, type CupSave, type RoundKey, type SeriesResult, type Shot } from '../../engine/cup';
import type { MatchResult } from '../../engine/match';
import type { Rhythm } from '../day/useResultDay';
import type { CourseLesson, Dictionary } from '../../engine/plan/lesson';
import { expectedHit, emptyStats } from '../../engine/typing/typing';
import type { FrameMatch } from '../match/frame';
import { beginSeries, seriesKey, type SeriesUi } from './seriesFlow';
import type { CupFinished } from './run';
import type { Run } from '../match/run';

/** Что кадр итога показывает сверх раздела: раунд и счёт матча (`cupFrame` фикстуры). */
export interface CupResultFrame {
  round: RoundKey;
  score: [number, number];
  /** Верных нажатий матча (кошелёк карточки); нет — 90. */
  correct?: number;
  /** Серия после ничьей: `w` — наша (✓ ✕ ✓ против ✓ ✕), `l` — проиграна (✕ ✓ ✕ против ✓ ✕ ✓); итог кадра строит свисток с этой серией. */
  series?: 'w' | 'l';
  /** Кадр наград (Э5.37, .38): окно формы сразу, без карточки итога; серебро и так идёт окном. */
  award?: boolean;
  /** День на кадре (068 Т8в): решение со свистка и открытый «Итог дня» — как у `ResultFrame` матча урока. */
  rhythm?: Rhythm;
  open?: 'summary';
}

const SHOTS: Record<'w' | 'l', { mine: Shot[]; theirs: Shot[] }> = {
  w: { mine: ['goal', 'miss', 'goal'], theirs: ['goal', 'miss'] },
  l: { mine: ['miss', 'goal', 'miss'], theirs: ['goal', 'miss', 'goal'] },
};

const stats = (correct: number) => ({ correct, errors: 0, keyErrors: {}, fingerErrors: {}, startedAt: 0, lastAt: 60000, intervals: Array.from({ length: correct }, () => 60000 / correct) });

/** Итог матча со счётом печатью `me:opp` и `correct` верными нажатиями — вход свистка. */
export function playedResult(me: number, opp: number, correct: number): MatchResult {
  return {
    verdict: me > opp ? 'win' : me < opp ? 'loss' : 'draw',
    score: { me, opp },
    total: { me, opp },
    penalty: { offered: false, scored: false },
    half1: { me, opp },
    half2: { me: 0, opp: 0 },
    extra: { me: 0, opp: 0 },
    replay: null,
    counted: me > opp,
    stats: stats(correct),
    play: stats(correct),
    presses: [],
  };
}

/** Итог кадра: свисток по сохранению фикстуры; раунд вне очереди (свисток ничего не записал) — `null`. */
export function cupFrameResult(save: CupSave, frame: CupResultFrame, now: number, day: string): CupFinished | null {
  const series: SeriesResult | null = frame.series === undefined ? null : { won: frame.series === 'w', ...SHOTS[frame.series], stats: emptyStats, presses: [] };
  const done = finishCup(save, playedResult(frame.score[0], frame.score[1], frame.correct ?? 90), series, { now, day, matchId: `frame-${frame.round}`, round: frame.round });
  return done.view === null ? null : { kind: 'cup', view: done.view, facts: done.facts, after: done.save.cup, saved: true };
}

/** Кадр матча Кубка: урок — якорь раунда; `intro` — до «Начать», `play` — идёт игра, `extra` — начало доп. времени, `attack` — атака 2-го тайма при 1:1 (Э5.23, .24, .29, .36). */
export function cupMatchFrame(f: { round: RoundKey; step?: string; shot?: 1 | 2 | 3 }, seed: number): FrameMatch {
  const series = f.step === 'series' && f.shot !== undefined ? { shot: f.shot } : undefined;
  const extra = f.step === 'extra' || series !== undefined; // серия идёт после доп. времени: фон — матч 1:1 на его начале
  return { lesson: anchorOf(f.round), seed, started: f.step !== 'intro', spec: { outcomes: '', toExtra: extra, toLead: f.step === 'play', ...(f.step === 'attack' ? { toHalf2: 2 } : {}) }, cup: series === undefined ? { round: f.round } : { round: f.round, series } };
}

/** Верная печать слова удара до `upTo` знаков (без `upTo` — слово целиком); `err` — перед этим одно неверное нажатие. */
function typeWord(ui: SeriesUi, t: { at: number }, upTo: number | null, err = false): SeriesUi {
  let cur = ui;
  const press = (code: string, key: string): void => void (cur = seriesKey(cur, { code, key, t: (t.at += 150) }).ui);
  if (err) press('', '§');
  for (;;) {
    const s = cur.state;
    if (s.phase !== 'run' || s.typing === null || (upTo !== null && s.typing.pos >= upTo)) return cur;
    const kick = s.kick;
    const hit = expectedHit(s.keymap, s.typing);
    press(hit?.key.code ?? '', s.typing.text[s.typing.pos] ?? '');
    const after = cur.state;
    if (after.phase !== 'run' || after.kick !== kick) return cur; // слово набрано
  }
}

/** Серия кадра (Э5.30–.33): состояние машины, доигранное настоящими нажатиями до нужного места. 1 — удар 1, два знака; 2 — после чистого первого, во втором ошибка и три знака; 3 — серия наша (✓ ✕ ✓). */
export function seriesFrameUi(shot: 1 | 2 | 3, run: Run, lesson: CourseLesson, dict: Dictionary): SeriesUi {
  const t = { at: 1000 };
  let ui = beginSeries(run, lesson, dict);
  if (shot === 1) return typeWord(ui, t, 2);
  ui = typeWord(ui, t, null);
  if (shot === 2) return { ...typeWord(ui, t, 3, true), shout: 'save' }; // ошибка уже есть: вратарь берёт мяч
  ui = typeWord(ui, t, null, true);
  return typeWord(ui, t, null);
}
