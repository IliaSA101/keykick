/**
 * Раздел сохранения v2: единственное описание на весь проект, помощники разбора и бюджет конверта
 * (спека 018 design §1, §3.4, §4.1). Чистые функции, без Vue и DOM.
 */
import type { JournalInput } from '../journal/records';

/**
 * Что известно об игре на момент разбора раздела. Движок каталог сам не читает (014-В2): число или список сюда
 * кладёт `app/save/instance.ts`. Поля необязательные — тест разбирает без контекста.
 */
export interface SaveContext {
  /** Текущая версия игры (`app/version`). */
  version?: string;
  /** id уроков курса v2 по порядку (`courseLessons`). */
  lessonIds?: readonly string[];
  /** Верных нажатий за монету (`content/match.json`): остаток кошелька зажимается по нему (018 design §3.3). Нет — зажима нет. */
  coinPer?: number;
}

/** Образец «все поля обязательны»: новое необязательное поле без добавления в образец не собирается (Б3). */
export type DeepRequired<T> = T extends readonly (infer U)[]
  ? DeepRequired<U>[]
  : T extends object
    ? { [K in keyof T]-?: DeepRequired<T[K]> }
    : T;

/** Значение только для чтения на любой глубине: то, что отдают `tx.get`, `readSection`, `sectionRef`. */
export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** Ключ раздела для чтения: имя и тип. Методом, а не свойством — чтобы `SectionDef<X>` ложился в `SectionDef`. */
export interface SectionKey<T> {
  readonly name: string;
  _t?(t: T): T;
}

/** Что есть в контенте: собирают тест и app, движок раздела сам каталог не читает. */
export interface Catalog {
  lessonIds: readonly string[];
  leagueIds: readonly string[];
  keyCodes: readonly string[];
  taskNoMax: number;
}

export interface SectionDef<T = unknown> extends SectionKey<T> {
  /** Спека-владелец: '017'. */
  owner: string;
  /** Не бросает; чинит по полям; не фильтрует по каталогу (014-В2). */
  parse(raw: unknown, ctx: SaveContext): T;
  empty(ctx: SaveContext): T;
  /** Образец формы: ни `null`, ни `[]`, ни `{}` на любой глубине (Б1, `assertFull`). */
  sample(): DeepRequired<T>;
  /** Все списки и словари на потолке — для бюджета конверта (В2). */
  maxSample(cat: Catalog): T;
  /** Счётчики, которые не должны убывать (ТЗ-0.11); нечего считать — `{}`. */
  counters(s: T): Record<string, number>;
  /** Инварианты ТЗ-13.8; пусто — ок, нечего проверять — `[]`. */
  check(s: T, cat: Catalog): string[];
}

/** Подсистема объявляет раздел одним файлом: `export const section = defineSection({…})`. */
export function defineSection<T>(d: SectionDef<T>): SectionDef<T> {
  return d;
}

/** Имена разделов (design §2). Другое имя — правка этого списка в коммите владельца. */
export const SECTION_PLAN: readonly string[] = [
  'club',
  'course',
  'match',
  'wallet',
  'school',
  'stadium',
  'collection',
  'games',
  'base',
  'championship',
  'day',
];

/** Бюджет одного конверта игрока в байтах JSON (018-Р13): все разделы на потолках не больше. */
export const ENVELOPE_MAX_BYTES = 40_960;

/** Транзакция над разделами игрока: тип здесь, чтобы касса движка писала через неё (Б2). Слой — `app/save/sections.ts`. */
export interface SectionTx {
  /** Копия разобранного лежащего; в dev и тестах заморожена глубоко. */
  get<T>(key: SectionKey<T>): DeepReadonly<T>;
  set<T>(def: SectionDef<T>, value: T): void;
  /** В журнал — после удачной записи. */
  log(rec: JournalInput): void;
}

// ───────────────────────────── помощники разбора ─────────────────────────────

/** Целое в [min, max]: не число, NaN — `min`; дробь — `floor`; за границами — зажим. */
export function int(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

/** Потолок даты JS (мс). */
export const TIME_MAX = 8.64e15;

/** Время в мс от эпохи: 0…8,64e15. Не `count()` из parse.ts — тот зажимает до 1e6, то есть до 1970. */
export function time(v: unknown): number {
  return int(v, 0, TIME_MAX);
}

/** Доля в тысячных: floor(1000·part/all); `all` = 0 — 0. */
export function permille(part: number, all: number): number {
  if (!(all > 0) || !(part > 0)) return 0;
  return Math.floor((1000 * part) / all);
}
