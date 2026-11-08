/**
 * Игроки через обёртку app/ (players/list, players/active, roster): свой прогресс
 * у каждого, общий перерыв, карточки. Подготовка — tests/playersHelpers.ts (хранилище в памяти, перезагрузка модулей).
 * Две вкладки — tests/players-tabs.test.ts. Чистые правила списка — tests/players.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHARED_KEY, saveKey } from '../src/app/storage';
import { parseShared } from '../src/engine/session';
import { T0, boot, clubAt, clubOf, coinsOf, fakeStorage, json, setClub } from './playersHelpers';

describe('обёртка: игроки, перенос и общий перерыв', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('у каждого свой прогресс; смена без перезагрузки; двое — нужен выбор во вкладке', async () => {
    const local = fakeStorage();
    let p = await boot(local);
    setClub(p, 'Гром', 4);
    const first = p.activeId() ?? '';
    expect(p.createPlayer('Петя', true)).toBe('p2');
    expect([p.activeId(), clubOf(p), coinsOf(p)]).toEqual(['p2', '', 0]);
    setClub(p, 'Ракета');
    p.choosePlayer(first);
    expect([clubOf(p), coinsOf(p)]).toEqual(['Гром', 4]);
    expect(clubAt(local, saveKey('p2'))).toBe('Ракета');
    // Новая вкладка (пустой sessionStorage): двое — спросить; эта вкладка помнит свой выбор.
    vi.resetModules();
    p = await boot(local);
    expect(p.needsChoice.value).toBe(true);
    p.choosePlayer('p2');
    expect([p.needsChoice.value, p.playerName.value, clubOf(p)]).toEqual([false, 'Петя', 'Ракета']);
  });

  it('перерыв общий: смена игрока его не снимает и не обнуляет счёт', async () => {
    const local = fakeStorage();
    const p = await boot(local);
    p.setBreakSettings({ enabled: true, playMinutes: 10, breakMinutes: 5 });
    for (let i = 0; i <= 10; i++) p.noteAction(T0 + i * 30_000, '2026-11-04');
    const since = p.shared.clock.sinceBreak;
    expect(since).toBe(300_000);
    p.createPlayer('Петя', true);
    expect(p.shared.clock.sinceBreak).toBe(since);
    for (let i = 11; i <= 21; i++) p.noteAction(T0 + i * 30_000, '2026-11-04');
    expect(p.shared.clock.breakDue).toBe(true);
    p.beginDueBreak(T0 + 700_000);
    p.choosePlayer('p1');
    expect(p.shared.clock.breakUntil).toBe(T0 + 700_000 + 300_000);
    expect(parseShared(json(local, SHARED_KEY)).clock.breakUntil).toBe(T0 + 1_000_000);
  });

  it('удалить игрока: список и ключ; играл во вкладке — выбор снят; последнего не удалить', async () => {
    const local = fakeStorage();
    const p = await boot(local);
    p.createPlayer('Петя', false);
    // Добавили второго со страницы родителя — вкладка так и играет за первого, без вопроса.
    expect([p.needsChoice.value, p.playerName.value]).toEqual([false, 'Игрок 1']);
    p.createPlayer('Ваня', true);
    setClub(p, 'Ракета');
    expect(local.data.has(saveKey('p3'))).toBe(true);
    expect(p.deletePlayer('p3')).toBe(true);
    expect(local.data.has(saveKey('p3'))).toBe(false);
    expect(p.players.players.map((x) => x.id)).toEqual(['p1', 'p2']);
    expect([p.needsChoice.value, clubOf(p)]).toEqual([true, '']);
    expect(p.deletePlayer('p2')).toBe(true);
    expect(p.needsChoice.value).toBe(false);
    expect(p.deletePlayer('p1')).toBe(false);
  });

  it('сброс — только выбранного игрока; другой и перерыв не меняются', async () => {
    const local = fakeStorage();
    const p = await boot(local);
    setClub(p, 'Гром');
    p.setBreakSettings({ enabled: false, playMinutes: 20, breakMinutes: 3 });
    p.createPlayer('Петя', true);
    setClub(p, 'Ракета');
    p.resetPlayer('p1');
    // Сброс — чистый конверт с rev + 1 и копия «до» (design §5), а не удаление ключа.
    expect(clubAt(local, saveKey('p1'))).toBe('');
    expect([...local.data.keys()].some((k) => k.includes('.reset.'))).toBe(true);
    expect(clubOf(p)).toBe('Ракета');
    expect((p.peekSave('p1').club as { name: string }).name).toBe('');
    expect(p.shared.breakSettings.enabled).toBe(false);
  });

  it('имя нового игрока: ошибки; полный список — не создать', async () => {
    const p = await boot(fakeStorage());
    expect(p.newNameError('Игрок 1')).toBe('taken');
    expect(p.newNameError('Я')).toBe('short');
    for (const name of ['Петя', 'Ваня', 'Папа']) expect(p.createPlayer(name, false)).not.toBeNull();
    expect(p.createPlayer('Мама', false)).toBeNull();
    expect(p.renamePlayer('p1', 'Маша')).toBe(true);
    expect(p.renameError('p2', 'маша')).toBe('taken');
    expect(p.players.players[0]?.name).toBe('Маша');
  });

  // Ловит: сохранение новее программы — а запуск пишет список игроков и общую часть (мутант «readOnly && false» в players.ts).
  it('старт с сохранением новее: список и перерыв побайтно прежние, сброс отказывает', async () => {
    const future = JSON.stringify({ format: 0, draft: 99, rev: 5, app: '9', sections: { wallet: {} } });
    const init = { [saveKey('p1')]: future };
    const local = fakeStorage(init);
    const p = await boot(local);
    // Решение 014-Р17: список не лёг (только чтение) — правка не применена, игрока нет.
    expect(p.createPlayer('Петя', false)).toBeNull();
    expect(p.players.players).toHaveLength(1);
    expect(p.resetPlayer('p1')).toBe(false);
    expect(Object.fromEntries(local.data)).toEqual(init);
  });

});

describe('карточки «Кто играет?»: клуб и урок из разделов v2 (019-Т13)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      data,
      get length() {
        return data.size;
      },
      key: (i: number) => [...data.keys()][i] ?? null,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  }

  it('lessonNumber: место урока курса с единицы; пустой и незнакомый — первый', async () => {
    const { lessonNumber } = await import('../src/app/players/cards');
    const ids = ['a', 'b', 'c'];
    expect([lessonNumber('a', ids), lessonNumber('c', ids), lessonNumber('', ids), lessonNumber('zzz', ids)]).toEqual([1, 3, 1, 1]);
  });

  it('у игрока с клубом — его название, форма и урок; у нового — «клуб не создан» и первый урок', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    const roster = await import('../src/app/roster');
    const club = await import('../src/app/club/club');
    const sections = await import('../src/app/save/sections');
    const { section: courseSection } = await import('../src/engine/course/save');
    const { courseLessons } = await import('../src/app/course/load');
    const { playerCards } = await import('../src/app/players/cards');
    const second = courseLessons[1]?.id ?? '';
    expect(second).not.toBe('');

    const kit = { pattern: 'plain', body: '#000000', sleeves: '#ffffff', trim: '#ffffff' } as const;
    expect(club.createClubNow({ name: 'Гром', kit, city: 'Тверь' }).created).toBe(true);
    sections.updatePlayer((tx) => void tx.set(courseSection, { ...tx.get(courseSection), lesson: second }));
    expect(roster.createPlayer('Петя', true)).toBe('p2');

    const [first, petya] = playerCards();
    expect([first?.club, first?.kit?.name, first?.lesson, first?.playing]).toEqual(['Гром', 'Гром', 2, false]);
    expect([petya?.name, petya?.club, petya?.kit, petya?.lesson, petya?.playing]).toEqual(['Петя', null, null, 1, true]);
  });
});
