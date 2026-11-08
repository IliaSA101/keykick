/**
 * Журнал событий (спека 014-Т4, design §6): кольцо в `localStorage` (ключ `events`), синхронно.
 * Хранилище, часы и игрок приходят снаружи — иначе не проверить. Режим `v1` — только память.
 * Журнал — лог, а не прогресс: битый становится пустым, об этом первой записью; не влезло — режем и,
 * если и это не помогло, держим в памяти.
 */
import { EVENT_LIMITS, parseEvents, pushEvent, type EventKind, type EventRecord } from '../../engine/save/backup';
import { EVENTS_NAME } from '../../engine/save/copies';
import { APP_VERSION } from '../version';
import { PREFIX } from '../versions/build';
import { listKeys, readTabPlayer, readText, removeKey, writeText } from '../storage';
import { isV1Prefix } from './store';
import { trimEvents } from './space';
import type { StoreEvent, TextIo } from './types';

export interface EventLogOptions {
  io: TextIo;
  prefix: string;
  now(): number;
  app: string;
  player(): string | null;
  /** Режим `v1`: в хранилище не писать. */
  memoryOnly?: boolean;
}

export interface LogExtra {
  player?: string | null;
  stack?: string;
  t?: number;
}

export function createEventLog(o: EventLogOptions) {
  const key = o.prefix + EVENTS_NAME;
  /** Копия в памяти: журнал виден, даже когда хранилище не читается или полно. */
  let memory: EventRecord[] = [];
  /** Последняя запись в хранилище не удалась: память новее лежащего. */
  let unsynced = false;
  let cursor = 0;

  function stored(): EventRecord[] | null {
    if (o.memoryOnly || unsynced) return null;
    const r = o.io.read(key);
    if (!r.ok) return null;
    const parsed = parseEvents(r.text);
    if (parsed.ok) return parsed.log;
    return pushEvent([], { t: o.now(), v: o.app, player: null, kind: 'storage', text: 'events-reset' });
  }

  function save(log: EventRecord[]): void {
    memory = log;
    if (o.memoryOnly) return;
    const text = JSON.stringify(log);
    unsynced = !(o.io.write(key, text) || o.io.write(key, trimEvents(text)));
  }

  /** Весь журнал: из хранилища, если читается, иначе из памяти. */
  function list(): readonly EventRecord[] {
    return stored() ?? memory;
  }

  function log(kind: EventKind, text: string, extra: LogExtra = {}): void {
    const rec: EventRecord = { t: extra.t ?? o.now(), v: o.app, player: extra.player === undefined ? o.player() : extra.player, kind, text };
    if (extra.stack !== undefined) rec.stack = extra.stack;
    save(pushEvent(stored() ?? memory, rec, EVENT_LIMITS));
  }

  /** Перенести в журнал события слоя сохранения (карантин, миграция, переполнение), ещё не попавшие туда. */
  function ingest(events: readonly StoreEvent[]): void {
    const fresh = events.slice(cursor);
    cursor = events.length;
    for (const e of fresh) log(e.kind, e.text, { t: e.t });
  }

  return { log, list, ingest };
}

export const eventLog = createEventLog({
  io: { read: readText, write: writeText, remove: removeKey, keys: listKeys },
  prefix: PREFIX,
  now: () => Date.now(),
  app: APP_VERSION,
  player: readTabPlayer,
  memoryOnly: isV1Prefix(PREFIX),
});

/** Записать событие: `screen` — смена маршрута, `error` — перехват, `storage` — копии, выгрузка, загрузка, `action` — для 017/018. */
export const logEvent = eventLog.log;
