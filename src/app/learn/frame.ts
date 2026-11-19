/**
 * Кадр учебной игры для стенда (067 Т17, К-Г) и «безошибочный игрок» для тестов: ввод, который игра принимает без промаха,
 * берётся из состояния самой игры, а не из таблицы. Чистые функции, часы приходят снаружи.
 */
import { STEP, type ArrowsState, type Dir } from '../../engine/learn/games/arrows';
import type { Pt } from '../../engine/learn/games/common';
import { checkAnswer, correctInput, type AnswerInput, type TaskAnswer } from '../../engine/school/answers';
import type { LearnCtx } from '../../engine/learn/queue';
import type { LearnView } from '../../engine/learn/finish';
import { beginLearn, inputLearn, isFormsPlay, openLearn, type FormsPlay, type GameInput, type LearnFlow, type Place } from './run';
import { missOf, type Miss } from './view';

const key = (p: Pt): string => `${p.x},${p.y}`;
const DIRS = Object.keys(STEP) as Dir[];

/** Сторона шага стрелкой: `closer` — к воротам (верный шаг), иначе — не ближе (промах). */
function arrowDir(s: ArrowsState, closer: boolean): Dir | undefined {
  const here = s.dist[key(s.ball)] ?? Infinity;
  return DIRS.find((d) => ((s.dist[key({ x: s.ball.x + STEP[d].x, y: s.ball.y + STEP[d].y })] ?? Infinity) < here) === closer);
}

/** Следующий верный ввод; `null` — игра не идёт. */
export function bestInput(flow: LearnFlow): GameInput | null {
  const p = flow.play;
  if (flow.step !== 'play' || p === null) return null;
  if (p.game === 'arrows') {
    const dir = arrowDir(p.s, true);
    return dir === undefined ? null : { game: 'arrows', dir };
  }
  if (p.game === 'mouse') {
    const step = p.s.steps[p.s.at];
    return step === undefined ? null : { game: 'mouse', input: { type: step.kind === 'click' ? 'click' : 'drop', at: step.target } };
  }
  if (p.game === 'tab') {
    const s = p.s;
    const n = s.numbers.length;
    if (s.focus === s.target) return { game: 'tab', input: 'enter' };
    return { game: 'tab', input: (s.target - s.focus + n) % n <= (s.focus - s.target + n) % n ? 'tab' : 'shiftTab' };
  }
  if (isFormsPlay(p)) return formsInput(p, true);
  const letter = p.s.tray.find((l) => !p.s.placed.includes(l));
  return letter === undefined ? null : { game: 'keyboard', letter, socket: letter };
}

/** Неверные вводы раунда по виду ответа, по порядку (проверяет сам движок: `checkAnswer` скажет `wrong`): повторный промах берёт следующий, а не тот же. */
function wrongsOf(a: TaskAnswer): AnswerInput[] {
  const right = correctInput(a);
  const plus = (v: string, k: number): string => String(Number(v) + k);
  const tries: AnswerInput[] = [];
  if (a.kind === 'choice') a.options.forEach((_, k) => void (k !== a.correct && tries.push({ kind: 'choice', value: k })));
  if (a.kind === 'multi') a.options.forEach((_, k) => void (!a.correct.includes(k) && tries.push({ kind: 'multi', value: [k] })));
  if (a.kind === 'pictures') a.pictures.forEach((_, k) => void (!a.correct.includes(k) && tries.push({ kind: 'pictures', value: [k] })));
  for (const k of [1, 2, 3]) {
    if (right.kind === 'fields' || right.kind === 'expr') tries.push({ kind: right.kind, value: right.value.map((v) => plus(v, k)) });
    if (right.kind === 'fraction') tries.push({ kind: 'fraction', value: { ...right.value, num: plus(right.value.num, k) } });
    if (a.kind === 'select') {
      const sizes = a.row.flatMap((part) => (typeof part === 'string' ? [] : [part.length]));
      tries.push({ kind: 'select', value: a.correct.map((c, i) => (c + k) % (sizes[i] ?? 1)) });
    }
  }
  return tries.filter((t) => checkAnswer(a, t) === 'wrong');
}

/**
 * Следующий ввод игры 5–8 по состоянию игры: верный — ввод верного ответа, затем «Ответить» (у «Пар» — верная линия);
 * промах — заведомо неверный ввод и «Ответить» (у «Пар» — линия не туда). Ответ раунда берётся из самой задачи, не из таблицы.
 */
function formsInput(p: FormsPlay, good: boolean): GameInput | null {
  const s = p.s;
  const task = s.tasks[s.round];
  if (task === undefined) return null;
  const a = task.answer;
  if (a.kind === 'match') {
    const left = s.input.kind === 'match' ? s.input.value.findIndex((v) => v === null) : -1;
    if (left < 0) return null;
    const right = good ? a.pairs[left]! : a.right.findIndex((_, r) => r !== a.pairs[left]);
    return { game: p.game, action: { type: 'link', left, right } };
  }
  const want = good ? correctInput(a) : (wrongsOf(a).find((w) => JSON.stringify(w) !== s.rejected) ?? null);
  if (want === null) return null;
  const same = JSON.stringify(s.input) === JSON.stringify(want);
  return { game: p.game, action: same ? { type: 'submit' } : { type: 'set', input: want } };
}

/** Ввод, который игра засчитает промахом (по состоянию игры); `null` — игра не идёт. */
export function missInput(flow: LearnFlow): GameInput | null {
  const p = flow.play;
  if (flow.step !== 'play' || p === null) return null;
  if (p.game === 'arrows') {
    return { game: 'arrows', dir: arrowDir(p.s, false) ?? 'up' };
  }
  if (p.game === 'mouse') {
    const step = p.s.steps[p.s.at];
    const far = (v: number): number => (v < 50 ? 95 : 5);
    return { game: 'mouse', input: { type: step?.kind === 'click' ? 'click' : 'drop', at: { x: far(step?.target.x ?? 50), y: far(step?.target.y ?? 50) } } };
  }
  if (p.game === 'tab') return { game: 'tab', input: p.s.focus === p.s.target ? 'tab' : 'enter' };
  if (isFormsPlay(p)) return formsInput(p, false);
  const letter = p.s.tray.find((l) => !p.s.placed.includes(l)) ?? '';
  return { game: 'keyboard', letter, socket: flow.ctx.learned.find((c) => c !== letter) ?? '-' };
}

/** Играет безошибочно, пока `until` не скажет «хватит» или игра не кончится; `at` — часы каждого ввода. */
export function playUntil(flow: LearnFlow, at: number, until: (f: LearnFlow) => boolean = () => false): LearnFlow {
  let f = flow;
  for (let i = 0; i < 500 && f.step === 'play' && !until(f); i++) {
    const input = bestInput(f);
    if (input === null) break;
    f = inputLearn(f, input, at);
  }
  return f;
}

/** Что стенд ставит на экран: игра, место, шаг окна, промахи и время (на игре и итоге), готовый итог (на итоге). */
export interface LearnFrame {
  game: string;
  place: Place;
  step: 'start' | 'play' | 'end';
  misses?: number;
  elapsedMs?: number;
  view?: LearnView;
}

/** Где остановиться на кадре «игра»: примерно как на кадрах макета Э8 (поле 2 из 3, задание 7 из 8, пас 3 из 5, три буквы из лотка). */
const STOP: Record<string, (f: LearnFlow) => boolean> = {
  arrows: (f) => f.play?.game === 'arrows' && f.play.s.field >= 1 && f.play.s.ball.x >= 3,
  mouse: (f) => f.play?.game === 'mouse' && f.play.s.at >= 6,
  tab: (f) => f.play?.game === 'tab' && f.play.s.passes >= 2,
  keyboard: (f) => f.play?.game === 'keyboard' && f.play.s.placed.length >= 2,
  squad: (f) => f.play !== null && isFormsPlay(f.play) && f.play.s.round >= 2,
  board: (f) => f.play !== null && isFormsPlay(f.play) && f.play.s.round >= 1,
  roster: (f) => f.play !== null && isFormsPlay(f.play) && f.play.s.round >= 2,
  pairs: (f) => f.play !== null && isFormsPlay(f.play) && f.play.s.input.kind === 'match' && f.play.s.input.value.filter((v) => v !== null).length >= 3,
};

/** Окно в нужном состоянии из настоящих правил: безошибочная игра до нужного места, затем промахи, затем — на итоге — конец. `miss` — последний промах для красной полосы. */
export function frameFlow(spec: LearnFrame, ctx: LearnCtx, seed: number, now: number, aspect: number): { flow: LearnFlow; miss: Miss | null } | null {
  const opened = openLearn(spec.game, spec.place, ctx, seed);
  if (opened === null) return null;
  if (spec.step === 'start') return { flow: opened, miss: null };
  const started = beginLearn(opened, now - (spec.elapsedMs ?? 0), aspect);
  let flow = spec.step === 'play' ? playUntil(started, now, STOP[spec.game]) : started;
  let miss: Miss | null = null;
  for (let i = 0; i < (spec.misses ?? 0); i++) {
    // промах игр 5–8 — два ввода (неверный ответ и «Ответить»): пробуем, пока счётчик не вырастет
    const was = flow.play?.s.misses ?? 0;
    for (let k = 0; k < 4 && flow.play !== null && flow.play.s.misses === was; k++) {
      const input = missInput(flow);
      if (input === null) break;
      const next = inputLearn(flow, input, now);
      miss = missOf(flow.play, next.play ?? flow.play, input) ?? miss;
      flow = next;
    }
  }
  if (spec.step === 'end') {
    flow = playUntil(flow, now);
    return { flow: { ...flow, ...(spec.view ? { view: spec.view, saved: true } : {}) }, miss: null };
  }
  return { flow, miss };
}
