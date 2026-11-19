/**
 * Игры 5–8 (057, ТЗ-7.7; 067 design §8): «Отбор» (squad), «Табло» (board), «Заявка» (roster), «Пары» (pairs) —
 * футбольные задачи видов ответа «Школы» (`formsTasks`: игроки, номера, позиции, формы, счёт, пальцы); новых видов нет.
 * Раунды и виды — `learn.json` (`play.forms`). Промах — неверный «Ответить» (у «Пар» — неверная линия); игра идёт дальше
 * (057-Р4): раунд закрывает только верный ответ. Щелчок мышью вместо Tab — не промах (057 «Состояния и края»).
 */
import { createRandom } from '../random';
import { checkAnswer, emptyInput, type AnswerInput } from '../school/answers';
import { buildFormsTasks, formsBuildable, FORMS_GAMES, type FormsGame, type FormsTask } from './formsTasks';
import type { Playing } from './games/common';

export { FORMS_GAMES, formsBuildable, type FormsGame, type FormsTask };

export interface FormsState extends Playing {
  game: FormsGame;
  /** Задача каждого раунда. */
  tasks: readonly FormsTask[];
  round: number;
  /** Что введено в раунде сейчас. */
  input: AnswerInput;
  /** Неверный ввод или линия, за которые промах уже записан: тот же ввод ещё раз («Ответить» дважды, двойной щелчок) промахом не считается. */
  rejected: string | null;
}

export type FormsAction = { type: 'set'; input: AnswerInput } | { type: 'submit' } | { type: 'link'; left: number; right: number };

export const isFormsGame = (id: string): id is FormsGame => (FORMS_GAMES as readonly string[]).includes(id);

/**
 * Игра по зерну: задачи всех раундов. `learned` — выученные буквы игрока (нужны раунду «палец ↔ клавиши»).
 * Собрать нечем (`formsBuildable`) — `null`: игра не стартует, исключения нет.
 */
export function startForms(game: FormsGame, learned: readonly string[], seed: number): FormsState | null {
  if (!formsBuildable(game, learned)) return null;
  const tasks = buildFormsTasks(game, learned, createRandom(seed));
  return { game, tasks, round: 0, ...opening(tasks[0]!, seed), misses: 0, done: false };
}

/** Ввод и «уже записанный промах» в начале раунда: у раунда с `start` поля заполнены неверно, и «Ответить» без правки — не новый промах. */
function opening(task: FormsTask, seed: number): Pick<FormsState, 'input' | 'rejected'> {
  return { input: task.start ?? emptyInput(task.answer, createRandom(seed)), rejected: task.start === null ? null : JSON.stringify(task.start) };
}

function nextRound(s: FormsState): FormsState {
  const round = s.round + 1;
  const task = s.tasks[round];
  if (task === undefined) return { ...s, round, done: true, rejected: null };
  return { ...s, round, ...opening(task, round) };
}

/** Промах за ввод `was`; тот же ввод подряд — один промах. */
function miss(s: FormsState, was: string): FormsState {
  return s.rejected === was ? s : { ...s, misses: s.misses + 1, rejected: was };
}

export function actForms(s: FormsState, action: FormsAction): FormsState {
  const task = s.tasks[s.round];
  if (s.done || task === undefined) return s;
  if (action.type === 'set') return action.input.kind === task.answer.kind ? { ...s, input: action.input } : s;
  if (action.type === 'link') {
    // «Пары»: линия проверяется сразу; верная остаётся, неверная — промах (двойной щелчок по ней — один)
    if (task.answer.kind !== 'match' || s.input.kind !== 'match') return s;
    const { left, right } = action;
    if (s.input.value[left] !== null) return s;
    if (task.answer.pairs[left] !== right) return miss(s, `link:${left}:${right}`);
    const value = s.input.value.map((v, i) => (i === left ? right : v));
    const next = { ...s, input: { kind: 'match' as const, value }, rejected: null };
    // замыкающая линия: двойной щелчок по ней уже в следующем раунде — не промах
    return value.every((v) => v !== null) ? { ...nextRound(next), rejected: `link:${left}:${right}` } : next;
  }
  const verdict = checkAnswer(task.answer, s.input);
  if (verdict === 'correct') return nextRound(s);
  return verdict === 'wrong' ? miss(s, JSON.stringify(s.input)) : s;
}
