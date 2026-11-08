/**
 * Формат журнала игры (спека 018 design §5): виды, запись, нажатия, выгрузка. Чистые типы и мелкие функции.
 */

/** Вид записи журнала. */
export type JournalKind = 'match' | 'coin' | 'spend' | 'session' | 'milestone' | 'skip' | 'school' | 'game';

/** Откуда пришло зачисление монет: касса `wallet` пишет его в `coin.source` (метрика `coinSources`). */
export type CoinSource = 'match' | 'prize' | 'game' | 'base';

/**
 * Что просит записать `tx.log`: вид и данные вида. `id` задаёт писатель, если запись перезаписывается
 * (матч — один `id` на весь матч); без него журнал даст свой.
 */
export interface JournalInput {
  kind: JournalKind;
  data: unknown;
  id?: string;
}

/** Запись журнала (design §5): `jv` — версия смысла `data`, `app` — сборка, что записала. */
export interface JournalRecord {
  id: string;
  player: string;
  t: number;
  app: string;
  jv: 1;
  kind: JournalKind;
  data: unknown;
}

/** Нажатия одного матча: `ok` выводится как `typed[i] === expected[i]`, `dt` — мс от прошлого нажатия. */
export interface KeysLog {
  match: string;
  player: string;
  t: number;
  typed: string;
  expected: string;
  dt: number[];
}

/** Файл выгрузки журнала (design §6). */
export interface JournalDump {
  jv: 1;
  records: JournalRecord[];
  keys: KeysLog[];
}

/** Исход матча в журнале: `open` — не закрыт (брошен), `at` — номер последней атаки. */
export type MatchOutcome = 'open' | 'win' | 'loss';

/**
 * `data` вида `match` (то, что читают метрики; остальное владелец вида добавляет сам, 017).
 * `signs`/`errors`/`ms` — по матчу целиком: знаков, ошибок, миллисекунд печати.
 */
export interface MatchData {
  lesson: string;
  league: string;
  /** Номер урока в лиге, с 1. */
  n: number;
  attempt: number;
  outcome: MatchOutcome;
  at: number;
  signs?: number;
  errors?: number;
  ms?: number;
}

/** Предел `dt`: мс от прошлого нажатия, целое 0–60 000. */
export const DT_MAX = 60_000;

/** Верно ли каждое нажатие: `typed[i] === expected[i]`. */
export function keysOk(k: Pick<KeysLog, 'typed' | 'expected'>): boolean[] {
  return Array.from(k.typed, (ch, i) => ch === k.expected[i]);
}

/** `dt` в допустимый вид: целое 0–60 000, мусор → 0. */
export function clampDt(dt: readonly number[]): number[] {
  return dt.map((v) => (Number.isFinite(v) ? Math.min(DT_MAX, Math.max(0, Math.round(v))) : 0));
}

/** `id` записи: `<player>.<t36>.<tab><seq>`; `tab` — 4 знака вкладки, `seq` — счётчик вкладки. */
export function recordId(player: string, t: number, tab: string, seq: number): string {
  return `${player}.${Math.max(0, Math.floor(t)).toString(36)}.${tab}${seq}`;
}
