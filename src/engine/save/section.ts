/**
 * Раздел сохранения: контракт и миграция по цепочке `up` (060 design §3).
 * Ядро не знает ни одного раздела — их перечисляет реестр сборки (src/app/save/sections.ts).
 */

/** Описание раздела: имя, текущая версия формы, пустое значение, шаги миграции и проверка. */
export interface SectionDef<T> {
  /** Имя в конверте: 'course:ru', 'club', 'league:ru.yard'… */
  name: string;
  /** Текущая версия формы данных, целое ≥ 1. */
  v: number;
  /** Пустой раздел текущей версии (новый игрок; раздел, которого в сохранении ещё не было). */
  empty(): T;
  /** `up[k]` переводит форму k-1 в k; чистая функция. */
  up: Record<number, (data: unknown) => unknown>;
  /** Пустой список — данные годны. Иначе — коды ошибок (английские, без кириллицы). */
  check(data: unknown): string[];
}

/** Результат миграции одного раздела. */
export type Migrated = { ok: true; data: unknown } | { ok: false; why: string };

/** Безопасное целое (не дробь, не NaN, не бесконечность, не больше 2^53−1: выше `n + 1 === n`, сверка rev ломается). */
export function isInt(x: unknown): x is number {
  return typeof x === 'number' && Number.isSafeInteger(x);
}

/** Данные раздела — объект (не `null`, не массив): первая проверка любого `check`. */
export function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/** Какие из полей `keys` — не безопасные неотрицательные целые: их имена для списка ошибок `check`. */
export function badCounters(x: Record<string, unknown>, keys: readonly string[]): string[] {
  return keys.filter((k) => !isInt(x[k]) || x[k] < 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** День — строка `ГГГГ-ММ-ДД` существующей даты (А-20: дни в сохранении только строками). */
export function isDay(x: unknown): x is string {
  if (typeof x !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Поднимает данные раздела с версии `from` до `def.v`: `up[from+1]`, …, `up[def.v]` подряд.
 * Не бросает: нет шага или шаг упал — `{ ok:false, why }`. Версия новее `def.v` сюда не попадает (это `newer`).
 */
export function migrateSection(def: SectionDef<unknown>, from: number, data: unknown): Migrated {
  let cur = data;
  for (let k = from + 1; k <= def.v; k++) {
    const step = Object.hasOwn(def.up, k) ? def.up[k] : undefined;
    if (!step) return { ok: false, why: `no-up:${k}` };
    try {
      cur = step(cur);
    } catch {
      return { ok: false, why: `up-failed:${k}` };
    }
  }
  return { ok: true, data: cur };
}
