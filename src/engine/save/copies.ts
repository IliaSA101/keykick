/**
 * Копии сохранения: снимки, «до …», карантин, освобождение места (спека 014, design §2, §4).
 * Чистые функции над ИМЕНАМИ копий (без префикса `PREFIX`; ключ собирает app/storage.copyKey) и размерами.
 * Часы приходят аргументом, хранилище — через `CopyIo`.
 */

export const SNAPSHOTS_KEEP = 3;
/** Журнал событий при переполнении режется до этого размера (design §4). */
export const EVENTS_KEEP_BYTES = 16 * 1024;
/** Потолок карантина и `pre.*` на канале `next`. */
export const COPIES_CEILING_BYTES = 512 * 1024;
export const EVENTS_NAME = 'events';

export type CopyKind = 'snap' | 'migrate' | 'import' | 'repair' | 'reset' | 'delete' | 'quarantine';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Имена не начинаются с `save.` — иначе savedPlayerIds() примет копию за игрока.
export const snapName = (id: string, date: string): string => `snap.${id}.${date}`;
export const migrateName = (id: string, format: number): string => `pre.${id}.migrate.f${format}`;
export const importName = (id: string, ms: number): string => `pre.${id}.import.${ms}`;
export const repairName = (id: string, date: string): string => `pre.${id}.repair.${date}`;
export const resetName = (id: string, ms: number): string => `pre.${id}.reset.${ms}`;
export const deleteName = (id: string, ms: number): string => `pre.${id}.delete.${ms}`;
export const quarantineName = (id: string, ms: number): string => `quarantine.${id}.${ms}`;

export interface ParsedCopy {
  kind: CopyKind;
  id: string;
  /** Последняя часть имени: дата, мс или `f<N>`. */
  tail: string;
  /** Возраст для порядка «старые раньше»: мс от эпохи; у `migrate` — максимум (их жалеем последними). */
  at: number;
}

function tailTime(tail: string): number {
  if (DATE.test(tail)) return Date.parse(`${tail}T00:00:00Z`);
  const n = Number(tail);
  return Number.isFinite(n) ? n : 0;
}

/** Имя копии → части; не копия (в т. ч. `save.*`, `events`) — null. Ключ разбирается с конца. */
export function parseCopyName(name: string): ParsedCopy | null {
  const parts = name.split('.');
  const tail = parts[parts.length - 1] ?? '';
  const [head, id] = parts;
  if (parts.length === 3 && head === 'snap' && id !== undefined && DATE.test(tail)) {
    return { kind: 'snap', id, tail, at: tailTime(tail) };
  }
  if (parts.length === 3 && head === 'quarantine' && id !== undefined && /^\d+$/.test(tail)) {
    return { kind: 'quarantine', id, tail, at: tailTime(tail) };
  }
  if (parts.length === 4 && head === 'pre' && id !== undefined) {
    const what = parts[2];
    if (what === 'migrate' && /^f\d+$/.test(tail)) return { kind: 'migrate', id, tail, at: Number.MAX_SAFE_INTEGER };
    if (what === 'repair' && DATE.test(tail)) return { kind: 'repair', id, tail, at: tailTime(tail) };
    if ((what === 'import' || what === 'reset' || what === 'delete') && /^\d+$/.test(tail)) {
      return { kind: what, id, tail, at: tailTime(tail) };
    }
  }
  return null;
}

/** Имя копии, а не сохранения игрока и не служебного ключа. */
export function isCopyName(name: string): boolean {
  return !name.startsWith('save.') && parseCopyName(name) !== null;
}

function ofKind(names: readonly string[], id: string, kinds: readonly CopyKind[]): { name: string; p: ParsedCopy }[] {
  const out: { name: string; p: ParsedCopy }[] = [];
  for (const name of names) {
    const p = parseCopyName(name);
    if (p !== null && p.id === id && kinds.includes(p.kind)) out.push({ name, p });
  }
  return out;
}

const newestFirst = (a: { p: ParsedCopy }, b: { p: ParsedCopy }): number => b.p.at - a.p.at;

export interface CopyPlan {
  /** Что записать; пусто — снимок за сегодня уже есть. */
  write: string[];
  /** Что удалить: снимки и `repair` сверх трёх новейших ключей. */
  remove: string[];
}

/**
 * Первая загрузка игрока за день: снимок `snap.<id>.<today>`, если его нет; снимки и `repair` этого игрока —
 * 3 новейших КЛЮЧА каждого вида (не «3 дня»: после перерыва не пропадает всё).
 */
export function planCopies(names: readonly string[], id: string, today: string): CopyPlan {
  const todays = snapName(id, today);
  const have = new Set(names);
  const write = have.has(todays) ? [] : [todays];
  const remove: string[] = [];
  const snaps = [...ofKind(names, id, ['snap']), ...(write.length > 0 ? [{ name: todays, p: parseCopyName(todays)! }] : [])];
  for (const group of [snaps, ofKind(names, id, ['repair'])]) {
    group.sort(newestFirst);
    for (const old of group.slice(SNAPSHOTS_KEEP)) remove.push(old.name);
  }
  return { write, remove };
}

/** Копии «до сброса/удаления/загрузки файла»: остаётся одна, новейшая; старые — в `remove`. */
export function planSingle(names: readonly string[], id: string, kind: 'reset' | 'delete' | 'import', keep: string): string[] {
  return ofKind(names, id, [kind])
    .map((x) => x.name)
    .filter((n) => n !== keep);
}

const DAY_MS = 24 * 3600 * 1000;
/** Моложе суток — по модулю: копия с отметкой из будущего (часы переводили вперёд) иначе «свежая» бессрочно. */
const withinDay = (nowMs: number, at: number): boolean => Math.abs(nowMs - at) < DAY_MS;

/** `pre.<id>.import.*` моложе суток не перезаписывается (В7): есть ли такая. */
export function recentImport(names: readonly string[], id: string, nowMs: number): boolean {
  return ofKind(names, id, ['import']).some((x) => withinDay(nowMs, x.p.at));
}

/** Копия «до загрузки файла» моложе суток (014-Р11): освобождение места её не удаляет никогда — это единственный путь назад. */
function youngImport(p: ParsedCopy, nowMs: number): boolean {
  return p.kind === 'import' && withinDay(nowMs, p.at);
}

export type FreeStepKind = 'events' | 'snaps' | 'old';

export interface FreeStep {
  kind: FreeStepKind;
  /**
   * `events` — пусто: журнал режется до EVENTS_KEEP_BYTES, а не удаляется;
   * `snaps` — снимки и `repair` кроме сегодняшних; `old` (только `next`) — карантин и `pre.*`, старые раньше
   * (кроме `pre.*.import.*` моложе суток — Р11).
   */
  remove: string[];
}

/**
 * Освобождение места при отказе записи — шаги по порядку, после каждого повтор записи (design §4):
 * 1) журнал, 2) снимки и `repair` кроме сегодняшних, 3) канал `next`: самый старый карантин и `pre.*`
 * (`pre.*.import.*` моложе суток — никогда, Р11). Пустые шаги не возвращаются; остался ни с чем — вызывающий ставит `storageFull`.
 */
export function planFree(
  names: readonly string[],
  sizes: Readonly<Record<string, number>>,
  channel: string,
  today: string,
  nowMs: number,
): FreeStep[] {
  const steps: FreeStep[] = [];
  if ((sizes[EVENTS_NAME] ?? 0) > EVENTS_KEEP_BYTES) steps.push({ kind: 'events', remove: [] });
  const snaps = names.filter((n) => {
    const p = parseCopyName(n);
    return p !== null && (p.kind === 'snap' || p.kind === 'repair') && p.tail !== today;
  });
  if (snaps.length > 0) steps.push({ kind: 'snaps', remove: snaps });
  if (channel === 'next') {
    const old = names
      .map((name) => ({ name, p: parseCopyName(name) }))
      .filter((x): x is { name: string; p: ParsedCopy } => x.p !== null && x.p.kind !== 'snap' && x.p.kind !== 'repair' && !youngImport(x.p, nowMs))
      .sort((a, b) => a.p.at - b.p.at)
      .map((x) => x.name);
    if (old.length > 0) steps.push({ kind: 'old', remove: old });
  }
  return steps;
}

/** Потолок канала `next` (512 КБ на карантин и `pre.*`): что удалить, старые раньше. Другие каналы — ничего; свежие `import` не удаляются (Р11). */
export function overCeiling(
  names: readonly string[],
  sizes: Readonly<Record<string, number>>,
  channel: string,
  nowMs: number,
): string[] {
  if (channel !== 'next') return [];
  const held = names
    .map((name) => ({ name, p: parseCopyName(name) }))
    .filter((x): x is { name: string; p: ParsedCopy } => x.p !== null && x.p.kind !== 'snap' && x.p.kind !== 'repair' && !youngImport(x.p, nowMs))
    .sort((a, b) => a.p.at - b.p.at);
  let total = held.reduce((sum, x) => sum + (sizes[x.name] ?? 0), 0);
  const remove: string[] = [];
  for (const x of held) {
    if (total <= COPIES_CEILING_BYTES) break;
    remove.push(x.name);
    total -= sizes[x.name] ?? 0;
  }
  return remove;
}

/** Запись и чтение ключей; `write` возвращает false, если не влезло (и после освобождения места). */
export interface CopyIo {
  write(key: string, text: string): boolean;
  read(key: string): string | null;
}

export type CopyWriteResult = 'ok' | 'copy-failed' | 'main-failed';

/**
 * Копия раньше основного ключа (Б1): записать копию, перечитать, и только если прочитанное побайтно равно —
 * писать основной ключ. Иначе основной ключ не тронут и остаётся прежним (игра идёт из памяти).
 */
export function copyThenWrite(io: CopyIo, copyKey: string, copyText: string, mainKey: string, mainText: string): CopyWriteResult {
  try {
    if (!io.write(copyKey, copyText)) return 'copy-failed';
    if (io.read(copyKey) !== copyText) return 'copy-failed';
  } catch {
    return 'copy-failed';
  }
  try {
    return io.write(mainKey, mainText) ? 'ok' : 'main-failed';
  } catch {
    return 'main-failed';
  }
}

const PLAYER_NAME_FIELD = 'playerName';
const PLAYER_NAME_MAX = 40;

/**
 * Копия «до удаления игрока» несёт имя игрока: после удаления его нет в списке, а родителю надо узнать, чья копия
 * (014-Р18). Имя — отдельное поле конверта (`classify` лишних полей не читает); текст не JSON-объект — как есть.
 */
export function withPlayerName(copyText: string, name: string): string {
  try {
    const raw: unknown = JSON.parse(copyText);
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return copyText;
    return JSON.stringify({ ...raw, [PLAYER_NAME_FIELD]: name.slice(0, PLAYER_NAME_MAX) });
  } catch {
    return copyText;
  }
}

/** Имя игрока из копии; нет (старая копия, снимок, битый текст) — null. */
export function copyPlayerName(copyText: string): string | null {
  try {
    const raw: unknown = JSON.parse(copyText);
    const name = (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) ? (raw as Record<string, unknown>)[PLAYER_NAME_FIELD] : undefined;
    return typeof name === 'string' && name.trim() !== '' ? name.slice(0, PLAYER_NAME_MAX) : null;
  } catch {
    return null;
  }
}
