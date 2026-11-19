/**
 * Итог тура и «штрафных» (067 К-В, ТЗ-6.3–6.7, 6.14): медаль по первым попыткам, часть эмблемы, «Знаток» — только через
 * кассу (`engine/rewards/cash.ts`, страж С1). Монет — 0 (ТЗ-6.6). Повторный вызов с тем же туром — сохранение не меняется
 * (тот же `sid` — запись не дописывается, решённые задачи «Знатока» второй раз не дают).
 */
import { credit, isPaid, type Purse } from '../rewards/cash';
import { bumpLevel } from './level';
import { EMBLEM_FULL, addPart, emblemN, medalOf, type Medal } from './medal';
import { REPEAT_KIND, lastNumbered } from './order';
import { MISS_MAX, SOLVED_MAX, TOURS_MAX, type School, type Tour as TourEntry } from './section';
import { isFinished, type Tour } from './tour';

export interface FinishCtx {
  /** Игровой день `ГГГГ-ММ-ДД`. */
  day: string;
}

export interface TourView {
  medal: Medal;
  size: number;
  /** Верных с первой попытки. */
  first: number;
  /** Номера промахнутых задач (для «Реванша»). */
  missed: number[];
  /** Вид, чья часть эмблемы добавлена этим туром, иначе null. */
  newPart: string | null;
  emblemN: number;
  /** Эмблема стала целой именно сейчас — праздник. */
  emblemDone: boolean;
  /** «Знаток»: сколько прибавлено. */
  knower: number;
}

/** Решённые задачи: верные с первой попытки; новыми считаются те, которых ещё не было в `solved`. */
function solveNow(school: School, tour: Tour): { solved: string[]; fresh: number; right: number } {
  const had = new Set(school.solved);
  const ids = tour.tasks.filter((_, i) => tour.firsts[i] === true).map((t) => t.id);
  const fresh = ids.filter((id) => !had.has(id)).length;
  return { solved: [...school.solved.filter((id) => !ids.includes(id)), ...ids].slice(-SOLVED_MAX), fresh, right: ids.length };
}

function mustBeFinished(tour: Tour): void {
  if (!isFinished(tour)) throw new Error('finish: tour is not finished');
}

/**
 * Итог тура: запись журнала (с неразобранными промахами `miss`, только если они были — Р94; пересдача сливается с записью своего номера, медаль берётся большая, `miss` — у новой попытки; тот же `sid` — не дописывается), часть эмблемы за первую
 * медаль вида (тур-повтор и тур прежних видов её не дают, Ш-З3), «Знаток» +1 за каждую новую задачу, решённую с первой
 * попытки (А7-Р9), уровень линии по серии (А7-Р5). Пересдача и потолок медали (`tour.cap`, ТЗ-6.5) — в `medal`.
 */
export function finishTour(save: Purse, tour: Tour, ctx: FinishCtx): { save: Purse; view: TourView } {
  mustBeFinished(tour);
  const size = tour.tasks.length;
  const first = tour.firsts.filter(Boolean).length;
  const raw = medalOf(size, first);
  const medal = (tour.cap === null ? raw : Math.min(raw, tour.cap)) as Medal;
  const { solved, fresh } = solveNow(save.school, tour);
  const paid = credit({ ...save, school: { ...save.school, solved } }, 'tour-knower', fresh);
  let school = paid.purse.school;
  const before = school.tours;
  let tours: TourEntry[];
  let merged: boolean;
  const twice = before.some((t) => t.sid === tour.sid);
  if (tour.repeat) {
    const entry: TourEntry = { n: Math.max(1, lastNumbered(school)), kind: REPEAT_KIND, medal, first, day: ctx.day, sid: tour.sid };
    tours = twice ? [...before] : [...before, entry].slice(-TOURS_MAX);
    merged = twice;
  } else {
    // пересдача сливается с записью своего номера; тот же итог второй раз (тот же `sid`) запись не дописывает
    const at = tour.retake ? before.findIndex((t) => t.n === tour.n && t.kind !== REPEAT_KIND) : -1;
    merged = at >= 0 || twice;
    const old = before[at];
    // неразобранные промахи берутся у новой попытки: старые задачи пересдача могла уже не повторить (067-Р88)
    const miss = tour.tasks.filter((_, i) => tour.firsts[i] === false).map((t) => t.id).slice(0, MISS_MAX);
    // `miss` пишется только при промахах; пересдача без промахов поле снимает (067-Р94)
    const base: TourEntry = old === undefined ? { n: tour.n, kind: tour.kind, medal, first, day: ctx.day, sid: tour.sid } : { n: old.n, kind: old.kind, day: old.day, ...(old.sid === undefined ? {} : { sid: old.sid }), medal: Math.max(old.medal, medal), first: Math.max(old.first, first) };
    const entry: TourEntry = miss.length > 0 ? { ...base, miss } : base;
    tours = old !== undefined ? before.map((t, i) => (i === at ? entry : t)) : twice ? [...before] : [...before, entry].slice(-TOURS_MAX);
  }
  const part = tour.repeat ? { mask: school.emblem, added: false } : addPart(school.emblem, tour.kind, medal);
  const steps = merged || tour.retake ? {} : bumpLevel(school, tour.line, medal);
  school = { ...school, tours, emblem: part.mask, ...steps };
  const n = emblemN(part.mask);
  const view: TourView = {
    medal,
    size,
    first,
    missed: tour.firsts.flatMap((ok, i) => (ok ? [] : [i])),
    newPart: part.added ? tour.kind : null,
    emblemN: n,
    emblemDone: part.added && n === EMBLEM_FULL,
    knower: paid.gain,
  };
  return { save: { ...paid.purse, school }, view };
}

/**
 * Итог «штрафных»: «Знаток» +1 за каждую задачу, верную с первой попытки, как пенальти (ТЗ-6.14, 025-Р38) — новая или нет:
 * банк исчерпан, «штрафные» всё равно дают (`kicks-knower`); журнала, медали и эмблемы нет. `ctx.ref` — метка тура (`sid` и день),
 * касса запоминает её: повторный вызов с тем же туром — сохранение не меняется, `knower` 0.
 * Пропуск («Дальше») — эту функцию не зовут, сохранение не меняется.
 */
export function finishKicks(save: Purse, tour: Tour, ctx: { ref: string }): { save: Purse; knower: number } {
  mustBeFinished(tour);
  if (isPaid(save.wallet, ctx.ref)) return { save, knower: 0 };
  const { solved, right } = solveNow(save.school, tour);
  const paid = credit({ ...save, school: { ...save.school, solved } }, 'kicks-knower', right, ctx.ref);
  return { save: paid.purse, knower: paid.gain };
}
