/**
 * Показ выгрузки и загрузки у родителя (спека 014-Т6, design §8): чистые функции без Vue и хранилища.
 * Из превью — строки двух колонок «сейчас / в файле»; из ответа слоя — итог (успех, частичный по Р11, отказ);
 * из `backup.at` — «N дней назад». Тексты подставляет компонент из i18n.
 */
import type { PlayerSummary, PreviewEntry } from './backup';
import { parseCopyName, type CopyKind } from './copies';

const DAY_MS = 24 * 3600 * 1000;

/** Местная дата `YYYY-MM-DD` по метке времени: даёт приложение (`app/session.localDay`), движок часов и поясов не знает. */
export type DayOf = (t: number) => string;

/** Номер суток из `YYYY-MM-DD` (по календарю, без часовых поясов); null — не дата. */
function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m === null ? null : Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
}

/**
 * Давность последнего файла: ещё не было, сегодня (в том числе часы ушли назад) или N календарных дней назад.
 * Считается по календарному дню, а не по суткам: файл вчера вечером — «1 день назад» уже утром.
 */
export type BackupAge = { kind: 'never' } | { kind: 'today' } | { kind: 'days'; days: number };

export function backupAge(at: number | null, now: number, dayOf: DayOf): BackupAge {
  if (at === null) return { kind: 'never' };
  const a = dayNumber(dayOf(at));
  const b = dayNumber(dayOf(now));
  const days = a === null || b === null ? 0 : b - a;
  return days < 1 ? { kind: 'today' } : { kind: 'days', days };
}

/** Дата файла `ДД.ММ.ГГГГ`; пусто — в файле нет времени (≤ 0 или не число). */
export function fileDateText(createdAt: number, dayOf: DayOf): string {
  return Number.isFinite(createdAt) && createdAt > 0 ? ruDate(dayOf(createdAt)) : '';
}

/** `YYYY-MM-DD` → `ДД.ММ.ГГГГ`; пусто — нет даты. */
export function ruDate(iso: string | null): string {
  const m = iso === null ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m === null ? '' : `${m[3]}.${m[2]}.${m[1]}`;
}

export interface PreviewCell {
  /** Номер урока с единицы (считает `summarize`). */
  lesson: number;
  coins: number;
  /** `ДД.ММ.ГГГГ`; пусто — не играл. */
  lastPlayed: string;
}

export interface PreviewRow {
  id: string;
  /** Имя из файла, а если его там нет — имя на устройстве. */
  name: string;
  /** Сохранение в файле не читается: игрок будет пропущен. */
  broken: boolean;
  /** Игрока на устройстве нет — будет добавлен. */
  isNew: boolean;
  /** null — на устройстве сохранения нет. */
  now: PreviewCell | null;
  /** null — в файле нет читаемого сохранения. */
  inFile: PreviewCell | null;
}

function cell(s: PlayerSummary | null): PreviewCell | null {
  return s === null ? null : { lesson: s.lesson, coins: s.coins, lastPlayed: ruDate(s.lastDay) };
}

/** Имя из файла; нет его (пусто или просто id) — имя на устройстве, а если и его нет — id. */
const nameOf = (e: PreviewEntry): string => (e.nameInFile !== '' && e.nameInFile !== e.id ? e.nameInFile : (e.nameNow ?? e.id));

export function previewRows(entries: readonly PreviewEntry[]): PreviewRow[] {
  return entries.map((e) => ({
    id: e.id,
    name: nameOf(e),
    broken: e.status === 'broken',
    // Нет в списке на устройстве — игрока добавят, даже если чей-то ключ сохранения там уже лежит.
    isNew: e.nameNow === null,
    now: cell(e.now),
    inFile: cell(e.inFile),
  }));
}

/** Есть кого загружать: хотя бы одно читаемое сохранение. */
export function canLoad(entries: readonly PreviewEntry[]): boolean {
  return entries.some((e) => e.status === 'ok' && e.sections !== null);
}

export type ApplyReason = 'v1' | 'readonly' | 'unreadable' | 'no-space';

/** Ответ `applyBackup` в том виде, в каком его читает показ (структурно: слой `app` движок не знает). */
export type ApplyAnswer =
  | { ok: true; applied: readonly string[]; skipped: readonly string[] }
  | { ok: false; reason: ApplyReason; applied?: readonly string[] };

/**
 * Итог загрузки. `done` — всё записано; `partial` (Р11) — часть игроков записана, остальным не хватило места или
 * хранилище отказало; `refused` — ничего не записано. Имена — игроков, а не id.
 */
export type ApplyReport =
  | { kind: 'done'; loaded: string[]; skipped: string[] }
  | { kind: 'partial'; loaded: string[]; lost: string[]; skipped: string[]; reason: ApplyReason }
  | { kind: 'refused'; reason: ApplyReason };

export function reportApply(answer: ApplyAnswer, entries: readonly PreviewEntry[]): ApplyReport {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const names = (ids: readonly string[]): string[] => ids.map((id) => {
    const e = byId.get(id);
    return e === undefined ? id : nameOf(e);
  });
  const skipped = entries.filter((e) => e.status !== 'ok').map(nameOf);
  if (answer.ok) return { kind: 'done', loaded: names(answer.applied), skipped };
  const applied = answer.applied ?? [];
  if (applied.length === 0) return { kind: 'refused', reason: answer.reason };
  const lost = entries.filter((e) => e.status === 'ok' && e.sections !== null && !applied.includes(e.id)).map(nameOf);
  return { kind: 'partial', loaded: names(applied), lost, skipped, reason: answer.reason };
}

/** После какого итога страницу надо перезагрузить: память ещё прежняя, а в хранилище уже новое (в том числе при частичном, Р11). */
export function needsReload(report: ApplyReport): boolean {
  return report.kind !== 'refused';
}

/** Итог — текстом для `sessionStorage`: после перезагрузки страница показывает его (014-Р13). */
export function encodeReport(report: ApplyReport): string {
  return JSON.stringify(report);
}

const REASONS: readonly string[] = ['v1', 'readonly', 'unreadable', 'no-space'];
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Итог из текста; чужое, битое и неполное — null (показывать нечего). */
export function decodeReport(text: string | null): ApplyReport | null {
  if (text === null) return null;
  let r: Record<string, unknown>;
  try {
    const raw: unknown = JSON.parse(text);
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    r = raw as Record<string, unknown>;
  } catch {
    return null;
  }
  const reason = r.reason as ApplyReason;
  if (r.kind === 'done' && strings(r.loaded) && strings(r.skipped)) return { kind: 'done', loaded: r.loaded, skipped: r.skipped };
  if (r.kind === 'partial' && strings(r.loaded) && strings(r.lost) && strings(r.skipped) && REASONS.includes(reason)) {
    return { kind: 'partial', loaded: r.loaded, lost: r.lost, skipped: r.skipped, reason };
  }
  if (r.kind === 'refused' && REASONS.includes(reason)) return { kind: 'refused', reason };
  return null;
}

/** Игроки, у которых при запуске нашли беду (`status().found`): имена по порядку id; игрока уже нет в списке — id. */
export function foundNames(found: Readonly<Record<string, string>>, nameOf: (id: string) => string | null): string[] {
  return Object.keys(found)
    .sort()
    .map((id) => nameOf(id) ?? id);
}

export interface CopyItem {
  /** Имя копии без префикса: по нему `downloadCopy` отдаёт файл. */
  key: string;
  kind: CopyKind;
  /** `ДД.ММ.ГГГГ`; пусто у `migrate` (у него формат, а не дата). */
  when: string;
  /** Формат, с которого миграция (только `migrate`). */
  format: number | null;
}

export interface CopyGroup {
  id: string;
  /** null — игрока уже нет в списке (копия «до удаления», чужой id). */
  name: string | null;
  items: CopyItem[];
}

/** Копии по игрокам: игроки по id; в игроке новые копии раньше, «до миграции» последними. Не копии (`save.*`, `events`) пропускаются. */
export function copyGroups(names: readonly string[], nameOfPlayer: (id: string) => string | null, dayOf: DayOf): CopyGroup[] {
  const byId = new Map<string, { at: number; item: CopyItem }[]>();
  for (const key of names) {
    const p = parseCopyName(key);
    if (p === null) continue;
    const isDate = /^\d{4}-/.test(p.tail);
    const item: CopyItem = {
      key,
      kind: p.kind,
      when: p.kind === 'migrate' ? '' : ruDate(isDate ? p.tail : dayOf(p.at)),
      format: p.kind === 'migrate' ? Number(p.tail.slice(1)) : null,
    };
    byId.set(p.id, [...(byId.get(p.id) ?? []), { at: p.kind === 'migrate' ? -p.at : p.at, item }]);
  }
  return [...byId.keys()].sort().map((id) => ({
    id,
    name: nameOfPlayer(id),
    items: (byId.get(id) ?? []).sort((a, b) => b.at - a.at || a.item.key.localeCompare(b.item.key)).map((x) => x.item),
  }));
}
