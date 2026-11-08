/**
 * Журнал событий и файл выгрузки (спека 014-Т4, К5 и К6; design §6, §8). Показ у родителя — в `backupView.test.ts`. Хранилище и часы — в памяти теста,
 * свой слой на каждое «устройство». Ловит у каждого теста — строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { createEventLog } from '../src/app/save/eventLog';
import { EVENT_LIMITS, backupFileName, buildBackup, mergePlayers, parseBackup, pushEvent, type EventRecord } from '../src/engine/save/backup';
import { NEXT, TODAY, V1, ctx, envAt, memory, onProbe, probeAt, probeOf } from './saveStoreHelpers';
import { probe } from './saveFixtures';
import { T0, device, prepare } from './backupHelpers';

const rec = (i: number, extra: Partial<EventRecord> = {}): EventRecord => ({
  t: i,
  v: '0.10.1',
  player: 'p1',
  kind: 'screen',
  text: `e${i}`,
  ...extra,
});

describe('журнал событий: кольцо (К5)', () => {
  // Ловит: кольцо без обрезки по числу — журнал растёт без предела, а localStorage общий и невелик.
  it('держит последние 200 записей, старые выбрасывает', () => {
    let log: EventRecord[] = [];
    for (let i = 0; i < 250; i++) log = pushEvent(log, rec(i));
    expect(log).toHaveLength(EVENT_LIMITS.count);
    expect(log[0]?.text).toBe('e50');
    expect(log.at(-1)?.text).toBe('e249');
  });

  // Ловит: кольцо без предела по размеру — 200 записей со стеками по 2 КБ дали бы 400 КБ и не влезли в хранилище.
  it('укладывается в 64 КБ в JSON, новейшая запись цела', () => {
    let log: EventRecord[] = [];
    for (let i = 0; i < 200; i++) log = pushEvent(log, rec(i, { text: 'x'.repeat(300), stack: 's'.repeat(2048) }));
    expect(JSON.stringify(log).length).toBeLessThanOrEqual(EVENT_LIMITS.bytes);
    expect(log.length).toBeLessThan(EVENT_LIMITS.count);
    expect(log.at(-1)?.text).toBe('x'.repeat(300));
  });

  // Ловит: длинный стек или текст ошибки в одной записи съедает кольцо целиком (обрезка стека — 2 КБ, текста — 300).
  it('обрезает text до 300 знаков и stack до 2 КБ', () => {
    const log = pushEvent([], rec(1, { text: 'x'.repeat(1000), stack: 's'.repeat(5000) }));
    expect(log[0]?.text).toHaveLength(300);
    expect(log[0]?.stack).toHaveLength(2048);
  });

  // Ловит: pushEvent правит переданный журнал на месте — общая память между вызовами портится.
  it('исходный журнал не меняет', () => {
    const before = [rec(1)];
    pushEvent(before, rec(2));
    expect(before).toHaveLength(1);
  });

  // Ловит: журнал живёт только в памяти (после перезагрузки пуст) или битый журнал валит запись.
  it('пишется в хранилище, битый становится пустым с записью об этом первой', () => {
    const { io, data } = memory();
    const log = createEventLog({ io, prefix: NEXT, now: () => 7, app: '0.10.1', player: () => 'p2' });
    log.log('action', 'раз');
    expect(JSON.parse(data.get(`${NEXT}events`) ?? '[]')).toMatchObject([{ kind: 'action', text: 'раз', player: 'p2', t: 7 }]);
    data.set(`${NEXT}events`, '{не json');
    log.log('error', 'два');
    expect((JSON.parse(data.get(`${NEXT}events`) ?? '[]') as EventRecord[]).map((r) => r.text)).toEqual(['events-reset', 'два']);
    data.set(`${NEXT}events`, '{"не":"список"}');
    log.log('error', 'три');
    expect((JSON.parse(data.get(`${NEXT}events`) ?? '[]') as EventRecord[]).map((r) => r.text)).toEqual(['events-reset', 'три']);
  });

  // Ловит: режим v1 пишет в хранилище лишний ключ `events` — сын на старой версии получил бы чужое в своём префиксе.
  it('в режиме v1 только память: ключа в хранилище нет, журнал виден', () => {
    const { io, data } = memory();
    const log = createEventLog({ io, prefix: V1, now: () => 1, app: '0.10.1', player: () => null, memoryOnly: true });
    log.log('error', 'сбой');
    expect(data.size).toBe(0);
    expect(log.list().map((r) => r.text)).toEqual(['сбой']);
  });

  // Ловит: хранилище полно — запись журнала бросает или теряется, и экран сбоя остаётся без журнала.
  it('при полном хранилище журнал остаётся в памяти', () => {
    const { io, data } = memory({}, { quota: 10 });
    const log = createEventLog({ io, prefix: NEXT, now: () => 1, app: '0.10.1', player: () => null });
    log.log('error', 'не влезло');
    expect(data.size).toBe(0);
    expect(log.list().map((r) => r.text)).toEqual(['не влезло']);
  });

  // Ловит: события слоя сохранения (карантин, переполнение) не попадают в журнал или попадают дважды при каждом вызове.
  it('события слоя переносятся один раз', () => {
    const d = device();
    d.mem.data.set(`${NEXT}save.p1`, '{битое');
    d.store.load('p1');
    d.events.ingest(d.store.events());
    d.events.ingest(d.store.events());
    const texts = d.events.list().map((r) => r.text);
    expect(texts.filter((t) => t === 'quarantine p1')).toHaveLength(1);
  });
});

describe('файл выгрузки: круг и отказы (К6)', () => {
  // Ловит: выгрузка теряет игрока, общую часть или раздел сохранения — «выгрузил → загрузил» не возвращает то же.
  it('круг «выгрузил → загрузил → то же»: players, shared, saves (без rev)', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 3, p2: 8 });
    a.mem.data.set(`${NEXT}session`, JSON.stringify({ days: { '2026-11-07': 600 }, mark: 1 }));
    const { text, name } = (await a.backup.downloadBackup());
    expect(name).toBe(backupFileName(TODAY, '0.10.1'));
    const b = device();
    const prepared = await prepare(b, text);
    expect(prepared.entries.map((e) => e.id)).toEqual(['p1', 'p2']);
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: true, applied: ['p1', 'p2'], skipped: [] });
    expect(JSON.parse(b.mem.data.get(`${NEXT}players`) ?? 'null')).toEqual(JSON.parse(a.mem.data.get(`${NEXT}players`) ?? 'null'));
    expect(JSON.parse(b.mem.data.get(`${NEXT}session`) ?? 'null')).toEqual(JSON.parse(a.mem.data.get(`${NEXT}session`) ?? 'null'));
    for (const id of ['p1', 'p2']) {
      expect(envAt(b.mem.data, `${NEXT}save.${id}`).sections).toEqual(envAt(a.mem.data, `${NEXT}save.${id}`).sections);
      expect(envAt(b.mem.data, `${NEXT}save.${id}`).rev).toBeGreaterThan(0);
    }
  });

  // Ловит: чужие и испорченные файлы принимаются — любой JSON или файл другой версии игры затёр бы сохранения.
  it('отказы: не JSON, не наш файл, другая версия файла, другой мажор', async () => {
    const d = device();
    d.seed([['p1', 'Аня']], { p1: 1 });
    const good = JSON.parse((await d.backup.downloadBackup()).text) as Record<string, unknown>;
    const ask = (obj: unknown) => parseBackup(typeof obj === 'string' ? obj : JSON.stringify(obj), 0);
    expect(ask('не json')).toEqual({ ok: false, reason: 'not-json' });
    expect(ask({ kind: 'другое' })).toEqual({ ok: false, reason: 'not-backup' });
    expect(ask({ ...good, file: 2 })).toEqual({ ok: false, reason: 'file-version' });
    expect(ask({ ...good, major: 2 })).toEqual({ ok: false, reason: 'other-major' });
    expect(ask({ ...good, saves: { p1: 5 } })).toEqual({ ok: false, reason: 'not-backup' });
    expect(ask(good).ok).toBe(true);
  });

  // Ловит: сохранение новее программы в файле принимается частью — игрок рядом с ним загрузился бы, а новее потерялся.
  it('сохранение новее программы в файле — отказ всего файла, хранилище не тронуто', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], {});
    const file = JSON.parse((await a.backup.downloadBackup()).text) as { saves: Record<string, string> };
    file.saves.p2 = JSON.stringify({ format: 99, rev: 1, app: '9.9.9', sections: {} });
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 4 });
    const withoutLog = (): string => JSON.stringify([...b.mem.data.entries()].filter(([k]) => !k.includes('events')));
    const snapshot = withoutLog();
    expect(await b.backup.readBackupFile(JSON.stringify(file))).toEqual({ ok: false, reason: 'newer', id: 'p2' });
    expect(withoutLog()).toBe(snapshot);
  });

  // Ловит: битое сохранение в файле роняет загрузку или затирает живого игрока мусором — игрок должен быть помечен и пропущен.
  it('битый игрок в файле помечен и пропущен, остальные загружены', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 3, p2: 8 });
    const file = JSON.parse((await a.backup.downloadBackup()).text) as { saves: Record<string, string> };
    file.saves.p2 = '{битое';
    const b = device();
    b.seed([['p2', 'Боря']], { p2: 2 });
    const prepared = await prepare(b, JSON.stringify(file));
    expect(prepared.entries.find((e) => e.id === 'p2')).toMatchObject({ status: 'broken', inFile: null });
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: true, applied: ['p1'], skipped: ['p2'] });
    expect(probeOf(b.store.memory('p1')).goals).toBe(3);
    expect(probeAt(b.mem.data, `${NEXT}save.p2`).goals).toBe(2);
  });

  // Ловит: превью без колонки «сейчас» — родитель не видит, что затрёт загрузка (имя, урок, монеты, день).
  it('превью: «сейчас» и «в файле» по игроку', async () => {
    const a = device();
    a.seed([['p1', 'Аня-файл']], { p1: 3 });
    a.store.update('p1', (all) => ({ ...all, wallet: { coins: 40 } }));
    const b = device();
    b.seed([['p1', 'Аня-сейчас']], {});
    const [entry] = (await prepare(b, (await a.backup.downloadBackup()).text)).entries;
    expect(entry).toMatchObject({ id: 'p1', nameNow: 'Аня-сейчас', nameInFile: 'Аня-файл', status: 'ok', now: { coins: 5, lastDay: null }, inFile: { coins: 40, lastDay: null } });
  });

  // Ловит: при переполнении хранилища файл собирается с диска — несохранённый прогресс из памяти молча не попадает в файл.
  it('файл при переполнении содержит сохранение из памяти', async () => {
    const d = device({}, { quota: 100_000 });
    d.seed([['p1', 'Аня']], { p1: 1 });
    d.mem.state.quota = d.mem.used() + 20;
    d.store.update('p1', onProbe((s) => ({ ...s, goals: 50, matches: 12, keyErrors: Object.fromEntries('abcdefghij'.split('').map((k) => [k, 1000])) })));
    expect(d.store.status().storageFull).toBe(true);
    expect(probeAt(d.mem.data, `${NEXT}save.p1`).goals).toBe(1);
    const file = JSON.parse((await d.backup.downloadBackup()).text) as { saves: Record<string, string>; fromMemory?: string[] };
    expect(file.fromMemory).toEqual(['p1']);
    expect(probe.parse((JSON.parse(file.saves.p1 ?? 'null') as { sections: { probe: unknown } }).sections.probe, ctx)).toMatchObject({ goals: 50, matches: 12 });
  });

  // Ловит: хранилище не переполнено, а файл берёт память — устаревшее из памяти ушло бы в файл вместо диска.
  it('не переполнено: файл с диска, даже если память отличается', () => {
    const d = device();
    d.seed([['p1', 'Аня']], { p1: 1 });
    const mem = d.store.memorySaves().p1;
    const fake = { p1: { rev: (mem?.rev ?? 0) + 5, save: { ...(mem?.save ?? {}), probe: { ...probeOf(mem?.save), goals: 77 } } } };
    const file = buildBackup(d.store.dumpStorage(), fake, {
      major: 0, channel: 'next', app: '0.10.1', browser: '', createdAt: 1, storageFull: false, format: 0, draft: 1,
    });
    expect(file.fromMemory).toBeUndefined();
    expect(probe.parse((JSON.parse(file.saves.p1 ?? 'null') as { sections: { probe: unknown } }).sections.probe, ctx).goals).toBe(1);
  });

  // Ловит: переполнено, а в памяти устаревшее (другая вкладка записала новее, `rev` выше) — файл содержит старое
  // из памяти вместо лежащего новее.
  it('переполнено: память старше лежащего (rev меньше) — берётся лежащее', () => {
    const d = device();
    d.seed([['p1', 'Аня']], { p1: 1 });
    const mem = d.store.memorySaves().p1;
    const lyingRev = envAt(d.mem.data, `${NEXT}save.p1`).rev;
    const save = { ...(mem?.save ?? {}), probe: { ...probeOf(mem?.save), goals: 77 } };
    const meta = { major: 0, channel: 'next' as const, app: '0.10.1', browser: '', createdAt: 1, storageFull: true, format: 0, draft: 1 };
    const fromOlder = buildBackup(d.store.dumpStorage(), { p1: { rev: lyingRev - 1, save } }, meta);
    expect(fromOlder.fromMemory).toBeUndefined();
    expect(probe.parse((JSON.parse(fromOlder.saves.p1 ?? 'null') as { sections: { probe: unknown } }).sections.probe, ctx).goals).toBe(1);
    const fromEqual = buildBackup(d.store.dumpStorage(), { p1: { rev: lyingRev, save } }, meta);
    expect(fromEqual.fromMemory).toEqual(['p1']);
  });

  // Ловит: лишняя пометка fromMemory у игрока, чьё сохранение на диске совпадает с памятью, — родитель решит, что часть
  // прогресса не сохранена.
  it('переполнено, но память совпадает с диском — fromMemory нет', () => {
    const d = device();
    d.seed([['p1', 'Аня']], { p1: 1 });
    const file = buildBackup(d.store.dumpStorage(), d.store.memorySaves(), {
      major: 0, channel: 'next', app: '0.10.1', browser: '', createdAt: 1, storageFull: true, format: 0, draft: 1,
    });
    expect(file.fromMemory).toBeUndefined();
  });

  // Ловит: «Последний файл» врёт — время не записывается после скачивания или читается как число из мусора.
  it('lastBackupAt: пусто до первого файла, потом время выгрузки', async () => {
    const d = device();
    d.seed([['p1', 'Аня']], {});
    expect(d.backup.lastBackupAt()).toBeNull();
    d.clock.now = T0 + 5;
    await d.backup.downloadBackup();
    expect(d.backup.lastBackupAt()).toBe(T0 + 5);
    d.mem.data.set(`${NEXT}backup.at`, 'мусор');
    expect(d.backup.lastBackupAt()).toBeNull();
  });

  // Ловит: в режиме v1 выгрузка пишет `keykick.backup.at` в ключи сына (чужой ключ в его хранилище).
  it('v1: выгрузка не пишет ключ backup.at, время помнит в памяти', async () => {
    const d = device({}, { prefix: V1, channel: 'release' });
    d.seed([['p1', 'Аня']], {});
    const before = JSON.stringify([...d.mem.data.entries()]);
    d.clock.now = T0 + 9;
    await d.backup.downloadBackup();
    expect(JSON.stringify([...d.mem.data.entries()])).toBe(before);
    expect([...d.mem.data.keys()].some((k) => k.includes('backup'))).toBe(false);
    expect(d.backup.lastBackupAt()).toBe(T0 + 9);
  });

  // Ловит: файл-снимок заменяет не только своего игрока (общая часть, список) или не читается обратно тем же путём.
  it('файл из копии: один игрок, shared: null, загрузка заменяет только его', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 3, p2: 4 });
    a.store.reset('p1');
    const copy = [...a.mem.data.keys()].find((k) => k.startsWith(`${NEXT}pre.p1.reset.`));
    expect(copy).toBeDefined();
    a.mem.data.set(`${NEXT}session`, JSON.stringify({ days: { '2026-11-07': 60 } }));
    const out = await a.backup.downloadCopy((copy ?? '').slice(NEXT.length));
    const file = JSON.parse(out?.text ?? 'null') as { saves: Record<string, string>; shared: unknown };
    expect(Object.keys(file.saves)).toEqual(['p1']);
    expect(file.shared).toBeNull();
    a.store.update('p2', onProbe((s) => ({ ...s, goals: 99 })));
    const sessionBefore = a.mem.data.get(`${NEXT}session`);
    expect(a.backup.applyBackup(await prepare(a, out?.text ?? '')).ok).toBe(true);
    expect(a.mem.data.get(`${NEXT}session`)).toBe(sessionBefore);
    expect(probeAt(a.mem.data, `${NEXT}save.p2`).goals).toBe(99);
    expect(probeAt(a.mem.data, `${NEXT}save.p1`).goals).toBe(3);
  });

  // Ловит (Р14): копия «до удаления» не возвращает игрока — в файл кладётся нынешний список без него, и после загрузки
  // сохранение лежит без игрока; возвращённый встаёт не в конец списка (порядок игроков меняется).
  it('копия удалённого игрока: загрузка возвращает его в конец списка, остальных не трогает', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 3, p2: 4 });
    expect(a.store.remove('p1')).toBe(true);
    a.mem.data.set(`${NEXT}players`, JSON.stringify({ players: [{ id: 'p2', name: 'Боря' }], current: 'p2', lastId: 2 }));
    const copy = [...a.mem.data.keys()].find((k) => k.startsWith(`${NEXT}pre.p1.delete.`));
    expect(copy).toBeDefined();
    const out = await a.backup.downloadCopy((copy ?? '').slice(NEXT.length));
    const inFile = (JSON.parse(out?.text ?? 'null') as { players: { players: Array<{ id: string; name: string }> } }).players.players;
    expect(inFile).toEqual([{ id: 'p2', name: 'Боря' }, { id: 'p1', name: 'Игрок 2' }]);
    expect(a.backup.applyBackup(await prepare(a, out?.text ?? '')).ok).toBe(true);
    const list = (JSON.parse(a.mem.data.get(`${NEXT}players`) ?? 'null') as { players: Array<{ id: string; name: string }> }).players;
    expect(list).toEqual([{ id: 'p2', name: 'Боря' }, { id: 'p1', name: 'Игрок 2' }]);
    expect(probeAt(a.mem.data, `${NEXT}save.p1`).goals).toBe(3);
  });

  // Ловит (014-Р18): копия «до удаления» без имени — родитель видит «Игрок 2» вместо имени удалённого; занятое имя перебивает живого.
  it('копия удалённого игрока несёт его имя: в файле, в списке копий; имя занято — запасное; сохранение читается как прежде', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 3, p2: 4 });
    expect(a.store.remove('p1', 'Аня')).toBe(true);
    const key = [...a.mem.data.keys()].find((k) => k.startsWith(`${NEXT}pre.p1.delete.`)) ?? '';
    expect(a.backup.deletedNames()).toEqual({ p1: 'Аня' });
    const list = (names: string[]): string => JSON.stringify({ players: names.map((name, i) => ({ id: `p${i + 2}`, name })), current: 'p2', lastId: 3 });
    a.mem.data.set(`${NEXT}players`, list(['Боря']));
    const out = await a.backup.downloadCopy(key.slice(NEXT.length));
    const file = JSON.parse(out?.text ?? 'null') as { players: { players: Array<{ id: string; name: string }> }; saves: Record<string, string> };
    expect(file.players.players).toEqual([{ id: 'p2', name: 'Боря' }, { id: 'p1', name: 'Аня' }]);
    // Копия — тот же конверт, игра её читает: загрузка файла возвращает игрока с прогрессом.
    expect(a.backup.applyBackup(await prepare(a, out?.text ?? '')).ok).toBe(true);
    expect(probeAt(a.mem.data, `${NEXT}save.p1`).goals).toBe(3);
    // Имя занято нынешним игроком — берётся запасное.
    a.mem.data.set(`${NEXT}players`, list(['аня']));
    const again = await a.backup.downloadCopy(key.slice(NEXT.length));
    const names = (JSON.parse(again?.text ?? 'null') as typeof file).players.players.map((p) => p.name);
    expect(names).toEqual(['аня', 'Игрок 2']);
  });

  // Ловит (014-Р18, п. 2): занятость имени из копии сверяется через toLowerCase, а не правилом списка — «Алёна» и «Алена»
  // (ё = е) в списке считались бы одним именем, и при чтении одно из них подменится.
  it('копия удалённого игрока: имя «Алёна» при живой «Алена» (ё = е) занято — запасное «Игрок N»', async () => {
    const a = device();
    a.seed([['p1', 'Алёна'], ['p2', 'Боря']], { p1: 3, p2: 4 });
    expect(a.store.remove('p1', 'Алёна')).toBe(true);
    const key = [...a.mem.data.keys()].find((k) => k.startsWith(`${NEXT}pre.p1.delete.`)) ?? '';
    a.mem.data.set(`${NEXT}players`, JSON.stringify({ players: [{ id: 'p2', name: 'Алена' }], current: 'p2', lastId: 2 }));
    const out = await a.backup.downloadCopy(key.slice(NEXT.length));
    const names = (JSON.parse(out?.text ?? 'null') as { players: { players: Array<{ name: string }> } }).players.players.map((p) => p.name);
    expect(names).toEqual(['Алена', 'Игрок 2']);
  });

  // Ловит: запасное имя возвращённого игрока совпадает с нынешним («Игрок 2» дважды) — при чтении списка одно из имён подменится.
  it('копия удалённого игрока: запасное имя «Игрок N» занято — берётся следующее', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Игрок 2']], { p1: 3, p2: 4 });
    a.store.remove('p1');
    a.mem.data.set(`${NEXT}players`, JSON.stringify({ players: [{ id: 'p2', name: 'Игрок 2' }], current: 'p2', lastId: 2 }));
    const copy = [...a.mem.data.keys()].find((k) => k.startsWith(`${NEXT}pre.p1.delete.`));
    const out = await a.backup.downloadCopy((copy ?? '').slice(NEXT.length));
    const inFile = (JSON.parse(out?.text ?? 'null') as { players: { players: Array<{ id: string; name: string }> } }).players.players;
    expect(inFile.map((p) => p.name)).toEqual(['Игрок 2', 'Игрок 3']);
  });

  // Ловит (Р16): при четырёх игроках возвращаемый пятый дописывается, а при чтении списка последний молча выпадает —
  // сохранение лежит без игрока. Нужен отказ на превью, и ничего не записано.
  it('копия пятого игрока при четырёх нынешних: отказ players-full, ничего не записано', async () => {
    const a = device();
    a.seed([['p1', 'А'], ['p2', 'Б'], ['p3', 'В'], ['p4', 'Г'], ['p5', 'Д']], { p5: 7 });
    a.store.remove('p5');
    a.mem.data.set(`${NEXT}players`, JSON.stringify({ players: ['p1', 'p2', 'p3', 'p4'].map((id, i) => ({ id, name: 'АБВГ'[i] })), current: 'p1', lastId: 5 }));
    const copy = [...a.mem.data.keys()].find((k) => k.startsWith(`${NEXT}pre.p5.delete.`));
    const out = await a.backup.downloadCopy((copy ?? '').slice(NEXT.length));
    const dump = (): string => JSON.stringify([...a.mem.data.entries()].filter(([k]) => k !== `${NEXT}events`));
    const before = dump();
    expect(await a.backup.readBackupFile(out?.text ?? '')).toEqual({ ok: false, reason: 'players-full' });
    expect(dump()).toBe(before);
  });

  // Ловит: режим v1 (ключи сына) принимает файл — загрузка записала бы конверт туда, где ждут голый SaveData.
  it('режим v1 загрузку не принимает', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], {});
    const v1 = device({}, { prefix: V1, channel: 'release' });
    expect(await v1.backup.readBackupFile((await a.backup.downloadBackup()).text)).toEqual({ ok: false, reason: 'v1' });
  });

  // Ловит: выгрузка и загрузка не оставляют следа в журнале — при разборе сбоя непонятно, что делал родитель.
  it('выгрузка и загрузка попадают в журнал', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 2 });
    const text = (await a.backup.downloadBackup()).text;
    a.backup.applyBackup(await prepare(a, text));
    const texts = a.events.list().map((r) => r.text);
    expect(texts).toContain('backup-download');
    expect(texts.some((t) => t.startsWith('backup-apply p1'))).toBe(true);
  });

  // Ловит: слияние списка теряет игрока файла или нынешнего, либо оставляет `current` на несуществующем игроке;
  // меняет порядок нынешних игроков (014-Р16: новые из файла идут в конец, а не первыми);
  // с `only` — берёт в список игрока файла, чьё сохранение не записано (воскрешает удалённого).
  it('mergePlayers: нынешние (порядок прежний) ∪ новые из файла, current существует, lastId — больший', () => {
    const cur = { players: [{ id: 'p1', name: 'А' }, { id: 'p3', name: 'В' }], current: 'p3', lastId: 3 };
    const file = { players: [{ id: 'p1', name: 'Аня' }, { id: 'p2', name: 'Б' }], current: 'p9', lastId: 2 };
    expect(mergePlayers(cur, file)).toEqual({
      players: [{ id: 'p1', name: 'Аня' }, { id: 'p3', name: 'В' }, { id: 'p2', name: 'Б' }],
      current: 'p3',
      lastId: 3,
    });
    expect(mergePlayers(cur, null)).toBe(cur);
    // Р11: только записанные из файла — p2 без сохранения в список не попадает, p1 берётся из файла.
    expect(mergePlayers(cur, file, ['p1'])).toEqual({ players: [{ id: 'p1', name: 'Аня' }, { id: 'p3', name: 'В' }], current: 'p3', lastId: 3 });
  });
});
