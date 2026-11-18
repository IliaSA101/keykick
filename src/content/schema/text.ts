/**
 * Тексты курса на языке объяснения (060 §2, §7): названия и анонсы лиг, названия кубков — по id.
 * Файл — `courses/<курс>/text/<язык>.json`. Тексты уроков живут в пакетах.
 */

export interface LeagueText {
  name: string;
  /** Одна фраза — что ждёт в лиге (для лиг «строится» — анонс на карте). */
  announce: string;
}

export interface CourseText {
  /** По id лиги. */
  leagues: Record<string, LeagueText>;
  /** По id кубка из каркаса. */
  cups: Record<string, string>;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const filled = (s: unknown): boolean => typeof s === 'string' && s.trim() !== '';

/** Проверка файла текстов: пусто — годен. Полноту по каркасу лиг проверяет тест курса. */
export function check(x: unknown): string[] {
  if (!isObj(x)) return ['тексты: ожидался объект'];
  const errs: string[] = [];
  if (!isObj(x.leagues)) errs.push('leagues: ожидался объект');
  else {
    for (const [id, t] of Object.entries(x.leagues)) {
      if (!isObj(t)) errs.push(`leagues.${id}: ожидался объект`);
      else {
        if (!filled(t.name)) errs.push(`leagues.${id}.name: пусто`);
        if (!filled(t.announce)) errs.push(`leagues.${id}.announce: пусто`);
      }
    }
  }
  if (!isObj(x.cups)) errs.push('cups: ожидался объект');
  else for (const [id, name] of Object.entries(x.cups)) if (!filled(name)) errs.push(`cups.${id}: пусто`);
  return errs;
}
