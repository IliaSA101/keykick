/**
 * Игроки на одном компьютере, чистые правила: разбор списка не теряет сохранений, имена
 * проверяются, первый запуск переносит старое сохранение. Через обёртку app/ — tests/players-app.test.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  PLAYERS_MAX,
  addPlayer,
  checkPlayerName,
  freshPlayers,
  nextPlayerId,
  parsePlayers,
  planStart,
  removePlayer,
  renamePlayer,
  selectPlayer,
  tabPlayer,
  type PlayersData,
} from '../src/engine/players';
import { emptyShared, parseShared } from '../src/engine/session';

const fallback = (n: number) => `Игрок ${n}`;

const two: PlayersData = {
  players: [
    { id: 'p1', name: 'Маша' },
    { id: 'p2', name: 'Петя' },
  ],
  current: 'p2',
  lastId: 2,
};

describe('имя игрока', () => {
  it('2–12 знаков: буквы, цифры, пробел, дефис; хотя бы одна буква; края обрезаются', () => {
    expect(checkPlayerName('  Маша ')).toEqual({ ok: true, name: 'Маша' });
    expect(checkPlayerName('Игрок 2')).toEqual({ ok: true, name: 'Игрок 2' });
    expect(checkPlayerName('Анна-Мария')).toEqual({ ok: true, name: 'Анна-Мария' });
    expect(checkPlayerName('Я')).toEqual({ ok: false, error: 'short' });
    expect(checkPlayerName('   ')).toEqual({ ok: false, error: 'short' });
    expect(checkPlayerName('Александрина1')).toEqual({ ok: false, error: 'long' });
    expect(checkPlayerName('Маша!')).toEqual({ ok: false, error: 'chars' });
    expect(checkPlayerName('12')).toEqual({ ok: false, error: 'chars' });
    expect(checkPlayerName('Маша  Петя')).toEqual({ ok: false, error: 'spaces' });
  });

  it('имя другого игрока занято — без регистра и с Ё = Е; своё при переименовании — нет', () => {
    const list = [{ id: 'p1', name: 'Алёна' }];
    expect(checkPlayerName('алена', list)).toEqual({ ok: false, error: 'taken' });
    expect(checkPlayerName('АЛЁНА', list)).toEqual({ ok: false, error: 'taken' });
    expect(checkPlayerName('Алена', list, 'p1')).toEqual({ ok: true, name: 'Алена' });
  });
});

describe('разбор списка игроков', () => {
  it('круг «JSON → разбор» без потерь', () => {
    expect(parsePlayers(JSON.parse(JSON.stringify(two)), fallback)).toEqual(two);
  });

  it('мусор — пусто, без исключений', () => {
    for (const raw of [null, undefined, 'x', 5, [], true, { players: 'все' }, { players: [1, null, 'p1'] }]) {
      expect(parsePlayers(raw, fallback)).toEqual({ players: [], current: null, lastId: 0 });
    }
  });

  it('битые id и повторы выкидываются, первый остаётся', () => {
    const raw = {
      players: [
        { id: 'p1', name: 'Маша' },
        { id: 'p1', name: 'Двойник' },
        { id: '../x', name: 'Взлом' },
        { id: 'p0', name: 'Ноль' },
        { id: 7, name: 'Число' },
        { id: 'p3', name: 'Петя' },
      ],
      current: 'p3',
    };
    expect(parsePlayers(raw, fallback)).toEqual({
      players: [
        { id: 'p1', name: 'Маша' },
        { id: 'p3', name: 'Петя' },
      ],
      current: 'p3',
      lastId: 3,
    });
  });

  it('пустое, битое или повторное имя — запасное: игрок с сохранением не теряется', () => {
    const raw = {
      players: [
        { id: 'p1', name: '' },
        { id: 'p2', name: 'Маша' },
        { id: 'p3', name: 'маша' },
        { id: 'p4' },
      ],
    };
    expect(parsePlayers(raw, fallback).players.map((p) => p.name)).toEqual(['Игрок 1', 'Маша', 'Игрок 3', 'Игрок 4']);
    // Запасное имя не совпадает с настоящим.
    const taken = { players: [{ id: 'p1', name: 'Игрок 2' }, { id: 'p2', name: 5 }] };
    expect(parsePlayers(taken, fallback).players.map((p) => p.name)).toEqual(['Игрок 2', 'Игрок 3']);
  });

  it(`больше ${PLAYERS_MAX} — первые ${PLAYERS_MAX}`, () => {
    const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `Игрок ${i + 1}` }));
    const data = parsePlayers({ players, current: 'p6' }, fallback);
    expect(data.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(data.current).toBe('p1');
  });

  it('current не из списка — первый игрок', () => {
    for (const current of ['p9', null, 3, undefined]) expect(parsePlayers({ ...two, current }, fallback).current).toBe('p1');
  });

  it('список пропал или пуст — собирается из найденных сохранений', () => {
    const data = parsePlayers('{битый', fallback, ['p10', 'p2', 'мусор', 'p2']);
    expect(data).toEqual({
      players: [
        { id: 'p2', name: 'Игрок 1' },
        { id: 'p10', name: 'Игрок 2' },
      ],
      current: 'p2',
      lastId: 10,
    });
    // Список годный — найденные сохранения его не меняют.
    expect(parsePlayers(two, fallback, ['p7']).players).toEqual(two.players);
  });
});

describe('действия со списком', () => {
  it('новый игрок: id больше всех, в конец и выбран; полон или имя не годится — null', () => {
    expect(nextPlayerId({ players: [], current: null, lastId: 0 })).toBe('p1');
    expect(nextPlayerId({ players: [{ id: 'p3', name: 'А' }, { id: 'p1', name: 'Б' }], current: null, lastId: 0 })).toBe('p4');
    const added = addPlayer(two, ' Ваня ');
    expect(added).toEqual({
      id: 'p3',
      data: { players: [...two.players, { id: 'p3', name: 'Ваня' }], current: 'p3', lastId: 3 },
    });
    expect(addPlayer(two, 'маша')).toBeNull();
    expect(addPlayer(two, 'Я')).toBeNull();
    let full: PlayersData = two;
    for (const name of ['Ваня', 'Папа']) full = addPlayer(full, name)?.data ?? full;
    expect(full.players).toHaveLength(PLAYERS_MAX);
    expect(addPlayer(full, 'Мама')).toBeNull();
  });

  it('id удалённого не выдаётся снова — даже когда удалили последнего по номеру', () => {
    const full = ['Ваня', 'Папа'].reduce((d, name) => addPlayer(d, name)?.data ?? d, two);
    const without = removePlayer(full, 'p4');
    expect(addPlayer(without, 'Петя2')?.id).toBe('p5');
    // Номер переживает запись и разбор списка.
    const parsed = parsePlayers(JSON.parse(JSON.stringify(without)), fallback);
    expect(addPlayer(parsed, 'Петя2')?.id).toBe('p5');
    // Битый номер в списке не опускает счёт ниже живых и найденных сохранений.
    expect(parsePlayers({ ...without, lastId: -5 }, fallback, ['p6']).lastId).toBe(6);
    expect(parsePlayers({ ...without, lastId: 'много' }, fallback).lastId).toBe(3);
  });

  it('удалить: выбранного — выбор на первого; последнего и чужого не удалить', () => {
    expect(removePlayer(two, 'p2')).toEqual({ players: [two.players[0]], current: 'p1', lastId: 2 });
    expect(removePlayer(two, 'p1')).toEqual({ players: [two.players[1]], current: 'p2', lastId: 2 });
    expect(removePlayer(two, 'p9')).toBe(two);
    const one = removePlayer(two, 'p2');
    expect(removePlayer(one, 'p1')).toBe(one);
  });

  it('переименовать и выбрать; не годится — список как был', () => {
    expect(renamePlayer(two, 'p1', 'Мария').players[0]).toEqual({ id: 'p1', name: 'Мария' });
    expect(renamePlayer(two, 'p1', 'Петя')).toBe(two);
    expect(renamePlayer(two, 'p9', 'Ваня')).toBe(two);
    expect(selectPlayer(two, 'p1').current).toBe('p1');
    expect(selectPlayer(two, 'p9')).toBe(two);
  });

  it('кто играет во вкладке: выбранный в ней; один игрок — он; двое без выбора — никто', () => {
    expect(tabPlayer(two, 'p1')).toBe('p1');
    expect(tabPlayer(two, null)).toBeNull();
    expect(tabPlayer(two, 'p9')).toBeNull();
    expect(tabPlayer(removePlayer(two, 'p2'), null)).toBe('p1');
  });

  it('действия не меняют исходный список', () => {
    const before = JSON.parse(JSON.stringify(two)) as PlayersData;
    addPlayer(two, 'Ваня');
    removePlayer(two, 'p1');
    renamePlayer(two, 'p1', 'Мария');
    selectPlayer(two, 'p1');
    expect(two).toEqual(before);
  });
});

describe('план первого запуска', () => {
  const none = { list: undefined, shared: undefined, savedIds: [] };

  it('общая часть уже есть — не перезаписывается; нет — пустая', () => {
    expect(planStart({ ...none, shared: { clock: {} } }, fallback).shared).toBeNull();
    expect(planStart(none, fallback).shared).toEqual(emptyShared());
  });

  it('список есть — по нему; годный список не переписываем', () => {
    const plan = planStart({ ...none, list: two, shared: emptyShared(), savedIds: ['p1', 'p2'] }, fallback);
    expect(plan).toEqual({ data: two, shared: null, writeList: false });
    const fixed = planStart({ ...none, list: { ...two, current: 'p9' }, shared: emptyShared() }, fallback);
    expect([fixed.data.current, fixed.writeList]).toEqual(['p1', true]);
  });

  it('список битый — собирается из сохранений; ничего нет — первый игрок с чистого листа', () => {
    const rebuilt = planStart({ ...none, list: null, savedIds: ['p2'] }, fallback);
    expect([rebuilt.data.players, rebuilt.writeList]).toEqual([[{ id: 'p2', name: 'Игрок 1' }], true]);
    const fresh = planStart(none, fallback);
    expect(fresh).toEqual({
      data: { players: [{ id: 'p1', name: 'Игрок 1' }], current: 'p1', lastId: 1 },
      shared: emptyShared(),
      writeList: true,
    });
  });

  it('общая часть: свой формат, старое сохранение и мусор', () => {
    const clock = { lastAction: 1_800_000_000_000, sinceBreak: 120_000, breakDue: false, breakUntil: 1_800_000_300_000 };
    const own = { clock, breakSettings: { enabled: false, playMinutes: 10, breakMinutes: 3 } };
    expect(parseShared(JSON.parse(JSON.stringify(own)))).toEqual(own);
    for (const raw of [null, 'x', [], 5]) expect(parseShared(raw)).toEqual(emptyShared());
    expect(parseShared({ clock: { sinceBreak: 'долго' }, breakSettings: 'off' })).toEqual(emptyShared());
  });
});

describe('freshPlayers: список перед записью', () => {
  const fb = (n: number) => `Игрок ${n}`;
  it('не объект, без массива или пустой — null: из ключей сохранений список не собирается', () => {
    for (const raw of [undefined, null, 'x', 5, [], {}, { players: 'x' }, { players: [] }, { players: [{ id: 'bad', name: 'Маша' }] }]) {
      expect(freshPlayers(raw, fb, ['p1', 'p2'])).toBeNull();
    }
  });

  it('имена из списка; lastId не меньше номеров ключей сохранений', () => {
    const raw = { players: [{ id: 'p1', name: 'Маша' }], current: 'p1', lastId: 1 };
    expect(freshPlayers(raw, fb, ['p1', 'p5', 'p5.reset.1'])).toEqual({ ...raw, lastId: 5 });
  });
});
