/**
 * Корзина игроков (063-Р62, 059-В10): чистые правила движка и запись через хранилище с замками. Другая подготовка, чем у session.test:
 * хранилище и замки напрямую, без Vue. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { createBin } from '../../src/app/save/bin';
import { newDevice, type Store } from '../../src/app/save/store';
import { binEntries, canDelete, clearConfirmed, clearPhrase, halfDeleted, restoreCheck, trashName } from '../../src/engine/save/bin';
import { withBinCleared, withPlayer, withoutPlayer, type Device } from '../../src/engine/save/device';
import { createPlayer } from '../../src/engine/save/envelope';
import { P, defs, fakeLocks, player, setup } from '../fixtures/storageKit';

const NAMES: Record<string, string> = { p1: 'Саша', p2: 'Миша', p3: 'Аня', p4: 'Коля', p5: 'Вера' };

/** Устройство с игроками `pids` (файлы записаны, имена — из `NAMES`). */
function club(store: Store, pids: string[]): Device {
  for (const pid of pids) expect(store.savePlayer(pid, createPlayer({ pid, name: NAMES[pid] ?? pid }, defs), null)).toEqual({ ok: true });
  const device: Device = { ...newDevice(), rev: 1, players: pids.map((pid, order) => ({ pid, order })) };
  expect(store.saveDevice(device, null)).toEqual({ ok: true });
  return device;
}
const listed = (store: Store): string[] => {
  const d = store.loadDevice();
  return d.kind === 'ok' ? d.device.players.map((p) => p.pid) : [];
};
const entry = (pid: string, name: string, day: string | null = null) => ({ pid, name, day, days: null });

describe('К14: корзина — правила движка', () => {
  it('К14: подтверждение очистки — тот же текст; регистр и пробелы не важны, лишняя буква важна; пустая корзина — нечего подтверждать', () => {
    // Ловит: очистка по любому вводу или только по точному регистру («миша» не пускает); очистка пустой корзины «подтверждается» пустой строкой.
    const one = [entry('p2', 'Миша')];
    expect(clearConfirmed(one, 'Миша')).toBe(true);
    expect(clearConfirmed(one, '  мИШа ')).toBe(true);
    expect(clearConfirmed([entry('p2', 'Ваня  Иванов')], ' ваня иванов')).toBe(true);
    expect(clearConfirmed(one, 'Миш')).toBe(false);
    expect(clearConfirmed(one, 'Ми ша')).toBe(false);
    expect(clearConfirmed(one, '')).toBe(false);
    expect(clearConfirmed([], '')).toBe(false);
    expect(clearPhrase([entry('p2', 'Миша'), entry('p3', 'Аня')])).toBe('Миша Аня');
    expect(clearConfirmed([entry('p2', 'Миша'), entry('p3', 'Аня')], 'миша аня')).toBe(true);
    expect(clearConfirmed([entry('p2', 'Миша'), entry('p3', 'Аня')], 'Миша')).toBe(false);
  });

  it('К14: последнего игрока не удалить; вернуть нельзя при 4 игроках (063-Р11) и тому, кто уже в списке', () => {
    // Ловит: «Удалить» у единственного игрока (клуб остаётся без игроков); возврат пятого игрока сверх лимита.
    expect(canDelete({ players: [{ pid: 'p1', order: 0 }] })).toBe(false);
    expect(canDelete({ players: [{ pid: 'p1', order: 0 }, { pid: 'p2', order: 1 }] })).toBe(true);
    const four = { players: ['p1', 'p2', 'p3', 'p4'].map((pid, order) => ({ pid, order })) };
    expect(restoreCheck(four, 'p5')).toBe('limit');
    expect(restoreCheck({ players: four.players.slice(0, 3) }, 'p5')).toBe('ok');
    expect(restoreCheck(four, 'p1')).toBe('listed');
  });

  it('К14: строки корзины — свежее выше, дни хранения от «сегодня»; имя читается из сырого, битое — null', () => {
    // Ловит: порядок строк прыгает; «сколько хранится» считается не от дня удаления; битый конверт роняет раздел.
    const device = { bin: { p2: '2026-11-10', p3: '2026-11-16' } };
    const raws = { p2: '{"name":"Миша"}', p3: '{"name":"Аня"}', p4: 'не json' };
    const rows = binEntries(['p2', 'p4', 'p3'], raws, device, '2026-11-18');
    expect(rows.map((r) => [r.pid, r.name, r.days])).toEqual([['p3', 'Аня', 2], ['p2', 'Миша', 8], ['p4', null, null]]);
    expect(trashName('{"name":""}')).toBeNull();
    expect(trashName('[1]')).toBeNull();
  });

  it('К14: запись устройства — игрок уходит с днём и возвращается в конец без дня; очистка стирает дни; игрока нет — тот же объект', () => {
    // Ловит: день корзины остаётся после возврата; возврат вставляет игрока не в конец; пустая правка повышает rev.
    const base: Device = { ...newDevice(), rev: 3, players: [{ pid: 'p1', order: 0 }, { pid: 'p2', order: 1 }] };
    const gone = withoutPlayer(base, 'p1', '2026-11-18');
    expect(gone).toMatchObject({ rev: 4, players: [{ pid: 'p2', order: 1 }], bin: { p1: '2026-11-18' } });
    const back = withPlayer(gone, 'p1');
    expect(back.players.map((p) => p.pid)).toEqual(['p2', 'p1']);
    expect(back.bin).toBeUndefined();
    expect(withBinCleared(gone).bin).toBeUndefined();
    expect(withoutPlayer(base, 'p9', '2026-11-18')).toBe(base);
    expect(withBinCleared(base)).toBe(base);
    expect(halfDeleted(base, ['p2', 'p7'])).toEqual(['p2']);
  });
});

describe('К14: корзина — запись через хранилище', () => {
  it('К14: удалить → в корзину, вернуть → в конец списка с тем же файлом; последнего удалить нельзя', async () => {
    // Ловит: файл игрока теряется по дороге; удалённый остаётся в списке; единственного игрока удаляют.
    const { store } = setup();
    club(store, ['p1', 'p2']);
    const bin = createBin({ store });
    expect(await bin.remove('p2', '2026-11-18')).toEqual({ ok: true });
    expect(listed(store)).toEqual(['p1']);
    expect(bin.list('2026-11-18').map((e) => [e.pid, e.name, e.day])).toEqual([['p2', 'Миша', '2026-11-18']]);
    expect(await bin.remove('p1', '2026-11-18')).toEqual({ ok: false, why: 'last' });
    expect(bin.restore('p2')).toEqual({ ok: true });
    expect(listed(store)).toEqual(['p1', 'p2']);
    expect(store.loadPlayer('p2')).toMatchObject({ kind: 'ok', env: { name: 'Миша' } });
    expect(bin.list('2026-11-18')).toEqual([]);
  });

  it('К14: вернуть при 4 игроках — отказ limit, игрок остаётся в корзине', async () => {
    // Ловит: возврат сверх лимита 4 (в списке 5) или потеря игрока при отказе.
    const { store } = setup();
    club(store, ['p1', 'p2', 'p3', 'p4']);
    const bin = createBin({ store });
    expect(await bin.remove('p4', '2026-11-18')).toEqual({ ok: true });
    expect(store.savePlayer('p5', createPlayer({ pid: 'p5', name: 'Вера' }, defs), null)).toEqual({ ok: true });
    const d = store.loadDevice();
    if (d.kind !== 'ok') throw new Error('device');
    expect(store.saveDevice(withPlayer(d.device, 'p5'), d.device.rev)).toEqual({ ok: true });
    expect(bin.restore('p4')).toEqual({ ok: false, why: 'limit' });
    expect(listed(store)).toEqual(['p1', 'p2', 'p3', 'p5']);
    expect(bin.list('2026-11-18').map((e) => e.pid)).toEqual(['p4']);
  });

  it('К14: очистить при пустой корзине — отказ empty; чужое имя — phrase, ничего не стёрто; верное (другой регистр, пробелы) — стёрто насовсем', async () => {
    // Ловит: очистка без подтверждения или по чужому имени; очистка пустой корзины «успешна»; данные игрока остаются после очистки.
    const { store, mem } = setup();
    club(store, ['p1', 'p2']);
    const bin = createBin({ store });
    expect(bin.empty('')).toEqual({ ok: false, why: 'empty' });
    await bin.remove('p2', '2026-11-18');
    expect(bin.empty('Саша')).toEqual({ ok: false, why: 'phrase' });
    expect(bin.empty('')).toEqual({ ok: false, why: 'phrase' });
    expect(mem.map.has(`${P}trash.p2`)).toBe(true);
    expect(bin.empty('  миша  ')).toEqual({ ok: true, count: 1 });
    expect(mem.map.has(`${P}trash.p2`)).toBe(false);
    expect(bin.list('2026-11-18')).toEqual([]);
    expect(bin.restore('p2')).toMatchObject({ ok: false });
    const d = store.loadDevice();
    expect(d.kind === 'ok' ? d.device.bin : 'нет устройства').toBeUndefined();
  });

  it('К14: запись устройства не легла (quota) — удаление откатывает конверт из корзины на место (063-Р31)', async () => {
    // Ловит: игрок «в списке без файла» после сбоя второй записи удаления (нет `store.restore` в remove).
    const { store } = setup();
    club(store, ['p1', 'p2']);
    const failing: Store = { ...store, saveDevice: () => ({ ok: false, err: 'quota' }) };
    expect(await createBin({ store: failing }).remove('p2', '2026-11-18')).toEqual({ ok: false, why: 'quota' });
    expect(listed(store)).toEqual(['p1', 'p2']);
    expect(store.loadPlayer('p2')).toMatchObject({ kind: 'ok', env: { name: 'Миша' } });
    expect(createBin({ store }).list('2026-11-18')).toEqual([]);
  });

  it('К14: запись устройства не легла (conflict) — возврат кладёт конверт снова в корзину, игрок не потерян (063-Р31)', async () => {
    // Ловит: игрок потерян (ни в списке, ни в корзине) после сбоя второй записи возврата (нет `store.trash` в restore).
    const { store } = setup();
    club(store, ['p1', 'p2']);
    expect(await createBin({ store }).remove('p2', '2026-11-18')).toEqual({ ok: true });
    const failing: Store = { ...store, saveDevice: () => ({ ok: false, err: 'conflict' }) };
    expect(createBin({ store: failing }).restore('p2')).toEqual({ ok: false, why: 'conflict' });
    expect(listed(store)).toEqual(['p1']);
    expect(store.loadPlayer('p2').kind).toBe('absent');
    expect(createBin({ store }).list('2026-11-18').map((e) => e.pid)).toEqual(['p2']);
  });

  it('К14 (063-Р65, ревью) оборванное удаление: игрок в списке, файла нет, конверт в корзине — «Начать заново» отказывает binned и не пишет поверх; settle доводит удаление, «Вернуть» отдаёт прогресс', async () => {
    // Ловит: «Начать заново» затирает пустым игроком единственный целый конверт (потеря прогресса); settle не доводит удаление без открытого игрока.
    const { store } = setup();
    club(store, ['p1', 'p2']);
    expect(store.savePlayer('p2', player('p2', 7), 0)).toEqual({ ok: true }); // игрок с прогрессом: stars 7
    expect(store.trash('p2')).toEqual({ ok: true }); // оборвалось: конверт в корзине, устройство ещё со списком из двух
    const bin = createBin({ store, defs });
    expect(await bin.restart('p2', 'Игрок')).toEqual({ ok: false, why: 'binned' });
    expect(store.loadPlayer('p2').kind).toBe('absent'); // поверх ничего не записано
    expect(store.peekTrash('p2').ok).toBe(true);
    expect(bin.settle('2026-11-19')).toBe(true); // как при открытии страницы: игрока вкладки нет, замков нет
    expect(listed(store)).toEqual(['p1']);
    expect(bin.restore('p2')).toEqual({ ok: true });
    const back = store.loadPlayer('p2');
    expect(back.kind === 'ok' ? back.env.sections.club?.data : null).toEqual({ stars: 7 });
    expect(listed(store)).toEqual(['p1', 'p2']);
  });

  it('К14 (063-Р65, ревью) «Начать заново»: игрока держит другая вкладка — busy, ничего не записано', async () => {
    // Ловит: «Начать заново» стирает битого игрока, пока другая вкладка с ним играет (нет hold в restart).
    const locks = fakeLocks();
    const first = setup({ locks });
    club(first.store, ['p1', 'p2']);
    first.mem.map.set(`${P}player.p2`, '{"name":"Миша","rev":4}');
    const other = first.open(defs, locks);
    const held = await other.hold('p2');
    expect(held.kind).toBe('held');
    expect(await createBin({ store: first.store, defs }).restart('p2', 'Игрок')).toEqual({ ok: false, why: 'busy' });
    expect(first.mem.map.get(`${P}player.p2`)).toBe('{"name":"Миша","rev":4}');
    if (held.kind === 'held') held.release();
  });

  it('К14: игрока держит другая вкладка — busy с именем, ничего не тронуто', async () => {
    // Ловит: удаление игрока, который сейчас играет в другой вкладке (у него пропал бы файл под руками).
    const locks = fakeLocks();
    const first = setup({ locks });
    club(first.store, ['p1', 'p2']);
    const other = first.open(defs, locks);
    const held = await other.hold('p2');
    expect(held.kind).toBe('held');
    const bin = createBin({ store: first.store });
    expect(await bin.remove('p2', '2026-11-18')).toEqual({ ok: false, why: 'busy', name: 'Миша' });
    expect(listed(first.store)).toEqual(['p1', 'p2']);
    expect(bin.list('2026-11-18')).toEqual([]);
    if (held.kind === 'held') held.release();
    await new Promise((r) => setTimeout(r, 0)); // замок отпускается на следующем такте
    expect(await bin.remove('p2', '2026-11-18')).toEqual({ ok: true });
  });

  it('К14: перезагрузка посреди удаления — конверт в корзине, игрок в списке: settle дописывает устройство, целый игрок не трогается', () => {
    // Ловит: игрок «в списке без файла» навсегда после обрыва; settle убирает из списка игрока, чей файл ещё на диске.
    const { store } = setup();
    const device = club(store, ['p1', 'p2', 'p3']);
    const bin = createBin({ store });
    expect(bin.settle('2026-11-18')).toBe(false);
    // оборвалось: конверт p2 уже в корзине, устройство не записано
    expect(store.trash('p2')).toEqual({ ok: true });
    expect(listed(store)).toEqual(['p1', 'p2', 'p3']);
    expect(bin.settle('2026-11-18')).toBe(true);
    expect(listed(store)).toEqual(['p1', 'p3']);
    expect(bin.list('2026-11-18').map((e) => [e.pid, e.day])).toEqual([['p2', '2026-11-18']]);
    expect(device.players).toHaveLength(3);
    // файл p3 есть и на диске, и в корзине (trash.p3 — старый конверт, p3 — игрок, записанный заново): список и файл на месте
    expect(store.trash('p3')).toEqual({ ok: true });
    expect(store.savePlayer('p3', createPlayer({ pid: 'p3', name: 'Аня' }, defs), null)).toEqual({ ok: true });
    expect(store.peekTrash('p3').ok).toBe(true);
    expect(bin.settle('2026-11-19')).toBe(false);
    expect(listed(store)).toEqual(['p1', 'p3']);
    expect(store.loadPlayer('p3')).toMatchObject({ kind: 'ok', env: { name: 'Аня' } });
  });
  it('К14 (063-Р66) игрок и в списке, и в корзине: удаление кладёт живого в корзину, старый конверт — в копии; не легла копия — отказ listed, ничего не стёрто', async () => {
    // Ловит: удаление такого дубля отказывает `exists`/«нет места» на ровном месте; старый конверт из корзины затирается без копии.
    const { store, mem } = setup();
    club(store, ['p1', 'p2', 'p3']);
    expect(store.trash('p3')).toEqual({ ok: true }); // оборвалось: старый конверт «Аня» в корзине, игрок — в списке
    const oldRaw = mem.map.get(`${P}trash.p3`);
    expect(store.savePlayer('p3', createPlayer({ pid: 'p3', name: 'Новая' }, defs), null)).toEqual({ ok: true });
    const bin = createBin({ store });
    expect(await bin.remove('p3', '2026-11-19')).toEqual({ ok: true });
    expect(listed(store)).toEqual(['p1', 'p2']);
    expect(JSON.parse(mem.map.get(`${P}trash.p3`) ?? '{}')).toMatchObject({ name: 'Новая' });
    expect(mem.map.get(`${P}player.p3.c1`)).toBe(oldRaw);
    expect(store.loadPlayer('p3').kind).toBe('absent');
    expect(bin.list('2026-11-19').map((e) => [e.pid, e.name, e.day])).toEqual([['p3', 'Новая', '2026-11-19']]);
    // копия не ложится — старый конверт остаётся, живой игрок цел
    const full = setup();
    club(full.store, ['p1', 'p2', 'p3']);
    full.store.trash('p3');
    full.store.savePlayer('p3', createPlayer({ pid: 'p3', name: 'Новая' }, defs), null);
    const keep = full.mem.map.get(`${P}trash.p3`);
    const set = full.mem.setItem.bind(full.mem);
    full.mem.setItem = (k, v) => {
      if (k.startsWith(`${P}player.p3.c`)) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      set(k, v);
    };
    expect(await createBin({ store: full.store }).remove('p3', '2026-11-19')).toEqual({ ok: false, why: 'listed' });
    expect(full.mem.map.get(`${P}trash.p3`)).toBe(keep);
    expect(listed(full.store)).toEqual(['p1', 'p2', 'p3']);
    expect(full.store.loadPlayer('p3')).toMatchObject({ kind: 'ok', env: { name: 'Новая' } });
  });
  it('К14 (063-Р65) двойной отказ при возврате (устройство и корзина не легли): игрок — файл без записи; settle кладёт его в корзину, а listed, копии и уже лежащее в корзине не трогает', async () => {
    // Ловит: игрок потерян из виду после двойного отказа restore (ни в списке, ни в корзине); settle подбирает копии `.c1` или живых игроков списка как «сирот».
    const { store, mem } = setup();
    club(store, ['p1', 'p2', 'p3']);
    expect(await createBin({ store }).remove('p2', '2026-11-18')).toEqual({ ok: true });
    expect(await createBin({ store }).remove('p3', '2026-11-18')).toEqual({ ok: true });
    expect(store.putCopy('p1', createPlayer({ pid: 'p1', name: 'Саша' }, defs))).toEqual({ ok: true });
    const failing: Store = { ...store, saveDevice: () => ({ ok: false, err: 'conflict' }), trash: () => ({ ok: false, err: 'quota' }) };
    expect(createBin({ store: failing }).restore('p2')).toEqual({ ok: false, why: 'conflict' });
    expect(mem.map.has(`${P}player.p2`)).toBe(true); // файл на диске
    expect(mem.map.has(`${P}trash.p2`)).toBe(false); // и из корзины ушёл
    expect(listed(store)).toEqual(['p1']);
    const bin = createBin({ store });
    expect(bin.settle('2026-11-19')).toBe(true);
    expect(mem.map.has(`${P}player.p2`)).toBe(false);
    expect(bin.list('2026-11-19').map((e) => [e.pid, e.day])).toEqual([['p2', '2026-11-19'], ['p3', '2026-11-18']]);
    expect(listed(store)).toEqual(['p1']);
    expect(store.loadPlayer('p1')).toMatchObject({ kind: 'ok' });
    expect(bin.settle('2026-11-20')).toBe(false);
    expect(bin.restore('p2')).toEqual({ ok: true }); // и вернуть его можно
    expect(listed(store)).toEqual(['p1', 'p2']);
  });

  it('К14 (063-Р65) свежий файл без данных (rev 0) тоже сирота — уходит в корзину; ключи не игроков (карантин, чужие) не трогаются', () => {
    // Ловит: сирота rev 0 остаётся (его «пустота» принимается за готовность); settle забирает чужие ключи или карантин.
    const { store, mem } = setup();
    club(store, ['p1', 'p2']);
    expect(store.savePlayer('p9', createPlayer({ pid: 'p9', name: 'Новичок' }, defs), null)).toEqual({ ok: true });
    mem.map.set(`${P}quarantine.p1.1`, '{не json');
    const before = mem.snapshot();
    const bin = createBin({ store });
    expect(bin.settle('2026-11-19')).toBe(true);
    const after = mem.snapshot();
    expect(Object.keys(before).filter((k) => !(k in after))).toEqual([`${P}player.p9`]);
    expect(Object.keys(after).filter((k) => !(k in before))).toEqual([`${P}trash.p9`]);
    expect(bin.list('2026-11-19').map((e) => [e.pid, e.name, e.day])).toEqual([['p9', 'Новичок', '2026-11-19']]);
  });
  it('К14 (063-Р65) «Начать заново»: битый игрок — сырое в карантине, пустой игрок с тем же pid и именем из конверта; здоровый — healthy, «новее» — readonly, нет в списке — absent', async () => {
    // Ловит: «Начать заново» стирает сырое без карантина, теряет имя, трогает здорового игрока или игрока «новее».
    const { store, mem } = setup();
    club(store, ['p1', 'p2', 'p3']);
    const bin = createBin({ store, defs });
    expect(await bin.restart('p1', 'Игрок')).toEqual({ ok: false, why: 'healthy' });
    expect(await bin.restart('p9', 'Игрок')).toEqual({ ok: false, why: 'absent' });
    mem.map.set(`${P}player.p2`, '{"name":"Миша","rev":4}');
    mem.map.set(`${P}player.p3`, JSON.stringify({ ...createPlayer({ pid: 'p3', name: 'Аня' }, defs), fmt: 99 }));
    expect(await bin.restart('p3', 'Игрок')).toEqual({ ok: false, why: 'readonly' });
    expect(await bin.restart('p2', 'Игрок')).toEqual({ ok: true });
    expect(store.loadPlayer('p2')).toMatchObject({ kind: 'ok', env: { pid: 'p2', name: 'Миша', rev: 0 } });
    expect(store.quarantined('p2')).toEqual(['{"name":"Миша","rev":4}']);
    expect(listed(store)).toEqual(['p1', 'p2', 'p3']);
    mem.map.delete(`${P}player.p1`); // ключа нет — имени взять неоткуда: запасное
    expect(await bin.restart('p1', 'Запас')).toEqual({ ok: true });
    expect(store.loadPlayer('p1')).toMatchObject({ kind: 'ok', env: { name: 'Запас' } });
  });

  it('К14 (063-Р65) «Начать заново»: нет места (quota) или карантин не лёг — отказ, сырое на диске как было; устройство «новее» — readonly', async () => {
    // Ловит: при отказе записи битый игрок пропадает (сырое стёрто без копии); устройство «новее» перезаписывается.
    const { store, mem } = setup();
    club(store, ['p1', 'p2']);
    mem.map.set(`${P}player.p2`, '{"name":"Миша"}');
    const full: Store = { ...store, savePlayer: () => ({ ok: false, err: 'quota' }) };
    expect(await createBin({ store: full, defs }).restart('p2', 'Игрок')).toEqual({ ok: false, why: 'quota' });
    const noQuarantine: Store = { ...store, loadPlayer: () => ({ kind: 'broken', raw: 'x', why: [], quarantined: false }) };
    expect(await createBin({ store: noQuarantine, defs }).restart('p2', 'Игрок')).toEqual({ ok: false, why: 'quota' });
    expect(mem.map.get(`${P}player.p2`)).toBe('{"name":"Миша"}');
    mem.map.set(`${P}device`, JSON.stringify({ kind: 'keykick-device', fmt: 99, rev: 1, players: [] }));
    expect(await createBin({ store: setup().store }).restart('p2', 'Игрок')).toEqual({ ok: false, why: 'absent' });
    expect(await createBin({ store: { ...store } }).restart('p2', 'Игрок')).toEqual({ ok: false, why: 'readonly' });
  });

  it('К14 (063-Р65) «Новый клуб»: битое устройство — новое поверх карантина, файлы прежних игроков уходят в корзину; quota — отказ, битое на месте; читается — healthy; «новее» — readonly', () => {
    // Ловит: «Новый клуб» затирает битое без карантина; прежние игроки остаются сиротами; живое устройство перезаписывается.
    const { store, mem } = setup();
    club(store, ['p1', 'p2']);
    const bin = createBin({ store });
    expect(bin.newClub('2026-11-19')).toEqual({ ok: false, why: 'healthy' });
    mem.map.set(`${P}device`, '{не json');
    const full: Store = { ...store, saveDevice: () => ({ ok: false, err: 'quota' }) };
    expect(createBin({ store: full }).newClub('2026-11-19')).toEqual({ ok: false, why: 'quota' });
    expect(mem.map.get(`${P}device`)).toBe('{не json');
    expect(bin.newClub('2026-11-19')).toEqual({ ok: true });
    expect(store.quarantined('device')).toEqual(['{не json']);
    expect(listed(store)).toEqual([]);
    expect(bin.list('2026-11-19').map((e) => [e.pid, e.name])).toEqual([['p1', 'Саша'], ['p2', 'Миша']]);
    mem.map.set(`${P}device`, JSON.stringify({ kind: 'keykick-device', fmt: 99, rev: 1, players: [] }));
    expect(createBin({ store: setup().store }).newClub('2026-11-19')).toEqual({ ok: false, why: 'absent' }); // устройства нет — это первый запуск, а не тупик
    expect(createBin({ store: { ...store, loadDevice: () => ({ kind: 'newer', raw: 'x' }) } }).newClub('2026-11-19')).toEqual({ ok: false, why: 'readonly' });
  });

  it('К14 (063-Р65) очистка корзины при устройстве «новее» — readonly, корзина не тронута', async () => {
    // Ловит: empty() стирает конверты, не спросив устройство, — дни не поправить, а читать его нельзя.
    const { store, mem } = setup();
    club(store, ['p1', 'p2']);
    await createBin({ store }).remove('p2', '2026-11-18');
    const newer: Store = { ...store, loadDevice: () => ({ kind: 'newer', raw: 'x' }) };
    expect(createBin({ store: newer }).empty('Миша')).toEqual({ ok: false, why: 'readonly' });
    expect(mem.map.has(`${P}trash.p2`)).toBe(true);
  });
});
