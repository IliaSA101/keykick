/**
 * Порядок видов тура (ТЗ-6.8), тренажёр перед новым видом (ТЗ-6.9), тур-повтор (025 А7-Р9). Данные — `content/school.json`.
 * Чистые функции: ничего не знают о Vue, часах и хранилище.
 */
import learnCfg from '../../content/learn.json';
import cfg from '../../content/school.json';
import type { School } from './section';

export interface KindDef {
  /** Вид тура (id в журнале и номер бита эмблемы по порядку списка). */
  id: string;
  /** Туры вида: `from`…`to`; у «вперемешку» `to` нет. */
  from: number;
  to: number | null;
  /** Виды ответа задач (`answer.kind`), из которых строится тур. Пусто — любые («вперемешку»). */
  answers: readonly string[];
  /** Задач в туре (ТЗ-6.2). */
  size: number;
  /** Есть ли у вида тренажёр — учебная игра (ТЗ-6.9, 7.2). */
  trainer: boolean;
}

/** Все виды эмблемы по порядку: 9 видов + «вперемешку» = 10 частей (ТЗ-6.7). */
export const KINDS: readonly KindDef[] = [
  ...cfg.kinds.map((k) => ({ ...k })),
  { id: cfg.mixed.id, from: cfg.mixed.from, to: null, answers: [], size: cfg.mixed.size, trainer: false },
];

/** Вид записи журнала для тура-повтора и тура «прежних видов», пока новый вид ждёт тренажёр: вне нумерации, без части эмблемы. */
export const REPEAT_KIND = cfg.repeatKind;

/** Вид по номеру тура: 1–2 число, … 17–18 соединялка, дальше — вперемешку. */
export function kindOf(n: number): KindDef {
  const last = KINDS[KINDS.length - 1] as KindDef;
  return KINDS.find((k) => n >= k.from && (k.to === null || n <= k.to)) ?? last;
}

/** Виды, которые ребёнок уже проходил к туру `n` (раньше его вида); у первого пара туров — только число. */
export function kindsBefore(n: number): KindDef[] {
  const own = kindOf(n);
  const before = KINDS.filter((k) => k.from < own.from && k.id !== cfg.mixed.id);
  return before.length > 0 ? before : [KINDS[0] as KindDef];
}

/** Номер последнего тура в нумерации (повторы не считаются); 0 — туров не было. */
export const lastNumbered = (school: School): number => school.tours.reduce((m, t) => (t.kind === REPEAT_KIND ? m : Math.max(m, t.n)), 0);

/**
 * Пора ли предложить тур-повтор: по числу туров нумерации после прошлого повтора — каждые 5–7 (шаг зависит от номера
 * повтора по кругу: 5, 6, 7, 5…, без случайности). Повтор не заменяет тур дня (А7-Р9) — решает вызывающий.
 */
export function repeatDue(school: School): boolean {
  const { every, since } = repeatStep(school);
  return since >= every;
}

/** Шаг повтора: сколько туров нумерации нужно между повторами и сколько их прошло после прошлого (067-Р179 берёт отсюда место строки «ждёт»). */
export function repeatStep(school: School): { every: number; since: number } {
  const idx = school.tours.map((t) => t.kind === REPEAT_KIND).lastIndexOf(true);
  const count = school.tours.filter((t) => t.kind === REPEAT_KIND).length;
  const since = school.tours.slice(idx + 1).filter((t) => t.kind !== REPEAT_KIND).length;
  const steps = cfg.repeatEvery;
  return { every: steps[count % steps.length] as number, since };
}

/**
 * Вид, чей тренажёр пропущен и не сыгран: следующий тур нумерации ждёт его и идёт из прежних видов (ТЗ-6.9, 067-Р146).
 * Нет такого — `null`. `done` — виды с взятым тренажёром (`trainersDone`): их тур идёт обычный.
 */
export function waitingKind(school: School, done: readonly string[] = []): string | null {
  const own = kindOf(lastNumbered(school) + 1);
  return own.trainer && !done.includes(own.id) && school.trainerSkip.includes(own.id) ? own.id : null;
}

/** «Пропустить» тренажёр (ТЗ-6.9): новый вид ждёт, туры идут из прежних видов. */
export function skipTrainer(school: School, kind: string): School {
  return school.trainerSkip.includes(kind) ? school : { ...school, trainerSkip: [...school.trainerSkip, kind] };
}

/** Учебная игра-тренажёр вида: игра с `tour`, равным первому туру вида (`content/learn.json`); у вида без тренажёра — `null`. */
export function trainerGame(kind: string): string | null {
  const def = KINDS.find((k) => k.id === kind);
  if (def === undefined || !def.trainer) return null;
  return learnCfg.games.find((g) => g.tour === def.from)?.id ?? null;
}

/** Виды, чей тренажёр уже взят хотя бы на бронзу (ТЗ-6.9: тогда тур идёт без карточки). `games` — раздел `learn.games`. */
export function trainersDone(games: Readonly<Record<string, { step: number }>>): string[] {
  return KINDS.filter((k) => {
    const g = trainerGame(k.id);
    return g !== null && (games[g]?.step ?? 0) >= 1;
  }).map((k) => k.id);
}
