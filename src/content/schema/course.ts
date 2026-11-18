/**
 * Курс (060 §2): какая раскладка, на каких языках объясняем, какие лиги по порядку.
 * Каркас лиг — в соседнем leagues.ts, названия — в text.ts.
 */

export interface Course {
  /** Код курса: `ru`, `en`. */
  id: string;
  /** Id раскладки из `content/layouts/`. */
  layout: string;
  /** Языки объяснения (советы и тексты контента); первый — запасной. */
  explain: string[];
  /** Id лиг по порядку прохождения. */
  leagues: string[];
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const slug = /^[a-z0-9-]+$/;

function strings(x: unknown, re: RegExp, what: string, errs: string[]): void {
  if (!Array.isArray(x) || x.length === 0) {
    errs.push(`${what}: ожидался непустой список`);
    return;
  }
  const seen = new Set<string>();
  for (const s of x as unknown[]) {
    if (typeof s !== 'string' || !re.test(s)) errs.push(`${what}: «${String(s)}» — не по формату`);
    else if (seen.has(s)) errs.push(`${what}: «${s}» повторяется`);
    else seen.add(s);
  }
}

/** Проверка course.json: пусто — годен. */
export function check(x: unknown): string[] {
  if (!isObj(x)) return ['курс: ожидался объект'];
  const errs: string[] = [];
  if (typeof x.id !== 'string' || !/^[a-z]{2,3}$/.test(x.id)) errs.push('id: ожидался код языка из 2–3 латинских букв');
  if (typeof x.layout !== 'string' || !slug.test(x.layout)) errs.push('layout: ожидался id раскладки');
  strings(x.explain, /^[a-z]{2,3}$/, 'explain', errs);
  strings(x.leagues, slug, 'leagues', errs);
  return errs;
}
