/**
 * Сеанс тура «Школы» (067 Т14, К-В): шаги экрана тура — чистые функции без Vue, часов и случайности (зерно расстановки — по id
 * задачи, как у пенальти). Движок решает, верно ли (`step`); здесь — что видит ребёнок: пустое поле на каждую задачу, подсказка
 * «ответ не принят», эталон, итог, «Реванш». Любой вызов не в свой шаг (двойной Enter) ничего не меняет.
 */
import { createRandom } from '../../engine/random';
import type { Purse } from '../../engine/rewards/cash';
import type { Stadium } from '../../engine/home/section';
import type { Wallet } from '../../engine/rewards/section';
import { correctInput, emptyInput, seedFromText, type AnswerInput } from '../../engine/school/answers';
import { finishTour, type TourView } from '../../engine/school/finish';
import { lineOf } from '../../engine/school/level';
import { REPEAT_KIND, trainerGame } from '../../engine/school/order';
import type { School, Tour as TourEntry } from '../../engine/school/section';
import type { Task } from '../../engine/school/tasks';
import { isFinished, revanche, step, type Etalon, type Tour } from '../../engine/school/tour';

export type Hint = 'empty' | 'incomplete' | 'format';
/** `trainer` — карточка тренажёра перед туром (её рисует Т16), `etalon` — промах: твой и эталонный ответ, `fix` — «Реванш». */
export type Stage = 'trainer' | 'ask' | 'etalon' | 'result' | 'fix';

export interface Missed {
  task: Task;
  mine: AnswerInput;
  etalon: Etalon;
}

export interface TourRun {
  tour: Tour;
  stage: Stage;
  /** Ввод на текущей задаче (на `fix` — на задаче `fixIdx`). */
  input: AnswerInput;
  hint: Hint | null;
  /** Последний промах: что ответил ребёнок и эталон (стадия `etalon`). */
  missed: Missed | null;
  /** Итог тура; пока тур идёт — null. */
  view: TourView | null;
  fixIdx: number | null;
  /** Итог последнего «Реванша» (верно или нет) — чтобы итог показал «ещё раз» или «разобрано»; до первого — null. */
  last: 'ok' | 'bad' | null;
  /** «Реванш» открыт из журнала (задачи — по `miss` записи, итога тура нет): после него — снова журнал. */
  journal: boolean;
}

/** Пустое поле под задачу; задачи нет (тур кончился) — пустое число. */
export const blankFor = (task: Task | undefined): AnswerInput => (task === undefined ? { kind: 'integer', value: '' } : emptyInput(task.answer, createRandom(seedFromText(task.id))));

/** Реплика тренера у задачи (ТЗ-6.9, 025-Р10; 067-Р199): текст `task.hint` — только когда движок разрешил (`Tour.hint`: первые задачи вида, не повтор, не пересдача). */
export function coachHint(run: TourRun): string | null {
  if (!run.tour.hint) return null;
  const task = run.stage === 'etalon' ? run.missed?.task : run.tour.tasks[run.stage === 'fix' ? (run.fixIdx ?? 0) : run.tour.i];
  return task?.hint ?? null;
}

export function openRun(tour: Tour): TourRun {
  return { tour, stage: tour.trainer === null ? 'ask' : 'trainer', input: blankFor(tour.tasks[0]), hint: null, missed: null, view: null, fixIdx: null, last: null, journal: false };
}

/** Ввод ребёнка; вне `ask` и `fix` ничего не меняет. */
export const typeInto = (run: TourRun, input: AnswerInput): TourRun => (run.stage === 'ask' || run.stage === 'fix' ? { ...run, input, hint: null } : run);

/** Куда идёт тур после задачи: следующая или итог. Ввод сбрасывается — в следующую задачу ничего не тянется. */
function forward(run: TourRun, tour: Tour): TourRun {
  return isFinished(tour)
    ? { ...run, tour, stage: 'result', input: blankFor(undefined), hint: null, missed: null }
    : { ...run, tour, stage: 'ask', input: blankFor(tour.tasks[tour.i]), hint: null, missed: null };
}

/**
 * «Ответить». Верно — сразу дальше; неверно — эталон; неверный формат, пусто, не всё заполнено — попытка не списана, подсказка
 * (ТЗ-6.13). Не на своём шаге (двойной Enter после ответа) — то же состояние.
 */
export function submitRun(run: TourRun): TourRun {
  if (run.stage !== 'ask') return run;
  const task = run.tour.tasks[run.tour.i];
  const out = step(run.tour, run.input);
  if (task === undefined || out.verdict === 'over') return run;
  if (out.verdict === 'correct') return forward(run, out.tour);
  if (out.verdict === 'wrong' && out.etalon !== undefined) return { ...run, tour: out.tour, stage: 'etalon', hint: null, missed: { task, mine: run.input, etalon: out.etalon } };
  return { ...run, hint: out.verdict as Hint };
}

/** «Дальше» после эталона. «Реванш» из журнала (Р95): эталон был последним шагом — назад в журнал (`stage` `result`, `journal`). */
export function nextRun(run: TourRun): TourRun {
  if (run.stage !== 'etalon') return run;
  return run.journal ? { ...run, stage: 'result', fixIdx: null, missed: null, input: blankFor(undefined) } : forward(run, run.tour);
}

/** Пересдать можно только тур нумерации, который уже есть в журнале (повтор и ненаписанная запись — нельзя). */
export const canRetake = (school: School, tour: Tour): boolean => !tour.repeat && school.tours.some((t) => t.n === tour.n && t.kind !== REPEAT_KIND);

/** Итог тура: запись через `finishTour` один раз (метка тура `sid` держит и повторный вызов); `view` уже есть — ничего. */
export function finishRun(run: TourRun, purse: Purse, day: string): { run: TourRun; purse: Purse } {
  if (run.stage !== 'result' || run.view !== null || run.journal) return { run, purse }; // «Реванш» из журнала тура не пишет
  const out = finishTour(purse, run.tour, { day });
  return { run: { ...run, view: out.view }, purse: out.save };
}

/**
 * Итог тура для экрана: экран кассу не трогает (страж С1), поэтому сборка кошелька и вызов `finishRun` — здесь. Возвращает раздел
 * `school` для записи (кошелёк тур не меняет: монет нет, Ш-З2) или null, если итог уже был.
 */
export function settleRun(run: TourRun, sections: { wallet: Wallet; school: School; stadium: Stadium }, day: string): { run: TourRun; school: School | null } {
  const out = finishRun(run, sections, day);
  return { run: out.run, school: out.run === run ? null : out.purse.school };
}

/** Первая промахнутая и ещё не разобранная задача — её берёт «Реванш»; нет — null. */
export const nextFix = (tour: Tour): number | null => {
  const i = tour.tasks.findIndex((t, k) => tour.firsts[k] === false && !tour.fixed.includes(t.id));
  return i < 0 ? null : i;
};

export function startFix(run: TourRun): TourRun {
  const idx = nextFix(run.tour);
  if (run.stage !== 'result' || run.view === null || idx === null) return run;
  return { ...run, stage: 'fix', fixIdx: idx, input: blankFor(run.tour.tasks[idx]), hint: null };
}

/**
 * «Реванш» из журнала (067-Р88): задачи — по id неразобранных промахов записи, ищем в банке. Тура нет: ни медали, ни записи,
 * ни монет; тур склеен только для шагов «Реванша». Id нет в банке (задачу сняли) или `miss` пуст — null.
 */
export function journalFixRun(entry: TourEntry, bank: readonly Task[]): TourRun | null {
  const tasks = (entry.miss ?? []).flatMap((id) => bank.find((t) => t.id === id) ?? []);
  const first = tasks[0];
  if (first === undefined) return null;
  const tour: Tour = {
    n: entry.n, kind: entry.kind, repeat: false, waiting: null, trainer: null, hint: false, retake: false, cap: null,
    sid: entry.sid ?? 0, line: lineOf(first), tasks, i: tasks.length, firsts: tasks.map(() => false), fixed: [],
  };
  return { tour, stage: 'fix', input: blankFor(first), hint: null, missed: null, view: null, fixIdx: 0, last: null, journal: true };
}

/** Запись журнала без разобранной задачи: по номеру тура `n` (у пересдачи старый `sid`); у повтора `miss` нет. */
const withoutMiss = (school: School, run: TourRun, id: string): School => ({
  ...school,
  tours: school.tours.map((t) => (!run.tour.repeat && t.n === run.tour.n && t.kind !== REPEAT_KIND && t.miss !== undefined ? { ...t, miss: t.miss.filter((m) => m !== id) } : t)),
});

/**
 * «Ответить» в «Реванше»: верно — «разобрано» (задача в `school.solved`, её id уходит из `miss` записи тура); медаль не трогаем;
 * неверно — назад к итогу, можно взять ещё раз; формат — подсказка. Из журнала (Р95): верно — следующий промах или конец
 * (`stage` `result`); неверно — эталон (`etalon`), затем назад в журнал, id остаётся в `miss`.
 */
export function submitFix(run: TourRun, school: School): { run: TourRun; school: School } {
  if (run.stage !== 'fix' || run.fixIdx === null) return { run, school };
  const out = revanche(school, run.tour, run.fixIdx, run.input);
  if (out.verdict !== 'correct' && out.verdict !== 'wrong') return { run: { ...run, hint: out.verdict as Hint }, school };
  const ok = out.verdict === 'correct';
  const id = (run.tour.tasks[run.fixIdx] as Task).id;
  if (!ok && run.journal) {
    const task = run.tour.tasks[run.fixIdx] as Task;
    const missed: Missed = { task, mine: run.input, etalon: { input: correctInput(task.answer), solution: task.solution } };
    return { run: { ...run, tour: out.tour, stage: 'etalon', last: 'bad', hint: null, missed, input: blankFor(undefined) }, school: out.school };
  }
  const next = ok && run.journal ? nextFix(out.tour) : null;
  const base: TourRun = { ...run, tour: out.tour, last: ok ? 'ok' : 'bad', hint: null };
  const moved: TourRun = next === null
    ? { ...base, stage: 'result', fixIdx: null, input: blankFor(undefined) }
    : { ...base, stage: 'fix', fixIdx: next, input: blankFor(out.tour.tasks[next]) };
  return { run: moved, school: ok ? withoutMiss(out.school, run, id) : out.school };
}

/**
 * Адрес игры-тренажёра вида для кнопки «Тренажёр» на карточке тура (Э3.18, 067-Р116, Р202): учебная игра 5–8 — окно над Базой,
 * `/base?play=<игра>` (067-Р171, как «Играть» на Базе). Игры у вида нет — null.
 */
export const trainerPath = (kind: string): string | null => {
  const game = trainerGame(kind);
  return game === null ? null : `/base?play=${game}`;
};
