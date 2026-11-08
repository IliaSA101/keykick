/**
 * Общая обвязка тестов резервных копий (спека 014-Т4): «устройство» — хранилище в памяти, слой, журнал и выгрузка
 * на одних часах.
 */
import { createBackup, type Prepared } from '../src/app/save/backup';
import { createEventLog } from '../src/app/save/eventLog';
import { NEXT, TODAY, V1, ctx, make, memory, onProbe } from './saveStoreHelpers';
import { PROBES } from './saveFixtures';

/** `n` разных дней вида `2026-MM-DD` по минуте — раздувает пробный раздел (n ≤ 336), не теряясь при разборе. */
export function bulkDays(n: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, 60]));
}

export const DAY = 24 * 3600 * 1000;
export const T0 = 1_800_000_000_000;

/** «Устройство»: хранилище, слой, журнал и выгрузка на одних часах; скачанные файлы копятся в `files`. */
export function device(init: Record<string, string> = {}, opts: { quota?: number; prefix?: string; channel?: 'next' | 'release' } = {}) {
  const mem = memory(init, opts.quota === undefined ? {} : { quota: opts.quota });
  const prefix = opts.prefix ?? NEXT;
  const channel = opts.channel ?? 'next';
  const store = make(mem.io, prefix, channel);
  const clock = { now: T0 };
  const files: Array<{ name: string; text: string }> = [];
  const events = createEventLog({ io: mem.io, prefix, now: () => clock.now, app: '0.10.1', player: () => null, memoryOnly: prefix === V1 });
  const backup = createBackup({
    store,
    io: mem.io,
    prefix,
    channel,
    major: 0,
    app: '0.10.1',
    browser: () => 'test',
    now: () => clock.now,
    today: () => TODAY,
    sections: PROBES,
    ctx,
    deliver: (name, text) => void files.push({ name, text }),
    log: events.log,
    events: () => events.list(),
    flush: () => events.ingest(store.events()),
  });
  const seed = (players: Array<[string, string]>, goals: Record<string, number>): void => {
    mem.data.set(`${prefix}players`, JSON.stringify({ players: players.map(([id, name]) => ({ id, name })), current: players[0]?.[0] ?? null, lastId: players.length }));
    for (const [id] of players) {
      store.load(id);
      // Монеты кошелька — для колонок превью (`summarize` читает `wallet`, не пробный раздел).
      store.update(id, (all) => ({ ...onProbe((s) => ({ ...s, goals: goals[id] ?? 0, coins: 5 }))(all), wallet: { coins: 5 } }));
    }
  };
  return { mem, store, backup, events, files, clock, seed };
}

export async function prepare(d: ReturnType<typeof device>, text: string): Promise<Prepared> {
  const r = await d.backup.readBackupFile(text);
  if (!r.ok) throw new Error(`отказ: ${r.reason}`);
  return r;
}
