/**
 * Тур «Школы» (ТЗ-6.1–6.9, 067 К-В): план тура, шаг ответа, реванш. Чистые функции: зерно приходит снаружи, часов нет.
 * Монеты — 0 (ТЗ-6.6); «Знаток», медаль и часть эмблемы пишет `finish.ts`.
 * Перезагрузка посреди тура — тур заново, медаль не записана (design §6): состояние тура в сохранение не попадает.
 */
import cfg from '../../content/school.json';
import { createRandom, shuffle } from '../random';
import { checkAnswer, correctInput, type AnswerInput, type CheckResult } from './answers';
import { DEFAULT_LINE, gradeOk, levelOf, lettersOk, lineOf } from './level';
import { KINDS, REPEAT_KIND, kindOf, kindsBefore, lastNumbered, waitingKind, type KindDef } from './order';
import { SOLVED_MAX, type School } from './section';
import type { Task } from './tasks';

export interface Tour {
  /** Номер тура (у повтора и тура «прежних видов» — номер, который ждёт); у «штрафных» 0. */
  n: number;
  /** Вид тура для журнала и эмблемы: `number`…`mixed`; у повтора — `repeat`; у «штрафных» — `kicks`. */
  kind: string;
  /** Тур-повтор или тур прежних видов, пока тренажёр нового вида пропущен: вне нумерации, без части эмблемы (А7-Р9). */
  repeat: boolean;
  /** Новый вид, который ждёт тренажёр (тур идёт из прежних видов), иначе null. */
  waiting: string | null;
  /** Карточка тренажёра перед туром (вид), иначе null; «Пропустить» — `skipTrainer`. */
  trainer: string | null;
  /** Первые задачи вида — с подсказкой (ТЗ-6.9, 025-Р10). */
  hint: boolean;
  /** Пересдача тура с тем номером (ТЗ-6.5): медаль записи только растёт. */
  retake: boolean;
  /** Потолок медали: все задачи уже решены раньше — не выше уже взятой по виду (ТЗ-6.5); null — без потолка. */
  cap: number | null;
  /** Метка тура (семя, номер, повтор, пересдача): двойной итог того же тура запись не дописывает. */
  sid: number;
  /** Линия темы тура (по первой задаче). */
  line: string;
  tasks: readonly Task[];
  /** Сколько задач пройдено (ответ или промах с эталоном). Равно длине — тур кончился. */
  i: number;
  /** По пройденным: верно с первой попытки. */
  firsts: readonly boolean[];
  /** Промахнутые задачи, разобранные в «Реванше» (id). */
  fixed: readonly string[];
}

export interface TourOpts {
  /** Пересдать тур с этим номером. */
  retake?: number;
  /** Тур-повтор по пройденным видам (`repeatDue`). */
  repeat?: boolean;
  /** Виды, чей тренажёр сыгран хотя бы на бронзу (учебные игры, раздел `learn`). */
  trainerDone?: readonly string[];
  /** Выученные буквы: слово-ответ не выдаётся с невыученной буквой (ТЗ-6.11). */
  letters?: string;
}

/** Эталонный ответ тем же видом (ТЗ-6.3, 6.10): ввод, который проходит проверку, и разбор задачи. */
export interface Etalon {
  input: AnswerInput;
  solution: string;
}

export type StepVerdict = CheckResult | 'over';

const finished = (t: Tour): boolean => t.i >= t.tasks.length;
export const isFinished = finished;

/**
 * Задачи тура: пул одной линии (линия — по зерну среди тех, где хватает задач), нерешённые раньше решённых, нужный уровень
 * раньше прочих. `fresh` — сколько из них не решено ещё. Задач меньше `size` — сколько есть.
 */
export function pickTasks(pool: readonly Task[], size: number, school: School, rnd: () => number): { tasks: Task[]; line: string; fresh: number } {
  const done = new Set(school.solved);
  const lines = [...new Set(pool.map(lineOf))].sort();
  const enough = lines.filter((l) => pool.filter((t) => lineOf(t) === l).length >= size);
  const line = shuffle(rnd, enough.length > 0 ? enough : lines)[0] ?? DEFAULT_LINE;
  const mine = shuffle(rnd, pool.filter((t) => lineOf(t) === line));
  const level = levelOf(school, line);
  const rank = (t: Task): number => (done.has(t.id) ? 2 : 0) + (t.level === level ? 0 : 1);
  const tasks = mine.sort((a, b) => rank(a) - rank(b)).slice(0, size);
  return { tasks, line, fresh: tasks.filter((t) => !done.has(t.id)).length };
}

/** Задачи, из которых можно строить тур: проверенные, нужных видов ответа, по классу и выученным буквам. */
export function poolOf(tasks: readonly Task[], answers: readonly string[], grade: number | null, letters?: string): Task[] {
  return tasks.filter((t) => t.verified && (answers.length === 0 || answers.includes(t.answer.kind)) && gradeOk(t, grade) && lettersOk(t, letters));
}

/** Виды ответа, из которых строится тур вида `def` при номере `n` («вперемешку» — все пройденные). */
const answersFor = (def: KindDef, n: number): string[] =>
  def.answers.length > 0 ? [...def.answers] : KINDS.filter((k) => k.from <= n && k.answers.length > 0).flatMap((k) => k.answers);

/**
 * План тура. Номер — следующий после последнего тура нумерации (или `opts.retake`); вид — по номеру (ТЗ-6.8).
 * Нет тренажёра у нового вида с ним — `trainer` (карточка); тренажёр пропущен и не сыгран — тур из прежних видов,
 * `waiting` и `repeat` (ТЗ-6.9). Все задачи вида уже решены — те же вперемешку, `cap` — медаль не выше взятой (ТЗ-6.5).
 * Задач вида нет совсем — тур из прежних видов (`repeat`), не исключение; нет и в прежних — `null` (экран без тура, как `kicksPlan`).
 * Метка `sid` зависит от последней записи журнала: до итога тур тот же (перезагрузка), после записи — новый, даже при том же семени.
 * Класс `grade` 1 — тур из `grade1Size` задач (025-Р31). `grade` null — без фильтра класса.
 */
export function tourPlan(school: School, tasks: readonly Task[], grade: number | null, seed: number, opts: TourOpts = {}): Tour | null {
  const retake = opts.retake !== undefined;
  const n = opts.retake ?? lastNumbered(school) + 1;
  const own = kindOf(n);
  const done = opts.trainerDone ?? [];
  const needsTrainer = !retake && !opts.repeat && own.trainer && !done.includes(own.id);
  const waiting = retake || opts.repeat === true ? null : waitingKind(school, done);
  const trainer = needsTrainer && waiting === null ? own.id : null;
  const last = school.tours.at(-1);
  const base = (seed ^ Math.imul(n, 0x9e3779b1) ^ Math.imul((last?.sid ?? school.tours.length) + 1, 0x27d4eb2f)) >>> 0;
  const prior = kindsBefore(n).flatMap((k) => k.answers);
  const build = (asRepeat: boolean): ReturnType<typeof pickTasks> => {
    const def = asRepeat ? (KINDS[KINDS.length - 1] as KindDef) : own;
    const size = grade === 1 ? Math.min(def.size, cfg.grade1Size) : def.size;
    const pool = poolOf(tasks, asRepeat ? prior : answersFor(def, n), grade, opts.letters);
    return pickTasks(pool, size, school, createRandom(base));
  };
  let repeat = opts.repeat === true || waiting !== null;
  let picked = build(repeat);
  // задач вида нет совсем (банк кончился, буквы не выучены) — безопасный тур из прежних видов, как при ожидании тренажёра
  if (picked.tasks.length === 0 && !repeat) {
    repeat = true;
    picked = build(true);
  }
  if (picked.tasks.length === 0) return null;
  const entry = school.tours.find((t) => t.n === n && t.kind !== REPEAT_KIND);
  const taken = school.tours.filter((t) => t.kind === own.id).map((t) => t.medal);
  const cap = repeat || picked.fresh > 0 ? null : retake ? (entry?.medal ?? 3) : Math.max(0, ...taken, taken.length === 0 ? 3 : 0);
  return {
    n,
    kind: repeat ? REPEAT_KIND : own.id,
    repeat,
    waiting,
    trainer,
    hint: !repeat && !retake && taken.length === 0,
    retake,
    cap,
    sid: (base ^ (repeat ? 0x85ebca6b : 0) ^ (retake ? 0xc2b2ae35 : 0)) >>> 0,
    line: picked.line,
    tasks: picked.tasks,
    i: 0,
    firsts: [],
    fixed: [],
  };
}

/**
 * Ответ на текущую задачу. Неверный формат, пусто и «не всё заполнено» попытку не списывают (ТЗ-6.13): тур тот же.
 * Верно — первая попытка засчитана; промах — эталон тем же видом (ТЗ-6.3), задача пройдена как неверная.
 */
export function step(tour: Tour, input: AnswerInput): { tour: Tour; verdict: StepVerdict; etalon?: Etalon } {
  const task = tour.tasks[tour.i];
  if (task === undefined) return { tour, verdict: 'over' };
  const verdict = checkAnswer(task.answer, input);
  if (verdict === 'correct') return { tour: { ...tour, i: tour.i + 1, firsts: [...tour.firsts, true] }, verdict };
  if (verdict !== 'wrong') return { tour, verdict };
  return { tour: { ...tour, i: tour.i + 1, firsts: [...tour.firsts, false] }, verdict, etalon: { input: correctInput(task.answer), solution: task.solution } };
}

/**
 * «Реванш» (ТЗ-6.3): ещё одна попытка промахнутой задачи `idx` после конца тура. Верно — «разобрано» (id в `school.solved`);
 * медаль, «Знаток» и монеты не меняются. Задача не промахнута или тур не кончен — ничего.
 */
export function revanche(school: School, tour: Tour, idx: number, input: AnswerInput): { school: School; tour: Tour; verdict: StepVerdict } {
  const task = tour.tasks[idx];
  if (task === undefined || !finished(tour) || tour.firsts[idx] !== false) return { school, tour, verdict: 'over' };
  const verdict = checkAnswer(task.answer, input);
  if (verdict !== 'correct' || tour.fixed.includes(task.id)) return { school, tour, verdict };
  const solved = [...school.solved.filter((id) => id !== task.id), task.id].slice(-SOLVED_MAX);
  return { school: { ...school, solved }, tour: { ...tour, fixed: [...tour.fixed, task.id] }, verdict };
}
