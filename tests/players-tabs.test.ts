/**
 * Две вкладки одного компьютера на одном списке игроков (014-Т7в): вкладка держит список с запуска и пишет его целиком —
 * чужой игрок пропадает, id делится. Подготовка — tests/playersHelpers.ts; остальное про игроков — tests/players-app.test.ts.
 */
import { afterEach, expect, it, vi, describe } from 'vitest';
import { PLAYERS_KEY, saveKey } from '../src/app/storage';
import { section as walletSection } from '../src/engine/wallet/save';
import { boot, fakeStorage, json, setClub } from './playersHelpers';

describe('игроки: две вкладки', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

// Ловит: вкладка держит список с запуска и пишет его целиком — чужой игрок пропадает, id делится (баг тестировщик, 014-Т7в).
describe('две вкладки (014-Т7в)', () => {
  /** Вкладка А грузится первой, Б — свежей загрузкой модулей поверх того же localStorage. hearA — событие storage для А. */
  async function twoTabs() {
    const local = fakeStorage();
    const handlers: ((e: { key: string | null }) => void)[] = [];
    vi.stubGlobal('addEventListener', (type: string, fn: (e: { key: string | null }) => void) => {
      if (type === 'storage') handlers.push(fn);
    });
    const a = await boot(local);
    const hearA = (key: string) => handlers.forEach((fn) => fn({ key }));
    vi.resetModules();
    const b = await boot(local);
    return { local, a, b, hearA };
  }

  type Stored = { players: { id: string; name: string }[]; lastId: number };

  it('оба добавляют игрока подряд — оба есть, id разные, lastId = 3', async () => {
    const { local, a, b } = await twoTabs();
    expect(b.createPlayer('Витя', false)).toBe('p2');
    // Вкладка А не слышала Витю (событий нет) и добавляет Гошу.
    expect(a.createPlayer('Гоша', false)).toBe('p3');
    const stored = json(local, PLAYERS_KEY) as Stored;
    expect(stored.players.map((x) => `${x.id}:${x.name}`)).toEqual(['p1:Игрок 1', 'p2:Витя', 'p3:Гоша']);
    expect(stored.lastId).toBe(3);
    expect(a.players.players.map((x) => x.name)).toEqual(['Игрок 1', 'Витя', 'Гоша']);
    expect(local.data.has(saveKey('p2'))).toBe(true);
    expect(local.data.has(saveKey('p3'))).toBe(true);
  });

  /** А создаёт Витю, Б его удаляет; А об этом не слышал (событий нет) и всё ещё помнит Витю. */
  async function deletedElsewhere() {
    const t = await twoTabs();
    t.a.createPlayer('Витя', false);
    t.b.syncList();
    expect(t.b.deletePlayer('p2')).toBe(true);
    expect(t.a.players.players.map((x) => x.id)).toEqual(['p1', 'p2']);
    return t;
  }

  it('удаление в одной вкладке, переименование в другой — удалённый не воскресает', async () => {
    const { local, a } = await deletedElsewhere();
    expect(a.renamePlayer('p2', 'Витька')).toBe(false);
    expect((json(local, PLAYERS_KEY) as Stored).players.map((x) => x.id)).toEqual(['p1']);
    expect(local.data.has(saveKey('p2'))).toBe(false);
    // Новый игрок не берёт id удалённого.
    expect(a.createPlayer('Гоша', false)).toBe('p3');
  });

  it('удаление в одной вкладке, выбор удалённого в другой — удалённый не воскресает', async () => {
    const { local, a } = await deletedElsewhere();
    a.choosePlayer('p2');
    expect((json(local, PLAYERS_KEY) as Stored).players.map((x) => x.id)).toEqual(['p1']);
    expect(a.activeId()).toBe('p1');
  });

  it('удаление в А после добавления в Б не теряет добавленного', async () => {
    const { local, a, b } = await twoTabs();
    expect(a.createPlayer('Витя', false)).toBe('p2');
    expect(b.createPlayer('Гоша', false)).toBe('p3');
    expect(a.deletePlayer('p2')).toBe(true);
    expect((json(local, PLAYERS_KEY) as Stored).players.map((x) => x.id)).toEqual(['p1', 'p3']);
  });

  it('переименование в А после добавления в Б не теряет добавленного', async () => {
    const { local, a, b } = await twoTabs();
    b.createPlayer('Витя', false);
    expect(a.renamePlayer('p1', 'Маша')).toBe(true);
    expect((json(local, PLAYERS_KEY) as Stored).players.map((x) => x.name)).toEqual(['Маша', 'Витя']);
  });

  it('id не совпадает с ключом сохранения, которого нет в списке', async () => {
    const { local, a } = await twoTabs();
    local.data.set(saveKey('p5'), JSON.stringify({}));
    expect(a.createPlayer('Гоша', false)).toBe('p6');
  });

  it('чужая запись списка обновляет players; игрока вкладки удалили — выбор снят, прогресс чужого не остаётся', async () => {
    const { a, b, hearA } = await twoTabs();
    b.createPlayer('Витя', false);
    b.createPlayer('Гоша', false);
    hearA(PLAYERS_KEY);
    expect(a.players.players.map((x) => x.id)).toEqual(['p1', 'p2', 'p3']);
    a.choosePlayer('p2');
    expect(a.activeId()).toBe('p2');
    b.deletePlayer('p2');
    hearA(PLAYERS_KEY);
    expect(a.players.players.map((x) => x.id)).toEqual(['p1', 'p3']);
    expect([a.needsChoice.value, a.activeId()]).toEqual([true, 'p1']);
  });

  // Ловит (014-Р18): вкладка играла за игрока, которого другая удалила, и продолжала писать в его ключ (или воскрешала его).
  it('игрока вкладки А удалили в Б: А ничего не пишет за него до и после события, выбор снят, номер не переиспользуется, копия с именем', async () => {
    const { local, a, b, hearA } = await twoTabs();
    b.createPlayer('Витя', false);
    b.createPlayer('Гоша', false);
    hearA(PLAYERS_KEY);
    a.choosePlayer('p2');
    setClub(a, 'Ракета', 5);
    const text = local.data.get(saveKey('p2')) ?? '';
    expect(b.deletePlayer('p2')).toBe(true);
    // Ключ мог остаться (копия «до» не легла) — А не должна ничего в него писать, ни до события, ни после.
    local.data.set(saveKey('p2'), text);
    const stored = Object.fromEntries(local.data);
    setClub(a, 'Новый', 9);
    expect(Object.fromEntries(local.data)).toEqual(stored);
    hearA(PLAYERS_KEY);
    expect([a.needsChoice.value, a.tabPlayerRemoved.value]).toEqual([true, 1]);
    // Идущий матч держит id игрока с начала и пишет по нему: после события это тоже отказ.
    a.updatePlayer((tx) => tx.set(walletSection, { ...walletSection.empty({}), coins: 11 }), { player: 'p2' });
    expect(Object.fromEntries(local.data)).toEqual(stored);
    // Ключа нет совсем — тоже ничего не воскресает.
    local.data.delete(saveKey('p2'));
    const noKey = Object.fromEntries(local.data);
    a.updatePlayer((tx) => tx.set(walletSection, { ...walletSection.empty({}), coins: 3 }), { player: 'p2' });
    expect(Object.fromEntries(local.data)).toEqual(noKey);
    // Номер удалённого не выдаётся новому игроку.
    expect(b.createPlayer('Миша', false)).toBe('p4');
    // Родитель видит, чья копия «до удаления».
    const backup = await import('../src/app/save/backup');
    expect(backup.deletedNames()).toEqual({ p2: 'Витя' });
  });

  it('другой ключ или битая запись списка вкладку не трогают: имена остаются, а не «Игрок N» из ключей сохранений', async () => {
    const { local, a, hearA } = await twoTabs();
    a.renamePlayer('p1', 'Маша');
    a.createPlayer('Витя', false);
    // Оба сохранения лежат в хранилище: «пересобрать список из ключей» дало бы запасные имена.
    local.data.set(saveKey('p1'), local.data.get(saveKey('p2')) ?? '{}');
    expect([local.data.has(saveKey('p1')), local.data.has(saveKey('p2'))]).toEqual([true, true]);
    hearA('keykick.muted');
    local.data.set(PLAYERS_KEY, 'не json');
    hearA(PLAYERS_KEY);
    expect(a.players.players.map((x) => x.name)).toEqual(['Маша', 'Витя']);
    // Следующий писатель пишет имена, а не запасные.
    expect(a.renamePlayer('p2', 'Витька')).toBe(true);
    expect((json(local, PLAYERS_KEY) as Stored).players.map((x) => x.name)).toEqual(['Маша', 'Витька']);
  });

  it('проверки имени и syncList при неизменном хранилище не подменяют объекты игроков', async () => {
    const { a, b, hearA } = await twoTabs();
    a.createPlayer('Витя', false);
    const before = [...a.players.players];
    a.renameError('p1', 'Новое имя');
    a.newNameError('Витя');
    a.syncList();
    hearA(PLAYERS_KEY);
    a.players.players.forEach((x, i) => expect(x).toBe(before[i]));
    // Чужое изменение подменяет список.
    b.syncList();
    b.renamePlayer('p2', 'Витька');
    a.syncList();
    expect(a.players.players.map((x) => x.name)).toEqual(['Игрок 1', 'Витька']);
  });

  it('проверка имени видит игрока из другой вкладки, не меняя список', async () => {
    const { a, b } = await twoTabs();
    b.createPlayer('Витя', false);
    expect(a.players.players).toHaveLength(1);
    expect(a.newNameError('витя')).toBe('taken');
    expect(a.players.players).toHaveLength(1);
  });

  // Решение 014-Р17: список не лёг — правка не применена, в памяти и в хранилище прежнее.
  it('отказ записи при создании — игрока нет, список и чужое целы, отказ виден', async () => {
    const { local, a, b } = await twoTabs();
    b.createPlayer('Гоша', false);
    const before = JSON.stringify(json(local, PLAYERS_KEY));
    local.failOn(PLAYERS_KEY);
    expect(a.createPlayer('Витя', true)).toBeNull();
    expect(a.writeRefused.value).toBe(true);
    // Список вкладки перечитан: Гоша от Б на месте, Вити нет; прогресс не переключён.
    expect(a.players.players.map((x) => `${x.id}:${x.name}`)).toEqual(['p1:Игрок 1', 'p2:Гоша']);
    expect(a.activeId()).toBe('p1');
    local.failOn('');
    expect(JSON.stringify(json(local, PLAYERS_KEY))).toBe(before);
    // Следующая попытка идёт нормально, номер не повторяет занятый осиротевшим сохранением.
    expect(a.createPlayer('Витя', false)).toBe('p4');
    expect(a.writeRefused.value).toBe(false);
  });

  it('отказ записи при переименовании — false, имя прежнее', async () => {
    const { local, a } = await twoTabs();
    local.failOn(PLAYERS_KEY);
    expect(a.renamePlayer('p1', 'Маша')).toBe(false);
    expect(a.writeRefused.value).toBe(true);
    expect(a.players.players[0]?.name).toBe('Игрок 1');
    local.failOn('');
    expect(a.renamePlayer('p1', 'Маша')).toBe(true);
    expect(a.writeRefused.value).toBe(false);
  });

  it('отказ записи при удалении — false, сохранение игрока на месте', async () => {
    const { local, a } = await twoTabs();
    a.createPlayer('Витя', false);
    expect(local.data.has(saveKey('p2'))).toBe(true);
    local.failOn(PLAYERS_KEY);
    expect(a.deletePlayer('p2')).toBe(false);
    expect(a.writeRefused.value).toBe(true);
    expect(local.data.has(saveKey('p2'))).toBe(true);
    expect(a.players.players.map((x) => x.id)).toEqual(['p1', 'p2']);
  });

  // Ловит (ревью М4): вкладка с отказом записи держала свою копию и воскрешала удалённого.
  it('Б создала Гошу, А сверилась, запись в А не легла, Б удалила Гошу, писатель в А — Гоши нет', async () => {
    const { local, a, b } = await twoTabs();
    expect(b.createPlayer('Гоша', false)).toBe('p2');
    a.syncList();
    expect(a.players.players.map((x) => x.id)).toEqual(['p1', 'p2']);
    local.failOn(PLAYERS_KEY);
    expect(a.renamePlayer('p1', 'Маша')).toBe(false);
    local.failOn('');
    expect(b.deletePlayer('p2')).toBe(true);
    expect(a.renamePlayer('p1', 'Маша')).toBe(true);
    const stored = json(local, PLAYERS_KEY) as Stored;
    expect(stored.players.map((x) => `${x.id}:${x.name}`)).toEqual(['p1:Маша']);
    expect(local.data.has(saveKey('p2'))).toBe(false);
  });

  it('только чтение: чужая запись списка по событию storage видна, сами ничего не пишем', async () => {
    const future = JSON.stringify({ format: 0, draft: 99, rev: 5, app: '9', sections: { wallet: {} } });
    const listP1 = { players: [{ id: 'p1', name: 'Маша' }], current: 'p1', lastId: 1 };
    const local = fakeStorage({ [saveKey('p1')]: future, [PLAYERS_KEY]: JSON.stringify(listP1) });
    const handlers: ((e: { key: string | null }) => void)[] = [];
    vi.stubGlobal('addEventListener', (type: string, fn: (e: { key: string | null }) => void) => {
      if (type === 'storage') handlers.push(fn);
    });
    const p = await boot(local);
    const init = Object.fromEntries(local.data);
    expect(p.createPlayer('Гоша', false)).toBeNull();
    expect(p.writeRefused.value).toBe(true);
    // Другая вкладка (не только чтение) добавила Витю.
    const other = { players: [...listP1.players, { id: 'p2', name: 'Витя' }], current: 'p1', lastId: 2 };
    local.data.set(PLAYERS_KEY, JSON.stringify(other));
    handlers.forEach((fn) => fn({ key: PLAYERS_KEY }));
    expect(p.players.players.map((x) => `${x.id}:${x.name}`)).toEqual(['p1:Маша', 'p2:Витя']);
    expect({ ...Object.fromEntries(local.data), [PLAYERS_KEY]: init[PLAYERS_KEY] }).toEqual(init);
  });
});
});
