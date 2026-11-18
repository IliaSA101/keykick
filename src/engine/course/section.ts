/**
 * Раздел `course:<курс>` (063-Р6): прогресс по урокам — форма `CourseProgress` из `reconcile.ts`.
 * Id уроков устойчивы (059-Р5, id не переименовываются), поэтому первый урок курса — константа, а не чтение пакета
 * (пакеты из кода не импортируются, страж 060 §8 п. 3); совпадение с настоящим порядком пакета держит тест К8.
 * Чистые функции: хранилища и часов нет.
 */
import { isDay, isInt, type SectionDef } from '../save/section';
import type { CourseProgress } from './reconcile';

/** Первый урок курса — с него начинает новый игрок. */
export const FIRST_LESSON: Readonly<Record<string, string>> = { ru: 'ru.yard.ao' };

const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

function markProblem(m: unknown): string | null {
  if (!isObj(m)) return 'mark';
  if (!isInt(m.stars) || m.stars < 0 || m.stars > 3) return 'mark:stars';
  if (!isInt(m.best) || m.best < 0) return 'mark:best';
  if (!isInt(m.tries) || m.tries < 0) return 'mark:tries';
  if (m.done !== undefined && !isDay(m.done)) return 'mark:done';
  if (m.bestAcc !== undefined && (!isInt(m.bestAcc) || m.bestAcc < 0 || m.bestAcc > 1000)) return 'mark:bestAcc';
  if (m.fails !== undefined && (!isInt(m.fails) || m.fails < 0)) return 'mark:fails';
  if (m.back !== undefined && typeof m.back !== 'boolean') return 'mark:back';
  return null;
}

/** v1 → v2 (065-Р9): отметки получают `fails: 0` — счётчик провалов подряд; остальное не трогаем. */
function upToV2(data: unknown): unknown {
  if (!isObj(data)) return data;
  const withFails = (group: unknown): unknown =>
    isObj(group) ? Object.fromEntries(Object.entries(group).map(([id, m]) => [id, isObj(m) ? { fails: 0, ...m } : m])) : group;
  return { ...data, lessons: withFails(data.lessons), archive: withFails(data.archive) };
}

/** Описание раздела курса `course` с первым уроком `first`. */
export function courseDef(course: string, first: string): SectionDef<CourseProgress> {
  return {
    name: `course:${course}`,
    v: 2,
    empty: () => ({ current: first, lessons: {}, archive: {}, leaguesDone: {} }),
    up: { 2: upToV2 },
    check(d) {
      if (!isObj(d)) return ['shape'];
      if (typeof d.current !== 'string' || d.current === '') return ['current'];
      if (!isObj(d.lessons) || !isObj(d.archive) || !isObj(d.leaguesDone)) return ['shape'];
      for (const m of [...Object.values(d.lessons), ...Object.values(d.archive)]) {
        const bad = markProblem(m);
        if (bad !== null) return [bad];
      }
      return Object.values(d.leaguesDone).every(isDay) ? [] : ['leaguesDone'];
    },
  };
}

/** Раздел русского курса — единственный в этапе Э1. */
export const ruCourseDef: SectionDef<CourseProgress> = courseDef('ru', FIRST_LESSON.ru!);
