/**
 * Сверка прогресса курса с реестром id (060 §2, 059 С-13, С-14): снятый урок уходит в архив, наследник
 * получает лучшее, текущий урок переезжает. Чистая функция: ни даты «сейчас», ни случайности — дни приходят в данных.
 */
import type { Registry } from '../../content/schema/ids';
import { resolveHeir } from './registry';

/** Отметка по уроку. `done` — день 'ГГГГ-ММ-ДД', когда урок пройден впервые (защёлка). */
export interface LessonMark {
  stars: 0 | 1 | 2 | 3;
  best: number;
  tries: number;
  done?: string;
  /** Рекорд: точность матча с лучшей скоростью, тысячные (ТЗ-2.17; `best` — зн/мин). */
  bestAcc?: number;
  /** Провалов подряд (ТЗ-2.9); сбрасывается проходом. Формат v2 (065-Р9). */
  fails?: number;
  /** Урок пройден с помощью — «вернуться за звёздами» (ТЗ-2.9), снимается проходом без помощи. */
  back?: boolean;
}

export interface CourseProgress {
  /** Id текущего урока. */
  current: string;
  lessons: Record<string, LessonMark>;
  /** Отметки снятых уроков: не удаляются никогда. */
  archive: Record<string, LessonMark>;
  /** Защёлки «лига пройдена» с днём; `reconcile` их не пересчитывает. */
  leaguesDone: Record<string, string>;
}

export type Change =
  | { kind: 'archived'; id: string }
  | { kind: 'inherited'; from: string; to: string }
  | { kind: 'current'; from: string; to: string };

/** Лучшая из двух отметок: по `stars`, затем `best`, затем `tries`; `done` — раньшая из дат. Порядок аргументов не важен. */
export function bestMark(a: LessonMark, b: LessonMark): LessonMark {
  const win = a.stars !== b.stars ? (a.stars > b.stars ? a : b) : a.best !== b.best ? (a.best > b.best ? a : b) : a.tries >= b.tries ? a : b;
  const days = [a.done, b.done].filter((d): d is string => d !== undefined).sort();
  const out: LessonMark = { stars: win.stars, best: win.best, tries: win.tries };
  if (days[0] !== undefined) out.done = days[0];
  if (win.bestAcc !== undefined) out.bestAcc = win.bestAcc;
  if (win.fails !== undefined) out.fails = win.fails;
  if (win.back !== undefined) out.back = win.back;
  return out;
}

const passed = (m: LessonMark | undefined): boolean => m !== undefined && (m.stars > 0 || m.done !== undefined);

/** Первый непройденный после последнего пройденного (по `order`); все пройдены — последний; `order` пуст — `null`. */
function nextUnpassed(order: readonly string[], lessons: Readonly<Record<string, LessonMark>>): string | null {
  let last = -1;
  order.forEach((id, i) => {
    if (passed(lessons[id])) last = i;
  });
  return order[last + 1] ?? order.at(-1) ?? null;
}

/**
 * Сверка. Правила:
 * - снятый id с отметкой → копия в `archive`; наследник (в конце цепочки) получает лучшее из двух;
 * - `current` снятый → наследник; наследника нет → первый непройденный после бывшей позиции (позиция снятого
 *   урока неизвестна, берём последний пройденный по `order`); `order` пуст — не трогаем;
 * - id, которого нет ни в `order`, ни в реестре (чужой курс, будущая версия), и вставленный позади урок — не трогаются,
 *   `current` вставка не двигает; `leaguesDone` не пересчитывается;
 * - id и живой, и снятый (нарушение реестра) считается живым. Вход не меняется.
 */
export function reconcile(p: CourseProgress, reg: Registry, order: readonly string[]): { progress: CourseProgress; changes: Change[] } {
  const live = new Set(order);
  const changes: Change[] = [];
  const lessons: Record<string, LessonMark> = { ...p.lessons };
  const archive: Record<string, LessonMark> = { ...p.archive };

  const gone = Object.keys(p.lessons)
    .filter((id) => !live.has(id) && Object.hasOwn(reg.retired, id))
    .sort();
  for (const id of gone) {
    const mark = p.lessons[id]!;
    archive[id] = Object.hasOwn(archive, id) ? bestMark(archive[id]!, mark) : { ...mark };
    delete lessons[id];
    changes.push({ kind: 'archived', id });
    const heir = resolveHeir(reg, live, id);
    if (heir === null) continue;
    lessons[heir] = Object.hasOwn(lessons, heir) ? bestMark(lessons[heir]!, mark) : { ...mark };
    changes.push({ kind: 'inherited', from: id, to: heir });
  }

  let current = p.current;
  if (!live.has(current) && Object.hasOwn(reg.retired, current)) {
    const to = resolveHeir(reg, live, current) ?? nextUnpassed(order, lessons);
    if (to !== null) {
      current = to;
      changes.push({ kind: 'current', from: p.current, to });
    }
  }

  return { progress: { current, lessons, archive, leaguesDone: { ...p.leaguesDone } }, changes };
}
