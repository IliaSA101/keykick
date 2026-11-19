/**
 * Сеанс учебной игры на экране (067 Т17, К-Г): старт · игра · итог. Часы и семя приходят снаружи, движок (`engine/learn`) чистый.
 * Запись — одна: `commitLearn` после конца игры; повтор (двойной Enter, F5 на итоге) — `finishLearn` отдаёт `view: null`,
 * второй записи нет (`ref = runId` кассы). Игра, брошенная посреди (Esc, перезагрузка), ничего не пишет: монеты и ступень не засчитаны.
 */
import { speedsOf, type JournalEntry } from '../../engine/journal';
import { GAMES, isBuildable, isOpen, type LearnCtx } from '../../engine/learn/queue';
import { finishLearn, learnPatch, type LearnSave, type LearnView } from '../../engine/learn/finish';
import { actForms, isFormsGame, startForms, type FormsAction, type FormsGame, type FormsState } from '../../engine/learn/forms';
import { moveArrows, startArrows, type ArrowsState, type Dir } from '../../engine/learn/games/arrows';
import { settle } from '../../engine/learn/games/common';
import { inputMouse, startMouse, type MouseInput, type MouseState } from '../../engine/learn/games/mouse';
import { placeLetter, startPuzzle, type PuzzleState } from '../../engine/learn/games/puzzle';
import { inputTab, startTab, type TabInput, type TabState } from '../../engine/learn/games/tab';
import { startLearn, type LearnRun, type Moment } from '../../engine/learn/steps';
import { REPEAT_KIND } from '../../engine/school/order';
import type { School } from '../../engine/school/section';

/** Игры, что играются в окне: 1–4 (Т17) и 5–8 — виды ответа «Школы» (Т18, `engine/learn/forms`). */
export const PLAYABLE: readonly string[] = ['arrows', 'mouse', 'tab', 'keyboard', 'squad', 'board', 'roster', 'pairs'];

export type Place = 'break' | 'base';

export type PlayState =
  | { game: 'arrows'; s: ArrowsState }
  | { game: 'mouse'; s: MouseState }
  | { game: 'tab'; s: TabState }
  | { game: 'keyboard'; s: PuzzleState }
  | { game: FormsGame; s: FormsState };

export type GameInput =
  | { game: 'arrows'; dir: Dir }
  | { game: 'mouse'; input: MouseInput }
  | { game: 'tab'; input: TabInput }
  | { game: 'keyboard'; letter: string; socket: string }
  | { game: FormsGame; action: FormsAction };

/** Игра 5–8 и её ввод (одна ветка вместо четырёх: у всех один движок `forms`). */
export type FormsPlay = Extract<PlayState, { s: FormsState }>;
export type FormsInput = Extract<GameInput, { action: FormsAction }>;
export const isFormsPlay = (p: PlayState): p is FormsPlay => isFormsGame(p.game);
export const isFormsInput = (i: GameInput): i is FormsInput => isFormsGame(i.game);

export interface LearnFlow {
  place: Place;
  game: string;
  seed: number;
  ctx: LearnCtx;
  step: 'start' | 'play' | 'end';
  run: LearnRun | null;
  play: PlayState | null;
  /** Итог после записи; `null` — ещё не записан (или запись уже была — повтор). */
  view: LearnView | null;
  /** Запись легла в сохранение (`false` — сеанс только читает или места нет: итог показан, догонит следующая запись). */
  saved: boolean;
}

/** Что нужно знать о ребёнке для очереди и ставки: всё приходит снаружи (разделы, журнал, пакет). */
export interface CtxFacts {
  /** Урок, на котором ребёнок сейчас (перерыв — урок матча): от него зависит, какие игры открыты (067-Р89). */
  lesson: number;
  /** Буквы, выученные к этому уроку (поле `keys` урока пакета). */
  keys: string;
  school: Pick<School, 'tours'>;
  /** Записи журнала матчей — источник скоростей. */
  entries: readonly JournalEntry[];
  /** Лучшие скорости пройденных уроков (старые первыми): запасной источник, пока в журнале нет скоростей (матчи записаны до Т17; 067-Р90). */
  bests?: readonly number[];
  now: number;
  day: string;
}

export function learnCtxOf(f: CtxFacts): LearnCtx {
  const journal = speedsOf(f.entries);
  const speeds = journal.length > 0 ? journal : (f.bests ?? []).filter((b) => b > 0);
  // Тур, до которого ребёнок дошёл (067-Р211): последний пройденный + 1; тренажёр на карточке тура N открыт (Р70).
  const tour = f.school.tours.reduce((m, t) => (t.kind === REPEAT_KIND ? m : Math.max(m, t.n)), 0) + 1;
  const learned = [...new Set([...f.keys.toLowerCase()].filter((c) => /\p{L}/u.test(c)))];
  return { now: f.now, day: f.day, lesson: f.lesson, tour, speeds, learned };
}

/**
 * Открыть окно игры (старт). `null` — игры нет, она не открыта или не собирается (нет выученных букв, «Пары» без пальцев):
 * экран не падает, игра не предлагается.
 */
export function openLearn(game: string, place: Place, ctx: LearnCtx, seed: number): LearnFlow | null {
  const def = GAMES.find((g) => g.id === game);
  if (def === undefined || !PLAYABLE.includes(game) || !isOpen(def, ctx) || !isBuildable(def, ctx)) return null;
  if (game === 'keyboard' && startPuzzle(ctx.learned, seed) === null) return null;
  if (isFormsGame(game) && startForms(game, ctx.learned, seed) === null) return null;
  return { place, game, seed, ctx, step: 'start', run: null, play: null, view: null, saved: false };
}

/** Состояние арены для показа: на старте — первое поле игры (кадр Э8: арена видна до «Играть»); `beginLearn` берёт его же. */
export function playOf(flow: LearnFlow, aspect: number): PlayState | null {
  if (flow.game === 'arrows') return { game: 'arrows', s: startArrows(flow.seed) };
  if (flow.game === 'mouse') return { game: 'mouse', s: startMouse(flow.seed, aspect) };
  if (flow.game === 'tab') return { game: 'tab', s: startTab(flow.seed) };
  if (isFormsGame(flow.game)) {
    const forms = startForms(flow.game, flow.ctx.learned, flow.seed);
    return forms === null ? null : { game: flow.game, s: forms };
  }
  const tray = startPuzzle(flow.ctx.learned, flow.seed);
  return flow.game === 'keyboard' && tray !== null ? { game: 'keyboard', s: tray } : null;
}

/** «Играть»: часы запуска и (у мыши) соотношение сторон арены передаёт экран. Не со старта — без изменений. */
export function beginLearn(flow: LearnFlow, now: number, aspect = 0.57): LearnFlow {
  if (flow.step !== 'start') return flow;
  const play = playOf(flow, aspect);
  return play === null ? flow : { ...flow, step: 'play', run: startLearn(flow.game, { now }, flow.seed), play };
}

/** Промахов в игре сейчас. */
export const missesOf = (flow: LearnFlow): number => flow.play?.s.misses ?? 0;

function apply(p: PlayState, input: GameInput): PlayState {
  if (p.game === 'arrows' && input.game === 'arrows') return { game: 'arrows', s: moveArrows(p.s, input.dir) };
  if (p.game === 'mouse' && input.game === 'mouse') return { game: 'mouse', s: inputMouse(p.s, input.input) };
  if (p.game === 'tab' && input.game === 'tab') return { game: 'tab', s: inputTab(p.s, input.input) };
  if (p.game === 'keyboard' && input.game === 'keyboard') return { game: 'keyboard', s: placeLetter(p.s, input.letter, input.socket) };
  if (isFormsPlay(p) && isFormsInput(input) && p.game === input.game) return { game: p.game, s: actForms(p.s, input.action) };
  return p;
}

/** Ввод в игру. Конец игры фиксирует время (`settle`) и переводит окно на итог; запись — отдельно, `commitLearn`. Ввод не в свою игру или вне игры — без изменений. */
export function inputLearn(flow: LearnFlow, input: GameInput, at: number): LearnFlow {
  const p = flow.play;
  if (flow.step !== 'play' || p === null || flow.run === null || p.game !== input.game) return flow;
  const play = apply(p, input);
  return { ...flow, play, run: settle(flow.run, play.s, at), step: play.s.done ? 'end' : 'play' };
}

export interface CommitDeps {
  /** Разделы игрока сейчас. */
  read(): LearnSave;
  /** `session.save`; не `ok` — игра не падает, итог показан (063-Р31). */
  save(patch: Record<string, unknown>): { ok: boolean };
}

/**
 * Запись итога: один раз. Не на итоге, нет времени или итог уже записан (повтор того же запуска) — без записи и без изменений.
 * Место (`break`/`base`) решает, показывать ли карточку «Права» (ТЗ-7.6).
 */
export function commitLearn(flow: LearnFlow, deps: CommitDeps): LearnFlow {
  if (flow.step !== 'end' || flow.run === null || flow.run.ms === null || flow.view !== null) return flow;
  const moment: Moment = flow.place === 'base' ? 'base' : 'break';
  const done = finishLearn(deps.read(), flow.run, flow.ctx, moment);
  if (done.view === null) return flow;
  return { ...flow, view: done.view, saved: deps.save(learnPatch(done.save)).ok };
}
