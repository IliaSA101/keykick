/**
 * Общая обвязка тестов слоя хранилища сохранений (спека 014-Т3): хранилище в памяти и фабрика слоя.
 */
import { createSaveStore } from '../src/app/save/store';
import type { Sections, TextIo } from '../src/app/save/types';
import { emptyEnvelope, type SaveEnvelope } from '../src/engine/save/format';
import { PROBES, probe, type Probe } from './saveFixtures';

export const TODAY = '2026-11-08';
export const NEXT = 'keykick-next.';
export const V1 = 'keykick.';
/** Контекст разбора: версия и id уроков курса (один на все тесты слоя сохранения). */
export const ctx = { version: '0.10.1', lessonIds: ['yard-01', 'yard-02', 'yard-03', 'yard-04', 'yard-05'] };

/**
 * Хранилище в памяти: квота в знаках (ключи и значения; `state.quota` можно поднять), `unreadable` — чтение не удаётся,
 * `writes` — число записей, `notify` — «другая вкладка поменяла ключ».
 */
export function memory(init: Record<string, string> = {}, opts: { quota?: number } = {}) {
  const data = new Map(Object.entries(init));
  const state = { writes: 0, unreadable: false, quota: opts.quota };
  const listeners: Array<(key: string | null) => void> = [];
  const sizeOf = (k: string, v: string): number => k.length + v.length;
  const used = (): number => [...data.entries()].reduce((n, [k, v]) => n + sizeOf(k, v), 0);
  const io: TextIo = {
    read: (k) => (state.unreadable ? { ok: false } : { ok: true, text: data.get(k) ?? null }),
    write: (k, t) => {
      const old = data.get(k);
      const after = used() - (old === undefined ? 0 : sizeOf(k, old)) + sizeOf(k, t);
      if (state.quota !== undefined && after > state.quota) return false;
      state.writes++;
      data.set(k, t);
      return true;
    },
    // Как настоящий removeKey: отсутствующий ключ — тоже успех.
    remove: (k) => {
      data.delete(k);
      return true;
    },
    keys: (prefix) => [...data.keys()].filter((k) => k.startsWith(prefix)),
    onChange: (fn) => void listeners.push(fn),
  };
  const notify = (key: string | null): void => listeners.forEach((fn) => fn(key));
  return { data, io, state, used, notify };
}

export function make(io: TextIo, prefix = NEXT, channel = 'next', hasPlayer?: (id: string) => boolean) {
  return createSaveStore({
    prefix,
    channel,
    storage: io,
    sections: PROBES,
    now: () => 1_800_000_000_000,
    today: () => TODAY,
    app: '0.10.1',
    ctx,
    ...(hasPlayer ? { hasPlayer } : {}),
  });
}

export const probeOf = (s: Sections | null | undefined): Probe => (s ?? {}).probe as Probe;
export const onProbe = (fn: (s: Probe) => Probe) => (all: Sections): Sections => ({ ...all, probe: fn(probeOf(all)) });
/** Текст ключа игрока: конверт с разделом `probe` (`rev` — счётчик записей, по умолчанию 1). */
export const envText = (p: Probe | Record<string, unknown>, rev = 1): string =>
  JSON.stringify({ ...emptyEnvelope('0.10.1', PROBES, ctx), rev, sections: { probe: p } });
/** Раздел `probe`, как его разбирает реестр тестов (для проверки лежащего в хранилище). */
export const probeAt = (data: Map<string, string>, key: string): Probe => probe.parse(envAt(data, key).sections.probe, ctx);
export const envAt = (data: Map<string, string>, key: string): SaveEnvelope => JSON.parse(data.get(key) ?? 'null') as SaveEnvelope;
