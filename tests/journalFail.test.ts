// Журнал игры: сбои базы (018-Т4, 018-Р24): память, квота, таймауты, ни одного unhandledRejection. Подготовка — journalHelpers.
import { reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalBackend } from '../src/app/journal/backend';
import { openIdb } from '../src/app/journal/idb';
import { DUMP_TIMEOUT_MS, FLUSH_MS, IDLE_MS, IMPORT_TIMEOUT_MS, OPEN_TIMEOUT_MS, type JournalDeps } from '../src/app/journal/journal';
import { memoryBackend } from '../src/app/journal/memory';
import type { KeysLog } from '../src/engine/journal/records';
import { keysOf, mdata, mk } from './journalHelpers';

describe('журнал: сбои', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  it('IndexedDB недоступна (приватный режим): память, игра не падает, одно событие', async () => {
    // Ловит: исключение из журнала в игру; пустая выгрузка после отказа базы; событие на каждую запись.
    const { j, told } = mk({ open: () => Promise.reject(new DOMException('denied', 'SecurityError')) });
    expect(() => j.log([{ kind: 'coin', data: { n: 1 } }], 'p1')).not.toThrow();
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
    j.log([{ kind: 'coin', data: { n: 2 } }], 'p1');
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
    const d = await j.dump();
    expect(d?.records.map((r) => (r.data as { n: number }).n)).toEqual([1, 2]);
    expect(j.usingMemory()).toBe(true);
    expect(told).toHaveLength(1);
    expect(told[0]).toContain('journal-memory');
  });

  it('сбой записи (не квота): пачка не теряется, уходит в память', async () => {
    const real = memoryBackend();
    const { j, told } = mk({ backend: { ...real, put: () => Promise.reject(new DOMException('x', 'UnknownError')) } });
    j.log([{ kind: 'coin', data: { n: 1 } }], 'p1');
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
    expect((await j.dump())?.records).toHaveLength(1);
    expect(told).toHaveLength(1);
  });

  it('квота: нажатия урезаются до 100 и запись повторяется один раз', async () => {
    const real = memoryBackend();
    let failed = false;
    const quota: JournalBackend = {
      ...real,
      put: (s, items) => {
        if (!failed && s === 'records') {
          failed = true;
          return Promise.reject(new DOMException('q', 'QuotaExceededError'));
        }
        return real.put(s, items);
      },
    };
    const { j, told } = mk({ backend: quota });
    await real.put('keys', Array.from({ length: 150 }, (_, i) => ({ match: `m${i}`, player: 'p1', t: i, ...keysOf(1) })));
    j.log([{ kind: 'coin', data: { n: 1 } }], 'p1');
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
    expect(await real.list('keys', 'p1')).toHaveLength(100);
    expect(await real.all('records')).toHaveLength(1);
    expect(j.usingMemory()).toBe(false);
    expect(told).toHaveLength(0);
  });

  it('бэкенд бросает всегда: 0 unhandledRejection, игра не бросает, событие одно', async () => {
    // Ловит: промис журнала без catch — экран «Что-то сломалось» из-за метрик.
    const seen: unknown[] = [];
    const onRej = (e: unknown): void => void seen.push(e);
    process.on('unhandledRejection', onRej);
    try {
      const err = (): never => {
        throw new DOMException('boom', 'UnknownError');
      };
      const bad: JournalBackend = { put: err, all: err, list: err, remove: err, close: err };
      const variants: Array<JournalDeps['open']> = [() => Promise.reject(new Error('no open')), () => Promise.resolve(bad), () => err()];
      for (const open of variants) {
        const { j, told } = mk({ open });
        expect(() => {
          j.log([{ kind: 'match', id: 'm', data: mdata('win') }, { kind: 'coin', data: {} }], 'p1');
          j.logKeys('p1', { match: 'm', ...keysOf(2) });
        }).not.toThrow();
        await j.flush();
        await j.trimOnce();
        await vi.advanceTimersByTimeAsync(IDLE_MS);
        await j.dump();
        await j.importFile({ jv: 1, records: [], keys: [] }, ['p1']);
        await j.close();
        expect(told.length).toBeLessThanOrEqual(1);
      }
      await new Promise((r) => setImmediate(r));
      expect(seen).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRej);
    }
  });

  it('persist: один вызов при первом открытии; отказ и бросок — без unhandledRejection и без падения', async () => {
    // Ловит: просьба о постоянном хранении не вызывается (или вызывается на каждую запись), её отказ — экран «Что-то сломалось».
    const seen: unknown[] = [];
    const onRej = (e: unknown): void => void seen.push(e);
    process.on('unhandledRejection', onRej);
    try {
      const modes: Array<() => Promise<unknown>> = [
        () => Promise.resolve(true),
        () => Promise.reject(new DOMException('no', 'NotAllowedError')),
        () => {
          throw new Error('persist бросает');
        },
      ];
      for (const mode of modes) {
        let calls = 0;
        const { j, told } = mk({
          persist: () => {
            calls++;
            return mode();
          },
        });
        expect(calls).toBe(0);
        j.log([{ kind: 'coin', data: { n: 1 } }], 'p1');
        await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
        j.log([{ kind: 'coin', data: { n: 2 } }], 'p1');
        await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
        await j.dump();
        expect(calls).toBe(1);
        expect((await j.dump())?.records).toHaveLength(2);
        expect(j.usingMemory()).toBe(false);
        expect(told).toEqual([]);
      }
      await new Promise((r) => setImmediate(r));
      expect(seen).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRej);
    }
  });

  it('база, где читать нельзя: выгрузка и загрузка без unhandledRejection', async () => {
    const seen: unknown[] = [];
    const onRej = (e: unknown): void => void seen.push(e);
    process.on('unhandledRejection', onRej);
    try {
      const real = memoryBackend();
      const fail = (): Promise<never> => Promise.reject(new Error('read'));
      const { j } = mk({ backend: { ...real, all: fail, list: fail, remove: fail } });
      j.log([{ kind: 'match', id: 'm', data: mdata('win') }], 'p1');
      await j.trimOnce();
      expect(await j.dump()).toBeNull();
      expect(await j.importFile({ jv: 1, records: [], keys: [] })).toBe(0);
      await new Promise((r) => setImmediate(r));
      expect(seen).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRej);
    }
  });

  it('выгрузка: зависшая база — null через 3 с и событие', async () => {
    const real = memoryBackend();
    const { j, told } = mk({ backend: { ...real, all: () => new Promise(() => undefined) } });
    const p = j.dump();
    await vi.advanceTimersByTimeAsync(DUMP_TIMEOUT_MS + 1);
    expect(await p).toBeNull();
    expect(told).toEqual(['journal-dump-timeout']);
  });

  it('сбой записи: прежние записи и нажатия сеанса переезжают в память вместе с новой пачкой', async () => {
    // Ловит: запасной режим стартует пустым — нажатия и записи прежних матчей сеанса пропадают (мутант M4 ревью Т4).
    const real = memoryBackend();
    let fail = false;
    const { j, told } = mk({ backend: { ...real, put: (s, items) => (fail ? Promise.reject(new DOMException('x', 'UnknownError')) : real.put(s, items)) } });
    j.logKeys('p1', { match: 'm1', ...keysOf(3) });
    j.log([{ kind: 'match', id: 'm1', data: mdata('win', 3) }], 'p1');
    await vi.advanceTimersByTimeAsync(0);
    expect((await real.all('keys')).length).toBe(1);
    fail = true;
    j.logKeys('p1', { match: 'm2', ...keysOf(2) });
    j.log([{ kind: 'match', id: 'm2', data: mdata('win') }], 'p1');
    await vi.advanceTimersByTimeAsync(0);
    expect(j.usingMemory()).toBe(true);
    const d = await j.dump();
    expect(d?.keys.map((k) => k.match).sort()).toEqual(['m1', 'm2']);
    expect(d?.records.map((r) => r.id).sort()).toEqual(['m1', 'm2']);
    expect(told).toHaveLength(1);
  });

  it('события разных видов не глушат друг друга: таймаут выгрузки и затем память', async () => {
    // Ловит: один общий флаг «уже сказано» — после таймаута выгрузки о переходе в память родитель не узнает.
    const real = memoryBackend();
    let fail = false;
    let slow = false;
    const { j, told } = mk({
      backend: {
        ...real,
        all: (s, p) => (slow ? new Promise((r) => setTimeout(() => r([]), 5000)) : real.all(s, p)),
        put: (s, items) => (fail ? Promise.reject(new DOMException('x', 'UnknownError')) : real.put(s, items)),
      },
    });
    j.log([{ kind: 'coin', data: {} }], 'p1');
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
    slow = true;
    const p = j.dump();
    await vi.advanceTimersByTimeAsync(DUMP_TIMEOUT_MS + 1);
    expect(await p).toBeNull();
    await vi.advanceTimersByTimeAsync(10_000); // два медленных `all` (records, keys) дочитываются в очереди
    slow = false;
    fail = true;
    j.log([{ kind: 'coin', data: {} }], 'p1');
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
    expect(told.map((x) => x.split(' ')[0])).toEqual(['journal-dump-timeout', 'journal-memory']);
  });

  it('база не открывается дольше 3 с: память и одно событие; опоздавшее соединение закрыто', async () => {
    // Ловит: зависший `open` держит очередь навсегда — журнал молчит, выгрузка висит.
    const real = memoryBackend();
    const close = vi.fn();
    const { j, told } = mk({ open: () => new Promise<JournalBackend>((r) => setTimeout(() => r({ ...real, close }), OPEN_TIMEOUT_MS + 1000)) });
    j.log([{ kind: 'coin', data: { n: 1 } }], 'p1');
    await vi.advanceTimersByTimeAsync(FLUSH_MS + OPEN_TIMEOUT_MS - 100);
    expect(j.usingMemory()).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(j.usingMemory()).toBe(true);
    expect((await j.dump())?.records).toHaveLength(1);
    expect(told).toHaveLength(1);
    expect(told[0]).toContain('journal-memory');
    await vi.advanceTimersByTimeAsync(2000);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('close: отложенная обрезка не срабатывает после закрытия', async () => {
    // Ловит: таймер обрезки живёт после close — обращение к закрытой базе.
    const real = memoryBackend();
    const list = vi.fn((...a: Parameters<JournalBackend['list']>) => real.list(...a));
    const { j } = mk({ backend: { ...real, list } });
    j.log([{ kind: 'coin', data: {} }], 'p1');
    await j.close();
    await vi.advanceTimersByTimeAsync(IDLE_MS + 100);
    expect(list).not.toHaveBeenCalled();
  });

  it('прокси Vue в data и нажатиях: запись не теряется (DataCloneError)', async () => {
    // Ловит: structuredClone(reactive) бросает — запись молча пропадает под catch журнала.
    const { j } = mk();
    j.log([{ kind: 'match', id: 'm1', data: reactive({ outcome: 'win', at: 2, nested: { n: [1, 2] } }) }], 'p1');
    j.logKeys('p1', reactive({ match: 'm1', typed: 'ab', expected: 'ab', dt: [5, 6] }));
    await vi.advanceTimersByTimeAsync(0);
    const d = await j.dump();
    expect(d?.records[0]?.data).toEqual({ outcome: 'win', at: 2, nested: { n: [1, 2] } });
    expect((d?.keys as KeysLog[])[0]?.dt).toEqual([5, 6]);
  });

  it('подъём версии базы (1 → 2): хранилища не пересоздаются, ConstraintError нет', async () => {
    // Ловит: createObjectStore в onupgradeneeded без contains — версия 2 падает, а экран сбоя 014 — из-за кнопки проверки.
    const have = new Set<string>();
    const created: string[] = [];
    let version = 0;
    const open = (_name: string, v: number): Record<string, unknown> => {
      const req: Record<string, unknown> = { result: null, error: null };
      const db = {
        objectStoreNames: { contains: (n: string) => have.has(n) },
        createObjectStore: (n: string) => {
          if (have.has(n)) throw Object.assign(new Error('exists'), { name: 'ConstraintError' });
          have.add(n);
          created.push(n);
          return { createIndex: () => undefined };
        },
        close: () => undefined,
      };
      req.result = db;
      void Promise.resolve().then(() => {
        try {
          if (v > version) (req.onupgradeneeded as () => void)();
          version = v;
          (req.onsuccess as () => void)();
        } catch (e) {
          req.error = e;
          (req.onerror as () => void)();
        }
      });
      return req;
    };
    vi.stubGlobal('indexedDB', { open });
    try {
      await openIdb('x', 1);
      await expect(openIdb('x', 2)).resolves.toBeDefined();
      expect(created).toEqual(['records', 'keys']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('слияние зависло: 0 через 3 с и своё событие journal-import-timeout', async () => {
    // Ловит: таймаут слияния под видом таймаута выгрузки — родитель не отличит, что не доехало.
    const real = memoryBackend();
    const { j, told } = mk({ backend: { ...real, all: () => new Promise(() => undefined) } });
    const p = j.importFile({ jv: 1, records: [], keys: [] }, ['p1']);
    await vi.advanceTimersByTimeAsync(IMPORT_TIMEOUT_MS + 1);
    expect(await p).toBe(0);
    expect(told).toEqual(['journal-import-timeout']);
  });

  it('запись, что не копируется (функция вместо данных), пропускается одна: соседние и очередь живы', async () => {
    // Ловит: одна плохая запись роняет всю пачку и сбрасывает таймер записи — остальное не уходит в базу.
    const { j } = mk();
    const notCopyable = (): number => 1;
    expect(() => j.log([{ kind: 'coin', data: { n: 1 } }, { kind: 'coin', data: notCopyable }, { kind: 'coin', data: { n: 3 } }], 'p1')).not.toThrow();
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
    expect(((await j.dump())?.records ?? []).map((r) => (r.data as { n: number }).n)).toEqual([1, 3]);
  });
});
