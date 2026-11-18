/**
 * К3 (065 Т3): журнал ≤ 100 матчей, повтор matchId перезаписывает, отказ хранилища игру не роняет (адаптер в памяти, 065-Р14).
 */
import { describe, expect, it } from 'vitest';
import { exportJournal, JOURNAL_LIMIT, overflow, parseEntry } from '../../src/engine/journal';
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
