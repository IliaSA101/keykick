/**
 * Перенос клуба файлом (063 Т11): выгрузка → загрузка на чистом хранилище (К11), совпадение игроков (выбор родителя),
 * отказ по лимиту, края §2 (bad, newer, квота, двойной клик, newer-игрок и карантин в выгрузке).
 * Подготовка — хранилище в памяти из `tests/fixtures/storageKit.ts` на настоящих разделах сборки. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { createBin } from '../../src/app/save/bin';
import { deviceRow, stuckRows } from '../../src/engine/parent/repair';
import { createTransfer, type Transfer } from '../../src/app/save/transfer';
import { SECTIONS } from '../../src/app/save/sections';
import { newDevice, type Store } from '../../src/app/save/store';
import { createPlayer, serializePlayer, writePlayer, type Envelope } from '../../src/engine/save/envelope';
import { exportFileName, summarize } from '../../src/engine/save/snapshot';
import type { LocksApi } from '../../src/app/save/locks';
import { P, fakeLocks, key, setup, type MemStorage } from '../fixtures/storageKit';

const MADE = '2026-11-18T10:00:00.000Z';
const FROM = 'https://example.org/keykick/next/';
const DAY = '2026-11-18';

/** Игрок на настоящих разделах: урок, звёзды и монеты — по ним сверяются сводки. */
function kid(pid: string, coins: number, lesson = 'ru.yard.ao', rev = 0): Envelope {
  const env = writePlayer(createPlayer({ pid, name: `Игрок ${pid}` }, SECTIONS), {
    'course:ru': { current: lesson, lessons: { 'ru.yard.ao': { stars: 2, best: 40, tries: 1, fails: 0, done: '2026-11-10' } }, archive: {}, leaguesDone: {} },
    wallet: { coins, rest: 0, paid: [] },
  });
  return { ...env, rev: Math.max(env.rev, rev) };
}

/** Устройство с игроками: записи игроков и список. */
function fill(store: Store, envs: Envelope[]): void {
  for (const env of envs) expect(store.savePlayer(env.pid, env, null)).toEqual({ ok: true });
  const base = newDevice();
  expect(store.saveDevice({ ...base, rev: 1, players: envs.map((e, order) => ({ pid: e.pid, order })) }, null)).toEqual({ ok: true });
}

function world(envs: Envelope[] = [], locks?: LocksApi) {
  const s = setup(locks ? { locks } : {});
  const store = s.open(SECTIONS);
  if (envs.length > 0) fill(store, envs);
  const transfer: Transfer = createTransfer({ store, defs: SECTIONS, app: '2.0.0' });
  return { ...s, store, transfer };
}

/** Квота на записи устройства: ключ устройства не пишется, пока `on`. */
function failDeviceWrites(mem: MemStorage): { on: boolean } {
  const fail = { on: true };
  const set = mem.setItem.bind(mem);
  mem.setItem = (k, v) => {
    if (fail.on && k === `${P}device`) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    set(k, v);
  };
  return fail;
}

/** Копия c1 игрока из кольца копий. */
const copyOf = (mem: MemStorage, pid: string): Envelope | undefined => {
  const raw = mem.map.get(`${key(pid)}.c1`);
  return raw === undefined ? undefined : (JSON.parse(raw) as Envelope);
};

const exported = (t: Transfer, memory?: Envelope[]): string => {
  const out = t.exportText(MADE, FROM, memory);
  if (!out.ok) throw new Error('export');
  return out.text;
};

describe('К11: выгрузка → загрузка на чистом хранилище', () => {
  it('К11 тот же клуб: игроки, сводки, порядок и список устройства совпадают', async () => {
    // Ловит: загрузка файла на чистом хранилище теряет игрока, разделы или порядок — клуб «вернулся» не тем.
    const a = world([kid('p-a', 89, 'ru.yard.ao'), kid('p-b', 72, 'ru.yard.ao')]);
    const text = exported(a.transfer);
    const b = world();
    const plan = b.transfer.plan(text);
    expect(plan.kind).toBe('ok');
    const res = await b.transfer.apply(plan, {});
    expect(res).toEqual({ ok: true, added: 2, replaced: 0, kept: 0, written: ['p-a', 'p-b'], binLeft: [] });
    const back = b.transfer.here();
    expect(back.players.map(summarize)).toEqual(a.transfer.here().players.map(summarize));
    expect(back.players.map((p) => serializePlayer(p))).toEqual(a.transfer.here().players.map((p) => serializePlayer(p)));
    expect(back.device?.players.map((p) => p.pid)).toEqual(['p-a', 'p-b']);
    expect(b.store.loadPlayer('p-a').kind).toBe('ok');
  });

  it('К11 имя файла — по дню снимка; не по форме — без даты', () => {
    // Ловит: имя файла уходит в браузер без даты, и родитель не отличает файлы друг от друга.
    const a = world([kid('p-a', 1)]);
    const out = a.transfer.exportText(MADE, FROM);
    expect(out.ok && out.name).toBe(`keykick-club-${DAY}.json`);
    expect(exportFileName('мусор')).toBe('keykick-club.json');
  });

  it('К11 выгрузка из памяти: игрок с отказом записи (квота) попадает в файл тем, что сыгран, а не тем, что на диске', async () => {
    // Ловит: при полном диске файл выгрузки теряет всё, что сыграно после последней удачной записи.
    const a = world([kid('p-a', 10)]);
    const ahead = kid('p-a', 99);
    const text = exported(a.transfer, [ahead]);
    const b = world();
    expect((await b.transfer.apply(b.transfer.plan(text), {})).ok).toBe(true);
    expect(summarize(b.transfer.here().players[0]!).coins).toBe(99);
  });
});

describe('К12: файл одного игрока (063-Р62)', () => {
  it('К12 exportText(only): в снимке только этот игрок, без дней корзины других и без карантина устройства; нет в списке — файл без игроков', () => {
    // Ловит: «Скачать файл Миши» отдаёт весь клуб (все игроки в файле одного); день корзины чужого игрока и карантин устройства попадают в чужой файл.
    const a = world([kid('p1', 10), kid('p2', 20), kid('p3', 30)]);
    const d = a.store.loadDevice();
    if (d.kind !== 'ok') throw new Error('device');
    expect(a.store.saveDevice({ ...d.device, rev: d.device.rev + 1, bin: { p9: DAY } }, d.device.rev)).toEqual({ ok: true });
    a.mem.map.set(`${P}quarantine.device.1`, 'битое устройство');
    const out = a.transfer.exportText(MADE, FROM, [], 'p2');
    if (!out.ok) throw new Error('export');
    const snap = JSON.parse(out.text) as { device: { players: { pid: string }[]; bin?: unknown }; players: { pid: string }[]; quarantine?: unknown };
    expect(snap.players.map((p) => p.pid)).toEqual(['p2']);
    expect(snap.device.players.map((p) => p.pid)).toEqual(['p2']);
    expect(snap.device.bin).toBeUndefined();
    expect(snap.quarantine).toBeUndefined();
    const all = JSON.parse((a.transfer.exportText(MADE, FROM) as { text: string }).text) as typeof snap;
    expect(all.players).toHaveLength(3);
    expect(all.quarantine).toEqual({ device: ['битое устройство'] });
    const none = a.transfer.exportText(MADE, FROM, [], 'p7');
    expect(none.ok ? (JSON.parse(none.text) as typeof snap).players : 'нет').toEqual([]);
  });
});

describe('К12: совпадение игроков и лимит', () => {
  it('К12 clash, «взять из файла»: проигравший (мой) — в копии, записан победитель с rev = max + 1', async () => {
    // Ловит: «взять из файла» затирает игрока без следа или пишет с тем же rev (savePlayer: invalid ['rev']).
    const file = world([kid('p-a', 204, 'ru.yard.ao', 11)]);
    const text = exported(file.transfer);
    const mine = world([kid('p-a', 89)]);
    const before = mine.transfer.here().players[0]!;
    const plan = mine.transfer.plan(text);
    expect(plan.kind === 'ok' && plan.clash.map((c) => c.pid)).toEqual(['p-a']);
    expect(await mine.transfer.apply(plan, { 'p-a': 'file' })).toEqual({ ok: true, added: 0, replaced: 1, kept: 0, written: ['p-a'], binLeft: [] });
    const now = mine.transfer.here().players[0]!;
    expect(summarize(now).coins).toBe(204);
    expect(now.rev).toBe(Math.max(before.rev, 11) + 1);
    expect(mine.mem.map.get(`${mine.mem.map.size ? [...mine.mem.map.keys()].find((k) => k.endsWith('player.p-a.c1')) : ''}`)).toBe(serializePlayer(before));
  });

  it('К12 clash, «оставить на компьютере»: игрок цел, версия из файла — в копии', async () => {
    // Ловит: выбор «оставить» всё равно перезаписывает игрока или выбрасывает версию из файла.
    const file = world([kid('p-a', 204)]);
    const text = exported(file.transfer);
    const mine = world([kid('p-a', 89)]);
    const before = serializePlayer(mine.transfer.here().players[0]!);
    expect(await mine.transfer.apply(mine.transfer.plan(text), { 'p-a': 'mine' })).toEqual({ ok: true, added: 0, replaced: 0, kept: 1, written: [], binLeft: [] });
    expect(serializePlayer(mine.transfer.here().players[0]!)).toBe(before);
    const copy = [...mine.mem.map.entries()].find(([k]) => k.endsWith('player.p-a.c1'));
    expect(copy && summarize(JSON.parse(copy[1]) as Envelope).coins).toBe(204);
  });

  it('К12 clash «взять из файла», а на компьютере тот же файл игрока: ничего не пишется — replaced 0, written пуст, rev не растёт', async () => {
    // Ловит: равный файлу игрок считается «заменённым» и пишется заново (rev +1, лишняя копия, ложное «заменён» в итоге).
    const text = exported(world([kid('p-a', 204)]).transfer);
    const mine = world([kid('p-a', 204)]);
    const before = serializePlayer(mine.transfer.here().players[0]!);
    expect(await mine.transfer.apply(mine.transfer.plan(text), { 'p-a': 'file' })).toEqual({ ok: true, added: 0, replaced: 0, kept: 0, written: [], binLeft: [] });
    expect(serializePlayer(mine.transfer.here().players[0]!)).toBe(before);
    expect(copyOf(mine.mem, 'p-a')).toBeUndefined();
  });

  it('К12 clash без выбора — отказ, ничего не записано', async () => {
    // Ловит: загрузка идёт без ответа родителя и сама выбирает победителя.
    const file = world([kid('p-a', 204)]);
    const text = exported(file.transfer);
    const mine = world([kid('p-a', 89)]);
    const snap = mine.mem.snapshot();
    expect(await mine.transfer.apply(mine.transfer.plan(text), {})).toEqual({ ok: false, why: 'pick-missing' });
    expect(mine.mem.snapshot()).toEqual(snap);
  });

  it('К12 overLimit: в игре было бы больше 4 игроков — весь отказ, ни одного записанного байта', async () => {
    // Ловит: частичный импорт (063-Р11): первых игроков записали, остальных нет, ребёнок видит «половину клуба».
    const file = world([kid('p-1', 1), kid('p-2', 2), kid('p-3', 3)]);
    const text = exported(file.transfer);
    const mine = world([kid('p-4', 4), kid('p-5', 5)]);
    const snap = mine.mem.snapshot();
    const plan = mine.transfer.plan(text);
    expect(plan.kind === 'ok' && plan.overLimit).toBe(true);
    expect(await mine.transfer.apply(plan, {})).toEqual({ ok: false, why: 'over-limit' });
    expect(mine.mem.snapshot()).toEqual(snap);
  });

  it('К12 новый игрок из файла дописывается к тем, что есть; остальные не меняются', async () => {
    // Ловит: загрузка файла заменяет весь список игроков, а не только совпавших.
    const file = world([kid('p-b', 72)]);
    const text = exported(file.transfer);
    const mine = world([kid('p-a', 89)]);
    expect(await mine.transfer.apply(mine.transfer.plan(text), {})).toEqual({ ok: true, added: 1, replaced: 0, kept: 0, written: ['p-b'], binLeft: [] });
    expect(mine.transfer.here().device?.players.map((p) => p.pid)).toEqual(['p-a', 'p-b']);
  });

  it('К12 двойной клик на «Загрузить»: второй раз — те же игроки совпали, не задвоились', async () => {
    // Ловит: повторная загрузка того же файла добавляет игрока второй раз или падает.
    const file = world([kid('p-a', 204)]);
    const text = exported(file.transfer);
    const mine = world();
    expect((await mine.transfer.apply(mine.transfer.plan(text), {})).ok).toBe(true);
    const again = mine.transfer.plan(text);
    expect(again.kind === 'ok' && [again.add.length, again.clash.length]).toEqual([0, 1]);
    expect((await mine.transfer.apply(again, { 'p-a': 'file' })).ok).toBe(true);
    expect(mine.transfer.here().device?.players).toHaveLength(1);
  });
});

describe('К12: игрок из корзины возвращается файлом (063-Р64)', () => {
  it('К12 (063-Р64) файл с игроком, что лежит в корзине: игрок из файла, его конверт из корзины — в копии; игрок не висит и в списке, и в корзине', async () => {
    // Ловит: игрок вернулся из файла, а trash.<pid> остался — он висит и во вкладках, и в корзине (очистка корзины потом стёрла бы копию живого); старая версия из корзины пропала без копии.
    const file = world([kid('p3', 77)]);
    const text = exported(file.transfer);
    const local = world([kid('p1', 10), kid('p2', 20), kid('p3', 5)]);
    expect(await createBin({ store: local.store }).remove('p3', DAY)).toEqual({ ok: true });
    expect(local.store.peekTrash('p3').ok).toBe(true);
    const res = await local.transfer.apply(local.transfer.plan(text), {});
    expect(res).toMatchObject({ ok: true, added: 1, written: ['p3'] });
    expect(local.store.peekTrash('p3').ok).toBe(false);
    expect(createBin({ store: local.store }).list(DAY)).toEqual([]);
    const d = local.store.loadDevice();
    expect(d.kind === 'ok' && d.device.players.map((p) => p.pid)).toEqual(['p1', 'p2', 'p3']);
    expect(d.kind === 'ok' ? d.device.bin : 'нет').toBeUndefined();
    expect(summarize(local.transfer.here().players.find((e) => e.pid === 'p3')!).coins).toBe(77);
    expect(summarize(copyOf(local.mem, 'p3')!).coins).toBe(5);
    expect((res as { binLeft: string[] }).binLeft).toEqual([]);
  });

  it('К12 (063-Р64) копия не легла (квота): корзина не тронута — ключ trash.<pid> на месте, игрок из файла записан, pid — в binLeft', async () => {
    // Ловит: при отказе копии корзину стирали бы всё равно — старая версия игрока пропала бы без копии; отказ копии не доходил до результата.
    const file = world([kid('p3', 77)]);
    const text = exported(file.transfer);
    const local = world([kid('p1', 10), kid('p2', 20), kid('p3', 5)]);
    expect(await createBin({ store: local.store }).remove('p3', DAY)).toEqual({ ok: true });
    const before = local.mem.map.get(`${P}trash.p3`);
    expect(before).toBeDefined();
    const set = local.mem.setItem.bind(local.mem);
    local.mem.setItem = (k, v) => {
      if (k.startsWith(`${key('p3')}.c`)) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      set(k, v);
    };
    const res = await local.transfer.apply(local.transfer.plan(text), {});
    expect(res).toMatchObject({ ok: true, added: 1, written: ['p3'], binLeft: ['p3'] });
    expect(local.mem.map.get(`${P}trash.p3`)).toBe(before);
    expect(copyOf(local.mem, 'p3')).toBeUndefined();
    expect(summarize(local.transfer.here().players.find((e) => e.pid === 'p3')!).coins).toBe(77);
  });
});

describe('К12: здесь — и те игроки, кого не открыть (063-Р65)', () => {
  it('К12 (063-Р65) here(): битый, «новее» и игрок без файла — в stuck с признаком и именем, открытые — в players; устройство broken/newer — в state', () => {
    // Ловит: страница родителя пишет «нет игроков», хотя игрок есть, — here() молча отбрасывал битых и «новее».
    const w = world([kid('p-a', 10), kid('p-b', 20), kid('p-c', 30), kid('p-d', 40)]);
    w.mem.map.set(key('p-b'), '{не json');
    const env = JSON.parse(w.mem.map.get(key('p-c')) ?? '{}') as Record<string, unknown>;
    w.mem.map.set(key('p-c'), JSON.stringify({ ...env, fmt: 99 }));
    w.mem.map.delete(key('p-d'));
    const h = w.transfer.here();
    expect(h.state).toBe('ok');
    expect(h.players.map((p) => p.pid)).toEqual(['p-a']);
    expect(h.stuck).toEqual([
      { pid: 'p-b', kind: 'broken', name: null },
      { pid: 'p-c', kind: 'newer', name: 'Игрок p-c' },
      { pid: 'p-d', kind: 'broken', name: null },
    ]);
    const broken = world([kid('p-a', 10)]);
    broken.mem.map.set(`${P}device`, '{не json');
    expect(broken.transfer.here()).toMatchObject({ device: null, players: [], stuck: [], state: 'broken' });
    const newer = world([kid('p-a', 10)]);
    newer.mem.map.set(`${P}device`, JSON.stringify({ kind: 'keykick-device', fmt: 99, rev: 1, players: [] }));
    expect(newer.transfer.here().state).toBe('newer');
    expect(world().transfer.here()).toMatchObject({ players: [], stuck: [], state: 'absent' });
  });
});

describe('К12 (063-Р65): со страницы родителя — выход из тупика', () => {
  it('К12 (063-Р65) оборванное удаление: ключа нет, конверт в корзине — here() даёт binned с именем из корзины и без действий; ключа нет и корзины нет — по-прежнему broken', () => {
    // Ловит: оборванное удаление показано как поломка с «Начать заново» (потеря прогресса из корзины); имя из корзины теряется.
    const w = world([kid('p-a', 10), kid('p-b', 20), kid('p-c', 30)]);
    expect(w.store.trash('p-b')).toEqual({ ok: true });
    w.mem.map.delete(key('p-c'));
    const h = w.transfer.here();
    expect(h.stuck).toEqual([
      { pid: 'p-b', kind: 'binned', name: 'Игрок p-b' },
      { pid: 'p-c', kind: 'broken', name: null },
    ]);
    expect(stuckRows(h.stuck).map((r) => [r.pid, r.actions])).toEqual([['p-b', []], ['p-c', ['load', 'restart']]]);
  });

  it('К12 (063-Р65) битый игрок: here() даёт ему строку с «Начать заново», после bin.restart он среди открытых под тем же именем, строки больше нет, сырое — в карантине', async () => {
    // Ловит: «Начать заново» не доходит до страницы (here() всё ещё держит игрока в stuck) или теряет имя и карантин.
    const w = world([kid('p-a', 10), kid('p-b', 20)]);
    w.mem.map.set(key('p-b'), '{"name":"Миша","rev":4}');
    const rows = stuckRows(w.transfer.here().stuck);
    expect(rows.map((r) => [r.pid, r.name, r.actions])).toEqual([['p-b', 'Миша', ['load', 'restart']]]);
    expect(await createBin({ store: w.store }).restart('p-b', 'Игрок')).toEqual({ ok: true });
    const after = w.transfer.here();
    expect(after.stuck).toEqual([]);
    expect(after.players.map((p) => [p.pid, p.name])).toEqual([['p-a', 'Игрок p-a'], ['p-b', 'Миша']]);
    expect(w.store.quarantined('p-b')).toEqual(['{"name":"Миша","rev":4}']);
  });

  it('К12 (063-Р65) битое устройство: here() даёт строку «Новый клуб», после newClub устройство читается, прежний игрок — в корзине, старая запись — в карантине', async () => {
    // Ловит: на битом устройстве страница молчит «нет игроков» без выхода; «Новый клуб» стирает игроков, а не кладёт в корзину.
    const w = world([kid('p-a', 10)]);
    w.mem.map.set(`${P}device`, '{не json');
    expect(deviceRow(w.transfer.here().state)?.actions).toEqual(['load', 'newClub']);
    const bin = createBin({ store: w.store });
    expect(await bin.newClub(DAY)).toEqual({ ok: true });
    expect(w.transfer.here()).toMatchObject({ players: [], stuck: [], state: 'ok' });
    expect(bin.list(DAY).map((e) => e.pid)).toEqual(['p-a']);
    expect(w.store.quarantined('device')).toEqual(['{не json']);
  });
});

describe('К12: края файла и записи', () => {
  it('К12 мусор и чужой файл — bad, «новее» — newer; в хранилище ничего не пишется', async () => {
    // Ловит: нечитаемый файл портит хранилище или даёт запись.
    const mine = world([kid('p-a', 1)]);
    const snap = mine.mem.snapshot();
    for (const text of ['', '{', '[]', '{"kind":"другое"}']) {
      const plan = mine.transfer.plan(text);
      expect(plan.kind).toBe('bad');
      expect(await mine.transfer.apply(plan, {})).toEqual({ ok: false, why: 'not-ok' });
    }
    expect(mine.transfer.plan('{"kind":"keykick-club","snap":99}').kind).toBe('newer');
    expect(mine.mem.snapshot()).toEqual(snap);
  });

  it('К12 нет места: копия проигравшего не легла — стоп до записи игрока, игрок на диске прежний', async () => {
    // Ловит: при нехватке места победитель записан, а проигравшего нигде нет (потеря данных).
    const file = world([kid('p-a', 204)]);
    const text = exported(file.transfer);
    const mine = world([kid('p-a', 89)]);
    const before = serializePlayer(mine.transfer.here().players[0]!);
    const plan = mine.transfer.plan(text);
    mine.mem.capacity = [...mine.mem.map].reduce((n, [k, v]) => n + k.length + v.length, 0);
    const res = await mine.transfer.apply(plan, { 'p-a': 'file' });
    expect(res.ok).toBe(false);
    expect(serializePlayer(mine.transfer.here().players[0]!)).toBe(before);
  });

  it('К12 выгрузка: игрок «новее» — сырым, устройства нет — отказ', () => {
    // Ловит: выгрузка теряет игрока, записанного версией новее, или молча выдаёт пустой клуб без устройства.
    const a = world([kid('p-a', 1), kid('p-n', 2)]);
    const raw = JSON.parse(a.mem.map.get(key('p-n'))!) as Record<string, unknown>;
    raw.fmt = 99;
    a.mem.map.set(key('p-n'), JSON.stringify(raw));
    const reopened = createTransfer({ store: a.open(SECTIONS), defs: SECTIONS, app: '2.0.0' });
    const snap = JSON.parse(exported(reopened)) as { newer?: string[]; players: unknown[] };
    expect(snap.newer).toEqual(['p-n']);
    expect(snap.players).toHaveLength(2);
    expect(world().transfer.exportText(MADE, FROM)).toEqual({ ok: false, why: 'no-device' });
  });

  it('К12 выгрузка: битый игрок и ранее битое устройство — сырые строки в карантине файла (ключи pid и device)', () => {
    // Ловит: выгрузка не кладёт битое в поле quarantine — родитель и разработчик теряют сырое, а файл молчит о поломке.
    const a = world([kid('p-a', 1), kid('p-b', 2)]);
    const badDevice = '{"kind":"keykick-device","fmt":1,"rev":';
    const badPlayer = '{"kind":"keykick-player","pid":"p-b",';
    // Битое устройство: хранилище кладёт его в карантин при чтении; затем список возвращён, карантин остаётся.
    const good = a.mem.map.get(`${P}device`)!;
    a.mem.map.set(`${P}device`, badDevice);
    expect(a.open(SECTIONS).loadDevice()).toMatchObject({ kind: 'broken', quarantined: true });
    a.mem.map.set(`${P}device`, good);
    a.mem.map.set(key('p-b'), badPlayer);
    const out = createTransfer({ store: a.open(SECTIONS), defs: SECTIONS, app: '2.0.0' }).exportText(MADE, FROM);
    if (!out.ok) throw new Error('export');
    const snap = JSON.parse(out.text) as { players: { pid: string }[]; quarantine?: Record<string, string[]> };
    expect(snap.quarantine).toEqual({ device: [badDevice], 'p-b': [badPlayer] });
    expect(snap.players.map((p) => p.pid)).toEqual(['p-a']);
  });

  it('К12 отметка выгрузки: parent.exported = день, rev устройства растёт; устройства нет — не пишет', () => {
    // Ловит: напоминание родителю не гаснет после выгрузки (дата не пишется) или запись ломает rev устройства.
    const a = world([kid('p-a', 1)]);
    const rev = a.transfer.here().device!.rev;
    expect(a.transfer.markExported(DAY)).toBe(true);
    expect(a.transfer.here().device).toMatchObject({ rev: rev + 1, parent: { exported: DAY } });
    expect(world().transfer.markExported(DAY)).toBe(false);
  });
});

describe('К12: загрузка поверх сбоев и чужих состояний (063-Р53)', () => {
  it('К12 сбой записи устройства посреди загрузки: игрок уже на диске, в списке его нет — повтор успешен', async () => {
    // Ловит: новый игрок пишется с expectRev = null, а его файл уже лежит на диске (сбой посреди прошлой загрузки) — conflict навсегда.
    const text = exported(world([kid('p-a', 204), kid('p-b', 7)]).transfer);
    const mine = world();
    const fail = failDeviceWrites(mine.mem);
    const first = await mine.transfer.apply(mine.transfer.plan(text), {});
    expect(first).toEqual({ ok: false, why: 'quota', written: ['p-a', 'p-b'] }); // written: игроки уже записаны — сеанс обязан перечитаться
    expect(mine.mem.map.has(key('p-a'))).toBe(true);
    expect(mine.mem.map.has(`${P}device`)).toBe(false);
    fail.on = false;
    expect(await mine.transfer.apply(mine.transfer.plan(text), {})).toEqual({ ok: true, added: 2, replaced: 0, kept: 0, written: [], binLeft: [] });
    expect(mine.transfer.here().device?.players.map((p) => p.pid)).toEqual(['p-a', 'p-b']);
    expect(summarize(mine.transfer.here().players[0]!).coins).toBe(204);
    expect(copyOf(mine.mem, 'p-a')).toBeUndefined(); // равный файлу не пишется и не копируется
  });

  it('К12 битое устройство при целых игроках: игроки на диске — «из файла», прежние в копиях, список записан поверх, битое — в карантине', async () => {
    // Ловит: загрузка при битой записи устройства даёт conflict на каждом игроке (они «новые» с expectRev = null) или теряет тех, что лежат на диске.
    const text = exported(world([kid('p-a', 204), kid('p-b', 7)]).transfer);
    const mine = world([kid('p-a', 89), kid('p-b', 7)]);
    const before = mine.transfer.here().players[0]!;
    const badDevice = '{"kind":"keykick-device",';
    mine.mem.map.set(`${P}device`, badDevice);
    const plan = mine.transfer.plan(text);
    expect(plan.kind === 'ok' && [plan.add.length, plan.clash.length]).toEqual([2, 0]);
    expect(await mine.transfer.apply(plan, {})).toEqual({ ok: true, added: 2, replaced: 0, kept: 0, written: ['p-a'], binLeft: [] });
    expect(summarize(mine.transfer.here().players[0]!).coins).toBe(204);
    expect(copyOf(mine.mem, 'p-a')).toEqual(before);
    expect(mine.transfer.here().device?.players.map((p) => p.pid)).toEqual(['p-a', 'p-b']);
    expect(mine.store.quarantined('device')).toEqual([badDevice]);
  });

  it('К12 игрок новее программы лежит на диске без записи в списке — отказ readonly до первой записи', async () => {
    // Ловит: сироту «новее» затирают файлом (потеря сыгранного версией новее) или отказ приходит после записи других игроков.
    const text = exported(world([kid('p-a', 1), kid('p-b', 2)]).transfer);
    const mine = world();
    const raw = JSON.parse(serializePlayer(kid('p-b', 9))) as Record<string, unknown>;
    raw.fmt = 99;
    mine.mem.map.set(key('p-b'), JSON.stringify(raw));
    const snap = mine.mem.snapshot();
    expect(await mine.transfer.apply(mine.transfer.plan(text), {})).toEqual({ ok: false, why: 'readonly' });
    expect(mine.mem.snapshot()).toEqual(snap);
  });

  it('К12 устройство новее программы или без доступа — отказ readonly/denied до первой записи, а не «пусто»', async () => {
    // Ловит: загрузка видит нечитаемое устройство как пустое, пишет игроков и только потом упирается в запись списка.
    const text = exported(world([kid('p-a', 1)]).transfer);
    const newer = world();
    const plan = newer.transfer.plan(text);
    newer.mem.map.set(`${P}device`, '{"kind":"keykick-device","fmt":99,"rev":1}');
    expect(await newer.transfer.apply(plan, {})).toEqual({ ok: false, why: 'readonly' });
    expect(newer.mem.map.has(key('p-a'))).toBe(false);
    const closed = world();
    const planClosed = closed.transfer.plan(text);
    closed.mem.failRead = true;
    expect(await closed.transfer.apply(planClosed, {})).toEqual({ ok: false, why: 'denied' });
    closed.mem.failRead = false;
    expect(closed.mem.map.has(key('p-a'))).toBe(false);
  });

  it('К12 совпавший игрок «битый на диске» (mine: null): сырое в карантине, поверх — игрок из файла; «оставить» — только копия', async () => {
    // Ловит: загрузка файла не может восстановить битого игрока (версия из файла уходит в копию, а игрок остаётся битым — тупик «взять из файла»).
    const text = exported(world([kid('p-a', 204)]).transfer);
    const brokenRaw = '{"kind":"keykick-player","pid":"p-a",';
    const mine = world([kid('p-a', 89)]);
    mine.mem.map.set(key('p-a'), brokenRaw);
    const keep = await mine.transfer.apply(mine.transfer.plan(text), { 'p-a': 'mine' });
    expect(keep).toEqual({ ok: true, added: 0, replaced: 0, kept: 1, written: [], binLeft: [] });
    expect(mine.mem.map.get(key('p-a'))).toBe(brokenRaw);
    expect(summarize(copyOf(mine.mem, 'p-a')!).coins).toBe(204);
    const plan = mine.transfer.plan(text);
    expect(plan.kind === 'ok' && plan.clash.map((c) => [c.pid, c.mine])).toEqual([['p-a', null]]);
    expect(await mine.transfer.apply(plan, {})).toEqual({ ok: true, added: 0, replaced: 1, kept: 0, written: ['p-a'], binLeft: [] });
    expect(summarize(mine.transfer.here().players[0]!).coins).toBe(204);
    expect(mine.store.quarantined('p-a')).toEqual([brokenRaw]);
  });

  it('К12 совпавший игрок «новее» на диске: версия из файла — в копию, игрок на диске не тронут при любом выборе', async () => {
    // Ловит: нечитаемого версией новее игрока затирают файлом без возможности вернуть.
    const text = exported(world([kid('p-a', 204)]).transfer);
    const mine = world([kid('p-a', 89)]);
    const raw = JSON.parse(mine.mem.map.get(key('p-a'))!) as Record<string, unknown>;
    raw.fmt = 99;
    const newerRaw = JSON.stringify(raw);
    mine.mem.map.set(key('p-a'), newerRaw);
    expect(await mine.transfer.apply(mine.transfer.plan(text), { 'p-a': 'file' })).toEqual({ ok: true, added: 0, replaced: 0, kept: 1, written: [], binLeft: [] });
    expect(mine.mem.map.get(key('p-a'))).toBe(newerRaw);
    expect(summarize(copyOf(mine.mem, 'p-a')!).coins).toBe(204);
  });

  it('К12 игрока держит другая вкладка — отказ busy с именем, ничего не записано; отпустила — записывается', async () => {
    // Ловит: загрузка файла затирает игрока, пока ребёнок играет в другой вкладке (его запись потом упрётся в conflict, а сыгранное пропадёт).
    const locks = fakeLocks();
    const text = exported(world([kid('p-a', 204)]).transfer);
    const mine = world([kid('p-a', 89)], locks);
    const other = mine.open(SECTIONS);
    const held = await other.hold('p-a');
    expect(held.kind).toBe('held');
    const snap = mine.mem.snapshot();
    expect(await mine.transfer.apply(mine.transfer.plan(text), { 'p-a': 'file' })).toEqual({ ok: false, why: 'busy', name: 'Игрок p-a' });
    expect(mine.mem.snapshot()).toEqual(snap);
    if (held.kind === 'held') held.release();
    await Promise.resolve();
    expect((await mine.transfer.apply(mine.transfer.plan(text), { 'p-a': 'file' })).ok).toBe(true);
    expect(summarize(mine.transfer.here().players[0]!).coins).toBe(204);
  });

  it('К12 игрок этой же вкладки (замок уже наш, own) — не «занят самой собой»; замки после записи отпущены', async () => {
    // Ловит: вкладка берёт замок своего же игрока второй раз и сама себе отвечает busy; либо замки записанных игроков остаются висеть.
    const locks = fakeLocks();
    const text = exported(world([kid('p-a', 204), kid('p-b', 1)]).transfer);
    const mine = world([kid('p-a', 89)], locks);
    const own = await mine.store.hold('p-a');
    const tab = createTransfer({ store: mine.store, defs: SECTIONS, app: '2.0.0', own: (pid) => pid === 'p-a' });
    expect((await tab.apply(tab.plan(text), { 'p-a': 'file' })).ok).toBe(true);
    const free = await mine.open(SECTIONS).hold('p-b');
    expect(free.kind).toBe('held'); // новый игрок p-b записан и отпущен
    if (free.kind === 'held') free.release();
    if (own.kind === 'held') own.release();
  });
});

describe('К12: гонки и карантин, который не лёг (063-Р53 п. 2–3)', () => {
  /** Квота на ключи карантина: сырое битого положить некуда. */
  function failQuarantine(mem: MemStorage): void {
    const set = mem.setItem.bind(mem);
    mem.setItem = (k, v) => {
      if (k.includes('quarantine.')) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      set(k, v);
    };
  }

  it('К12 битый игрок загружен, а на диске сырое уже другое — savePlayer(null) даёт conflict, диск не тронут', () => {
    // Ловит: запись поверх битого не сверяет сырое на диске с тем, что лежит в карантине, — затирает то, что туда успела записать другая вкладка.
    const mine = world([kid('p-a', 1)]);
    mine.mem.map.set(key('p-a'), '{"kind":"keykick-player",');
    expect(mine.store.loadPlayer('p-a')).toMatchObject({ kind: 'broken', quarantined: true });
    const other = serializePlayer(kid('p-a', 55));
    mine.mem.map.set(key('p-a'), other);
    expect(mine.store.savePlayer('p-a', kid('p-a', 204), null)).toEqual({ ok: false, err: 'conflict' });
    expect(mine.mem.map.get(key('p-a'))).toBe(other);
  });

  it('К12 карантин игрока не лёг: совпавший битый — отказ quota, ничего не записано', async () => {
    // Ловит: битого игрока затирают файлом, хотя его сырое нигде не сохранено (потеря без возврата).
    const text = exported(world([kid('p-a', 204)]).transfer);
    const mine = world([kid('p-a', 89)]);
    mine.mem.map.set(key('p-a'), '{"kind":"keykick-player",');
    failQuarantine(mine.mem);
    const plan = mine.transfer.plan(text);
    const snap = mine.mem.snapshot();
    expect(await mine.transfer.apply(plan, {})).toEqual({ ok: false, why: 'quota' });
    expect(mine.mem.snapshot()).toEqual(snap);
  });

  it('К12 карантин устройства не лёг: битое устройство — отказ quota до первой записи, игроков на диске нет', async () => {
    // Ловит: список устройства затирают файлом, хотя битое сырое нигде не сохранено; либо игроки пишутся, а список — нет.
    const text = exported(world([kid('p-b', 7)]).transfer);
    const mine = world();
    mine.mem.map.set(`${P}device`, '{"kind":"keykick-device",');
    failQuarantine(mine.mem);
    const plan = mine.transfer.plan(text);
    const snap = mine.mem.snapshot();
    expect(await mine.transfer.apply(plan, {})).toEqual({ ok: false, why: 'quota' });
    expect(mine.mem.snapshot()).toEqual(snap);
    expect(mine.mem.map.has(key('p-b'))).toBe(false);
  });

  it('К12 устаревший план: другая вкладка дописала того же игрока, но другим — apply заменяет его файлом: replaced 1, written [pid], added 0', async () => {
    // Ловит: игрок уже в списке, но отличается от файла, а apply считает его «добавленным» или вовсе не пишет — родитель видит не тот итог, диск остаётся прежним.
    const text = exported(world([kid('p-a', 204)]).transfer);
    const mine = world();
    const stale = mine.transfer.plan(text);
    fill(mine.store, [kid('p-a', 89)]);
    expect(await mine.transfer.apply(stale, {})).toEqual({ ok: true, added: 0, replaced: 1, kept: 0, written: ['p-a'], binLeft: [] });
    expect(summarize(mine.transfer.here().players[0]!).coins).toBe(204);
    expect(summarize(copyOf(mine.mem, 'p-a')!).coins).toBe(89);
  });

  it('К12 устаревший план: другая вкладка уже дописала игроков — повтор apply даёт ok, а не invalid [rev]', async () => {
    // Ловит: устройство пишется с тем же rev, когда список не изменился, — «Позови взрослого» на каждом повторе второй вкладки.
    const text = exported(world([kid('p-a', 204)]).transfer);
    const mine = world();
    const stale = mine.transfer.plan(text);
    expect((await mine.transfer.apply(stale, {})).ok).toBe(true);
    const rev = mine.transfer.here().device!.rev;
    expect(await mine.transfer.apply(stale, {})).toEqual({ ok: true, added: 0, replaced: 0, kept: 0, written: [], binLeft: [] });
    expect(mine.transfer.here().device!.rev).toBe(rev);
  });
});
