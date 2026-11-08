/**
 * Показ выгрузки и загрузки у родителя (спека 014-Т6, Р11, Р13): чистые функции `engine/save/backupView` и слой для
 * родителя на поддельном устройстве. Ловит у каждого теста — строка «Ловит:». Подготовка та же, что у `backup.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  backupAge,
  canLoad,
  copyGroups,
  decodeReport,
  encodeReport,
  fileDateText,
  foundNames,
  needsReload,
  previewRows,
  reportApply,
  ruDate,
  type ApplyReport,
} from '../src/engine/save/backupView';
import { summarize, type PreviewEntry } from '../src/engine/save/backup';
import { ctx } from './saveStoreHelpers';
import { NEXT, V1, onProbe, probeAt } from './saveStoreHelpers';
import { DAY, T0, bulkDays, device, prepare } from './backupHelpers';

describe('показ у родителя: давность, превью и итог (К6, 014-Т6)', () => {
  // Ловит: «Последний файл» считает не календарные дни: в 23:50 вчера и 00:10 сегодня пишет «сегодня» (прошло 20 минут, но
  // день другой — по правилу это «1 день назад»), при часах назад — отрицательные дни, без файла — «0 дней».
  it('давность файла: нет, сегодня, вчера вечером, часы ушли назад', () => {
    const dayOf = (t: number): string => new Date(t).toISOString().slice(0, 10);
    expect(backupAge(null, T0, dayOf)).toEqual({ kind: 'never' });
    // «Сегодня» — по календарному дню, а не по суткам: за 20 минут до полуночи и после — уже «1 день назад» (было «сегодня»).
    expect(backupAge(T0 - 3600_000, T0, dayOf)).toEqual({ kind: 'today' });
    expect(backupAge(Date.UTC(2026, 10, 8, 0, 10), Date.UTC(2026, 10, 8, 23, 50), dayOf)).toEqual({ kind: 'today' });
    expect(backupAge(Date.UTC(2026, 10, 7, 23, 50), Date.UTC(2026, 10, 8, 0, 10), dayOf)).toEqual({ kind: 'days', days: 1 });
    expect(backupAge(T0 - DAY, T0, dayOf)).toEqual({ kind: 'days', days: 1 });
    expect(backupAge(T0 - 5 * DAY - 1000, T0, dayOf)).toEqual({ kind: 'days', days: 5 });
    expect(backupAge(T0 + 3 * DAY, T0, dayOf)).toEqual({ kind: 'today' });
    expect(backupAge(T0, T0, () => 'не дата')).toEqual({ kind: 'today' });
    expect(ruDate('2026-11-08')).toBe('08.11.2026');
    expect(ruDate(null)).toBe('');
  });

  // Ловит: номер урока в превью считали по числу пройденных, и при всех пройденных выходило «Урок 33» вместо последнего (018-Т6б2б).
  it('summarize: урок — место course.lesson среди уроков курса; пройден весь курс — не больше числа уроков', () => {
    const ids = ctx.lessonIds;
    const all = { course: { lesson: ids[ids.length - 1], passed: [...ids] }, wallet: { coins: 3 } };
    expect(summarize(all, ctx)).toEqual({ lesson: ids.length, coins: 3, lastDay: null });
    expect(summarize({ course: { lesson: 'yard-03', passed: ['yard-01', 'yard-02'] } }, ctx).lesson).toBe(3);
    // Пусто или незнакомый id — первый, как на карточке игрока.
    expect(summarize({ course: { lesson: 'нет-такого', passed: [] } }, ctx).lesson).toBe(1);
    expect(summarize({}, ctx).lesson).toBe(1);
  });

  // Ловит: превью путает колонки «сейчас» и «в файле» (или показывает урок с нуля), новый игрок не помечен, битый не виден.
  it('строки превью: сейчас и в файле, номер урока с единицы, новый и битый игрок', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря'], ['p3', 'Вера']], { p1: 9 });
    a.store.update('p1', (all) => ({ ...all, course: { lesson: 'yard-05', passed: ['yard-01', 'yard-02', 'yard-03', 'yard-04'] }, wallet: { coins: 77 } }));
    const file = JSON.parse((await a.backup.downloadBackup()).text) as { saves: Record<string, string> };
    file.saves.p3 = '{не json';
    const b = device();
    b.seed([['p1', 'Аня'], ['p3', 'Вера']], { p1: 1, p3: 1 });
    const prep = await prepare(b, JSON.stringify(file));
    const rows = previewRows(prep.entries);
    expect(rows.map((r) => [r.id, r.name, r.broken, r.isNew])).toEqual([
      ['p1', 'Аня', false, false],
      ['p2', 'Боря', false, true],
      ['p3', 'Вера', true, false],
    ]);
    expect(rows[0]?.inFile).toMatchObject({ lesson: 5, coins: 77 });
    expect(rows[0]?.now).toMatchObject({ lesson: 1, coins: 5 });
    expect(rows[1]?.now).toBeNull();
    expect(rows[2]?.inFile).toBeNull();
    expect(canLoad(prep.entries)).toBe(true);
    expect(canLoad(prep.entries.filter((e) => e.status === 'broken'))).toBe(false);
    expect(canLoad([])).toBe(false);
  });

  // Ловит: итог успеха теряет имена или пропущенных (битых) — родитель не узнает, кто не загрузился.
  it('итог успеха: имена загруженных и пропущенных', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 9 });
    const file = JSON.parse((await a.backup.downloadBackup()).text) as { saves: Record<string, string> };
    file.saves.p2 = 'мусор';
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    const prep = await prepare(b, JSON.stringify(file));
    expect(reportApply(b.backup.applyBackup(prep), prep.entries)).toEqual({ kind: 'done', loaded: ['Аня'], skipped: ['Боря'] });
  });

  // Ловит (Р11): частичный отказ показан как полный успех или как полный отказ — не названы загруженные и не влезшие.
  it('итог частичного отказа: загружен первый, не хватило места второму; без записанных — просто отказ', async () => {
    const a = device();
    a.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 9, p2: 7 });
    const text = (await a.backup.downloadBackup()).text;
    const b = device();
    b.seed([['p1', 'Аня'], ['p2', 'Боря']], { p1: 1, p2: 2 });
    b.store.update('p2', onProbe((s) => ({ ...s, days: bulkDays(300) })));
    const prep = await prepare(b, text);
    b.mem.state.quota = b.mem.used() + 3000;
    expect(reportApply(b.backup.applyBackup(prep), prep.entries)).toEqual({
      kind: 'partial',
      loaded: ['Аня'],
      lost: ['Боря'],
      skipped: [],
      reason: 'no-space',
    });
    expect(reportApply({ ok: false, reason: 'no-space', applied: [] }, prep.entries)).toEqual({ kind: 'refused', reason: 'no-space' });
    expect(reportApply({ ok: false, reason: 'v1' }, prep.entries)).toEqual({ kind: 'refused', reason: 'v1' });
  });

  // Ловит: круг «выгрузил → превью → загрузил» через показ расходится со слоем: после итога `done` игрок не тот.
  it('круг через показ: выгрузил, прочитал, загрузил — игрок как в файле', async () => {
    const a = device();
    a.seed([['p1', 'Аня']], { p1: 9 });
    const b = device();
    b.seed([['p1', 'Аня']], { p1: 1 });
    const prep = await prepare(b, (await a.backup.downloadBackup()).text);
    expect(reportApply(b.backup.applyBackup(prep), prep.entries).kind).toBe('done');
    expect(probeAt(b.mem.data, `${NEXT}save.p1`).goals).toBe(9);
  });
});

describe('показ у родителя: доправка по ревью (014-Р13)', () => {
  const dayOf = (t: number): string => new Date(t).toISOString().slice(0, 10);
  const entry = (over: Partial<PreviewEntry>): PreviewEntry => ({
    id: 'p1',
    nameNow: null,
    nameInFile: 'p1',
    status: 'ok',
    sections: {},
    now: null,
    inFile: { lesson: 1, coins: 1, lastDay: null },
    ...over,
  });

  // Ловит: у файла без имён в строке превью торчит id (p1), хотя на устройстве игрок Аня; сохранение лежит, а игрока в списке нет — не помечен новым.
  it('имя: если в файле только id — имя на устройстве; игрока нет в списке — новый, даже если ключ лежит', () => {
    const rows = previewRows([
      entry({ nameNow: 'Аня', nameInFile: 'p1' }),
      entry({ id: 'p2', nameInFile: 'p2', now: { lesson: 3, coins: 9, lastDay: null } }),
      entry({ id: 'p3', nameNow: 'Вера', nameInFile: 'Вера', now: { lesson: 1, coins: 1, lastDay: null } }),
    ]);
    expect(rows.map((r) => [r.name, r.isNew])).toEqual([
      ['Аня', false],
      ['p2', true],
      ['Вера', false],
    ]);
  });

  // Ловит: дата файла «01.01.1970» при createdAt 0 (файл без времени) или «NaN».
  it('дата файла: нет времени — пусто', () => {
    expect(fileDateText(0, dayOf)).toBe('');
    expect(fileDateText(-5, dayOf)).toBe('');
    expect(fileDateText(Number.NaN, dayOf)).toBe('');
    expect(fileDateText(T0, dayOf)).toBe('15.01.2027');
  });

  // Ловит (Р13): после частичного итога страница остаётся со старой памятью и затирает загруженное; итог в sessionStorage искажается.
  it('перезагрузка нужна после успеха и частичного итога, не после отказа; итог переживает текст', () => {
    const done: ApplyReport = { kind: 'done', loaded: ['Аня'], skipped: ['Боря'] };
    const partial: ApplyReport = { kind: 'partial', loaded: ['Аня'], lost: ['Боря'], skipped: [], reason: 'no-space' };
    const refused: ApplyReport = { kind: 'refused', reason: 'v1' };
    expect([done, partial, refused].map(needsReload)).toEqual([true, true, false]);
    for (const r of [done, partial, refused]) expect(decodeReport(encodeReport(r))).toEqual(r);
    const bads = [null, '', '{не json', '[]', 'null', '{"kind":"done"}', '{"kind":"partial","loaded":[],"lost":[],"skipped":[],"reason":"?"}', '{"kind":"x"}'];
    for (const bad of bads) expect(decodeReport(bad)).toBeNull();
  });

  // Ловит: найденная при запуске беда показана без имени игрока или в беспорядке (порядок строк «прыгает» между запусками).
  it('найденная беда: имена по порядку id, нет в списке — id', () => {
    const names: Record<string, string> = { p1: 'Аня', p2: 'Боря' };
    expect(foundNames({ p2: 'broken', p9: 'fresh-with-snaps', p1: 'broken' }, (id) => names[id] ?? null)).toEqual(['Аня', 'Боря', 'p9']);
    expect(foundNames({}, () => null)).toEqual([]);
  });

  // Ловит: список копий путает игроков, теряет даты, «до миграции» стоит первой, сохранения игроков попадают в копии.
  it('копии по игроку: даты, новые раньше, «до миграции» последней, не копии пропущены', () => {
    const names: Record<string, string> = { p1: 'Аня', p2: 'Боря' };
    const groups = copyGroups(
      [
        'save.p1',
        'events',
        'snap.p1.2026-11-06',
        'snap.p1.2026-11-08',
        'pre.p1.migrate.f1',
        'pre.p1.import.1800000000000',
        'quarantine.p2.1700000000000',
        'pre.p9.delete.1750000000000',
      ],
      (id) => names[id] ?? null,
      dayOf,
    );
    expect(groups.map((g) => [g.id, g.name])).toEqual([['p1', 'Аня'], ['p2', 'Боря'], ['p9', null]]);
    expect(groups[0]?.items.map((i) => [i.key, i.kind, i.when, i.format])).toEqual([
      ['pre.p1.import.1800000000000', 'import', '15.01.2027', null],
      ['snap.p1.2026-11-08', 'snap', '08.11.2026', null],
      ['snap.p1.2026-11-06', 'snap', '06.11.2026', null],
      ['pre.p1.migrate.f1', 'migrate', '', 1],
    ]);
    expect(groups[1]?.items[0]).toMatchObject({ kind: 'quarantine', when: '14.11.2023' });
    expect(copyGroups([], () => null, dayOf)).toEqual([]);
  });

  // Ловит: родителю не видно режима v1, найденной беды; список копий берёт сохранения игроков и служебные ключи.
  it('слой для родителя: режим, найденное при запуске, имена копий', () => {
    const v1 = device({}, { prefix: V1, channel: 'release' });
    expect(v1.backup.saveInfo()).toEqual({ v1: true, storageFull: false, found: {} });
    const d = device({
      [`${NEXT}save.p1`]: '{не json',
      [`${NEXT}snap.p1.2026-11-01`]: '{}',
      [`${NEXT}events`]: '[]',
      [`${NEXT}players`]: '{}',
    });
    d.store.load('p1');
    expect(d.backup.saveInfo()).toMatchObject({ v1: false, storageFull: false, found: { p1: 'broken' } });
    expect(d.backup.copyNames().sort()).toEqual([expect.stringMatching(/^quarantine\.p1\.\d+$/), 'snap.p1.2026-11-01'].sort());
  });
});
