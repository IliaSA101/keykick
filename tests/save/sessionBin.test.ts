/**
 * Корзина и выход из тупика через мост сеанса (063-Р62, Р65): `session.bin` поверх хранилища в памяти. Вынесено из `session.test.ts` (предел 600 строк);
 * подготовка — `tests/fixtures/sessionKit.ts`. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { enter } from '../../src/engine/players/entry';
import { P } from '../fixtures/storageKit';
import { browser, disk, withClub } from '../fixtures/sessionKit';

describe('session: сирота create (063-Р65)', () => {
  it('К8 (063-Р65) create: игрок записан, устройство не легло (quota) — файл-сирота; bin.settle кладёт его в корзину с днём «сегодня», список и первый игрок целы', async () => {
    // Ловит: сирота `create` (файл игрока без записи в списке и в корзине) остаётся на диске навсегда — родитель его не видит, и он ест квоту.
    const { mem, tab } = browser();
    const t = tab();
    await t.session.init();
    expect(await t.session.create({ name: 'Саша' })).toEqual({ ok: true, pid: 'p1' });
    const set = t.store.saveDevice.bind(t.store);
    t.store.saveDevice = () => ({ ok: false, err: 'quota' });
    expect(await t.session.create({ name: 'Маша' })).toEqual({ ok: false, why: 'quota' });
    t.store.saveDevice = set;
    expect(mem.map.has(`${P}player.p2`)).toBe(true);
    expect(t.session.bin.settle('2026-11-19')).toBe(true);
    expect(mem.map.has(`${P}player.p2`)).toBe(false);
    expect(mem.map.has(`${P}trash.p2`)).toBe(true);
    expect(t.session.bin.list('2026-11-19').map((e) => [e.pid, e.name, e.day])).toEqual([['p2', 'Маша', '2026-11-19']]);
    expect(disk(mem, 'device').players.map((p) => p.pid)).toEqual(['p1']);
    expect(mem.map.has(`${P}player.p1`)).toBe(true);
    expect(t.session.bin.settle('2026-11-19')).toBe(false); // повтор — ничего нового
  });
});

describe('session.bin: корзина через мост сеанса (063-Р62)', () => {
  /** Сеанс с двумя игроками: Саша (p1, выбран) и Маша (p2). */
  async function two() {
    const w = await withClub();
    expect(await w.session.create({ name: 'Маша' })).toEqual({ ok: true, pid: 'p2' });
    await w.session.choose(w.pid);
    return w;
  }
  const listedIn = (session: Awaited<ReturnType<typeof two>>['session']): string[] => {
    const d = session.device.value;
    return d.kind === 'ok' ? d.value.players.map((p) => p.pid) : [];
  };

  it('К14 удалить и вернуть чужого игрока — список в сеансе (session.device) обновляется сразу, свой игрок не тронут', async () => {
    // Ловит: после «Удалить» или «Вернуть» экран родителя показывает старый список (нет readDevice в обёртке корзины).
    const { session, pid } = await two();
    expect(listedIn(session)).toEqual(['p1', 'p2']);
    expect(await session.bin.remove('p2', '2026-11-18')).toEqual({ ok: true });
    expect(listedIn(session)).toEqual(['p1']);
    expect(session.bin.list('2026-11-18').map((e) => e.pid)).toEqual(['p2']);
    expect(session.player.value).toMatchObject({ kind: 'ok', pid });
    expect(session.bin.restore('p2')).toEqual({ ok: true });
    expect(listedIn(session)).toEqual(['p1', 'p2']);
    expect(session.bin.list('2026-11-18')).toEqual([]);
  });

  it('К14 удалить своего игрока — вкладка его отпускает и выбирает заново: игрока p1 в сеансе больше нет, замок свободен', async () => {
    // Ловит: вкладка держит удалённого игрока (запись «в никуда», замок не отпущен) — нет reload у своего игрока.
    const { session, tab, pid } = await two();
    expect(await session.bin.remove(pid, '2026-11-18')).toEqual({ ok: true });
    expect(listedIn(session)).toEqual(['p2']);
    const cur = session.player.value;
    expect(cur.kind === 'none' ? '' : cur.pid).not.toBe(pid);
    // замок p1 отпущен: вернуть и взять его другой вкладкой можно
    expect(session.bin.restore(pid)).toEqual({ ok: true });
    const other = tab();
    await other.session.init();
    await other.session.choose(pid);
    expect(other.session.status.value).toBe('ok');
  });
});

describe('session.bin: «Начать заново» и «Новый клуб» перечитывают вкладку (063-Р65)', () => {
  it('К14 (063-Р65) restart своего битого игрока — вкладка перечитывается: player.kind снова ok, имя то же', async () => {
    // Ловит: после «Начать заново» вкладка остаётся с «broken» в памяти (нет reload для своей вкладки в обёртке restart) — игрок «не открывается», хотя файл уже пустой и целый.
    const w = await withClub();
    w.mem.map.set(`${P}player.${w.pid}`, '{"name":"Саша","rev":4}');
    await w.session.reload(); // вкладка видит битый файл
    expect(w.session.player.value).toMatchObject({ kind: 'broken', pid: w.pid });
    expect(await w.session.bin.restart(w.pid, 'Игрок')).toEqual({ ok: true });
    const cur = w.session.player.value;
    expect(cur).toMatchObject({ kind: 'ok', pid: w.pid });
    expect(cur.kind === 'ok' ? cur.env.name : '').toBe('Саша');
  });

  it('К14 (063-Р65) restart чужого игрока — своя вкладка не перечитывается (игрок вкладки остаётся), список сеанса обновлён', async () => {
    // Ловит: restart чужого игрока сбрасывает игрока вкладки (reload без разбора pid).
    const w = await withClub();
    expect(await w.session.create({ name: 'Маша' })).toEqual({ ok: true, pid: 'p2' });
    await w.session.choose(w.pid);
    w.mem.map.set(`${P}player.p2`, '{"name":"Маша","rev":4}');
    expect(await w.session.bin.restart('p2', 'Игрок')).toEqual({ ok: true });
    expect(w.session.player.value).toMatchObject({ kind: 'ok', pid: w.pid });
  });

  it('К14 (063-Р65) newClub: битое устройство — вкладка начинает с первого запуска: игрока нет, список пуст, вход ведёт на «Старт»', async () => {
    // Ловит: после «Нового клуба» вкладка держит прежнего игрока (уже в корзине) и прежний список (нет reload в обёртке newClub).
    const w = await withClub();
    w.mem.map.set(`${P}device`, '{не json');
    expect(w.session.player.value).toMatchObject({ kind: 'ok', pid: w.pid }); // вкладка ещё держит игрока в памяти: страница родителя открыта поверх
    expect(w.session.bin.newClub('2026-11-19')).toEqual({ ok: true });
    await w.session.init(); // `reload` обёртки не ждётся — `init` отдаёт тот же запуск
    expect(w.session.player.value.kind).toBe('none');
    expect(w.session.entryState()).toMatchObject({ device: 'ok', players: [], player: 'none' });
    expect(enter({ ...w.session.entryState(), pack: 'ok', route: '#/home', crash: false })).toMatchObject({ kind: 'go' });
    expect(w.session.bin.list('2026-11-19').map((e) => e.pid)).toEqual([w.pid]);
  });
});
