/**
 * К3 (065 Т3): журнал ≤ 100 матчей, повтор matchId перезаписывает, отказ хранилища игру не роняет (адаптер в памяти, 065-Р14).
 */
import { describe, expect, it } from 'vitest';
import { exportJournal, JOURNAL_LIMIT, matchIdOf, overflow, ownEntries, parseEntry, speedsOf } from '../../src/engine/journal';
import { createJournal, lazyDb, memoryDb, openIdb, type JournalDb } from '../../src/app/journal';
import { createCrash } from '../../src/app/crash/crash';
import { journalDbName } from '../../src/app/save/storage';
import { prefix } from '../../src/engine/release/keys';

const rec = (seed: number) => ({ seed, events: [{ type: 'tick' as const, t: seed }] });

describe('К3 журнал матчей', () => {
  it('предел — 100, старые вытесняются', async () => {
    const db = memoryDb();
    let t = 0;
    const j = createJournal({ db, now: () => ++t, onFail: () => undefined });
    for (let i = 0; i < JOURNAL_LIMIT + 5; i++) await j.put(`m${i}`, rec(i));
    const all = await j.all();
    expect(all).toHaveLength(JOURNAL_LIMIT);
    expect(all[0]?.matchId).toBe('m5');
    expect(all.at(-1)?.matchId).toBe(`m${JOURNAL_LIMIT + 4}`);
  });

  it('тот же matchId перезаписывает запись и обновляет порядок', async () => {
    let t = 0;
    const j = createJournal({ db: memoryDb(), now: () => ++t, onFail: () => undefined });
    await j.put('a', rec(1));
    await j.put('b', rec(2));
    await j.put('a', rec(3));
    const all = await j.all();
    expect(all.map((e) => [e.matchId, e.seed])).toEqual([['b', 2], ['a', 3]]);
  });

  it('отказ хранилища не бросает: false, пустой список, сообщение в onFail', async () => {
    const boom: JournalDb = {
      all: () => Promise.reject(new Error('quota')),
      put: () => Promise.reject(new Error('quota')),
      remove: () => Promise.reject(new Error('quota')),
    };
    const fails: unknown[] = [];
    const j = createJournal({ db: boom, now: () => 1, onFail: (e) => fails.push(e) });
    expect(await j.put('a', rec(1))).toBe(false);
    expect(await j.all()).toEqual([]);
    expect(fails).toHaveLength(2);
  });

  it('IndexedDB нет (db: null) — тихо, без сообщений', async () => {
    const fails: unknown[] = [];
    const j = createJournal({ db: null, now: () => 1, onFail: (e) => fails.push(e) });
    expect(await j.put('a', rec(1))).toBe(false);
    expect(await j.all()).toEqual([]);
    expect(fails).toEqual([]);
  });

  it('битые строки в хранилище не попадают в выгрузку', () => {
    expect(parseEntry({ matchId: 'x', seed: 1, events: 'нет', at: 1 })).toBeNull();
    expect(exportJournal([null, 5, { matchId: 'x', seed: 1, events: [], at: 2 }])).toHaveLength(1);
    expect(overflow([], 3)).toEqual([]);
  });
});

describe('К3 подключение к приложению (065-Т3б)', () => {
  it('отказ открытия базы: onFail пишет в журнал событий без окна сбоя', async () => {
    const crash = createCrash({ now: () => 7, origin: 'https://x', goHome: () => undefined });
    let shown = 0;
    crash.setPresenter(() => shown++);
    const db = lazyDb(() => Promise.reject(new Error('quota')));
    const j = createJournal({ db, now: () => 1, onFail: (err) => crash.note('journal', err) });
    await j.put('m1', rec(1));
    expect(await j.all()).toEqual([]);
    expect(crash.events().map((e) => [e.kind, e.text])).toEqual([['journal', 'quota'], ['journal', 'quota']]);
    expect(crash.crashed()).toBe(false);
    expect(shown).toBe(0);
  });

  it('нет IndexedDB: журнал молчит, без сбоя', async () => {
    const fails: unknown[] = [];
    const j = createJournal({ db: lazyDb(() => openIdb(null, 'x')), now: () => 1, onFail: (e) => fails.push(e) });
    await j.put('m1', rec(1));
    expect(fails).toEqual([]);
  });

  it('имя базы зависит от мажора и канала так же, как префикс ключей', () => {
    expect(journalDbName(2, 'release')).toBe(`${prefix(2, 'release')}journal`);
    expect(journalDbName(2, 'next')).toBe(`${prefix(2, 'next')}journal`);
    expect(journalDbName(3, 'release')).not.toBe(journalDbName(2, 'release'));
    expect(journalDbName(2, 'next')).not.toBe(journalDbName(2, 'release'));
  });
});

describe('К4 (067 Т17): скорости матчей из журнала для ставки учебных игр', () => {
  const e = (matchId: string, at: number, cpm?: number) => ({ matchId, seed: 1, events: [], at, ...(cpm === undefined ? {} : { cpm }) });
  it('К4: журнал хранит скорость записи (`put` с `cpm` → `all()` отдаёт `cpm`); без скорости поля нет', async () => {
    // Ловит: `put` не кладёт `cpm` в запись — скорости матчей не доезжают до ставки учебных игр.
    let t = 0;
    const j = createJournal({ db: memoryDb(), now: () => ++t, onFail: () => undefined });
    await j.put('m-p1-1', { ...rec(1), cpm: 47 });
    await j.put('m-p1-2', rec(2));
    const all = await j.all();
    expect(all.find((x) => x.matchId === 'm-p1-1')?.cpm).toBe(47);
    expect(all.find((x) => x.matchId === 'm-p1-2')).not.toHaveProperty('cpm');
  });

  it('К4: ownEntries — журнал один на устройство, берутся записи только этого игрока; matchIdOf строит тот же id, что ищет фильтр', () => {
    // Ловит: ставка Ани считается по скоростям Бори; фильтр по префиксу «p1» цепляет игрока «p10».
    const list = [e('m-p1-100', 1, 30), e('m-p2-200', 2, 90), e('m-p10-300', 3, 70), e(matchIdOf('p1', 400), 4, 50)];
    expect(ownEntries(list, 'p1').map((x) => x.matchId)).toEqual(['m-p1-100', 'm-p1-400']);
    expect(speedsOf(ownEntries(list, 'p2'))).toEqual([90]);
    expect(ownEntries(list, 'p3')).toEqual([]);
  });

  it('К4: speedsOf — старые первыми, без скорости и нулевые пропускаются; parseEntry скорость не теряет', () => {
    // Ловит: скорость не доезжает до ставки (parseEntry выбрасывает поле), порядок «новые первыми» ломает «3 последних», нулевая скорость тянет медиану вниз.
    const list = [e('b', 20, 40), e('a', 10, 30), e('old', 5), e('zero', 25, 0), e('c', 30, 50)];
    expect(speedsOf(list)).toEqual([30, 40, 50]);
    expect(parseEntry(e('x', 1, 33))?.cpm).toBe(33);
    expect(parseEntry({ ...e('x', 1), cpm: 'много' })?.cpm).toBeUndefined();
    expect(exportJournal([e('m', 1, 44)])[0]?.cpm).toBe(44);
  });
});
