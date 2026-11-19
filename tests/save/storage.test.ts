/**
 * Адаптеры хранилища (060 Т6, design §3): отказы результатом (К18), device, запись игрока, две вкладки (К19).
 * Карантин, копии, переполнение (К20), корзина — tests/save/storageCopies.test.ts. Хранилище и замки подменены в памяти. У каждого теста строка «Ловит:» — какую поломку он видит.
 */
import { describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { serializePlayer, writePlayer } from '../../src/engine/save/envelope';
import { planImport } from '../../src/engine/save/import';
import { makeSnapshot, serializeSnapshot } from '../../src/engine/save/snapshot';
import type { SectionDef } from '../../src/engine/save/section';
import { holdLock, type LocksApi } from '../../src/app/save/locks';
import { SECTIONS } from '../../src/app/save/sections';
import { createKeyValue } from '../../src/app/save/storage';
import { DEVICE_KIND, createStore, newDevice } from '../../src/app/save/store';
import {
  MemStorage,
  P,
  clubDef,
  defs,
  fakeLocks,
  foreignIntact,
  key,
  player,
  seed,
  setup,
  stored,
} from '../fixtures/storageKit';

// --- Адаптер storage.ts (К18) ----------------------------------------------------------------------------------

describe('storage: отказы — результатом, не исключением (К18, 059 С-19)', () => {
  it('чтение: есть, нет, запрещено', () => {
    // Ловит: пустой ключ путают с отказом (первый запуск показывает «ошибку») или getItem наружу бросает.
    const mem = new MemStorage();
    mem.map.set('a', '1');
    const kv = createKeyValue(mem);
    expect(kv.read('a')).toEqual({ ok: true, value: '1' });
    expect(kv.read('b')).toEqual({ ok: false, err: 'absent' });
    mem.failRead = true;
    expect(kv.read('a')).toEqual({ ok: false, err: 'denied' });
  });

  it('запись: квота — quota (все имена браузеров), прочее — denied', () => {
    // Ловит: Safari с кодом 22 или Firefox с NS_ERROR_DOM_QUOTA_REACHED принят за «запрещено», и переполнение не лечится.
    const mem = new MemStorage();
    const kv = createKeyValue(mem);
    mem.failWrite = 'QuotaExceededError';
    expect(kv.write('a', '1')).toEqual({ ok: false, err: 'quota' });
    mem.failWrite = 'NS_ERROR_DOM_QUOTA_REACHED';
    expect(kv.write('a', '1')).toEqual({ ok: false, err: 'quota' });
    const byCode = new MemStorage();
    byCode.setItem = () => {
      throw Object.assign(new Error('x'), { code: 22 });
    };
    expect(createKeyValue(byCode).write('a', '1')).toEqual({
      ok: false,
      err: 'quota',
    });
    mem.failWrite = 'SecurityError';
    expect(kv.write('a', '1')).toEqual({ ok: false, err: 'denied' });
    expect(mem.map.size).toBe(0);
  });

  it('хранилища нет (undefined) — всё denied, ничего не бросает', () => {
    // Ловит: режим без хранилища (обращение к localStorage бросает) роняет приложение на первом чтении.
    const kv = createKeyValue(undefined);
    const denied = { ok: false, err: 'denied' };
    expect([kv.read('a'), kv.write('a', '1'), kv.remove('a'), kv.keys('')]).toEqual([denied, denied, denied, denied]);
  });

  it('keys(prefix) отдаёт только ключи с префиксом; remove отсутствующего — успех', () => {
    // Ловит: перебор по префиксу захватывает чужие ключи — их потом удалит «очистка».
    const mem = new MemStorage();
    for (const k of ['keykick2.a', 'keykick2.b', 'keykick2-next.a', 'keykick.a', 'zzz']) mem.map.set(k, '');
    const kv = createKeyValue(mem);
    expect(kv.keys('keykick2.')).toEqual({
      ok: true,
      value: ['keykick2.a', 'keykick2.b'],
    });
    expect(kv.remove('нет такого')).toEqual({ ok: true });
  });

  it('store при отказе хранилища ничего не бросает', () => {
    // Ловит: исключение из getItem/setItem пролетает через store в экран.
    const mem = new MemStorage();
    mem.failRead = true;
    mem.failWrite = 'SecurityError';
    const store = createStore({ prefix: P, local: createKeyValue(mem), defs });
    expect(store.loadDevice()).toEqual({ kind: 'denied' });
    expect(store.loadPlayer('p1')).toEqual({ kind: 'denied' });
    expect(store.savePlayer('p1', player(), null)).toEqual({
      ok: false,
      err: 'denied',
    });
    expect(store.saveDevice(newDevice(), null)).toEqual({
      ok: false,
      err: 'denied',
    });
    expect(store.trash('p1')).toEqual({ ok: false, err: 'denied' });
    expect(store.emptyTrash()).toEqual({ ok: true, value: 0 });
    const none = createStore({
      prefix: P,
      local: createKeyValue(undefined),
      defs,
    });
    expect(none.loadDevice()).toEqual({ kind: 'denied' });
    expect(none.savePlayer('p1', player(), null)).toEqual({
      ok: false,
      err: 'denied',
    });
    expect(none.emptyTrash()).toEqual({ ok: false, err: 'denied' });
    expect(none.tabPid()).toBeUndefined();
    expect(none.setTabPid('p1')).toEqual({ ok: false, err: 'denied' });
  });
});

// --- Пустое хранилище и устройство -----------------------------------------------------------------------------

describe('корзина: откат при отказе удаления ключа (063-Р31)', () => {
  /** Ключ не удаляется (как отказ доступа на запись), остальное работает. */
  function stuckKey(mem: { removeItem(k: string): void }, bad: string): void {
    const rm = mem.removeItem.bind(mem);
    mem.removeItem = (k) => {
      if (k === bad) throw Object.assign(new Error('fail'), { name: 'SecurityError' });
      rm(k);
    };
  }

  it('К18 trash: ключ игрока не удалился — denied, ключа trash.<pid> нет, игрок на месте', () => {
    // Ловит: при отказе удаления файла игрок оказывается и в корзине, и в списке (дубль), а откат корзины не сделан.
    const { store, mem } = setup();
    expect(store.savePlayer('p1', player('p1', 3), null)).toEqual({ ok: true });
    const raw = stored(mem);
    stuckKey(mem, key('p1'));
    expect(store.trash('p1')).toEqual({ ok: false, err: 'denied' });
    expect(mem.map.has(`${P}trash.p1`)).toBe(false);
    expect(stored(mem)).toBe(raw);
  });

  it('К18 restore: ключ корзины не удалился — denied, только что записанный ключ игрока убран, конверт в корзине цел', () => {
    // Ловит: возврат «успешен», а игрок и в корзине, и в списке; после отказа остаётся записанный файл игрока.
    const { store, mem } = setup();
    expect(store.savePlayer('p1', player('p1', 3), null)).toEqual({ ok: true });
    expect(store.trash('p1')).toEqual({ ok: true });
    const kept = mem.map.get(`${P}trash.p1`);
    stuckKey(mem, `${P}trash.p1`);
    expect(store.restore('p1')).toEqual({ ok: false, err: 'denied' });
    expect(mem.map.has(key('p1'))).toBe(false);
    expect(mem.map.get(`${P}trash.p1`)).toBe(kept);
  });
});

describe('пустое хранилище и устройство', () => {
  it('нет device и игрока — absent; ключи v1, next и чужие не читаются', () => {
    // Ловит: store читает `keykick.*` или `keykick-next.*` как своё — сохранение v1 принимается за v2.
    const { store } = setup();
    expect(store.loadDevice()).toEqual({ kind: 'absent' });
    expect(store.loadPlayer('p1')).toEqual({ kind: 'absent' });
    expect(store.trashed()).toEqual({ ok: true, value: [] });
  });

  it('device: записать — прочитать; rev на диске другой — conflict', () => {
    // Ловит: список игроков затирается второй вкладкой без сверки rev.
    const { store, mem } = setup();
    const d = newDevice();
    expect(store.saveDevice(d, null)).toEqual({ ok: true });
    expect(store.saveDevice(d, null)).toEqual({ ok: false, err: 'conflict' });
    expect(store.loadDevice()).toEqual({ kind: 'ok', device: d });
    const next = { ...d, rev: 1, players: [{ pid: 'p1', order: 0 }] };
    expect(store.saveDevice(next, 0)).toEqual({ ok: true });
    expect(store.saveDevice({ ...d, rev: 1 }, 0)).toEqual({
      ok: false,
      err: 'conflict',
    });
    expect(JSON.parse(mem.map.get(`${P}device`) ?? '{}')).toMatchObject({
      rev: 1,
      players: [{ pid: 'p1' }],
    });
    foreignIntact(mem);
  });

  it('device: мусор — broken, формат новее — newer и только чтение; сырое цело', () => {
    // Ловит: битый или более новый device перезаписывается пустым — дети теряют список игроков.
    const { store, mem } = setup();
    mem.map.set(`${P}device`, '{не json');
    expect(store.loadDevice()).toEqual({
      kind: 'broken',
      raw: '{не json',
      quarantined: true,
    });
    const newer = JSON.stringify({ ...newDevice(), fmt: 2 });
    mem.map.set(`${P}device`, newer);
    expect(store.loadDevice()).toEqual({ kind: 'newer', raw: newer });
    expect(store.saveDevice(newDevice(), 0)).toEqual({
      ok: false,
      err: 'readonly',
    });
    expect(mem.map.get(`${P}device`)).toBe(newer);
    mem.map.set(`${P}device`, JSON.stringify({ ...newDevice(), players: [{ pid: '', order: 0 }] }));
    expect(store.loadDevice().kind).toBe('broken');
    expect(DEVICE_KIND).toBe('keykick-device');
    // «Новее» — только чтение: карантина нет, сырое и так цело.
    mem.map.set(`${P}device`, newer);
    store.loadDevice();
    expect([...mem.map.keys()].some((k) => k.startsWith(`${P}quarantine.device`) && mem.map.get(k) === newer)).toBe(
      false,
    );
  });

  it('device: битый — в карантин (≤ 3), поверх него новый пишется — выход из тупика', () => {
    // Ловит: битый device навсегда запирает список игроков (запись даёт conflict), или перезапись теряет сырое.
    const { store, mem } = setup();
    const q = (n: number) => mem.map.get(`${P}quarantine.device.${n}`);
    for (const raw of ['{не json', '{не json', 'мусор 2', 'мусор 3', 'мусор 4']) {
      mem.map.set(`${P}device`, raw);
      expect(store.loadDevice()).toEqual({
        kind: 'broken',
        raw,
        quarantined: true,
      });
    }
    expect([q(1), q(2), q(3), q(4)]).toEqual(['мусор 4', 'мусор 3', 'мусор 2', undefined]);
    expect(store.saveDevice(newDevice(), null)).toEqual({ ok: true });
    expect(store.loadDevice()).toEqual({ kind: 'ok', device: newDevice() });
    expect(q(1)).toBe('мусор 4');
    expect(store.saveDevice(newDevice(), null)).toEqual({
      ok: false,
      err: 'conflict',
    });
    foreignIntact(mem);
  });

  it('device: карантин не записался или на диске уже другое — поверх битого не пишем', () => {
    // Ловит: «выход из тупика» стирает сырое, которого нет в карантине, или затирает device, починенный другой вкладкой.
    const { store, mem } = setup();
    mem.map.set(`${P}device`, 'мусор');
    mem.capacity = [...mem.map].reduce((s, [k, v]) => s + k.length + v.length, 0);
    expect(store.loadDevice()).toEqual({
      kind: 'broken',
      raw: 'мусор',
      quarantined: false,
    });
    expect(store.saveDevice(newDevice(), null)).toEqual({
      ok: false,
      err: 'conflict',
    });
    expect(mem.map.get(`${P}device`)).toBe('мусор');
    mem.capacity = Infinity;
    store.loadDevice();
    const repaired = JSON.stringify({ ...newDevice(), rev: 4 });
    mem.map.set(`${P}device`, repaired); // другая вкладка починила
    expect(store.saveDevice(newDevice(), null)).toEqual({
      ok: false,
      err: 'conflict',
    });
    expect(mem.map.get(`${P}device`)).toBe(repaired);
  });

  it('device: saveDevice проверяет устройство — invalid, на диск ничего не идёт', () => {
    // Ловит: ошибка вызывающего (пустой pid, чужой kind, цикл) пишет в device то, что при следующем запуске «битое».
    const { store, mem } = setup();
    const d = newDevice();
    const cyclic: Record<string, unknown> = { pid: 'a', order: 0 };
    cyclic.self = cyclic;
    const bad = [
      { ...d, players: [{ pid: '', order: 0 }] },
      { ...d, rev: -1 },
      { ...d, uiLang: 5 },
      { ...d, sound: null },
      { ...d, kind: 'другое' },
      { ...d, fmt: 2 },
      { ...d, players: [cyclic] },
    ];
    for (const device of bad) {
      expect(store.saveDevice(device as unknown as typeof d, null)).toEqual({
        ok: false,
        err: 'invalid',
        why: ['device'],
      });
    }
    expect(mem.map.has(`${P}device`)).toBe(false);
  });

  it('pid «device» занят карантином устройства — игроком быть не может', () => {
    // Ловит: игрок с pid «device» делит ключи карантина и корзины с самим устройством.
    const { store, mem } = setup();
    expect(store.savePlayer('device', player('device'), null)).toEqual({
      ok: false,
      err: 'denied',
    });
    expect(store.loadPlayer('device')).toEqual({ kind: 'absent' });
    expect(mem.map.has(`${P}player.device`)).toBe(false);
  });

  it('pid вкладки живёт в sessionStorage, не в постоянном', () => {
    // Ловит: pid вкладки попадает в localStorage — вторая вкладка открывается тем же игроком.
    const { store, mem, session } = setup();
    expect(store.tabPid()).toBeUndefined();
    expect(store.setTabPid('p1')).toEqual({ ok: true });
    expect(store.tabPid()).toBe('p1');
    expect(session.map.get(`${P}tab`)).toBe('p1');
    expect(mem.map.has(`${P}tab`)).toBe(false);
  });
});

// --- Игрок: запись и чтение ------------------------------------------------------------------------------------

describe('игрок: запись, чтение, rev', () => {
  it('создание, запись, чтение — тот же конверт; запись одним ключом', () => {
    // Ловит: игрок разложен по нескольким ключам — перезагрузка посреди записи оставляет половину.
    const { store, mem } = setup();
    const env = seed(store);
    const loaded = store.loadPlayer('p1');
    expect(loaded).toEqual({ kind: 'ok', env, changed: false, backup: true });
    const next = writePlayer(env, { club: { stars: 3 } });
    expect(store.savePlayer('p1', next, 0)).toEqual({ ok: true });
    expect(stored(mem)).toBe(serializePlayer(next));
    expect([...mem.map.keys()].filter((k) => k.startsWith(P))).toEqual([key()]);
    foreignIntact(mem);
  });

  it('чтение без миграции ничего не пишет', () => {
    // Ловит: загрузка меняет хранилище (лишний rev, копия) — две вкладки спорят уже на открытии.
    const { store, mem } = setup();
    seed(store);
    const before = mem.snapshot();
    store.loadPlayer('p1');
    expect(mem.snapshot()).toEqual(before);
  });

  it('перезагрузка посреди записи: сорванный setItem оставляет прежний конверт целым', () => {
    // Ловит: запись идёт «стереть и записать» — сбой между шагами теряет игрока.
    const { store, mem } = setup();
    const env = seed(store);
    const before = stored(mem);
    mem.failWrite = 'UnknownError';
    expect(store.savePlayer('p1', writePlayer(env, { club: { stars: 9 } }), 0)).toEqual({ ok: false, err: 'denied' });
    mem.failWrite = undefined;
    expect(stored(mem)).toBe(before);
    expect(store.loadPlayer('p1')).toMatchObject({ kind: 'ok', env });
  });

  it('разделы не прошли check — invalid, на диск не пишется', () => {
    // Ловит: ошибка подсистемы записывает битое, и при следующем запуске игрок «битый» (долг ревью Т5а).
    const { store, mem } = setup();
    const env = seed(store);
    const before = stored(mem);
    const bad = writePlayer(env, { club: { stars: 'много' } });
    expect(store.savePlayer('p1', bad, 0)).toEqual({
      ok: false,
      err: 'invalid',
      why: ['section:club:stars'],
    });
    const throwing: SectionDef<unknown> = {
      ...clubDef,
      check: () => {
        throw new Error('boom');
      },
    };
    expect(setup().open([throwing]).savePlayer('p1', env, null)).toEqual({
      ok: false,
      err: 'invalid',
      why: ['section:club:check-failed'],
    });
    expect(store.savePlayer('p1', { ...env, rev: 1, sections: {} }, 0)).toEqual({
      ok: false,
      err: 'invalid',
      why: ['section:club:missing'],
    });
    expect(stored(mem)).toBe(before);
  });

  it('rev не вырос — invalid; чужой конверт под этим pid — исключение программиста', () => {
    // Ловит: запись «того же rev» неотличима для второй вкладки; игрок p2 пишется в ключ p1.
    const { store, mem } = setup();
    const env = seed(store);
    expect(store.savePlayer('p1', env, 0)).toEqual({
      ok: false,
      err: 'invalid',
      why: ['rev'],
    });
    expect(() => store.savePlayer('p1', player('p2'), null)).toThrow(/p2/);
    expect(store.savePlayer('a.b', { ...env, pid: 'a.b' }, null)).toEqual({
      ok: false,
      err: 'denied',
    });
    expect(mem.map.has(`${P}player.a.b`)).toBe(false);
  });

  it('конверт не сериализуется (BigInt в разделе) — invalid, не исключение; на диске прежнее', () => {
    // Ловит: ошибка подсистемы с необычным значением роняет запись исключением в экран, а не отказом.
    const { store, mem } = setup();
    const env = seed(store);
    const before = stored(mem);
    const odd = writePlayer(env, { club: { stars: 1, junk: 10n } });
    expect(store.savePlayer('p1', odd, 0)).toEqual({
      ok: false,
      err: 'invalid',
      why: ['serialize'],
    });
    expect(stored(mem)).toBe(before);
  });

  it('реактивные объекты Vue (конверт, раздел, устройство): запись ok, на диске — сырое, круг снимка и импорта тот же (062-Т4)', () => {
    // Ловит: Proxy Vue ломает сериализацию, проверки или круг «хранилище → снимок → импорт»: на диске не то, что у сырого объекта.
    const { store, mem } = setup();
    const plain = writePlayer(player(), { club: { stars: 5 } });
    const proxied = reactive(writePlayer(player(), { club: reactive({ stars: 5 }) }));
    expect(store.savePlayer('p1', proxied, null)).toEqual({ ok: true });
    expect(stored(mem)).toBe(serializePlayer(plain));
    const loaded = store.loadPlayer('p1');
    expect(loaded).toMatchObject({ kind: 'ok' });
    const dev = reactive({ ...newDevice(), players: [{ pid: 'p1', order: 0 }] });
    expect(store.saveDevice(dev, null)).toEqual({ ok: true });
    expect(mem.map.get(`${P}device`)).toBe(JSON.stringify({ ...newDevice(), players: [{ pid: 'p1', order: 0 }] }));
    const text = serializeSnapshot(makeSnapshot(dev, [reactive(plain)], { app: 'x', made: 'm', from: 'f' }));
    const plan = planImport(text, { device: { players: [] }, players: [] }, defs, {});
    expect(plan.kind).toBe('ok');
    if (plan.kind !== 'ok') return;
    expect(plan.add).toHaveLength(1);
    expect(serializePlayer(plan.add[0]!)).toBe(stored(mem));
  });

  it('конверт с другим pid под ключом игрока — broken (why pid), сырое в карантине, запись readonly, не исключение', () => {
    // Ловит: конверт p9 под player.p1 грузится ok, а первая запись бросает исключение (savePlayer: «чужой конверт»).
    const { store, mem } = setup();
    const raw = serializePlayer(player('p9'));
    mem.map.set(key('p1'), raw);
    const res = store.loadPlayer('p1');
    expect(res).toEqual({ kind: 'broken', raw, why: ['pid'], quarantined: true });
    expect(mem.map.get(`${P}quarantine.p1.1`)).toBe(raw);
    expect(stored(mem)).toBe(raw);
    expect(() => store.savePlayer('p1', player('p1'), 0)).not.toThrow();
    expect(store.savePlayer('p1', player('p1'), 0)).toEqual({ ok: false, err: 'readonly' });
    expect(stored(mem)).toBe(raw);
    foreignIntact(mem);
  });

  it('потолок формата свой у ключа: устройство fmt 2 при DEVICE_FMT 2 пишется, а не «новее» по ENVELOPE_FMT', async () => {
    // Ловит: readDisk сравнивает fmt устройства с ENVELOPE_FMT — после повышения только DEVICE_FMT запись устройства вечно readonly.
    vi.resetModules();
    vi.doMock('../../src/engine/save/device', async (orig) => ({ ...(await orig<object>()), DEVICE_FMT: 2 }));
    try {
      const fresh = await import('../../src/app/save/store');
      const mem = new MemStorage();
      const store = fresh.createStore({ prefix: P, local: createKeyValue(mem), defs });
      const d0 = fresh.newDevice();
      expect(d0.fmt).toBe(2);
      expect(store.saveDevice(d0, null)).toEqual({ ok: true });
      expect(store.saveDevice({ ...d0, rev: 1 }, 0)).toEqual({ ok: true });
      expect(JSON.parse(mem.map.get(`${P}device`) ?? '{}')).toMatchObject({ fmt: 2, rev: 1 });
    } finally {
      vi.doUnmock('../../src/engine/save/device');
      vi.resetModules();
    }
  });

  it('реестр сборки — ровно разделы этапа Э1 (club, course:ru, seen) и волны 2 (wallet, day, school, form, stadium), без тестовых', () => {
    // Ловит: в реестр случайно попал тестовый раздел — он окажется в сохранениях детей; раздел этапа пропал или переименован.
    // До этапа Э1 реестр был пуст (060-Р21); разделы зарегистрировала 063 Т5 — ожидание сменилось вместе с поведением; волна 2 (065-Т2, Р23) дописала wallet, day, school, form; волна 4 (067 Т1) — path, album, shop, learn, base; 067 Т24 — coach.
    expect(SECTIONS.map((d) => d.name)).toEqual(['club', 'course:ru', 'seen', 'wallet', 'day', 'school', 'form', 'stadium', 'path', 'album', 'shop', 'learn', 'base', 'coach']);
  });
});

// --- Две вкладки (К19) -----------------------------------------------------------------------------------------

describe('две вкладки (К19, 059 С-18)', () => {
  it('замок: вторая вкладка busy и писать не может, после release — может', async () => {
    // Ловит: две вкладки пишут одного игрока: последняя затирает первую.
    const locks = fakeLocks();
    const { open, mem } = setup({ locks });
    const a = open();
    const b = open();
    const env = seed(a);
    const heldA = await a.hold('p1');
    expect(heldA.kind).toBe('held');
    expect((await b.hold('p1')).kind).toBe('busy');
    const before = stored(mem);
    // Загрузка той же вкладкой замка не снимает: запись по-прежнему закрыта.
    expect(b.loadPlayer('p1').kind).toBe('ok');
    expect(b.savePlayer('p1', writePlayer(env, { club: { stars: 5 } }), 0)).toEqual({ ok: false, err: 'readonly' });
    expect(stored(mem)).toBe(before);
    if (heldA.kind === 'held') heldA.release();
    await Promise.resolve();
    expect((await b.hold('p1')).kind).toBe('held');
    expect(b.savePlayer('p1', writePlayer(env, { club: { stars: 5 } }), 0)).toEqual({ ok: true });
  });

  it('busy и «битый» не затирают друг друга: после починки игрока замок остаётся', async () => {
    // Ловит: одна пометка на игрока — «битый» стирает «занят» (или наоборот), и вкладка пишет при чужом замке.
    const locks = fakeLocks();
    const { open, mem } = setup({ locks });
    const a = open();
    const b = open();
    const env = seed(a);
    await a.hold('p1');
    expect((await b.hold('p1')).kind).toBe('busy');
    const good = stored(mem) as string;
    mem.map.set(key(), 'мусор');
    expect(b.loadPlayer('p1').kind).toBe('broken');
    mem.map.set(key(), good);
    expect(b.loadPlayer('p1').kind).toBe('ok');
    expect(b.savePlayer('p1', writePlayer(env, { club: { stars: 5 } }), 0)).toEqual({ ok: false, err: 'readonly' });
    expect(stored(mem)).toBe(good);
  });

  it('удалить игрока, которого держит другая вкладка, нельзя — busy; после release можно', async () => {
    // Ловит: вкладка без замка уносит в корзину игрока, который играет в соседней.
    const locks = fakeLocks();
    const { open, mem } = setup({ locks });
    const a = open();
    const b = open();
    seed(a);
    const heldA = await a.hold('p1');
    await b.hold('p1');
    const before = mem.snapshot();
    expect(b.trash('p1')).toEqual({ ok: false, err: 'busy' });
    expect(mem.snapshot()).toEqual(before);
    if (heldA.kind === 'held') heldA.release();
    await Promise.resolve();
    expect((await b.hold('p1')).kind).toBe('held');
    expect(b.trash('p1')).toEqual({ ok: true });
  });

  it('замок другого игрока не мешает', async () => {
    // Ловит: замок один на всё устройство — вторая вкладка с другим ребёнком получает busy.
    const locks = fakeLocks();
    const { open } = setup({ locks });
    expect((await open().hold('p1')).kind).toBe('held');
    expect((await open().hold('p2')).kind).toBe('held');
  });

  it('без Web Locks: запасной путь — conflict по rev, запись не идёт', async () => {
    // Ловит: без Web Locks (старый Safari) вторая вкладка молча затирает первую.
    const { open, mem } = setup();
    const a = open();
    const b = open();
    const env = seed(a);
    expect((await a.hold('p1')).kind).toBe('unsupported');
    expect(a.savePlayer('p1', writePlayer(env, { club: { stars: 1 } }), 0)).toEqual({ ok: true });
    const mine = stored(mem);
    expect(b.savePlayer('p1', writePlayer(env, { club: { stars: 2 } }), 0)).toEqual({ ok: false, err: 'conflict' });
    expect(stored(mem)).toBe(mine);
  });

  it('замок падает (SecurityError, отказ request) — unsupported, не исключение', async () => {
    // Ловит: iframe или запрет сайта роняет открытие игрока из-за замка.
    const rejecting: LocksApi = {
      request: () => Promise.reject(new Error('SecurityError')),
    };
    const throwing: LocksApi = {
      request: () => {
        throw new Error('SecurityError');
      },
    };
    expect(await holdLock('k', rejecting)).toEqual({ kind: 'unsupported' });
    expect(await holdLock('k', throwing)).toEqual({ kind: 'unsupported' });
    expect(await holdLock('k', undefined)).toEqual({ kind: 'unsupported' });
  });

  it('conflict: игрока стёрли или заменили на диске, создание поверх существующего', () => {
    // Ловит: вторая вкладка воскрешает удалённого игрока или создаёт нового поверх живого с тем же pid.
    const { store, mem } = setup();
    const env = seed(store);
    expect(store.savePlayer('p1', player(), null)).toEqual({
      ok: false,
      err: 'conflict',
    });
    mem.map.delete(key());
    expect(store.savePlayer('p1', writePlayer(env, { club: { stars: 1 } }), 0)).toEqual({ ok: false, err: 'conflict' });
    mem.map.set(key(), 'не конверт');
    expect(store.savePlayer('p1', writePlayer(env, { club: { stars: 1 } }), 0)).toEqual({ ok: false, err: 'conflict' });
    expect(stored(mem)).toBe('не конверт');
  });

  it('на диске конверт новее программы — readonly, прежнее цело', () => {
    // Ловит: старая вкладка (старый код) перезаписывает игрока, которого уже сохранила новая версия.
    const { store, mem } = setup();
    const env = seed(store);
    const newer = JSON.stringify({ ...env, fmt: 2 });
    mem.map.set(key(), newer);
    expect(store.savePlayer('p1', writePlayer(env, { club: { stars: 1 } }), 0)).toEqual({ ok: false, err: 'readonly' });
    expect(stored(mem)).toBe(newer);
  });
});
