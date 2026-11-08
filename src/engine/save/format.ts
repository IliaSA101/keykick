/**
 * Конверт сохранения, разбор при загрузке и цепочка миграций (спека 014, design §1–§3).
 * Чистые функции: хранилище и часы — у app-слоя (app/save/store.ts), сюда приходят строки и числа.
 */
import type { PlayersData } from '../players';
import type { SharedSession } from '../session';
import type { DeepRequired, SaveContext, SectionDef } from './section';

export type { DeepRequired, SectionDef } from './section';

/**
 * Номер формата. 0 — «нулевой» период до v2.0 (014-Р1): миграций нет, несовместимое уходит в карантин,
 * совместимость задаёт SAVE_DRAFT. С выпуском v2.0 станет 1, дальше +1 с миграцией на каждый шаг.
 */
export const SAVE_FORMAT = 0;
/** Номер черновика при формате 0: растёт при любой несовместимой правке формы (018 поднимает). */
export const SAVE_DRAFT = 2;

/** Разделы, которым разрешён фильтр по каталогу контента (design §1, В2). После ухода `legacy` (018-Т6б) — никому. */
export const CATALOG_FILTER_EXEMPT: readonly string[] = [];

export interface SaveEnvelope {
  format: number;
  draft?: number;
  /** Счётчик записей этого ключа: +1 при каждой записи (design §5, Б2). */
  rev: number;
  /** APP_VERSION программы, записавшей конверт: для журнала и разбора, не для решений. */
  app: string;
  sections: Record<string, unknown>;
}

/** Что умеет программа: формат и черновик (в тестах подменяются). */
export interface ProgramFormat {
  format: number;
  draft: number;
}

export const PROGRAM: ProgramFormat = { format: SAVE_FORMAT, draft: SAVE_DRAFT };

// ───────────────────────────── разделы ─────────────────────────────

function stamp(program: ProgramFormat): Pick<SaveEnvelope, 'format'> & { draft?: number } {
  return program.format === 0 ? { format: 0, draft: program.draft } : { format: program.format };
}

/** Чистый конверт: каждый раздел реестра — `empty(ctx)`. Реестр — полный, `app/save/registry.ts`. */
export function emptyEnvelope(app: string, registry: readonly SectionDef[], ctx: SaveContext = {}): SaveEnvelope {
  return {
    ...stamp(PROGRAM),
    rev: 0,
    app,
    sections: Object.fromEntries(registry.map((s) => [s.name, s.empty(ctx)])),
  };
}

/** Разобрать зарегистрированные разделы; незнакомые остаются как есть и пишутся обратно. */
export function parseSections(
  sections: Record<string, unknown>,
  ctx: SaveContext,
  registry: readonly SectionDef[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...sections };
  for (const def of registry) out[def.name] = def.parse(sections[def.name], ctx);
  return out;
}

/** Следующий конверт к записи: разделы новые, `rev + 1`, формат и черновик — программы. */
export function nextEnvelope(prev: Pick<SaveEnvelope, 'rev'>, sections: Record<string, unknown>, app: string): SaveEnvelope {
  return { ...stamp(PROGRAM), rev: prev.rev + 1, app, sections };
}

// ───────────────────────────── разбор при загрузке ─────────────────────────────

export type BrokenReason = 'json' | 'shape';

export type LoadDecision =
  | { kind: 'fresh' }
  | { kind: 'broken'; reason: BrokenReason }
  | { kind: 'stale-draft'; format: number; draft: number }
  | { kind: 'newer'; format: number; draft: number }
  | { kind: 'ok'; envelope: SaveEnvelope }
  | { kind: 'migrate'; envelope: SaveEnvelope; from: number };

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function wholeNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/** Решение по сырой строке из хранилища; битое надо сохранить побайтно — сырьё здесь не меняется (design §2). */
export function classify(text: string | null, program: ProgramFormat = PROGRAM): LoadDecision {
  if (text === null) return { kind: 'fresh' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'broken', reason: 'json' };
  }
  if (!isObject(raw)) return { kind: 'broken', reason: 'shape' };
  if (!wholeNumber(raw.format)) return { kind: 'broken', reason: 'shape' };
  const format = raw.format;
  const draft = wholeNumber(raw.draft) ? raw.draft : 0;
  // «Новее программы» решает номер, а не состав: будущий формат мог переименовать `sections`, и затирать его нельзя.
  if (format > program.format || (format === 0 && program.format === 0 && draft > program.draft)) {
    return { kind: 'newer', format, draft };
  }
  if (!isObject(raw.sections)) return { kind: 'broken', reason: 'shape' };
  const envelope: SaveEnvelope = {
    format,
    ...(format === 0 ? { draft } : {}),
    rev: wholeNumber(raw.rev) ? raw.rev : 0,
    app: typeof raw.app === 'string' ? raw.app : '',
    sections: raw.sections,
  };
  if (format === 0) {
    if (program.format >= 1 || draft < program.draft) return { kind: 'stale-draft', format, draft };
    return { kind: 'ok', envelope };
  }
  if (format < program.format) return { kind: 'migrate', envelope, from: format };
  return { kind: 'ok', envelope };
}

// ───────────────────────────── миграции ─────────────────────────────

/** Ключ N — переход N−1 → N. Чистые функции над сырыми разделами. До v2.0 реестр пуст. */
export type Migrations = Record<number, (s: SaveEnvelope) => SaveEnvelope>;

export const MIGRATIONS: Migrations = {};

/** Правило 1: для каждого N в 2..format есть migrations[N], лишних ключей нет. */
export function migrationGaps(migrations: Migrations, format: number = SAVE_FORMAT): { missing: number[]; extra: number[] } {
  const missing: number[] = [];
  for (let n = 2; n <= format; n++) if (typeof migrations[n] !== 'function') missing.push(n);
  const extra = Object.keys(migrations)
    .map(Number)
    .filter((n) => !Number.isInteger(n) || n < 2 || n > format)
    .sort((a, b) => a - b);
  return { missing, extra };
}

export type MigrateResult = { ok: true; envelope: SaveEnvelope } | { ok: false; at: number; error: unknown };

/** Цепочка от `env.format` до `target` по одному шагу; бросок шага — `ok: false` (сохранение не трогается, Р4). */
export function migrate(env: SaveEnvelope, migrations: Migrations = MIGRATIONS, target: number = SAVE_FORMAT): MigrateResult {
  let cur = env;
  for (let n = env.format + 1; n <= target; n++) {
    try {
      const step = migrations[n];
      if (typeof step !== 'function') throw new Error(`no migration ${n}`);
      cur = { ...step(cur), format: n };
    } catch (error) {
      return { ok: false, at: n, error };
    }
  }
  return { ok: true, envelope: cur };
}

// ───────────────────────────── битый раздел ─────────────────────────────

function same(a: unknown, b: unknown): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

/**
 * Пути сырого раздела, которых в разобранном нет или значение другое (новые поля по умолчанию не считаются).
 * Путь — ключи через точку, индекс массива — `[i]`. Больше нуля — до записи сырое уходит в `pre.*.repair` (В3).
 */
export function lostPaths(raw: unknown, parsed: unknown, path = ''): string[] {
  if (Array.isArray(raw)) {
    if (!Array.isArray(parsed)) return [path || '(root)'];
    return raw.flatMap((item, i) => lostPaths(item, parsed[i], `${path}[${i}]`));
  }
  if (isObject(raw)) {
    if (!isObject(parsed)) return [path || '(root)'];
    return Object.keys(raw).flatMap((k) => lostPaths(raw[k], parsed[k], path === '' ? k : `${path}.${k}`));
  }
  return same(raw, parsed) ? [] : [path || '(root)'];
}

// ───────────────────────────── образцы для голденов и форм ─────────────────────────────

/**
 * Полный образец конверта — голден выпуска нового формата (design §3). Разделы — `sample()` переданных описаний
 * (тесты передают реестр: добавленный раздел попадает в голден сам, 018-Р18); аргумент обязателен.
 */
export function fullSample(defs: readonly SectionDef[]): DeepRequired<SaveEnvelope> {
  const sections = Object.fromEntries(defs.map((d) => [d.name, d.sample()]));
  return { format: SAVE_FORMAT, draft: SAVE_DRAFT, rev: 3, app: '0.10.1', sections };
}

export function fullPlayers(): DeepRequired<PlayersData> {
  return { players: [{ id: 'p1', name: 'Ilya' }], current: 'p1', lastId: 1 };
}

export function fullShared(): DeepRequired<SharedSession> {
  return {
    clock: { lastAction: 1_700_000_000_000, sinceBreak: 60_000, breakDue: false, breakUntil: 1_700_000_300_000 },
    breakSettings: { enabled: true, playMinutes: 15, breakMinutes: 5 },
  };
}
