/**
 * Общая оснастка тестов хранилища (060 Т6): хранилище и замки в памяти, разделы-образцы, чужие ключи.
 * Используют tests/save/storage.test.ts и tests/save/storageCopies.test.ts.
 */
import { expect } from 'vitest';
import { createPlayer, writePlayer, type Envelope } from '../../src/engine/save/envelope';
import { isInt, type SectionDef } from '../../src/engine/save/section';
import { prefix } from '../../src/engine/release/keys';
import type { LocksApi } from '../../src/app/save/locks';
import { createKeyValue, type Backend } from '../../src/app/save/storage';
import { createStore, type Store } from '../../src/app/save/store';

// --- Подмены ---------------------------------------------------------------------------------------------------

/** Хранилище в памяти: потолок знаков (ключи + значения, как квота браузера) и переключатель отказа записи. */
export class MemStorage implements Backend {
  readonly map = new Map<string, string>();
  /** Сколько знаков вместе можно держать; `Infinity` — без потолка. */
  capacity = Infinity;
  /** Что бросать при записи: имя ошибки; `undefined` — не бросать. */
  failWrite: string | undefined;
  failRead = false;

  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    if (this.failRead) throw new Error('SecurityError');
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.failWrite !== undefined) throw Object.assign(new Error('fail'), { name: this.failWrite });
    let used = 0;
    for (const [key, val] of this.map) if (key !== k) used += key.length + val.length;
    if (used + k.length + v.length > this.capacity)
      throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.map);
  }
}

/** Общий «менеджер замков»: имя → занято. `ifAvailable` без ожидания, как в браузере. */
export function fakeLocks(): LocksApi {
  const taken = new Set<string>();
  return {
    request(name, _options, callback) {
      if (taken.has(name)) return Promise.resolve(callback(null));
      taken.add(name);
      return Promise.resolve(callback({ name })).finally(() => taken.delete(name));
    },
  };
}

export const P = prefix(2, 'release');
export const FOREIGN: Record<string, string> = {
  'keykick.save': '{"v1":"сохранение первой версии"}',
  'keykick-next.device': 'тестовая v2',
  'keykick2-next.player.p1': 'канал next',
  'keykick3.player.p1': 'следующая мажорная',
  // Чужие ключи нашей формы (копии, корзина, карантин): префикс не наш — трогать нельзя.
  'keykick2-next.player.p1.c3': 'копия канала next',
  'keykick2-next.trash.p1': 'корзина канала next',
  'keykick.player.p1.c2': 'копия первой версии',
  'keykick3.quarantine.p1.1': 'карантин следующей мажорной',
  'other.site': 'чужое',
};

// --- Разделы-образцы -------------------------------------------------------------------------------------------

interface Club {
  stars: number;
}
export const clubDef: SectionDef<Club> = {
  name: 'club',
  v: 1,
  empty: () => ({ stars: 0 }),
  up: {},
  check: (d) => (d && isInt((d as Partial<Club>).stars) ? [] : ['stars']),
};
export const defs = [clubDef] as SectionDef<unknown>[];
/** Та же `club`, но на версии 2: сохранения v1 открываются с миграцией (и копией сырого в c1). */
export const clubV2: SectionDef<unknown> = {
  name: 'club',
  v: 2,
  empty: () => ({ stars: 0, tag: '' }),
  up: { 2: (d) => ({ ...(d as object), tag: '' }) },
  check: (d) => (d && isInt((d as Partial<Club>).stars) ? [] : ['stars']),
};

export function setup(over: { capacity?: number; locks?: LocksApi; withSession?: boolean } = {}) {
  const mem = new MemStorage();
  if (over.capacity !== undefined) mem.capacity = over.capacity;
  for (const [k, v] of Object.entries(FOREIGN)) mem.map.set(k, v);
  const session = new MemStorage();
  const open = (d: readonly SectionDef<unknown>[] = defs, locks = over.locks): Store =>
    createStore({
      prefix: P,
      local: createKeyValue(mem),
      ...(over.withSession === false ? {} : { session: createKeyValue(session) }),
      ...(locks ? { locks } : {}),
      defs: d,
    });
  return { mem, session, open, store: open() };
}

export const player = (pid = 'p1', stars = 0): Envelope => {
  const env = createPlayer({ pid, name: 'Тест' }, defs);
  return stars === 0 ? env : writePlayer(env, { club: { stars } });
};
export const key = (pid = 'p1') => `${P}player.${pid}`;
export const stored = (mem: MemStorage, pid = 'p1') => mem.map.get(key(pid));
/** Игрок записан и загружен: ожидаемый rev — тот, что на диске. */
export function seed(store: Store, pid = 'p1', stars = 0): Envelope {
  const env = player(pid, stars);
  expect(store.savePlayer(pid, env, null)).toEqual({ ok: true });
  return env;
}
export function foreignIntact(mem: MemStorage): void {
  for (const [k, v] of Object.entries(FOREIGN)) expect(mem.map.get(k)).toBe(v);
}
