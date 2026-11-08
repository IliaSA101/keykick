/**
 * Файл выгрузки и загрузка (спека 014-Т4, design §8): `downloadBackup`, `readBackupFile`, `applyBackup`,
 * `lastBackupAt`. Фабрика получает слой, хранилище и часы снаружи — круг «выгрузил → загрузил» проверяется
 * на поддельном хранилище; готовый набор для приложения — внизу файла.
 */
import {
  backupFileName,
  buildBackup,
  buildCopyBackup,
  mergePlayers,
  parseBackup,
  previewBackup,
  type BackupFile,
  type BackupMeta,
  type BackupRefusal,
  type EventKind,
  type EventRecord,
  type PreviewEntry,
} from '../../engine/save/backup';
import { copyPlayerName, importName, isCopyName, parseCopyName, recentImport } from '../../engine/save/copies';
import { PROGRAM, type SectionDef } from '../../engine/save/format';
import type { SaveContext } from '../../engine/save/section';
import { ru } from '../../i18n/ru';
import { APP_VERSION } from '../version';
import { CHANNEL, MAJOR, PREFIX } from '../versions/build';
import { eventLog } from './eventLog';
import { saveContext, saveStore } from './instance';
import { registry } from './registry';
import { listKeys, readText, removeKey, writeText } from '../storage';
import type { SaveStore } from './store';
import type { TextIo } from './types';

export const BACKUP_AT_NAME = 'backup.at';

export interface BackupOptions {
  store: SaveStore;
  io: TextIo;
  prefix: string;
  channel: 'release' | 'next';
  major: number;
  app: string;
  browser(): string;
  now(): number;
  today(): string;
  sections: readonly SectionDef[];
  ctx: SaveContext;
  /** Отдать файл пользователю (в приложении — скачивание). */
  deliver(name: string, text: string): void;
  log(kind: EventKind, text: string): void;
  /** Журнал событий для файла. */
  events(): readonly EventRecord[];
  /** Перед выгрузкой: события слоя сохранения — в журнал. */
  flush?(): void;
  /** Журнал игры IndexedDB (018-Р24): читается по требованию, не дольше 3 с (дольше — null); `player` — только его записи. */
  journal?(player?: string): Promise<unknown>;
  /** После загрузки файла: слить журнал из файла (018-Р24); `players` — чьи сохранения загружены. Число записей, не дольше 3 с. */
  importJournal?(journal: unknown, players: string[]): Promise<number>;
}

/** Файл, разобранный и показанный в превью: `entries` — игроки файла, «сейчас» и «в файле». */
export interface Prepared {
  file: BackupFile;
  entries: PreviewEntry[];
}

export type ReadResult = ({ ok: true } & Prepared) | { ok: false; reason: BackupRefusal | 'newer' | 'players-full' | 'v1' | 'readonly'; id?: string };

export type ApplyResult =
  /** `journalDone` — слияние журнала из файла (есть, только если задан `importJournal`): страница ждёт его перед перезагрузкой. */
  | { ok: true; applied: string[]; skipped: string[]; journalDone?: Promise<number> }
  | { ok: false; reason: 'v1' | 'readonly' | 'unreadable' }
  /**
   * Не легла копия «до» или ключ: `applied` — игроки, уже загруженные до отказа (их прежнее — в `pre.*.import.*`;
   * в списке они остаются). Остальные игроки файла со статусом `ok` не загружены — родителю: «не хватило места».
   */
  | { ok: false; reason: 'no-space' | 'readonly' | 'unreadable'; applied: string[]; journalDone?: Promise<number> };

export function createBackup(o: BackupOptions) {
  const key = (name: string): string => o.prefix + name;
  const done = new WeakMap<Prepared, ApplyResult>();
  /** Время последнего файла в памяти: в режиме v1 ключ `backup.at` писать нельзя (ключи сына). */
  let stampedAt: number | null = null;

  /** Журнал для файла: хук не должен ронять выгрузку (отказ, таймаут — файл без журнала). */
  async function journalFor(player?: string): Promise<unknown> {
    if (!o.journal) return undefined;
    try {
      return await o.journal(player);
    } catch {
      return null;
    }
  }

  function meta(journal: unknown, withJournal: boolean): BackupMeta {
    return {
      major: o.major,
      channel: o.channel,
      app: o.app,
      browser: o.browser(),
      createdAt: o.now(),
      storageFull: o.store.status().storageFull,
      format: PROGRAM.format,
      draft: PROGRAM.draft,
      ...(withJournal ? { journal } : {}),
    };
  }

  function playersNow(): unknown {
    const r = o.io.read(key('players'));
    if (!r.ok || r.text === null) return null;
    try {
      return JSON.parse(r.text) as unknown;
    } catch {
      return null;
    }
  }

  function stamp(): void {
    stampedAt = o.now();
    if (o.store.mode !== 'v1') o.io.write(key(BACKUP_AT_NAME), String(stampedAt));
  }

  /** Весь файл выгрузки: имя и текст отданы пользователю, время записано в `backup.at`. */
  async function downloadBackup(): Promise<{ name: string; text: string; fromMemory: string[] }> {
    // Журнал — до всего остального: пока ждём (до 3 с), слой и события не должны разойтись с файлом.
    const journal = await journalFor();
    o.flush?.();
    const file = buildBackup(o.store.dumpStorage(), o.store.memorySaves(), meta(journal, o.journal !== undefined));
    file.events = [...o.events()];
    const name = backupFileName(o.today(), o.app);
    const text = JSON.stringify(file);
    o.deliver(name, text);
    stamp();
    o.log('storage', 'backup-download');
    return { name, text, fromMemory: file.fromMemory ?? [] };
  }

  /** Файл одного игрока из копии (снимок, `pre.*`): ключ копии — имя без префикса. null — копии нет или имя чужое. */
  async function downloadCopy(copyName: string): Promise<{ name: string; text: string } | null> {
    const parsed = parseCopyName(copyName);
    if (parsed === null) return null;
    const r = o.io.read(key(copyName));
    if (!r.ok || r.text === null) return null;
    // Журнал — только этого игрока (018-Р24); ждём его после того, как копия нашлась (018-Р26).
    const journal = await journalFor(parsed.id);
    const file = buildCopyBackup(parsed.id, r.text, playersNow(), meta(journal, o.journal !== undefined), (n) => `${ru.players.fallback} ${n}`);
    const name = backupFileName(o.today(), `${o.app}-${parsed.id}`);
    const text = JSON.stringify(file);
    o.deliver(name, text);
    o.log('storage', `backup-copy-download ${copyName}`);
    return { name, text };
  }

  /** Время последнего файла (мс); null — ещё не сохраняли (в v1 — только с запуска страницы). */
  function lastBackupAt(): number | null {
    if (o.store.mode === 'v1') return stampedAt;
    const r = o.io.read(key(BACKUP_AT_NAME));
    const n = r.ok && r.text !== null ? Number(r.text) : Number.NaN;
    return Number.isFinite(n) ? n : null;
  }

  /** Прочитать файл и показать, что изменится. Ничего не пишет. */
  async function readBackupFile(source: string | { text(): Promise<string> }): Promise<ReadResult> {
    if (o.store.mode === 'v1') return { ok: false, reason: 'v1' };
    if (o.store.status().readOnly) return { ok: false, reason: 'readonly' };
    const text = typeof source === 'string' ? source : await source.text();
    const parsed = parseBackup(text, o.major);
    if (!parsed.ok) {
      o.log('storage', `backup-refused ${parsed.reason}`);
      return parsed;
    }
    const saves: Record<string, string | null> = {};
    for (const id of Object.keys(parsed.file.saves)) {
      const r = o.io.read(key(`save.${id}`));
      saves[id] = r.ok ? r.text : null;
    }
    const preview = previewBackup(parsed.file, { saves, players: playersNow() }, o.ctx, o.sections);
    if (!preview.ok && preview.reason === 'players-full') {
      o.log('storage', 'backup-refused players-full');
      return { ok: false, reason: 'players-full' };
    }
    if (!preview.ok) {
      o.log('storage', `backup-refused newer ${preview.id}`);
      return { ok: false, reason: 'newer', id: preview.id };
    }
    return { ok: true, file: parsed.file, entries: preview.entries };
  }

  /**
   * Загрузить файл. До первой записи: `newer` у любого из игроков файла → отказ (В6). Порядок записи: список игроков
   * (записанные из файла ∪ нынешние) → сохранения по одному (`store.restore`: копия «до» `pre.<id>.import.<ms>` — перечитать —
   * ключ, моложе суток копия не перезаписывается) → общая часть `session` последней. Любой отказ — `session` не тронута;
   * `applied` — кто уже загружен (они остаются в списке, остальное в списке прежнее). Битые игроки пропускаются. Успех повтор не пишет.
   */
  function applyBackup(prepared: Prepared): ApplyResult {
    const before = done.get(prepared);
    if (before) return before;
    const result = run(prepared);
    if (result.ok) done.set(prepared, result);
    return result;
  }

  /** Вернуть ключ в прежнее состояние: текст или удаление, если его не было. */
  function putBack(name: string, prev: string | null): void {
    if (prev === null) o.io.remove(key(name));
    else o.io.write(key(name), prev);
  }

  /** Id всех сохранений под префиксом: проверка «новее программы» (В6) смотрит на всех, а не только на игроков файла. */
  function savedIds(): string[] {
    return o.io
      .keys(o.prefix)
      .map((k) => k.slice(o.prefix.length))
      .filter((n) => n.startsWith('save.'))
      .map((n) => n.slice('save.'.length));
  }

  function run({ file, entries }: Prepared): ApplyResult {
    if (o.store.mode === 'v1') return { ok: false, reason: 'v1' };
    const ids = [...new Set([...savedIds(), ...entries.map((e) => e.id)])];
    if (o.store.status().readOnly || o.store.scanNewer(ids)) return { ok: false, reason: 'readonly', applied: [] };
    const todo = entries.filter((e) => e.status === 'ok' && e.sections !== null);
    const skipped = entries.filter((e) => e.status !== 'ok').map((e) => e.id);
    const prevPlayers = o.io.read(key('players'));
    if (!prevPlayers.ok) return { ok: false, reason: 'unreadable' };
    const listBefore = playersNow();
    const applied: string[] = [];
    const refuse = (reason: 'no-space' | 'readonly' | 'unreadable'): ApplyResult => {
      // Применённые видимы и не откатываются (Р11): список = прежний + игроки файла из `applied`; ничего не применено —
      // прежний список. `session` пишется последней: если её запись отказала, она осталась прежней — возвращать нечего.
      const partial = applied.length > 0 ? mergePlayers(listBefore, file.players, applied) : null;
      if (partial === null) putBack('players', prevPlayers.text);
      else o.io.write(key('players'), JSON.stringify(partial));
      o.log('storage', `backup-refused ${reason} applied ${applied.join(',')}`);
      // Загруженные игроки остаются (Р11): их журнал сливаем так же, как при успехе; не загруженных — нет (018-Р26).
      const journalDone = applied.length > 0 ? o.importJournal?.(file.journal, applied) : undefined;
      return { ok: false, reason, applied, ...(journalDone ? { journalDone: journalDone.catch(() => 0) } : {}) };
    };
    // В список — только игроки, чьё сохранение будет записано (Р11): удалённый на устройстве не воскресает из чужого списка.
    const players = mergePlayers(listBefore, file.players, todo.map((e) => e.id));
    if (players !== null && !o.io.write(key('players'), JSON.stringify(players))) return refuse('no-space');
    const now = o.now();
    for (const e of todo) {
      const copy = recentImport(o.io.keys(o.prefix).map((k) => k.slice(o.prefix.length)), e.id, now) ? null : importName(e.id, now);
      const res = o.store.restore(e.id, e.sections as Record<string, unknown>, copy);
      if (res !== 'ok') return refuse(res);
      applied.push(e.id);
    }
    if (file.shared !== null && !o.io.write(key('session'), JSON.stringify(file.shared))) return refuse('no-space');
    o.flush?.();
    const journalDone = o.importJournal?.(file.journal, applied);
    o.log('storage', `backup-apply ${applied.join(',')}${skipped.length > 0 ? ` skipped ${skipped.join(',')}` : ''}`);
    return { ok: true, applied, skipped, ...(journalDone ? { journalDone: journalDone.catch(() => 0) } : {}) };
  }

  /** Имена копий (снимки, `pre.*`, карантин) без префикса: список «Копии сохранений» у родителя. */
  function copyNames(): string[] {
    return o.io
      .keys(o.prefix)
      .map((k) => k.slice(o.prefix.length))
      .filter(isCopyName);
  }

  /** Что показать родителю о слое: режим v1 (файл не грузится), переполнение, игроки, у которых при запуске нашли беду. */
  function saveInfo(): { v1: boolean; storageFull: boolean; found: Record<string, 'broken' | 'fresh-with-snaps'> } {
    const st = o.store.status();
    return { v1: o.store.mode === 'v1', storageFull: st.storageFull, found: { ...st.found } };
  }

  /** Имена игроков, которых удалили, по id: из самой свежей копии «до удаления» (014-Р18); без имени в копии — нет записи. */
  function deletedNames(): Record<string, string> {
    const newest = new Map<string, { at: number; name: string }>();
    for (const copy of copyNames()) {
      const parsed = parseCopyName(copy);
      if (parsed === null || parsed.kind !== 'delete') continue;
      const r = o.io.read(key(copy));
      const name = r.ok && r.text !== null ? copyPlayerName(r.text) : null;
      if (name !== null && parsed.at >= (newest.get(parsed.id)?.at ?? -1)) newest.set(parsed.id, { at: parsed.at, name });
    }
    return Object.fromEntries([...newest].map(([id, v]) => [id, v.name]));
  }

  return { downloadBackup, downloadCopy, lastBackupAt, readBackupFile, applyBackup, copyNames, deletedNames, saveInfo };
}

/** Скачивание: Blob и временная ссылка. */
function deliverDownload(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function today(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Крючки журнала игры: ставит `app/journal/boot.ts` до монтирования; пока не поставлены — файл без журнала. */
const journalHooks: { dump: (player?: string) => Promise<unknown>; merge: (journal: unknown, players: string[]) => Promise<number> } = {
  dump: () => Promise.resolve(null),
  merge: () => Promise.resolve(0),
};
export function setBackupJournal(hooks: typeof journalHooks): void {
  Object.assign(journalHooks, hooks);
}

const backup = createBackup({
  store: saveStore,
  io: { read: readText, write: writeText, remove: removeKey, keys: listKeys },
  prefix: PREFIX,
  channel: CHANNEL,
  major: MAJOR,
  app: APP_VERSION,
  browser: () => (typeof navigator === 'undefined' ? '' : navigator.userAgent),
  now: () => Date.now(),
  today,
  sections: registry,
  ctx: saveContext,
  deliver: deliverDownload,
  log: eventLog.log,
  events: () => eventLog.list(),
  flush: () => eventLog.ingest(saveStore.events()),
  journal: (player) => journalHooks.dump(player),
  importJournal: (journal, players) => journalHooks.merge(journal, players),
});

export const { downloadBackup, downloadCopy, lastBackupAt, readBackupFile, applyBackup, copyNames, deletedNames, saveInfo } = backup;
