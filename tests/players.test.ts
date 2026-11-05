/**
 * Игроки на одном компьютере: разбор списка не теряет сохранений, имена проверяются,
 * первый запуск переносит старое сохранение; через обёртку — у каждого свой прогресс,
 * перерыв общий. Отдельный файл: другая подготовка — хранилище с перечислением ключей
 * и sessionStorage вкладки.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PLAYERS_MAX,
  addPlayer,
  checkPlayerName,
  nextPlayerId,
  parsePlayers,
  planStart,
  removePlayer,
  renamePlayer,
  selectPlayer,
  tabPlayer,
  type PlayersData,
} from '../src/engine/players';
import { emptySave, parseSave } from '../src/engine/save';
import { emptyShared, parseShared } from '../src/engine/session';
import { emptyStats } from '../src/engine/typing';

const fallback = (n: number) => `Игрок ${n}`;

/** Сохранение одного игрока (до 04.11): поля days ещё не было, время — в session.days. */
function legacySave(patch: Record<string, unknown>): Record<string, unknown> {
  const { days, ...rest } = emptySave();
  expect(days).toEqual({});
  return { ...rest, ...patch };
}
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
  const club = { name: 'Метеор', kit: { pattern: 'plain', body: '#000000', sleeves: '#ffffff', trim: '#ffffff' } };
  const clock = { lastAction: 1_800_000_000_000, sinceBreak: 120_000, breakDue: false, breakUntil: 1_800_000_300_000 };
  const breakSettings = { enabled: true, playMinutes: 20, breakMinutes: 10 };
  const legacy = legacySave({
    club: { ...club, shirtName: 'Илья' },
    goals: 9,
    session: { days: { '2026-11-04': 60_000 }, ...clock },
    breakSettings,
  });
  const none = { list: undefined, legacy: undefined, shared: undefined, savedIds: [] };

  it('старое сохранение — первый игрок с именем со спины; перерыв и настройки — в общую часть', () => {
    const plan = planStart({ ...none, legacy }, fallback);
    expect(plan.data).toEqual({ players: [{ id: 'p1', name: 'Илья' }], current: 'p1', lastId: 1 });
    expect(plan.moveLegacyTo).toBe('p1');
    expect(plan.writeList).toBe(true);
    expect(plan.shared).toEqual({ clock, breakSettings });
    // Перенесённое как есть читается новым форматом: время по дням и прогресс на месте.
    const moved = parseSave(JSON.parse(JSON.stringify(legacy)));
    expect([moved.goals, moved.days]).toEqual([9, { '2026-11-04': 60_000 }]);
  });

  it('старое сохранение без имени на спине (или с битым) — «Игрок 1»', () => {
    expect(planStart({ ...none, legacy: { ...legacy, club } }, fallback).data.players[0]?.name).toBe('Игрок 1');
    expect(planStart({ ...none, legacy: '{битое' }, fallback).data.players[0]?.name).toBe('Игрок 1');
  });

  it('общая часть уже есть — не перезаписывается', () => {
    expect(planStart({ ...none, legacy, shared: { clock: {} } }, fallback).shared).toBeNull();
  });

  it('список есть — по нему; старое сохранение не трогаем; годный список не переписываем', () => {
    const plan = planStart({ ...none, list: two, legacy, shared: emptyShared(), savedIds: ['p1', 'p2'] }, fallback);
    expect(plan).toEqual({ data: two, moveLegacyTo: null, shared: null, writeList: false });
    const fixed = planStart({ ...none, list: { ...two, current: 'p9' }, shared: emptyShared() }, fallback);
    expect([fixed.data.current, fixed.writeList]).toEqual(['p1', true]);
  });

  it('список битый — собирается из сохранений; ничего нет — первый игрок с чистого листа', () => {
    const rebuilt = planStart({ ...none, list: null, savedIds: ['p2'] }, fallback);
    expect([rebuilt.data.players, rebuilt.moveLegacyTo, rebuilt.writeList]).toEqual([
      [{ id: 'p2', name: 'Игрок 1' }],
      null,
      true,
    ]);
    const fresh = planStart(none, fallback);
    expect(fresh).toEqual({
      data: { players: [{ id: 'p1', name: 'Игрок 1' }], current: 'p1', lastId: 1 },
      moveLegacyTo: null,
      shared: emptyShared(),
      writeList: true,
    });
  });

  it('общая часть: свой формат, старое сохранение и мусор', () => {
    const own = { clock, breakSettings: { enabled: false, playMinutes: 10, breakMinutes: 3 } };
    expect(parseShared(JSON.parse(JSON.stringify(own)))).toEqual(own);
    for (const raw of [null, 'x', [], 5]) expect(parseShared(raw)).toEqual(emptyShared());
    expect(parseShared({ clock: { sinceBreak: 'долго' }, breakSettings: 'off' })).toEqual(emptyShared());
  });
});

describe('обёртка: игроки, перенос и общий перерыв', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /** Хранилище в памяти с перечислением ключей; failKey — запись этого ключа бросает (переполнение). */
  function fakeStorage(initial: Record<string, string> = {}, failKey = '') {
    const data = new Map(Object.entries(initial));
    return {
      data,
      get length() {
        return data.size;
      },
      key: (i: number) => [...data.keys()][i] ?? null,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (k === failKey) throw new Error('QuotaExceededError');
        data.set(k, v);
      },
      removeItem: (k: string) => void data.delete(k),
    };
  }

  const KIT = { pattern: 'plain', body: '#000000', sleeves: '#ffffff', trim: '#ffffff' } as const;
  const T0 = 1_800_000_000_000;

  async function boot(local: ReturnType<typeof fakeStorage>, tab = fakeStorage()) {
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', tab);
    const players = await import('../src/app/players');
    const progress = await import('../src/app/progress');
    const roster = await import('../src/app/roster');
    return { ...players, ...progress, ...roster };
  }

  const json = (s: ReturnType<typeof fakeStorage>, key: string) => JSON.parse(s.data.get(key) ?? 'null') as unknown;

  it('перенос: старое сохранение — первый игрок, ключ перенесён, старый удалён, перерыв сохранился', async () => {
    const legacy = legacySave({
      club: { name: 'Метеор', kit: KIT, shirtName: 'Илья' },
      goals: 5,
      session: { days: { '2026-11-04': 60_000 }, lastAction: T0, sinceBreak: 0, breakDue: false, breakUntil: T0 + 1 },
    });
    const local = fakeStorage({ 'keykick.save': JSON.stringify(legacy) });
    const p = await boot(local);
    expect(p.players.players).toEqual([{ id: 'p1', name: 'Илья' }]);
    expect(local.data.has('keykick.save')).toBe(false);
    expect(parseSave(json(local, 'keykick.save.p1')).goals).toBe(5);
    expect(p.progress.goals).toBe(5);
    expect(p.progress.days).toEqual({ '2026-11-04': 60_000 });
    expect(p.shared.clock.breakUntil).toBe(T0 + 1);
    // Один игрок — «Кто играет?» не нужен.
    expect(p.needsChoice.value).toBe(false);
    // Перезагрузка: переноса больше нет, всё на месте.
    vi.resetModules();
    const again = await boot(local);
    expect(again.progress.goals).toBe(5);
    expect(again.players.players).toHaveLength(1);
  });

  it('перенос не записался — старое сохранение остаётся и переносится при следующем запуске', async () => {
    const local = fakeStorage({ 'keykick.save': JSON.stringify(legacySave({ goals: 3 })) }, 'keykick.players');
    await boot(local);
    expect(local.data.has('keykick.save')).toBe(true);
    vi.resetModules();
    const healthy = fakeStorage(Object.fromEntries(local.data));
    const p = await boot(healthy);
    expect(healthy.data.has('keykick.save')).toBe(false);
    expect(p.progress.goals).toBe(3);
  });

  it('у каждого свой прогресс; смена без перезагрузки; двое — нужен выбор во вкладке', async () => {
    const local = fakeStorage();
    let p = await boot(local);
    p.setClub({ name: 'Гром', kit: KIT });
    p.recordHalf({ lessonId: p.currentLesson().id, stars: 3, goals: 4, stats: emptyStats });
    const first = p.activeId() ?? '';
    expect(p.createPlayer('Петя', true)).toBe('p2');
    expect([p.activeId(), p.progress.club, p.progress.goals, p.progress.lessonIndex]).toEqual(['p2', null, 0, 0]);
    expect(p.clubFirst()).toBe('/club');
    p.setClub({ name: 'Ракета', kit: KIT });
    p.choosePlayer(first);
    expect([p.progress.club?.name, p.progress.goals, p.progress.lessonIndex]).toEqual(['Гром', 4, 1]);
    expect(parseSave(json(local, 'keykick.save.p2')).club?.name).toBe('Ракета');
    // Новая вкладка (пустой sessionStorage): двое — спросить; эта вкладка помнит свой выбор.
    vi.resetModules();
    p = await boot(local);
    expect(p.needsChoice.value).toBe(true);
    p.choosePlayer('p2');
    expect([p.needsChoice.value, p.playerName.value, p.progress.club?.name]).toEqual([false, 'Петя', 'Ракета']);
  });

  it('перерыв общий: смена игрока его не снимает и не обнуляет счёт; время по дням — своё', async () => {
    const local = fakeStorage();
    const p = await boot(local);
    p.setBreakSettings({ enabled: true, playMinutes: 10, breakMinutes: 5 });
    for (let i = 0; i <= 10; i++) p.noteAction(T0 + i * 30_000, '2026-11-04');
    const since = p.shared.clock.sinceBreak;
    expect(since).toBe(300_000);
    p.createPlayer('Петя', true);
    expect(p.shared.clock.sinceBreak).toBe(since);
    expect(p.progress.days).toEqual({});
    for (let i = 11; i <= 21; i++) p.noteAction(T0 + i * 30_000, '2026-11-04');
    expect(p.shared.clock.breakDue).toBe(true);
    // Промежуток от последнего действия первого игрока до первого действия Пети — уже Петин: 11 по 30 с.
    expect(p.progress.days['2026-11-04']).toBe(330_000);
    p.beginDueBreak(T0 + 700_000);
    p.choosePlayer('p1');
    expect(p.shared.clock.breakUntil).toBe(T0 + 700_000 + 300_000);
    expect(p.progress.days['2026-11-04']).toBe(300_000);
    expect(parseShared(json(local, 'keykick.session')).clock.breakUntil).toBe(T0 + 1_000_000);
  });

  it('удалить игрока: список и ключ; играл во вкладке — выбор снят; последнего не удалить', async () => {
    const local = fakeStorage();
    const p = await boot(local);
    p.createPlayer('Петя', false);
    // Добавили второго со страницы родителя — вкладка так и играет за первого, без вопроса.
    expect([p.needsChoice.value, p.playerName.value]).toEqual([false, 'Игрок 1']);
    p.createPlayer('Ваня', true);
    p.setClub({ name: 'Ракета', kit: KIT });
    expect(local.data.has('keykick.save.p3')).toBe(true);
    expect(p.deletePlayer('p3')).toBe(true);
    expect(local.data.has('keykick.save.p3')).toBe(false);
    expect(p.players.players.map((x) => x.id)).toEqual(['p1', 'p2']);
    expect([p.needsChoice.value, p.progress.club]).toEqual([true, null]);
    expect(p.deletePlayer('p2')).toBe(true);
    expect(p.needsChoice.value).toBe(false);
    expect(p.deletePlayer('p1')).toBe(false);
  });

  it('сброс — только выбранного игрока; другой и перерыв не меняются', async () => {
    const local = fakeStorage();
    const p = await boot(local);
    p.setClub({ name: 'Гром', kit: KIT });
    p.setBreakSettings({ enabled: false, playMinutes: 20, breakMinutes: 3 });
    p.createPlayer('Петя', true);
    p.setClub({ name: 'Ракета', kit: KIT });
    p.resetPlayer('p1');
    expect(local.data.has('keykick.save.p1')).toBe(false);
    expect(p.progress.club?.name).toBe('Ракета');
    expect(p.peekSave('p1').club).toBeNull();
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
});
