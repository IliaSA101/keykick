/**
 * Состояние кадров «Школы» для стенда (067 Т14, `kk-school-stand`): журнал — строка под мышью (Э3.11); тур — на каком шаге открыт
 * кадр и сколько задач уже сдано. В игре поставщика нет, экраны работают как обычно. Чистые функции: часов и случайности нет.
 */
import { correctInput, type AnswerInput } from '../../engine/school/answers';
import type { Task } from '../../engine/school/tasks';
import type { Tour } from '../../engine/school/tour';
import { openRun, type TourRun } from './tour';

/** Кадр тура: `firsts` — исходы уже сданных задач (верно с первой попытки), `size` — сколько задач в туре кадра (макет: 5, «тест» — 30). */
export interface TourFrame {
  stage: 'ask' | 'etalon' | 'result';
  firsts: boolean[];
  size?: number;
  /** Условие текущей задачи — самое длинное из банка (Э3.41, прокрутка). */
  long?: boolean;
  /** Карточка тренажёра (Э3.18): тур открыт на шаге `trainer`, если план даёт тренажёр (вид с игрой, не взятый). */
  trainer?: boolean;
}

export interface SchoolStand {
  /** Журнал: номер тура, над строкой которого стоит карточка (Э3.11). */
  hover?: number;
  tour?: TourFrame;
  /** Праздник эмблемы открыт сразу (Э3.24): итог тура уже пройден. */
  fest?: boolean;
}

/** Задачи кадра: те же, что выбрал `tourPlan`, добранные до `size` другими задачами банка (по кругу), без повторов подряд. */
export function padTasks(have: readonly Task[], bank: readonly Task[], size: number): Task[] {
  const ids = new Set(have.map((t) => t.id));
  const more = bank.filter((t) => t.verified && !ids.has(t.id));
  const out = have.slice(0, size);
  for (let k = 0; out.length < size && more.length > 0; k++) out.push(more[k % more.length] as Task);
  return out;
}

/** Ответ «не тот», заведомо не равный эталону: число и поле — на единицу больше, дробь — числитель, слово — с лишним знаком, остальное — пусто. Только чтобы кадр было что сравнить с эталоном. */
export function wrongSample(task: Task): AnswerInput {
  const good = correctInput(task.answer);
  const bump = (v: string): string => String(Number(v) + 1);
  switch (good.kind) {
    case 'integer': return { kind: 'integer', value: bump(good.value) };
    case 'expr': return { kind: 'expr', value: good.value.map((v, i) => (i === good.value.length - 1 ? bump(v) : v)) };
    case 'fields': return { kind: 'fields', value: good.value.map((v, i) => (i === 0 ? bump(v) : v)) };
    case 'fraction': return { kind: 'fraction', value: { ...good.value, num: bump(good.value.num) } };
    case 'text': return { kind: 'text', value: `${good.value}?` };
    case 'choice': return { kind: 'choice', value: good.value === 0 ? 1 : 0 };
    case 'multi': return { kind: 'multi', value: [] };
    case 'pictures': return { kind: 'pictures', value: [] };
    case 'order': return { kind: 'order', value: [...good.value].reverse() };
    case 'select': return { kind: 'select', value: good.value.map(() => null) };
    case 'match': return { kind: 'match', value: good.value.map(() => null) };
  }
}

/** Тур кадра из плана: задачи добраны, ход — по `firsts`, тренажёра нет. */
export function frameRun(plan: Tour, frame: TourFrame, bank: readonly Task[]): TourRun {
  const size = frame.size ?? plan.tasks.length;
  let tasks = padTasks(plan.tasks, bank, size);
  const i = Math.min(frame.firsts.length, size);
  if (frame.long === true && i < size) {
    const longest = [...bank].filter((t) => t.verified).sort((a, b) => b.text.length - a.text.length)[0];
    if (longest !== undefined) tasks = tasks.map((t, k) => (k === i ? longest : t));
  }
  const tour: Tour = { ...plan, tasks, trainer: frame.trainer === true ? plan.trainer : null, i, firsts: frame.firsts.slice(0, i) };
  const run = openRun(tour);
  if (frame.stage === 'result') return { ...run, stage: 'result', input: { kind: 'integer', value: '' } };
  const missed = tasks[i - 1];
  if (frame.stage === 'etalon' && missed !== undefined) {
    return { ...run, stage: 'etalon', missed: { task: missed, mine: wrongSample(missed), etalon: { input: correctInput(missed.answer), solution: missed.solution } } };
  }
  return run;
}
