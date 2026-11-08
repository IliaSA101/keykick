// Журнал игры: файл выгрузки и загрузка (018-Т4, 018-Р24; крючок 014). Журнал читается по требованию, не из кэша.
import { describe, expect, it } from 'vitest';
import { createJournal } from '../src/app/journal/journal';
import { memoryBackend } from '../src/app/journal/memory';
import { createBackup, type BackupOptions } from '../src/app/save/backup';
import { T0, bulkDays, device, prepare } from './backupHelpers';
import { mdata } from './journalHelpers';
import { PROBES } from './saveFixtures';
import { NEXT, ctx, onProbe } from './saveStoreHelpers';

type Hooks = Pick<BackupOptions, 'journal' | 'importJournal'>;

/** Выгрузка на «устройстве» `d` с журнальными крючками `hooks`; отданные файлы копятся в `files`. */
function backupWith(d: ReturnType<typeof device>, hooks: Hooks) {
  const files: string[] = [];
  const backup = createBackup({
    store: d.store,
    io: d.mem.io,
    prefix: NEXT,
    channel: 'next',
    major: 0,
    app: '0.10.1',
    browser: () => 'test',
    now: () => T0,
    today: () => '2026-11-08',
    sections: PROBES,
    ctx,
    deliver: (_name, text) => void files.push(text),
    log: () => undefined,
    events: () => [],
    ...hooks,
  });
  return { backup, files };
}

const liveJournal = () => createJournal({ open: () => Promise.resolve(memoryBackend()), now: () => 1000, app: 't', tab: 'aaaa', onStorage: () => undefined });

describe('журнал: файл выгрузки (крючок 014)', () => {
  it('журнал уходит в файл, а при загрузке отдаётся на слияние игрокам, чьё сохранение загружено; страница ждёт journalDone', async () => {
    // Ловит: журнал не доехал в файл; слияние зовётся без игроков (чужой журнал затёр бы лежащий) или не зовётся;
    // applyBackup не отдаёт обещание слияния — страница перезагрузится раньше, чем журнал запишется.
    const d = device();
    d.seed([['p1', 'Аня']], { p1: 3 });
    const dump = { jv: 1, records: [], keys: [] };
    const merged: Array<[unknown, string[]]> = [];
    const { backup } = backupWith(d, {
      journal: () => Promise.resolve(dump),
      importJournal: (j, players) => {
        merged.push([j, players]);
        return Promise.resolve(7);
      },
    });
    const text = (await backup.downloadBackup()).text;
    expect((JSON.parse(text) as { journal: unknown }).journal).toEqual(dump);
    const r = backup.applyBackup(await prepare(d, text));
    expect(r.ok).toBe(true);
    expect(merged).toEqual([[dump, ['p1']]]);
    expect(r.ok && (await r.journalDone)).toBe(7);
  });

  it('первая выгрузка сразу после старта несёт журнал (без кэша и ожидания простоя)', async () => {
    // Ловит: кэш выгрузки, который наполняется через 30 с — файл, снятый сразу после старта, без журнала.
    const d = device();
    d.seed([['p1', 'Аня']], { p1: 3 });
    const j = liveJournal();
    j.log([{ kind: 'match', id: 'p1.m', data: mdata('win', 3) }], 'p1');
    const { backup } = backupWith(d, { journal: (p) => j.dump(p) });
    const file = JSON.parse((await backup.downloadBackup()).text) as { journal: { records: Array<{ id: string }> } | null };
    expect(file.journal?.records.map((r) => r.id)).toEqual(['p1.m']);
  });

  it('файл-копия одного игрока несёт журнал только этого игрока', async () => {
    // Ловит: в копию p1 попал журнал p2 (чужая история — в файле, который папа отдаёт одному ребёнку) или журнала нет вовсе.
    const d = device();
    d.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 3, p2: 4 });
    d.store.reset('p1');
    const copy = [...d.mem.data.keys()].find((k) => k.startsWith(`${NEXT}pre.p1.reset.`));
    expect(copy).toBeDefined();
    const j = liveJournal();
    j.log([{ kind: 'coin', data: {} }], 'p1');
    j.log([{ kind: 'coin', data: {} }], 'p2');
    const { backup } = backupWith(d, { journal: (p) => j.dump(p) });
    const out = await backup.downloadCopy((copy ?? '').slice(NEXT.length));
    const file = JSON.parse(out?.text ?? 'null') as { journal: { records: Array<{ player: string }> } | null };
    expect(file.journal?.records.map((r) => r.player)).toEqual(['p1']);
  });

  it('журнал отказал при выгрузке: файл отдаётся, журнал в нём null', async () => {
    // Ловит: сбой журнала лишает папу файла сохранения.
    const d = device();
    d.seed([['p1', 'Аня']], { p1: 3 });
    const { backup, files } = backupWith(d, { journal: () => Promise.reject(new Error('idb')) });
    await backup.downloadBackup();
    expect(files).toHaveLength(1);
    expect((JSON.parse(files[0] ?? '{}') as { journal: unknown }).journal).toBeNull();
  });
  it('частичная загрузка (второй игрок не влез): журнал слит только для загруженного, журнал не загруженного — нет', async () => {
    // Ловит: загруженный игрок остаётся без журнала (отказ на втором — слияние пропущено) или слит журнал не загруженного.
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 9, p2: 7 });
    const text = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 1, p2: 2 });
    b.store.update('p2', onProbe((x) => ({ ...x, days: bulkDays(300) })));
    const prepared = await prepare(b, text);
    b.mem.state.quota = b.mem.used() + 3000;
    const merged: Array<[unknown, string[]]> = [];
    const { backup } = backupWith(b, {
      importJournal: (j, players) => {
        merged.push([j, players]);
        return Promise.resolve(3);
      },
    });
    const r = backup.applyBackup(prepared);
    expect(r).toMatchObject({ ok: false, reason: 'no-space', applied: ['p1'] });
    expect(merged.map(([, players]) => players)).toEqual([['p1']]);
    expect(!r.ok && 'journalDone' in r && (await r.journalDone)).toBe(3);
  });

  it('копия не найдена: ответ null сразу, журнал не запрашивается', async () => {
    // Ловит: ожидание журнала (до 3 с) там, где файла всё равно не будет.
    const d = device();
    d.seed([['p1', 'Аня']], { p1: 3 });
    let asked = 0;
    const { backup } = backupWith(d, {
      journal: () => {
        asked += 1;
        return Promise.resolve(null);
      },
    });
    expect(await backup.downloadCopy('pre.p1.reset.1')).toBeNull();
    expect(asked).toBe(0);
  });
});
