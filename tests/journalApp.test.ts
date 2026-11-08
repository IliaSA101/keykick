// Журнал игры, приложение (018-Т4): очередь, итог матча, обрезка, слияние. Сбои — journalFail.test.ts, сеанс — journalSession.test.ts,
// файл выгрузки — journalFile.test.ts. Бэкенд — память; IndexedDB проверяется контрактом (кнопка на #/dev/frames).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalBackend } from '../src/app/journal/backend';
import { currentJournal, logMatchKeys, startJournal } from '../src/app/journal/boot';
import { backendContract } from '../src/app/journal/contract';
import { FLUSH_MS, IDLE_MS } from '../src/app/journal/journal';
import { memoryBackend } from '../src/app/journal/memory';
import { saveStore } from '../src/app/save/instance';
import { startSession, type SessionWiring } from '../src/app/journal/session';
import type { JournalRecord, KeysLog } from '../src/engine/journal/records';
import { KEYS_KEEP } from '../src/engine/journal/trim';
import { ids, keysOf, mdata, mk } from './journalHelpers';

describe('журнал: приложение', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  it('контракт бэкенда: память проходит все случаи', async () => {
    const res = await backendContract(() => Promise.resolve(memoryBackend()));
    expect(res.length).toBeGreaterThanOrEqual(8);
    expect(res.filter((r) => !r.ok)).toEqual([]);
  });

  it('контракт краснеет на бэкенде, что отдаёт чужого игрока', async () => {
    // Ловит: набор, который не отличает хороший бэкенд от плохого, — пустая проверка.
    const bad = (): Promise<JournalBackend> => {
      const m = memoryBackend();
      return Promise.resolve({ ...m, all: (store) => m.all(store) });
    };
    const res = await backendContract(bad);
    expect(res.filter((r) => !r.ok).map((r) => r.name)).toContain('all-player');
  });

  it('очередь: записи уходят пачкой раз в 500 мс, по порядку', async () => {
    // Ловит: запись на каждый вызов (транзакция на нажатие) или потерянный порядок.
    const { j, backend } = mk();
    j.log([{ kind: 'coin', data: { n: 1 } }, { kind: 'coin', data: { n: 2 } }], 'p1');
    j.log([{ kind: 'coin', data: { n: 3 } }], 'p1');
    await vi.advanceTimersByTimeAsync(FLUSH_MS - 1);
    expect(await ids(backend)).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    const got = (await backend.all('records')) as JournalRecord[];
    expect(got.map((r) => (r.data as { n: number }).n)).toEqual([1, 2, 3]);
    expect(got.every((r) => r.player === 'p1' && r.jv === 1 && r.app === 'test')).toBe(true);
  });

  it('pagehide и hidden: очередь сбрасывается сразу, не ждёт 500 мс', async () => {
    // Ловит: вкладку закрыли за 400 мс до сброса — записи пропали.
    const { j, backend } = mk();
    const cbs: Record<string, () => void> = {};
    const w: SessionWiring = {
      journal: j,
      now: () => 5 * 60_000,
      tab: 'aaaa',
      player: () => 'p1',
      route: () => 'home',
      onRoute: () => () => undefined,
      onHidden: (cb) => ((cbs.hidden = cb), () => undefined),
      onVisible: (cb) => ((cbs.visible = cb), () => undefined),
      onPageHide: (cb) => ((cbs.pagehide = cb), () => undefined),
    };
    startSession(w);
    j.log([{ kind: 'coin', data: { n: 1 } }], 'p1');
    cbs.pagehide?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(((await backend.all('records')) as JournalRecord[]).some((r) => (r.data as { n?: number }).n === 1)).toBe(true);
    j.log([{ kind: 'coin', data: { n: 2 } }], 'p1');
    cbs.hidden?.();
    await vi.advanceTimersByTimeAsync(0);
    const all = (await backend.all('records')) as JournalRecord[];
    expect(all.some((r) => (r.data as { n?: number }).n === 2)).toBe(true);
  });

  it('итог матча уходит сразу, вне пачки; open перезаписывается тем же id', async () => {
    // Ловит: доиграл, закрыл вкладку — в журнале остался open; или перезапись создала дубль.
    const { j, backend } = mk();
    j.log([{ kind: 'match', id: 'm1', data: mdata('open', 0) }], 'p1');
    await vi.advanceTimersByTimeAsync(FLUSH_MS);
    const first = ((await backend.all('records')) as JournalRecord[])[0]!;
    j.log([{ kind: 'match', id: 'm1', data: mdata('win', 3) }], 'p1');
    await vi.advanceTimersByTimeAsync(0); // без хода часов: 500 мс не прошло
    const all = (await backend.all('records')) as JournalRecord[];
    expect(all).toHaveLength(1);
    expect((all[0]!.data as { outcome: string }).outcome).toBe('win');
    expect(all[0]!.t).toBe(first.t);
  });

  it('нажатия уходят вместе с итогом; повтор матча — перезапись, dt зажат', async () => {
    const { j, backend } = mk();
    j.logKeys('p1', { match: 'm1', typed: 'ab', expected: 'ab', dt: [10, 99_999] });
    j.logKeys('p1', { match: 'm1', typed: 'abc', expected: 'abc', dt: [10, 99_999, Number.NaN] });
    j.log([{ kind: 'match', id: 'm1', data: mdata('loss', 2) }], 'p1');
    await vi.advanceTimersByTimeAsync(0);
    const k = (await backend.all('keys')) as KeysLog[];
    expect(k).toHaveLength(1);
    expect(k[0]!.typed).toBe('abc');
    expect(k[0]!.dt).toEqual([10, 60_000, 0]);
  });

  it('обрезка: 300 последних нажатий игрока, чужие целы, один раз за сеанс', async () => {
    // Ловит: база растёт без предела; обрезка чужого игрока; обрезка не по t.
    const { j, backend } = mk();
    await backend.put('keys', Array.from({ length: KEYS_KEEP + 5 }, (_, i) => ({ match: `m${i}`, player: 'p1', t: i, ...keysOf(1) })));
    await backend.put('keys', [{ match: 'other', player: 'p2', t: 0, ...keysOf(1) }]);
    j.log([{ kind: 'match', id: 'new', data: mdata('win') }], 'p1');
    await vi.advanceTimersByTimeAsync(0);
    const left = (await backend.list('keys', 'p1')).map((e) => e.key);
    expect(left).toHaveLength(KEYS_KEEP);
    expect(left).not.toContain('m0');
    expect(left).toContain(`m${KEYS_KEEP + 4}`);
    expect(await backend.list('keys', 'p2')).toHaveLength(1);
    // Второй раз за сеанс — не трогает.
    await backend.put('keys', [{ match: 'late', player: 'p1', t: 9999, ...keysOf(1) }]);
    j.log([{ kind: 'match', id: 'new2', data: mdata('win') }], 'p1');
    await vi.advanceTimersByTimeAsync(0);
    expect(await backend.list('keys', 'p1')).toHaveLength(KEYS_KEEP + 1);
  });

  it('обрезка в простое: через 30 с без итога матча', async () => {
    const { j, backend } = mk();
    await backend.put('keys', Array.from({ length: KEYS_KEEP + 2 }, (_, i) => ({ match: `m${i}`, player: 'p1', t: i, ...keysOf(1) })));
    j.log([{ kind: 'coin', data: {} }], 'p1');
    await vi.advanceTimersByTimeAsync(IDLE_MS - 1000);
    expect(await backend.list('keys', 'p1')).toHaveLength(KEYS_KEEP + 2);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await backend.list('keys', 'p1')).toHaveLength(KEYS_KEEP);
  });

  it('две вкладки в одну базу: свои id не сталкиваются, общий матч — одна запись', async () => {
    // Ловит: одинаковый id в двух вкладках в одну миллисекунду (потеря записи) и дубль матча.
    const shared = memoryBackend();
    const a = mk({ backend: shared, tab: 'aaaa', constNow: 7000 });
    const b = mk({ backend: shared, tab: 'bbbb', constNow: 7000 });
    for (let i = 0; i < 5; i++) {
      a.j.log([{ kind: 'coin', data: { i } }], 'p1');
      b.j.log([{ kind: 'coin', data: { i } }], 'p1');
    }
    a.j.log([{ kind: 'match', id: 'p1.match', data: mdata('open') }], 'p1');
    b.j.log([{ kind: 'match', id: 'p1.match', data: mdata('win', 4) }], 'p1');
    a.j.logKeys('p1', { match: 'p1.match', ...keysOf(3) });
    b.j.logKeys('p1', { match: 'p1.match', ...keysOf(3) });
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 10);
    const all = (await shared.all('records')) as JournalRecord[];
    expect(all).toHaveLength(11);
    expect(new Set(all.map((r) => r.id)).size).toBe(11);
    expect(await shared.all('keys')).toHaveLength(1);
  });

  it('выгрузка игрока — только его записи; загрузка: слияние, полнее побеждает, ничего не удаляется', async () => {
    const { j, backend } = mk();
    j.log([{ kind: 'match', id: 'p1.m', data: mdata('open', 1) }, { kind: 'coin', data: {} }], 'p1');
    j.log([{ kind: 'coin', data: {} }], 'p2');
    await j.flush();
    expect((await j.dump('p1'))?.records.every((r) => r.player === 'p1')).toBe(true);
    const base = { app: 'f', jv: 1, t: 1 };
    const file = {
      jv: 1,
      records: [
        { ...base, id: 'p1.m', player: 'p1', kind: 'match', data: mdata('win', 5) },
        { ...base, id: 'p3.x', player: 'p3', kind: 'coin', data: {} },
        { ...base, id: 'p2.new', player: 'p2', kind: 'coin', data: {} },
        { bad: true },
      ],
      keys: [],
    };
    const before = (await backend.all('records')).length;
    await j.importFile(file, ['p1', 'p2']);
    const all = (await backend.all('records')) as JournalRecord[];
    expect(all.length).toBe(before + 1); // p2.new; p3 не загружен; битое отброшено
    expect((all.find((r) => r.id === 'p1.m')!.data as { outcome: string }).outcome).toBe('win');
    // Менее полная запись из файла лежащую не затирает.
    await j.importFile({ ...file, records: [{ ...file.records[0], data: mdata('open', 1) }] }, ['p1']);
    expect(((await backend.all('records')) as JournalRecord[]).find((r) => r.id === 'p1.m')!.data).toMatchObject({ outcome: 'win' });
    expect(await j.importFile('мусор')).toBe(0);
  });

  it('объём нажатий матча: 800 знаков — в пределах 8 КБ', () => {
    // Мера для design §5 («≈ 3 КБ» была гипотезой): 800 нажатий урока 14.
    const typed = 'аб'.repeat(400);
    const k: KeysLog = {
      match: 'p1.zzzzzzzz.aaaa12',
      player: 'p1',
      t: 1_800_000_000_000,
      typed,
      expected: typed,
      dt: Array.from({ length: 800 }, (_, i) => 90 + ((i * 37) % 400)),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(k)).length;
    expect(bytes).toBeLessThan(8 * 1024);
    expect(bytes).toBeGreaterThan(2 * 1024);
  });

  it('v1: журнал не запускается — ни базы, ни слушателей, ни ключей localStorage', () => {
    // Ловит: новая запись в ключах сына (v1) и база там, где её быть не должно.
    const open = vi.fn();
    const setItem = vi.fn();
    const addEventListener = vi.fn();
    vi.stubGlobal('indexedDB', { open });
    vi.stubGlobal('localStorage', { setItem, getItem: () => null, removeItem: vi.fn(), key: () => null, length: 0 });
    vi.stubGlobal('document', { addEventListener });
    vi.stubGlobal('window', { addEventListener });
    try {
      const router = { currentRoute: { value: { name: 'home' } }, afterEach: vi.fn() };
      startJournal(router as never, 'v1');
      expect(open).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
      expect(addEventListener).not.toHaveBeenCalled();
      expect(router.afterEach).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('logMatchKeys: пишет нажатия в журнал; при хранилище «только чтение» — нет', async () => {
    // Ловит: нажатия пишутся в журнал, когда сохранение заперто (новее программы) — история расходится с игрой.
    const listeners = vi.fn();
    vi.stubGlobal('document', { addEventListener: listeners, visibilityState: 'visible' });
    vi.stubGlobal('window', { addEventListener: listeners });
    try {
      startJournal({ currentRoute: { value: { name: 'home' } }, afterEach: vi.fn() } as never, 'envelope');
      const j = currentJournal();
      expect(j).not.toBeNull();
      const keys = { match: 'm1', typed: 'ab', expected: 'ab', dt: [5, 6] };
      logMatchKeys('p1', keys);
      const status = saveStore.status();
      const spy = vi.spyOn(saveStore, 'status').mockReturnValue({ ...status, readOnly: true });
      logMatchKeys('p1', { ...keys, match: 'm2' });
      spy.mockRestore();
      expect((await j?.dump())?.keys.map((k) => k.match)).toEqual(['m1']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
