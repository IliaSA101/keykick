/**
 * Загрузка файла резервной копии: запись, отказы и порядок (спека 014-Т4, К6; правила Б1, В6, В7). Ловит у каждого теста —
 * строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { mergePlayers } from '../src/engine/save/backup';
import { NEXT, V1, onProbe, probeAt } from './saveStoreHelpers';
import { DAY, T0, bulkDays, device, prepare } from './backupHelpers';

describe('загрузка файла: запись и отказы (К6)', () => {
  // Ловит: вторая загрузка за сутки затирает `pre.import` — первая копия «до» (настоящее состояние) пропадает навсегда.
  it('вторая загрузка за сутки не затирает pre.import; через сутки старая заменяется', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const file = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    const original = b.mem.data.get(`${NEXT}save.p1`);
    expect(b.backup.applyBackup(await prepare(b, file)).ok).toBe(true);
    const imports = (): string[] => [...b.mem.data.keys()].filter((k) => k.includes('.import.'));
    expect(imports()).toHaveLength(1);
    expect(b.mem.data.get(imports()[0] ?? '')).toBe(original);
    b.clock.now = T0 + 3600 * 1000;
    expect(b.backup.applyBackup(await prepare(b, file)).ok).toBe(true);
    expect(imports()).toHaveLength(1);
    expect(b.mem.data.get(imports()[0] ?? '')).toBe(original);
    b.clock.now = T0 + 2 * DAY;
    b.store.update('p1', onProbe((s) => ({ ...s, goals: 77 })));
    const before = b.mem.data.get(`${NEXT}save.p1`);
    expect(b.backup.applyBackup(await prepare(b, file)).ok).toBe(true);
    expect(imports()).toHaveLength(1);
    expect(b.mem.data.get(imports()[0] ?? '')).toBe(before);
  });

  // Ловит: загрузка файла одного игрока трогает остальных (их сохранения, запись в списке) — родитель теряет чужой прогресс.
  it('игроки вне файла не тронуты', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const b = device();
    b.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 1, p2: 6 });
    const p2Before = b.mem.data.get(`${NEXT}save.p2`);
    expect(b.backup.applyBackup(await prepare(b, (await a.backup.downloadBackup()).text)).ok).toBe(true);
    expect(b.mem.data.get(`${NEXT}save.p2`)).toBe(p2Before);
    const list = JSON.parse(b.mem.data.get(`${NEXT}players`) ?? '{}') as { players: Array<{ id: string }> };
    expect(list.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(probeAt(b.mem.data, `${NEXT}save.p1`).goals).toBe(9);
  });

  // Ловит: двойной клик «Загрузить» пишет дважды (две копии «до», rev растёт лишний раз) — повтор обязан вернуть тот же итог.
  it('повторный вызов с тем же превью ничего не пишет', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    const prepared = await prepare(b, (await a.backup.downloadBackup()).text);
    const first = b.backup.applyBackup(prepared);
    const writes = b.mem.state.writes;
    expect(b.backup.applyBackup(prepared)).toBe(first);
    expect(b.mem.state.writes).toBe(writes);
  });

  // Ловит: копия «до» не легла (нет места), а основной ключ, список или `session` всё равно записаны — прежний прогресс
  // потерян без следа. Имена в файле и на устройстве разные, `session` разный: отличие любой записи видно побайтно.
  it('копия «до» не влезла — отказ, сохранение, список и session прежние побайтно', async () => {
    const a = device();
    a.seed([['p1', 'Аня-в-файле']], { p1: 9 });
    a.mem.data.set(`${NEXT}session`, JSON.stringify({ days: { '2026-11-07': 600 }, mark: 'файл' }));
    const text = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    b.mem.data.set(`${NEXT}session`, JSON.stringify({ days: { '2026-11-06': 5 } }));
    const prepared = await prepare(b, text);
    const keys = ['save.p1', 'players', 'session'].map((k) => `${NEXT}${k}`);
    const before = keys.map((k) => b.mem.data.get(k));
    const grown = JSON.stringify(mergePlayers(JSON.parse(before[1] ?? 'null'), (JSON.parse(text) as { players: unknown }).players)).length - (before[1] ?? '').length;
    // Место есть на новый список, но не на копию «до» (она вдвое больше запаса).
    b.mem.state.quota = b.mem.used() + Math.max(grown, 0) + 20;
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'no-space', applied: [] });
    expect(keys.map((k) => b.mem.data.get(k))).toEqual(before);
    expect([...b.mem.data.keys()].filter((k) => k.includes('.import.'))).toEqual([]);
  });

  // Ловит: копия «до» записана и перечитана, но освобождение места при записи основного ключа (канал `next`, шаг «old»)
  // удаляет её же — прогресс пропал, а ответ `ok`. Основной ключ должен остаться прежним, копия — лежать.
  it('основной ключ не влез после копии — копия «до» не удаляется, ответ no-space', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    a.store.update('p1', onProbe((s) => ({ ...s, days: bulkDays(60) })));
    const text = (await a.backup.downloadBackup()).text;
    const init = (): ReturnType<typeof device> => {
      const d = device();
      d.seed([['p1', 'Аня']], { p1: 1 });
      return d;
    };
    // Пробный прогон без квоты: сколько займёт всё вместе с копией.
    const probe = init();
    probe.backup.applyBackup(await prepare(probe, text));
    const b = init();
    const prepared = await prepare(b, text);
    const before = b.mem.data.get(`${NEXT}save.p1`);
    // Журнал в пробном прогоне дописан уже после записей — его размер в расчёт не входит.
    const logSize = `${NEXT}events`.length + (probe.mem.data.get(`${NEXT}events`) ?? '').length;
    b.mem.state.quota = probe.mem.used() - logSize - 1;
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'no-space', applied: [] });
    expect(b.mem.data.get(`${NEXT}save.p1`)).toBe(before);
    const copies = [...b.mem.data.entries()].filter(([k]) => k.includes('.import.'));
    expect(copies.map(([, v]) => v)).toEqual([before]);
  });

  // Ловит: после отказа на втором игроке теряется ответ, кто уже загружен, или первый остаётся не загруженным.
  it('второй игрок не влез: первый загружен и назван в applied, второй прежний, session прежняя', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 9, p2: 7 });
    a.mem.data.set(`${NEXT}session`, JSON.stringify({ mark: 'файл' }));
    const text = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 1, p2: 2 });
    b.store.update('p2', onProbe((s) => ({ ...s, days: bulkDays(300) })));
    b.mem.data.set(`${NEXT}session`, JSON.stringify({ mark: 'устройство' }));
    const prepared = await prepare(b, text);
    const p2Before = b.mem.data.get(`${NEXT}save.p2`);
    const sessionBefore = b.mem.data.get(`${NEXT}session`);
    b.mem.state.quota = b.mem.used() + 3000;
    // Порядок записи: список первым (session — после всех сохранений, до неё отказ не дошёл).
    const written: string[] = [];
    const write = b.mem.io.write.bind(b.mem.io);
    b.mem.io.write = (k, t) => {
      written.push(k.slice(NEXT.length));
      return write(k, t);
    };
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'no-space', applied: ['p1'] });
    expect(written[0]).toBe('players');
    expect(written.some((k) => k === 'session')).toBe(false);
    expect(b.mem.data.get(`${NEXT}save.p2`)).toBe(p2Before);
    expect(b.mem.data.get(`${NEXT}session`)).toBe(sessionBefore);
    expect(probeAt(b.mem.data, `${NEXT}save.p1`).goals).toBe(9);
  });

  // Ловит (S1): копия «до» моложе суток уже есть (`copyName` null), основной ключ пишется без защиты — шаг «old» на `next`
  // удаляет эту копию, и исходный прогресс до первой загрузки пропадает; ответ при этом `ok`.
  it('Р11: вторая загрузка за сутки не влезла — свежая pre.import цела, ключ прежний, no-space', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const first = (await a.backup.downloadBackup()).text;
    a.store.update('p1', onProbe((s) => ({ ...s, goals: 123456 })));
    const second = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    const original = b.mem.data.get(`${NEXT}save.p1`);
    expect(b.backup.applyBackup(await prepare(b, first)).ok).toBe(true);
    const afterFirst = b.mem.data.get(`${NEXT}save.p1`);
    const prepared = await prepare(b, second);
    // Список игроков (тот же размер) ещё влезает, а ключ игрока, длиннее на 5 знаков, — нет, пока не освободится копия «до».
    b.mem.state.quota = b.mem.used() + 2;
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'no-space', applied: [] });
    expect(b.mem.data.get(`${NEXT}save.p1`)).toBe(afterFirst);
    expect([...b.mem.data.entries()].filter(([k]) => k.includes('.import.')).map(([, v]) => v)).toEqual([original]);
  });

  // Ловит (S2): при записи второго игрока освобождение места удаляет `pre.p1.import.*`, записанную секунды назад, —
  // у первого игрока уже новое, а пути назад нет. Заодно: применённый p1 остаётся в списке из файла (Р11, «Аня-файл»),
  // не применённый p2 — как на устройстве.
  it('Р11: второй игрок не влез — pre.p1.import цела, p1 в списке из файла, p2 прежний', async () => {
    const a = device();
    a.seed([['p1', 'Аня-файл'], ['p2', 'Боря-файл']], { p1: 9, p2: 7 });
    const text = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 1, p2: 2 });
    b.store.update('p2', onProbe((s) => ({ ...s, days: bulkDays(300) })));
    const prepared = await prepare(b, text);
    const p1Before = b.mem.data.get(`${NEXT}save.p1`);
    const p2Before = b.mem.data.get(`${NEXT}save.p2`);
    b.mem.state.quota = b.mem.used() + 3000;
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'no-space', applied: ['p1'] });
    const imports = [...b.mem.data.entries()].filter(([k]) => k.includes('.import.'));
    expect(imports.map(([k, v]) => [k.slice(NEXT.length).split('.')[1], v])).toEqual([['p1', p1Before]]);
    expect(b.mem.data.get(`${NEXT}save.p2`)).toBe(p2Before);
    const list = JSON.parse(b.mem.data.get(`${NEXT}players`) ?? '{}') as { players: Array<{ id: string; name: string }> };
    expect(list.players).toEqual([{ id: 'p1', name: 'Аня-файл' }, { id: 'p2', name: 'Боря' }]);
  });

  // Ловит (S3): в список попадают все игроки файла, даже без сохранения в файле, — удалённый на устройстве игрок воскресает
  // пустой, а имя на устройстве затирается чужим.
  it('Р11: в список — только записанные из файла; удалённый на устройстве не воскресает', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 9, p2: 7 });
    const file = JSON.parse((await a.backup.downloadBackup()).text) as { saves: Record<string, string> };
    delete file.saves.p2;
    const b = device();
    b.seed([['p1', 'Аня-новая']], { p1: 1 });
    expect(b.backup.applyBackup(await prepare(b, JSON.stringify(file)))).toEqual({ ok: true, applied: ['p1'], skipped: [] });
    const list = JSON.parse(b.mem.data.get(`${NEXT}players`) ?? '{}') as { players: Array<{ id: string; name: string }> };
    expect(list.players).toEqual([{ id: 'p1', name: 'Аня' }]);
    expect(b.mem.data.has(`${NEXT}save.p2`)).toBe(false);
  });

  // Ловит (п. 5): запись игрока не удалась потому, что хранилище не читается, а родителю сказано «не хватило места».
  it('сохранение игрока не читается — причина unreadable, а не no-space; ключ прежний', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    const prepared = await prepare(b, (await a.backup.downloadBackup()).text);
    const before = b.mem.data.get(`${NEXT}save.p1`);
    const read = b.mem.io.read.bind(b.mem.io);
    b.mem.io.read = (k) => (k === `${NEXT}save.p1` ? { ok: false } : read(k));
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'unreadable', applied: [] });
    b.mem.io.read = read;
    expect(b.mem.data.get(`${NEXT}save.p1`)).toBe(before);
  });

  // Ловит (п. 6): проверка «новее программы» смотрит только на игроков файла — на устройстве лежит чужой p2 новее,
  // а загрузка p1 всё равно идёт и пишет рядом с ним (В6).
  it('на устройстве есть сохранение новее программы вне файла — apply отказывает, ничего не пишется', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const text = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    const prepared = await prepare(b, text);
    b.mem.data.set(`${NEXT}save.p2`, JSON.stringify({ format: 99, rev: 3, app: '9.9.9', sections: {} }));
    const snapshot = JSON.stringify([...b.mem.data.entries()].filter(([k]) => !k.includes('events')));
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'readonly', applied: [] });
    expect(JSON.stringify([...b.mem.data.entries()].filter(([k]) => !k.includes('events')))).toBe(snapshot);
  });

  // Ловит: отказ запоминается навсегда (повтор после освобождения места возвращает старый отказ).
  it('отказ no-space не кэшируется: после освобождения места тот же файл загружается', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    const prepared = await prepare(b, (await a.backup.downloadBackup()).text);
    b.mem.state.quota = b.mem.used() + 5;
    expect(b.backup.applyBackup(prepared).ok).toBe(false);
    b.mem.state.quota = undefined;
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: true, applied: ['p1'], skipped: [] });
  });

  // Ловит: лежащее сохранение новее программы не проверяется в превью — загрузка писала бы игроков рядом с ним (В6).
  it('лежащее сохранение новее программы — отказ превью и ничего не пишется', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 9 });
    const text = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 1 });
    b.mem.data.set(`${NEXT}save.p2`, JSON.stringify({ format: 99, rev: 3, app: '9.9.9', sections: {} }));
    const snapshot = JSON.stringify([...b.mem.data.entries()].filter(([k]) => !k.includes('events')));
    expect(await b.backup.readBackupFile(text)).toEqual({ ok: false, reason: 'newer', id: 'p2' });
    expect(JSON.stringify([...b.mem.data.entries()].filter(([k]) => !k.includes('events')))).toBe(snapshot);
  });

  // Ловит: между превью и «Загрузить» сохранение стало новее программы (другая вкладка обновилась) — загрузка пишет список
  // и первого игрока, а `scanNewer` до записи не звали.
  it('сохранение стало новее после превью — apply отказывает, список и session не тронуты', async () => {
    const a = device();
    a.seed([['p1', 'Аня-в-файле'], ['p2', 'Боря']], { p1: 9 });
    a.mem.data.set(`${NEXT}session`, JSON.stringify({ mark: 'файл' }));
    const text = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 1 });
    const prepared = await prepare(b, text);
    b.mem.data.set(`${NEXT}save.p2`, JSON.stringify({ format: 99, rev: 3, app: '9.9.9', sections: {} }));
    const snapshot = JSON.stringify([...b.mem.data.entries()].filter(([k]) => !k.includes('events')));
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'readonly', applied: [] });
    expect(JSON.stringify([...b.mem.data.entries()].filter(([k]) => !k.includes('events')))).toBe(snapshot);
    expect(b.store.status().readOnly).toBe(true);
  });

  // Ловит: слой уже «только чтение» (новее программы у другого игрока), а apply всё равно пишет.
  it('слой в readOnly — apply отказывает без записи', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const text = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    const prepared = await prepare(b, text);
    b.mem.data.set(`${NEXT}save.p7`, JSON.stringify({ format: 99, rev: 1, app: '9.9.9', sections: {} }));
    b.store.load('p7');
    expect(b.store.status().readOnly).toBe(true);
    const writes = b.mem.state.writes;
    expect(b.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'readonly', applied: [] });
    expect(b.mem.state.writes).toBe(writes);
    expect(await b.backup.readBackupFile(text)).toEqual({ ok: false, reason: 'readonly' });
  });

  // Ловит: режим v1 (ключи сына) принимает готовое превью — apply записал бы конверт туда, где ждут голый SaveData.
  it('режим v1: apply с готовым превью отказывает без записи', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const prepared = await prepare(a, (await a.backup.downloadBackup()).text);
    const v1 = device({}, { prefix: V1, channel: 'release' });
    const writes = v1.mem.state.writes;
    expect(v1.backup.applyBackup(prepared)).toEqual({ ok: false, reason: 'v1' });
    expect(v1.mem.state.writes).toBe(writes);
    expect(v1.mem.data.size).toBe(0);
  });
});
