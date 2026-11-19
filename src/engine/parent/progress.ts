/**
 * Страница родителя (063 Т11): числа игрока, «последний файл» и строки «Что изменится» при загрузке файла. Чистые функции:
 * сегодняшний день и порядок уроков приходят снаружи, хранилища и Vue нет.
 */
import { restoreFacts, type Fact } from '../club/start';
import type { Envelope } from '../save/envelope';
import type { ImportPlan } from '../save/import';
import type { Pick } from '../save/restore';
import { dayNo } from '../save/remind';
import { isDay } from '../save/section';
import { isObj, num, playedOf, summarize } from '../save/snapshot';

/** Что показываем в плитках; `null` — раздела нет или он не той формы (плитки нет, не «0»). */
export interface ProgressFacts {
  coins: number | null;
  stars: number | null;
  matches: number | null;
  days: number | null;
  /** Номер текущего урока в курсе (1…) и сколько уроков в курсе; без порядка уроков — `null`. */
  lessonNo: number | null;
  lessonsAll: number | null;
  passed: number | null;
}

export function progressFacts(env: Envelope, order: readonly string[]): ProgressFacts {
  const own = (name: string): unknown => (Object.hasOwn(env.sections, name) ? env.sections[name]?.data : undefined);
  const sum = summarize(env);
  const day = own('day');
  const course = own(`course:${env.course}`);
  const at = sum.lesson === null ? -1 : order.indexOf(sum.lesson);
  const passed = isObj(course) && isObj(course.lessons) ? Object.values(course.lessons).filter((m) => isObj(m) && (num(m.stars) ?? 0) > 0).length : null;
  return {
    coins: sum.coins,
    stars: sum.stars,
    matches: playedOf(env),
    days: isObj(day) ? num(day.days) : null,
    lessonNo: at >= 0 ? at + 1 : null,
    lessonsAll: order.length > 0 ? order.length : null,
    passed,
  };
}

export type LastFile = { kind: 'never' } | { kind: 'today' } | { kind: 'ago'; days: number };

/** Когда сохраняли файл: `exported` — день `ГГГГ-ММ-ДД` из записи устройства (не день — «ещё не сохраняли»; будущее — «сегодня»). */
export function lastFile(exported: unknown, today: string): LastFile {
  if (!isDay(exported) || !isDay(today)) return { kind: 'never' };
  const days = Math.round(dayNo(today) - dayNo(exported));
  return days <= 0 ? { kind: 'today' } : { kind: 'ago', days };
}

/**
 * Строка «Что изменится»: новый игрок из файла, совпавший (`mine: null` — на компьютере не открывается) или игрок только
 * на компьютере (`here`: в файле его нет — останется как есть, `theirs` пуст; кадр Э6.54).
 */
export interface ChangeRow {
  pid: string;
  name: string;
  kind: 'new' | 'clash' | 'here';
  mine: Fact[] | null;
  theirs: Fact[];
  /** Новый игрок из файла лежит в корзине на этом компьютере (в колонке «Сейчас» — «в корзине», а не «нет»). */
  binned?: true;
}

export function changeRows(plan: ImportPlan, here: readonly Envelope[], order: readonly string[], binned: ReadonlySet<string> = new Set()): ChangeRow[] {
  if (plan.kind !== 'ok') return [];
  const rows: ChangeRow[] = plan.clash.map((c) => {
    const mine = here.find((e) => e.pid === c.pid);
    return { pid: c.pid, name: c.file.name, kind: 'clash', mine: mine ? restoreFacts(mine, order) : null, theirs: restoreFacts(c.file, order) };
  });
  const added = plan.add.map((e): ChangeRow => ({ pid: e.pid, name: e.name, kind: 'new', mine: [], theirs: restoreFacts(e, order), ...(binned.has(e.pid) ? { binned: true as const } : {}) }));
  const inFile = new Set([...plan.clash.map((c) => c.pid), ...plan.add.map((e) => e.pid)]);
  const only = here.filter((e) => !inFile.has(e.pid)).map((e): ChangeRow => ({ pid: e.pid, name: e.name, kind: 'here', mine: restoreFacts(e, order), theirs: [] }));
  return [...rows, ...added, ...only];
}

/** Выбор по умолчанию — «оставить на компьютере»: пока родитель не решил иное, ничего не перезаписывается (063-Р56). */
export function defaultPicks(plan: ImportPlan): Record<string, Pick> {
  return plan.kind === 'ok' ? Object.fromEntries(plan.clash.map((c) => [c.pid, 'mine' as const])) : {};
}

/** Ключ строки для отказа корзины (063-Р66): у каждой причины своя строка, «нет места» — только у `limit`; остальное — общее «не записалось». `busy` — со своим именем, здесь не участвует. */
export type BinNote = 'limit' | 'phrase' | 'conflict' | 'readonly' | 'listed' | 'fail';
export function binNoteKey(why: string): BinNote {
  return why === 'limit' || why === 'phrase' || why === 'conflict' || why === 'readonly' || why === 'listed' ? why : 'fail';
}
