/**
 * «Что нового»: сравнение версий и отбор записей. Чистые функции — номер версии игры
 * приходит аргументом (app/version), ничего глобального здесь нет.
 */

/** Запись о версии: что увидит ребёнок (kid) и что прочтёт родитель (parent). Пустой kid — карточки нет. */
export interface NewsEntry {
  version: string;
  /** «ГГГГ-ММ-ДД»; пусто — дата ещё не поставлена (до выпуска). */
  date: string;
  kid: string[];
  parent: string[];
}

/** Версия, которой считается сохранение без поля «видел новости» (до появления «Что нового»). */
export const NEWS_LEGACY_SEEN = '0.9.0';
/** Больше строк в карточке ребёнка не бывает: пропустившему много версий — только свежее. */
export const NEWS_KID_MAX = 6;

const VERSION_RE = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;

/** «X.Y.Z» из чисел — единственный допустимый вид номера. */
export function isVersion(v: unknown): v is string {
  return typeof v === 'string' && VERSION_RE.test(v);
}

function parts(v: string): [number, number, number] {
  const m = VERSION_RE.exec(v);
  return m === null ? [0, 0, 0] : [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Сравнение по числам, а не по строкам: 0.10.0 > 0.9.0. Битый номер считается 0.0.0. <0, 0, >0. */
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** Записи с версией не новее current, новые сверху; записи с битым номером выбрасываются. */
function upTo(news: readonly NewsEntry[], current: string): NewsEntry[] {
  return news
    .filter((n) => isVersion(n.version) && compareVersions(n.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Строки карточки для ребёнка: kid всех версий, которые новее seen и не новее current, новые сверху,
 * не больше NEWS_KID_MAX. Версии без kid-строк (исправления) ничего не дают; всё увидено — пусто.
 * seen битый — как NEWS_LEGACY_SEEN.
 */
export function unseen(news: readonly NewsEntry[], seen: string, current: string): string[] {
  const from = isVersion(seen) ? seen : NEWS_LEGACY_SEEN;
  const lines = upTo(news, current)
    .filter((n) => compareVersions(n.version, from) > 0)
    .flatMap((n) => n.kid);
  return lines.slice(0, NEWS_KID_MAX);
}

/** Список для родителя: все записи не новее current, новые сверху. */
export function parentNews(news: readonly NewsEntry[], current: string): NewsEntry[] {
  return upTo(news, current);
}

/** Из двух отметок «видел до версии» — более поздняя; битая уступает годной. */
export function laterVersion(a: string, b: string): string {
  if (!isVersion(a)) return isVersion(b) ? b : NEWS_LEGACY_SEEN;
  if (!isVersion(b)) return a;
  return compareVersions(a, b) >= 0 ? a : b;
}
