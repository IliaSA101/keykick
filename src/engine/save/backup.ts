/**
 * Журнал событий и файл выгрузки (спека 014-Т4, design §6, §8). Чистые функции: хранилище, часы и скачивание —
 * у app-слоя (`app/save/eventLog.ts`, `app/save/backup.ts`).
 */
import { classify, migrate, parseSections, type SaveEnvelope, type SectionDef } from './format';
import { PLAYERS_MAX, checkPlayerName, type Player } from '../players';
import { copyPlayerName, isCopyName } from './copies';
import type { SaveContext } from './section';

// ───────────────────────────── журнал событий ─────────────────────────────

export type EventKind = 'screen' | 'action' | 'error' | 'storage';

export interface EventRecord {
  t: number;
  v: string;
  player: string | null;
  kind: EventKind;
  text: string;
  stack?: string;
}

export interface EventLimits {
  count: number;
  bytes: number;
  text: number;
  stack: number;
}

/** Кольцо: 200 записей, 64 КБ в JSON, `text` до 300 знаков, `stack` до 2 КБ (ТЗ-12.15). */
export const EVENT_LIMITS: EventLimits = { count: 200, bytes: 64 * 1024, text: 300, stack: 2048 };

/** Добавить запись: поля обрезаются, старые выбрасываются по числу и по размеру. Исходный журнал не меняется. */
export function pushEvent(log: readonly EventRecord[], rec: EventRecord, limits: EventLimits = EVENT_LIMITS): EventRecord[] {
  const cut: EventRecord = { ...rec, text: rec.text.slice(0, limits.text) };
  if (rec.stack !== undefined) cut.stack = rec.stack.slice(0, limits.stack);
  let out = [...log, cut];
  if (out.length > limits.count) out = out.slice(out.length - limits.count);
  while (out.length > 1 && JSON.stringify(out).length > limits.bytes) out = out.slice(1);
  return out;
}

/** Журнал из сырого текста; битое или не список — пусто (это лог, не прогресс), `ok: false` — чтобы записать об этом. */
export function parseEvents(text: string | null): { log: EventRecord[]; ok: boolean } {
  if (text === null) return { log: [], ok: true };
  try {
    const raw: unknown = JSON.parse(text);
    if (!Array.isArray(raw)) return { log: [], ok: false };
    const log = raw.filter(
      (r): r is EventRecord =>
        r !== null && typeof r === 'object' && typeof (r as EventRecord).t === 'number' && typeof (r as EventRecord).text === 'string',
    );
    return { log, ok: true };
  } catch {
    return { log: [], ok: false };
  }
}

// ───────────────────────────── файл выгрузки ─────────────────────────────

export interface BackupFile {
  kind: 'keykick-backup';
  file: 1;
  major: number;
  channel: 'release' | 'next';
  app: string;
  browser: string;
  createdAt: number;
  players: unknown;
  /** Общая часть компьютера; null — файл-снимок одного игрока (общая часть не заменяется). */
  shared: unknown;
  saves: Record<string, string>;
  copies: Record<string, string>;
  events: EventRecord[];
  journal: unknown;
  fromMemory?: string[];
}

export interface BackupMeta {
  major: number;
  channel: 'release' | 'next';
  app: string;
  browser: string;
  createdAt: number;
  storageFull: boolean;
  journal?: unknown;
  /** Формат и черновик программы, для конверта из памяти. */
  format: number;
  draft: number;
}

/** Сохранение игрока в памяти слоя. */
export interface MemorySave {
  rev: number;
  save: Record<string, unknown>;
}

const SAVE_PREFIX = 'save.';

function jsonOrNull(text: string | undefined): unknown {
  if (text === undefined) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function sectionsOf(text: string | undefined): unknown {
  const d = classify(text ?? null);
  return d.kind === 'ok' || d.kind === 'migrate' ? d.envelope.sections : undefined;
}

function revOf(text: string | undefined): number {
  const d = classify(text ?? null);
  return d.kind === 'ok' || d.kind === 'migrate' ? d.envelope.rev : 0;
}

/** Имя файла: `keykick-<YYYY-MM-DD>-<app>.json`. */
export function backupFileName(date: string, app: string): string {
  return `keykick-${date}-${app}.json`;
}

/**
 * Сборка файла из выгрузки хранилища (имя без префикса → текст). Хранилище переполнено — сохранение игрока, чьё
 * состояние в памяти отличается от лежащего, берётся из памяти (конверт с `rev` памяти), id — в `fromMemory` (В4);
 * но только если память не старше лежащего (`mem.rev >= rev`): иначе другая вкладка записала новее — берётся лежащее.
 */
export function buildBackup(dump: Readonly<Record<string, string>>, memory: Readonly<Record<string, MemorySave>>, meta: BackupMeta): BackupFile {
  const saves: Record<string, string> = {};
  const copies: Record<string, string> = {};
  for (const [name, text] of Object.entries(dump)) {
    if (name.startsWith(SAVE_PREFIX)) saves[name.slice(SAVE_PREFIX.length)] = text;
    else if (isCopyName(name)) copies[name] = text;
  }
  const fromMemory: string[] = [];
  if (meta.storageFull) {
    for (const [id, mem] of Object.entries(memory)) {
      const lying = sectionsOf(saves[id]);
      if (lying !== undefined && JSON.stringify(lying) === JSON.stringify(mem.save)) continue;
      if (lying !== undefined && mem.rev < revOf(saves[id])) continue;
      const env: SaveEnvelope = { format: meta.format, draft: meta.draft, rev: mem.rev, app: meta.app, sections: mem.save };
      saves[id] = JSON.stringify(env);
      fromMemory.push(id);
    }
  }
  const { log } = parseEvents(dump.events ?? null);
  return {
    kind: 'keykick-backup',
    file: 1,
    major: meta.major,
    channel: meta.channel,
    app: meta.app,
    browser: meta.browser,
    createdAt: meta.createdAt,
    players: jsonOrNull(dump.players),
    shared: jsonOrNull(dump.session),
    saves,
    copies,
    events: log,
    journal: meta.journal ?? null,
    ...(fromMemory.length > 0 ? { fromMemory } : {}),
  };
}

/**
 * Файл одного игрока из копии (снимок, `pre.*`): `saves` — один игрок, `shared: null`, копий и журнала нет.
 * Игрока из копии «до удаления» в нынешнем списке нет, и без него загруженное сохранение лежало бы без игрока (014-Р14):
 * такого игрока дописываем в `players` файла под именем из копии (`copyPlayerName`), а нет его или оно занято —
 * под запасным (`fallbackName(n)` — первое свободное).
 */
export function buildCopyBackup(
  id: string,
  copyText: string,
  players: unknown,
  meta: BackupMeta,
  fallbackName: (n: number) => string,
): BackupFile {
  const list = isRecord(players) && Array.isArray(players.players) ? (players.players as unknown[]) : null;
  const named = (x: unknown): x is { id: string; name: string } => isRecord(x) && typeof x.id === 'string' && typeof x.name === 'string';
  let filePlayers: unknown = players;
  if (list !== null && !list.some((x) => named(x) && x.id === id)) {
    // Занятость и годность имени — теми же правилами, что у самого списка (ё = е, 2–12 знаков, допустимые знаки).
    const others = list.filter(named).map((x): Player => ({ id: x.id, name: x.name }));
    const own = copyPlayerName(copyText);
    const ownCheck = own === null ? null : checkPlayerName(own, others);
    let name = ownCheck?.ok === true ? ownCheck.name : '';
    for (let n = list.length + 1; name === ''; n += 1) {
      const check = checkPlayerName(fallbackName(n), others);
      if (check.ok || check.error !== 'taken') name = fallbackName(n);
    }
    filePlayers = { ...(players as Record<string, unknown>), players: [...list, { id, name }] };
  }
  return {
    kind: 'keykick-backup',
    file: 1,
    major: meta.major,
    channel: meta.channel,
    app: meta.app,
    browser: meta.browser,
    createdAt: meta.createdAt,
    players: filePlayers,
    shared: null,
    saves: { [id]: copyText },
    copies: {},
    events: [],
    // Журнал игры — только этого игрока: его вставляет вызывающий (018-Р24); нет — null.
    journal: meta.journal ?? null,
  };
}

export type BackupRefusal = 'not-json' | 'not-backup' | 'file-version' | 'other-major';

export type ParsedBackup = { ok: true; file: BackupFile } | { ok: false; reason: BackupRefusal };

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function stringMap(v: unknown): Record<string, string> | null {
  if (!isRecord(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) {
    if (typeof x !== 'string') return null;
    out[k] = x;
  }
  return out;
}

/** Файл из текста: тип, версия файла, мажор игры. Сами сохранения проверяются при превью. */
export function parseBackup(text: string, major: number): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (!isRecord(raw) || raw.kind !== 'keykick-backup') return { ok: false, reason: 'not-backup' };
  if (raw.file !== 1) return { ok: false, reason: 'file-version' };
  if (raw.major !== major) return { ok: false, reason: 'other-major' };
  const saves = stringMap(raw.saves);
  const copies = stringMap(raw.copies ?? {});
  if (saves === null || copies === null) return { ok: false, reason: 'not-backup' };
  const file: BackupFile = {
    kind: 'keykick-backup',
    file: 1,
    major,
    channel: raw.channel === 'release' ? 'release' : 'next',
    app: typeof raw.app === 'string' ? raw.app : '',
    browser: typeof raw.browser === 'string' ? raw.browser : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
    players: raw.players ?? null,
    shared: raw.shared ?? null,
    saves,
    copies,
    events: parseEvents(JSON.stringify(raw.events ?? [])).log,
    journal: raw.journal ?? null,
  };
  if (Array.isArray(raw.fromMemory)) file.fromMemory = raw.fromMemory.filter((x): x is string => typeof x === 'string');
  return { ok: true, file };
}

// ───────────────────────────── превью загрузки ─────────────────────────────

/** Что показать про игрока в колонке превью. */
export interface PlayerSummary {
  lesson: number;
  coins: number;
  /** Последний день игры, `YYYY-MM-DD`; null — не играл. */
  lastDay: string | null;
}

export interface PreviewEntry {
  id: string;
  /** Имя игрока в списке на устройстве сейчас; null — такого игрока здесь нет. */
  nameNow: string | null;
  /** Имя игрока в файле (нет — id). */
  nameInFile: string;
  /** 'broken' — сохранение в файле не читается: игрок помечен и при загрузке пропускается. */
  status: 'ok' | 'broken';
  /** Разобранные разделы из файла (после миграции); null у битого. */
  sections: Record<string, unknown> | null;
  now: PlayerSummary | null;
  inFile: PlayerSummary | null;
}

export type Preview =
  | { ok: true; entries: PreviewEntry[] }
  | { ok: false; reason: 'newer'; id: string }
  | { ok: false; reason: 'players-full' };

/**
 * Колонка превью из разделов v2: урок — место `course.lesson` среди уроков курса с единицы (как карточка игрока,
 * `app/players/cards`); пусто или незнакомый — первый; монеты — кошелёк.
 * Последний день игры жил в `legacy.days`; раздела дня (040) ещё нет — `null` (018-Р32).
 */
export function summarize(sections: Readonly<Record<string, unknown>>, ctx: SaveContext): PlayerSummary {
  const course = sections.course;
  const wallet = sections.wallet;
  const at = isRecord(course) && typeof course.lesson === 'string' ? (ctx.lessonIds ?? []).indexOf(course.lesson) : -1;
  const lesson = at < 0 ? 1 : at + 1;
  const coins = isRecord(wallet) && typeof wallet.coins === 'number' ? wallet.coins : 0;
  return { lesson, coins, lastDay: null };
}

type Decoded = { kind: 'sections'; sections: Record<string, unknown> } | { kind: 'newer' | 'broken' | 'none' };

/** Разделы из сырого текста сохранения: ok/migrate → разобранные; newer, битое, ничего — своё. */
function decode(text: string | null, ctx: SaveContext, registry: readonly SectionDef[]): Decoded {
  const d = classify(text);
  if (d.kind === 'fresh') return { kind: 'none' };
  if (d.kind === 'newer') return { kind: 'newer' };
  if (d.kind === 'broken' || d.kind === 'stale-draft') return { kind: 'broken' };
  let env: SaveEnvelope;
  if (d.kind === 'ok') env = d.envelope;
  else {
    const done = migrate(d.envelope);
    if (!done.ok) return { kind: 'broken' };
    env = done.envelope;
  }
  return { kind: 'sections', sections: parseSections(env.sections, ctx, registry) };
}

function nameOf(players: unknown, id: string): string | null {
  const list: unknown[] = isRecord(players) && Array.isArray(players.players) ? (players.players as unknown[]) : [];
  const p = list.find((x) => isRecord(x) && x.id === id);
  return isRecord(p) && typeof p.name === 'string' ? p.name : null;
}

/**
 * Превью: по игроку из `saves` файла — «сейчас» и «в файле». Любое сохранение новее программы — в файле или лежащее
 * на устройстве (В6) — отказ всего файла; битое — игрок помечен. `current` — лежащие сохранения (id → текст) и список игроков.
 */
export function previewBackup(
  file: BackupFile,
  current: { saves: Readonly<Record<string, string | null>>; players: unknown },
  ctx: SaveContext,
  registry: readonly SectionDef[],
): Preview {
  const entries: PreviewEntry[] = [];
  for (const [id, text] of Object.entries(file.saves)) {
    const inFile = decode(text, ctx, registry);
    if (inFile.kind === 'newer') return { ok: false, reason: 'newer', id };
    const now = decode(current.saves[id] ?? null, ctx, registry);
    if (now.kind === 'newer') return { ok: false, reason: 'newer', id };
    const sections = inFile.kind === 'sections' ? inFile.sections : null;
    entries.push({
      id,
      nameNow: nameOf(current.players, id),
      nameInFile: nameOf(file.players, id) ?? id,
      status: sections === null ? 'broken' : 'ok',
      sections,
      now: now.kind === 'sections' ? summarize(now.sections, ctx) : null,
      inFile: sections === null ? null : summarize(sections, ctx),
    });
  }
  // Возвращаемые игроки (в том числе из копии удалённого) не должны переполнить список: при чтении лишний молча
  // выпал бы, и его сохранение лежало бы без игрока (014-Р16). Считаем так же, как `run` при записи.
  const merged = mergePlayers(current.players, file.players, entries.filter((e) => e.status === 'ok').map((e) => e.id));
  const count = isRecord(merged) && Array.isArray(merged.players) ? merged.players.length : 0;
  if (count > PLAYERS_MAX) return { ok: false, reason: 'players-full' };
  return { ok: true, entries };
}

/**
 * Список игроков после загрузки: нынешние в прежнем порядке (имя — из файла, если он берёт игрока), затем новые из файла.
 * `only` — id, реально записанные из файла (014-Р11): остальных игроков файла в список не берём (удалённый на
 * устройстве не воскресает, пока его сохранение не записано); не задан — все. Файла-списка нет — прежний список как есть.
 */
export function mergePlayers(current: unknown, fromFile: unknown, only?: readonly string[]): unknown {
  if (!isRecord(fromFile) || !Array.isArray(fromFile.players)) return current;
  const valid = (x: unknown): x is { id: string; name: string } => isRecord(x) && typeof x.id === 'string' && typeof x.name === 'string';
  const filePlayers = (fromFile.players as unknown[]).filter(valid).filter((p) => only === undefined || only.includes(p.id));
  const own = isRecord(current) && Array.isArray(current.players) ? (current.players as unknown[]).filter(valid) : [];
  // Порядок нынешних игроков не меняется (имя — из файла, если он берёт этого игрока); новые из файла — в конец (014-Р16).
  const byId = new Map(filePlayers.map((p) => [p.id, p]));
  const ownIds = new Set(own.map((p) => p.id));
  const players = [...own.map((p) => byId.get(p.id) ?? p), ...filePlayers.filter((p) => !ownIds.has(p.id))];
  const cur = (v: unknown): string | null => (isRecord(v) && typeof v.current === 'string' ? v.current : null);
  const last = (v: unknown): number => (isRecord(v) && typeof v.lastId === 'number' ? v.lastId : 0);
  const keep = [cur(fromFile), cur(current)].find((c) => c !== null && players.some((p) => p.id === c)) ?? null;
  return { players, current: keep, lastId: Math.max(last(fromFile), last(current)) };
}
