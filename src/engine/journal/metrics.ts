/**
 * 13 метрик журнала (спека 018 design §7). Чистая функция: `metrics(records, keys, course)` по записям одного игрока.
 * Нет данных — `value: null`, не `NaN`. Доли — 0…1, время — минуты, перерыв — дни.
 */
import type { JournalRecord, KeysLog, MatchData } from './records';

export type MetricId =
  | 'coinSources'
  | 'gameCoinShare'
  | 'milestones'
  | 'restAfterFinal'
  | 'firstLessonsAcc'
  | 'schoolShare'
  | 'baseGames'
  | 'breakSkips'
  | 'gamesToGold'
  | 'schoolSkips'
  | 'firstTryMedals'
  | 'firstTryPass'
  | 'medianCpm';

export interface MetricRow {
  id: MetricId;
  value: number | null;
  alarm: boolean;
  /** Разбивка там, где одного числа мало (источники монет, вехи по датам). */
  detail?: Record<string, number>;
}

/** Из курса метрикам нужны только лиги: с какого урока идёт Shift. */
export interface MetricsCourse {
  leagues: readonly { id: string; shiftFrom?: number }[];
}

export const METRIC_IDS: readonly MetricId[] = [
  'coinSources', 'gameCoinShare', 'milestones', 'restAfterFinal', 'firstLessonsAcc', 'schoolShare', 'baseGames',
  'breakSkips', 'gamesToGold', 'schoolSkips', 'firstTryMedals', 'firstTryPass', 'medianCpm',
];

/** Порог тревоги: игры и «Школа» не больше 20 % (ТЗ-12.13). */
export const SHARE_ALARM = 0.2;
/** Сколько первых уроков лиги (и уроков Shift) идёт в `firstLessonsAcc`. */
export const FIRST_LESSONS = 5;

type Bag = Record<string, unknown>;

function dataOf(r: JournalRecord): Bag {
  return typeof r.data === 'object' && r.data !== null ? (r.data as Bag) : {};
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function mean(xs: number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function matches(records: readonly JournalRecord[]): { r: JournalRecord; d: MatchData }[] {
  return records
    .filter((r) => r.kind === 'match')
    .map((r) => ({ r, d: dataOf(r) as unknown as MatchData }))
    .filter((x) => typeof x.d.lesson === 'string');
}

function accuracy(d: MatchData): number | null {
  const signs = num(d.signs);
  const errors = num(d.errors);
  if (signs === null || errors === null || signs <= 0) return null;
  return Math.max(0, 1 - errors / signs);
}

function cpm(d: MatchData): number | null {
  const signs = num(d.signs);
  const ms = num(d.ms);
  if (signs === null || ms === null || ms <= 0) return null;
  return (signs / ms) * 60_000;
}

function row(id: MetricId, value: number | null, alarm = false, detail?: Record<string, number>): MetricRow {
  const out: MetricRow = { id, value, alarm };
  if (detail) out.detail = detail;
  return out;
}

function coinMetrics(records: readonly JournalRecord[]): MetricRow[] {
  const by: Record<string, number> = {};
  for (const r of records) {
    if (r.kind !== 'coin') continue;
    const d = dataOf(r);
    const coins = num(d.coins);
    if (coins === null || typeof d.source !== 'string') continue;
    by[d.source] = (by[d.source] ?? 0) + coins;
  }
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const has = Object.keys(by).length > 0;
  const share = has && total > 0 ? (by.game ?? 0) / total : null;
  return [row('coinSources', has ? total : null, false, has ? by : undefined), row('gameCoinShare', share, share !== null && share > SHARE_ALARM)];
}

function milestoneMetrics(records: readonly JournalRecord[]): MetricRow[] {
  const ms = records.filter((r) => r.kind === 'milestone').sort((a, b) => a.t - b.t);
  const dates: Record<string, number> = {};
  for (const r of ms) {
    const name = dataOf(r).name;
    if (typeof name === 'string' && !(name in dates)) dates[name] = r.t;
  }
  const finals = ms.filter((r) => dataOf(r).name === 'league-final');
  const sessions = records.filter((r) => r.kind === 'session').sort((a, b) => a.t - b.t);
  let rest: number | null = null;
  const lastFinal = finals[finals.length - 1];
  if (lastFinal) {
    const next = sessions.find((s) => (num(dataOf(s).start) ?? s.t) > lastFinal.t);
    if (next) rest = ((num(dataOf(next).start) ?? next.t) - lastFinal.t) / 86_400_000;
  }
  return [row('milestones', ms.length ? Object.keys(dates).length : null, false, ms.length ? dates : undefined), row('restAfterFinal', rest)];
}

function firstLessonsAcc(records: readonly JournalRecord[], course: MetricsCourse): MetricRow {
  const shift = new Map(course.leagues.map((l) => [l.id, l.shiftFrom]));
  const accs: number[] = [];
  for (const { d } of matches(records)) {
    if (d.outcome === 'open') continue;
    const from = shift.get(d.league);
    const first = d.n >= 1 && d.n <= FIRST_LESSONS;
    const inShift = from !== undefined && d.n >= from && d.n < from + FIRST_LESSONS;
    const a = accuracy(d);
    if ((first || inShift) && a !== null) accs.push(a);
  }
  return row('firstLessonsAcc', mean(accs));
}

function schoolShare(records: readonly JournalRecord[]): MetricRow {
  let school = 0;
  let total = 0;
  for (const r of records) {
    if (r.kind !== 'session') continue;
    const m = dataOf(r).minutes;
    if (typeof m !== 'object' || m === null) continue;
    for (const [k, v] of Object.entries(m as Bag)) {
      const n = num(v);
      if (n === null) continue;
      total += n;
      if (k === 'school') school += n;
    }
  }
  const share = total > 0 ? school / total : null;
  return row('schoolShare', share, share !== null && share > SHARE_ALARM);
}

function gameMetrics(records: readonly JournalRecord[]): MetricRow[] {
  const games = records.filter((r) => r.kind === 'game').sort((a, b) => a.t - b.t);
  const gold = games.findIndex((r) => (num(dataOf(r).gold) ?? 0) > 0);
  const base = games.filter((r) => Boolean(dataOf(r).base)).length;
  return [row('baseGames', games.length ? base : null), row('gamesToGold', gold >= 0 ? gold + 1 : null)];
}

function skipMetrics(records: readonly JournalRecord[]): MetricRow[] {
  const skips = records.filter((r) => r.kind === 'skip');
  const school = records.filter((r) => r.kind === 'school');
  const breaks = skips.filter((r) => dataOf(r).what === 'break').length;
  const skipped = school.filter((r) => dataOf(r).skipped === true).length;
  return [row('breakSkips', records.length ? breaks : null), row('schoolSkips', school.length ? skipped : null)];
}

function firstTryMedals(records: readonly JournalRecord[]): MetricRow {
  const medals = records.filter((r) => r.kind === 'school' && (num(dataOf(r).medal) ?? 0) > 0);
  if (medals.length === 0) return row('firstTryMedals', null);
  return row('firstTryMedals', medals.filter((r) => dataOf(r).attempt === 1).length / medals.length);
}

/** Первая попытка по каждому уроку (наименьший `attempt`); брошенный (`open`) — не пройден. */
function firstTryPass(records: readonly JournalRecord[]): MetricRow {
  const first = new Map<string, MatchData>();
  for (const { d } of matches(records)) {
    const at = num(d.attempt) ?? 1;
    const cur = first.get(d.lesson);
    if (!cur || at < (num(cur.attempt) ?? 1)) first.set(d.lesson, d);
  }
  if (first.size === 0) return row('firstTryPass', null);
  let win = 0;
  for (const d of first.values()) if (d.outcome === 'win') win += 1;
  return row('firstTryPass', win / first.size);
}

function medianCpm(records: readonly JournalRecord[]): MetricRow {
  const xs: number[] = [];
  for (const { d } of matches(records)) {
    if (d.outcome === 'open') continue;
    const c = cpm(d);
    if (c !== null) xs.push(c);
  }
  return row('medianCpm', median(xs));
}

/**
 * Метрики игрока. `keys` пока не нужны (скорость берётся из `match`), параметр оставлен под метрики по нажатиям.
 * Порядок строк — как `METRIC_IDS`.
 */
export function metrics(records: readonly JournalRecord[], _keys: readonly KeysLog[], course: MetricsCourse): MetricRow[] {
  const all = [
    ...coinMetrics(records),
    ...milestoneMetrics(records),
    firstLessonsAcc(records, course),
    schoolShare(records),
    ...gameMetrics(records),
    ...skipMetrics(records),
    firstTryMedals(records),
    firstTryPass(records),
    medianCpm(records),
  ];
  return METRIC_IDS.map((id) => all.find((r) => r.id === id)!);
}
