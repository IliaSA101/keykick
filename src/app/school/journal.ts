/**
 * Журнал «Школы» (067 Т14, кадры Э3.08–14): чистые функции без Vue — строки журнала, часть эмблемы, «Знаток», вопрос класса.
 * Экран только показывает; что в какой строке и когда спрашивать класс — решает этот файл (тест — tests/school/tour.test.ts).
 */
import cfg from '../../content/school.json';
import type { Day } from '../../engine/day/section';
import { EMBLEM_FULL, emblemN } from '../../engine/school/medal';
import { KINDS, REPEAT_KIND, kindOf, lastNumbered, repeatDue, repeatStep, waitingKind } from '../../engine/school/order';
import type { School, Tour } from '../../engine/school/section';

/** Туры, за которые даётся тактика мини-футбола (ТЗ-6.6). */
export const TACTIC_TOURS: readonly number[] = [4, 8, 12, 16];
/** Журнал показывает не меньше стольких строк (кадры Э3.08, Э3.09: до тура 12). */
const MIN_ROWS = 12;
/** Пустой журнал (Э3.13) показывает столько строк, остальные — «ещё N» (067-Р176). */
const SHOWN_FIRST = 10;

export interface JournalRow {
  type: 'tour' | 'repeat' | 'now' | 'next';
  n: number;
  kind: string;
  /** Медаль 0…3; у будущих строк 0. */
  medal: number;
  /** Столбец «Разобрано» (067-Р88): «разобрать» — в записи есть неразобранные промахи (`miss`), «разобрано» — были и разобраны, иначе пусто. */
  fixed: 'none' | 'done' | 'todo';
  /** Номер тура для «Реванша» из журнала — у строки «разобрать», иначе null. */
  fixN: number | null;
  tactic: boolean;
  /** Повтор ждёт своего часа (`repeatDue`). */
  waits: boolean;
}

export interface JournalView {
  rows: JournalRow[];
  /** Сколько видов ещё впереди после последней строки; 0 — строки нет. */
  ahead: number;
  emblem: number;
  /** Эмблема собрана (067-Р177): «Ещё тур» вместо «Тур N», заголовок «Эмблема собрана». */
  done: boolean;
  /** Сколько строк `rows` показано сверху; пустой журнал — 10 из 12 (067-Р176). */
  shown: number;
  /** «Ещё N» ниже показанных строк (067-Р178). */
  below: number;
  parts: { kind: string; on: boolean }[];
  tactics: { n: number; of: number };
  expert: { left: number; pct: number; done: boolean };
  nowN: number;
  nowKind: string;
  due: boolean;
}

/**
 * Столбец «Разобрано» по записи тура (067-Р88, Р94). Нет `miss` (старая запись, тур без промахов) и повтор — пусто;
 * непусто — «разобрать»; `[]` — промахи были и все разобраны.
 */
export function fixedOf(t: Tour): JournalRow['fixed'] {
  if (t.kind === REPEAT_KIND || t.miss === undefined) return 'none';
  return t.miss.length > 0 ? 'todo' : 'done';
}

/** Вопрос «В каком ты классе?» — один раз: пока класса нет. Раздела нет (игрок не открыт) — не спрашиваем. */
export const needsGrade = (school: School | null): boolean => school !== null && school.grade === null;

/**
 * Ждёт ли тур на Доме (ТЗ-6.1): сегодня сыгран хотя бы один матч и тур дня ещё не взят. Тур дня — запись нумерации за сегодня;
 * повтор по расписанию (025 А7-Р9) его не заменяет. Но пока следующий тур — ожидание тренажёра (`waitingKind`), все туры идут
 * видом повтора, и любая запись за сегодня — это тур дня (067-Р146), иначе «Тур ждёт» зовёт после каждого матча вечно.
 * `done` — виды с взятым тренажёром (Р203): ожидание снято, тур дня за сегодня — только запись нумерации.
 */
export function tourWaits(school: School, day: Pick<Day, 'today' | 'todayN'>, today: string, done: readonly string[]): boolean {
  const todays = school.tours.filter((t) => t.day === today);
  const taken = todays.some((t) => t.kind !== REPEAT_KIND) || (todays.length > 0 && waitingKind(school, done) !== null);
  return day.today === today && day.todayN >= 1 && !taken;
}

/** Поставщик Дома (`HomeExtras`): число собранных частей эмблемы и «тур ждёт». */
export const schoolExtras = (school: School, day: Pick<Day, 'today' | 'todayN'>, today: string, done: readonly string[]): { emblemN: number; tourWaits: boolean } => ({
  emblemN: emblemN(school.emblem),
  tourWaits: tourWaits(school, day, today, done),
});

export function journalView(school: School): JournalView {
  const numbered = school.tours.filter((t) => t.kind !== REPEAT_KIND);
  const due = repeatDue(school);
  const nowN = lastNumbered(school) + 1;
  const rows: JournalRow[] = school.tours.map((t) => ({
    type: t.kind === REPEAT_KIND ? 'repeat' : 'tour',
    n: t.n,
    kind: t.kind,
    medal: t.medal,
    fixed: fixedOf(t),
    fixN: fixedOf(t) === 'todo' ? t.n : null,
    tactic: t.kind !== REPEAT_KIND && TACTIC_TOURS.includes(t.n),
    waits: false,
  }));
  const blank = (type: JournalRow['type'], n: number): JournalRow => ({ type, n, kind: kindOf(n).id, medal: 0, fixed: 'none', fixN: null, tactic: TACTIC_TOURS.includes(n), waits: false });
  if (due) {
    // ждущий повтор стоит там, где подошёл срок: после тура, на котором набралось нужное число (Э3.14: после 12-го, 13-й уже сыгран; 067-Р179)
    const { every } = repeatStep(school);
    const lastRep = school.tours.map((t) => t.kind === REPEAT_KIND).lastIndexOf(true);
    const dueAfter = school.tours.map((t, i) => ({ t, i })).filter(({ t, i }) => i > lastRep && t.kind !== REPEAT_KIND)[every - 1];
    const at = dueAfter !== undefined ? dueAfter.i + 1 : rows.length;
    rows.splice(at, 0, { ...blank('repeat', nowN), kind: REPEAT_KIND, waits: true });
  }
  rows.push(blank('now', nowN));
  const lastShown = Math.max(MIN_ROWS, nowN + 2);
  for (let n = nowN + 1; n <= lastShown; n++) rows.push(blank('next', n));
  const medalTours = numbered.filter((t) => t.medal >= 1).length;
  const at = cfg.expertAt;
  const shown = school.tours.length === 0 ? Math.min(SHOWN_FIRST, rows.length) : rows.length;
  return {
    rows,
    done: emblemN(school.emblem) >= EMBLEM_FULL,
    shown,
    below: rows.length - shown,
    ahead: KINDS.filter((k) => k.from > lastShown).length,
    emblem: emblemN(school.emblem),
    parts: KINDS.map((k, i) => ({ kind: k.id, on: (school.emblem & (1 << i)) !== 0 })),
    tactics: { n: numbered.filter((t) => TACTIC_TOURS.includes(t.n) && t.medal >= 1).length, of: TACTIC_TOURS.length },
    expert: { left: Math.max(0, at - medalTours), pct: Math.min(100, Math.round((medalTours / at) * 100)), done: medalTours >= at },
    nowN,
    nowKind: kindOf(nowN).id,
    due,
  };
}
