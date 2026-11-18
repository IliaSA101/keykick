/**
 * Ход пенальти на листе задачи (065 Т10б, ТЗ-2.7): открыть лист → ответить или «Не бить» → вердикт → дальше.
 * Чистые функции, без часов и случайности (расстановка «по порядку» — по зерну id задачи): так «двойной Enter не шлёт два ответа»
 * проверяется тестом, а не глазом. Движку уходит только `PenaltyAnswer`: верно — `hit`, неверно — `miss`, «Не бить» — `skip`.
 * Не принятый ответ (пусто, не всё заполнено, не тот формат) попытку не тратит — лист остаётся открытым с подсказкой.
 */
import { checkAnswer, emptyInput, seedFromText, type AnswerInput } from '../../engine/school/answers';
import { createRandom } from '../../engine/random';
import type { Task } from '../../engine/school/tasks';
import type { PenaltyAnswer } from '../../engine/match';

export type PenaltyHint = 'empty' | 'incomplete' | 'format';

export interface PenaltyFlow {
  task: Task;
  input: AnswerInput;
  /** `ask` — лист ждёт ответа; `done` — ответ дан, показан вердикт, матч стоит до «играем дальше». */
  stage: 'ask' | 'done';
  /** Ответ, ушедший движку; пока лист в `ask` — null. */
  answer: PenaltyAnswer | null;
  /** Почему последний ответ не принят. */
  hint: PenaltyHint | null;
}

/** Открыть лист: пустое поле под вид ответа, расстановка — по id задачи (одна и та же при повторном открытии). */
export function openPenalty(task: Task): PenaltyFlow {
  return { task, input: emptyInput(task.answer, createRandom(seedFromText(task.id))), stage: 'ask', answer: null, hint: null };
}

/** Ввод ребёнка меняет поле; после ответа лист не меняется. */
export function typeInto(flow: PenaltyFlow, input: AnswerInput): PenaltyFlow {
  return flow.stage === 'ask' ? { ...flow, input, hint: null } : flow;
}

/**
 * «Ответить»: верно — `hit`, неверно — `miss`; не принятый ответ — подсказка, без ответа движку. Повторный вызов
 * после ответа (двойной Enter, двойной клик) ничего не делает: `sent` — null.
 */
export function submitPenalty(flow: PenaltyFlow): { flow: PenaltyFlow; sent: PenaltyAnswer | null } {
  if (flow.stage !== 'ask') return { flow, sent: null };
  const verdict = checkAnswer(flow.task.answer, flow.input);
  if (verdict === 'correct' || verdict === 'wrong') {
    const sent: PenaltyAnswer = verdict === 'correct' ? 'hit' : 'miss';
    return { flow: { ...flow, stage: 'done', answer: sent, hint: null }, sent };
  }
  return { flow: { ...flow, hint: verdict }, sent: null };
}

/** «Не бить» (Esc): без штрафа (М2). После ответа — холостое действие. */
export function skipPenalty(flow: PenaltyFlow): { flow: PenaltyFlow; sent: PenaltyAnswer | null } {
  if (flow.stage !== 'ask') return { flow, sent: null };
  return { flow: { ...flow, stage: 'done', answer: 'skip', hint: null }, sent: 'skip' };
}
