/**
 * Слой транзакции над разделами сохранения игрока (спека 018 design §4.1, Т2): `updatePlayer` = один `update`
 * слоя 014 — несколько разделов одной записью. Фабрика без привязки к приложению (хранилище и «текущий игрок»
 * приходят снаружи) — чтобы тест поднимал две «вкладки» на одном хранилище; привязка — `sections.ts`.
 */
import { shallowRef, watch, type ShallowRef } from 'vue';
import type { JournalInput } from '../../engine/journal/records';
import type { DeepReadonly, SaveContext, SectionDef, SectionKey, SectionTx } from '../../engine/save/section';
import type { SaveStore } from './store';
import type { Sections } from './types';

/** Куда уходят записи `tx.log` после удачной записи (Т4 подключает журнал). */
export type JournalSink = (recs: JournalInput[], player: string) => void;

export interface SectionLayerOptions {
  store: Pick<SaveStore, 'update' | 'memory' | 'peek' | 'status' | 'mode'>;
  registry: readonly SectionDef[];
  ctx: SaveContext;
  /** Текущий игрок в момент вызова; null — игроков нет. Источник реактивный — `sectionRef` следит за сменой. */
  currentId(): string | null;
  /** Замораживать копии и значения в памяти глубоко (dev и тесты): `w.coins += 100` бросает `TypeError`. */
  freeze: boolean;
}

/** Запись, ушедшая в приёмник по умолчанию (до Т4 — массив в памяти). */
export interface PendingJournal {
  player: string;
  rec: JournalInput;
}

const PENDING_MAX = 5000;

function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

export function createSectionLayer(o: SectionLayerOptions) {
  const byName = new Map(o.registry.map((d) => [d.name, d]));
  const pending: PendingJournal[] = [];
  let sink: JournalSink = (recs, player) => {
    for (const rec of recs) pending.push({ player, rec });
    if (pending.length > PENDING_MAX) pending.splice(0, pending.length - PENDING_MAX);
  };
  const refs: Array<{ ref: ShallowRef<unknown>; name: string }> = [];

  const copyOf = <T>(v: T): T => (o.freeze ? deepFreeze(structuredClone(v)) : structuredClone(v));
  const defOf = (name: string): SectionDef => {
    const d = byName.get(name);
    if (!d) throw new Error(`save: section '${name}' is not in the registry`);
    return d;
  };

  /** Транзакция над базой `all`: чтение видит собственные записи (зачислил и тут же потратил). */
  function makeTx(all: Sections, written: Record<string, unknown>, logs: JournalInput[]): SectionTx {
    return {
      get: <T>(key: SectionKey<T>): DeepReadonly<T> => {
        const v = key.name in written ? written[key.name] : all[key.name];
        return copyOf(v === undefined ? defOf(key.name).empty(o.ctx) : v) as DeepReadonly<T>;
      },
      set: <T>(def: SectionDef<T>, value: T): void => {
        written[def.name] = structuredClone(value);
      },
      log: (rec) => void logs.push(structuredClone(rec)),
    };
  }

  /** Освежить `sectionRef` (после записи, смены игрока, чужой записи). */
  function refreshRefs(): void {
    for (const r of refs) r.ref.value = readSection({ name: r.name });
  }

  /**
   * Одна запись на все разделы, тронутые `fn`. `fn` вызывается слоем 014 один раз — на лежащем при чужом `rev`;
   * поэтому в `tx.set` — только значение, построенное из `tx.get` (Б2). Ничего не менялось — записи нет.
   * `readOnly`, игрок удалён в другой вкладке — `fn` считается вхолостую на памяти (результат есть, записи и
   * журнала нет). v1 — разделы v2 только в памяти, журнала нет. `fn` бросила — ни записи, ни журнала.
   */
  function updatePlayer<R>(fn: (tx: SectionTx) => R, opts?: { player?: string }): R {
    const id = opts?.player ?? o.currentId();
    if (id === null) throw new Error('save: no player to write to');
    let result: R | undefined;
    let ran = false;
    const logs: JournalInput[] = [];
    o.store.update(id, (all) => {
      ran = true;
      const written: Record<string, unknown> = {};
      result = fn(makeTx(all, written, logs));
      const names = Object.keys(written).filter((n) => JSON.stringify(written[n]) !== JSON.stringify(all[n]));
      if (names.length === 0) return all;
      const next: Sections = { ...all };
      for (const n of names) next[n] = o.freeze ? deepFreeze(written[n]) : written[n];
      return next;
    });
    if (!ran) {
      // `peek`, не `load`: `load` удалённого игрока писал бы снимок дня или карантин (014-Р19, п. 1).
      const mem = o.store.memory(id) ?? o.store.peek(id);
      return fn(makeTx(mem, {}, []));
    }
    if (o.store.mode === 'envelope' && logs.length > 0) sink(logs, id);
    refreshRefs();
    return result as R;
  }

  /** Можно ли писать: игрок есть и сохранение не только для чтения (`newer`). Подсказка экранам; `updatePlayer` при `readOnly` считает вхолостую. */
  function canWrite(): boolean {
    return o.currentId() !== null && !o.store.status().readOnly;
  }

  /** Один раздел: `fn` получает копию, возвращает новое значение. Возвращает записанное. */
  function updateSection<T>(def: SectionDef<T>, fn: (cur: DeepReadonly<T>) => T): T {
    return updatePlayer((tx) => {
      const next = fn(tx.get(def));
      tx.set(def, next);
      return next;
    });
  }

  /** Только показ: значение в памяти текущего игрока (нет игрока или раздела в памяти — `empty`). */
  function readSection<T>(key: SectionKey<T>): DeepReadonly<T> {
    const id = o.currentId();
    const v = id === null ? undefined : o.store.memory(id)?.[key.name];
    const val = v === undefined ? defOf(key.name).empty(o.ctx) : v;
    return (o.freeze ? deepFreeze(val) : val) as DeepReadonly<T>;
  }

  /** Только показ, реактивно: обновляется после `updatePlayer`, при смене игрока и по `refreshRefs()` (чужая запись). */
  function sectionRef<T>(key: SectionKey<T>): Readonly<ShallowRef<DeepReadonly<T>>> {
    const ref = shallowRef(readSection(key));
    refs.push({ ref, name: key.name });
    return ref as Readonly<ShallowRef<DeepReadonly<T>>>;
  }

  watch(() => o.currentId(), refreshRefs);

  return {
    updatePlayer,
    updateSection,
    readSection,
    sectionRef,
    refreshRefs,
    canWrite,
    setJournalSink: (fn: JournalSink): void => void (sink = fn),
    /** Приёмник по умолчанию: записи, не ушедшие в журнал (до Т4). */
    pendingJournal: (): readonly PendingJournal[] => pending,
  };
}

export type SectionLayer = ReturnType<typeof createSectionLayer>;
