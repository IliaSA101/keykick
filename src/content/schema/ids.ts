/**
 * Реестр id курса (060 §2, 059-Р7): какие id уже выпущены и какие сняты (с наследником или без).
 * Файл — `courses/<курс>/ids.json`. Правила связи с живым контентом — в `engine/course/registry.ts`.
 */

export interface Registry {
  /** Код курса: `ru`. */
  course: string;
  /** Id, выпущенные детям; список только растёт (дописывает `tools/ids-release.mjs`). */
  released: string[];
  /** Снятые id: старый → наследник (живой или тоже снятый, цепочка) или `null`, если наследника нет. */
  retired: Record<string, string | null>;
}

/** Формат id урока: `<курс>.<лига>.<слово>`, всё латиница (059-Р5). */
export const ID_RE = /^[a-z]{2,3}\.[a-z0-9-]+\.[a-z0-9-]+$/;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Проверка формы ids.json: пусто — годен. Связь с живым контентом проверяет `checkRegistry`. */
export function check(x: unknown): string[] {
  if (!isObj(x)) return ['реестр: ожидался объект'];
  const errs: string[] = [];
  const course = typeof x.course === 'string' && /^[a-z]{2,3}$/.test(x.course) ? x.course : null;
  if (course === null) errs.push('course: ожидался код курса из 2–3 латинских букв');
  const idOk = (id: unknown): boolean => typeof id === 'string' && ID_RE.test(id) && (course === null || id.startsWith(`${course}.`));
  if (!Array.isArray(x.released)) errs.push('released: ожидался список');
  else {
    const seen = new Set<string>();
    for (const id of x.released as unknown[]) {
      if (typeof id !== 'string' || !idOk(id)) errs.push(`released: «${JSON.stringify(id)}» — не по формату или не этого курса`);
      else if (seen.has(id)) errs.push(`released: «${id}» повторяется`);
      else seen.add(id);
    }
  }
  if (!isObj(x.retired)) errs.push('retired: ожидался объект «старый id → наследник или null»');
  else {
    for (const [old, heir] of Object.entries(x.retired)) {
      if (!idOk(old)) errs.push(`retired: ключ «${old}» — не по формату или не этого курса`);
      if (heir !== null && !idOk(heir)) errs.push(`retired.${old}: наследник должен быть id или null`);
    }
  }
  return errs;
}
