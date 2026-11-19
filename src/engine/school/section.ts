/**
 * Раздел `school` (065-Р9, 067 design §7). v1 — счёт «Знатока» (+1 за верную задачу пенальти, ТЗ-2.7);
 * v2 (067 Т1) — класс, журнал туров, эмблема, решённые задачи, уровень по линиям, пропуск тренажёра.
 * Знаток растёт только через кассу (`engine/rewards/cash.ts`).
 */
import { isDay, isDotId, isInt, isRecord, type SectionDef } from '../save/section';

export interface Tour {
  /** Номер тура. */
  n: number;
  /** Вид тура (id вида из `school.json`, Т2). */
  kind: string;
  /** Медаль 0…3. */
  medal: number;
  /** Задач, решённых с первой попытки. */
  first: number;
  day: string;
  /** Метка тура (семя + номер, `tourPlan`): тот же итог второй раз запись не дописывает (067 К2). У старых записей нет. */
  sid?: number;
  /**
   * Id неразобранных промахов тура, не больше `MISS_MAX` (067-Р88). Нет поля — старая запись (журнал «разобрать» не рисует);
   * `[]` — разбирать нечего или всё разобрано; непусто — строка «разобрать», «Реванш» открывается из журнала по этим id.
   * Необязательное поле, версия раздела та же.
   */
  miss?: string[];
}

export interface School {
  knower: number;
  /** Класс 1…8; `null` — не выбран (вопрос Э3.08 один раз). */
  grade: number | null;
  /** Журнал туров, не больше `TOURS_MAX`. */
  tours: Tour[];
  /** Части эмблемы: 10 бит маской, 0…1023 (ТЗ-6.7). */
  emblem: number;
  /** Решённые задачи (id), не больше `SOLVED_MAX`. */
  solved: string[];
  /** Уровень 1…3 по линии задач. */
  level: Record<string, number>;
  /** Виды, чей тренажёр пропущен. */
  trainerSkip: string[];
  /** Серия по линии: медали последних туров, ещё не решивших шаг уровня (0…2 штуки; А7-Р5). Нет поля — серий нет. */
  streak?: Record<string, number[]>;
}

export const TOURS_MAX = 400;
/** Сколько неразобранных промахов хранит запись тура. */
export const MISS_MAX = 5;
export const SOLVED_MAX = 500;
export const EMBLEM_MAX = 1023;

const tourOk = (t: unknown): boolean =>
  isRecord(t) && isInt(t.n) && t.n >= 1 && isDotId(t.kind) && isInt(t.medal) && t.medal >= 0 && t.medal <= 3 && isInt(t.first) && t.first >= 0 && isDay(t.day) && (t.sid === undefined || (isInt(t.sid) && t.sid >= 0)) && (t.miss === undefined || (Array.isArray(t.miss) && t.miss.length <= MISS_MAX && t.miss.every(isDotId)));

const streakOk = (s: unknown): boolean =>
  isRecord(s) && Object.entries(s).every(([k, v]) => isDotId(k) && Array.isArray(v) && v.length <= 2 && v.every((m) => isInt(m) && m >= 0 && m <= 3));

export const emptySchool = (): School => ({ knower: 0, grade: null, tours: [], emblem: 0, solved: [], level: {}, trainerSkip: [] });

export const schoolDef: SectionDef<School> = {
  name: 'school',
  v: 2,
  empty: emptySchool,
  up: {
    // v1 { knower } → v2: поля Школы пустые, «Знаток» сохраняется как есть; испорченное v1 не обнуляется молча —
    // его отвергает `check` (раздел уходит в карантин с сырыми данными)
    2: (d) => (isRecord(d) ? { ...emptySchool(), knower: d.knower } : d),
  },
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const why: string[] = [];
    if (!isInt(d.knower) || d.knower < 0) why.push('knower');
    if (d.grade !== null && (!isInt(d.grade) || d.grade < 1 || d.grade > 8)) why.push('grade');
    if (!Array.isArray(d.tours) || d.tours.length > TOURS_MAX || !d.tours.every(tourOk)) why.push('tours');
    if (!isInt(d.emblem) || d.emblem < 0 || d.emblem > EMBLEM_MAX) why.push('emblem');
    if (!Array.isArray(d.solved) || d.solved.length > SOLVED_MAX || !d.solved.every(isDotId)) why.push('solved');
    if (!isRecord(d.level) || Object.entries(d.level).some(([k, v]) => !isDotId(k) || !isInt(v) || v < 1 || v > 3)) why.push('level');
    if (d.streak !== undefined && !streakOk(d.streak)) why.push('streak');
    if (!Array.isArray(d.trainerSkip) || !d.trainerSkip.every(isDotId)) why.push('trainerSkip');
    return why;
  },
};
