/**
 * Страница родителя (063 Т11): чистые функции `engine/parent/progress.ts` — плитки, «последний файл», «Что изменится». У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../../src/app/save/sections';
import { binNoteKey, changeRows, clearTyped, defaultPicks, lastFile, progressFacts } from '../../src/engine/parent/progress';
import { binLeftNames, deviceRow, repairNoteKey, stuckRows } from '../../src/engine/parent/repair';
import { createPlayer, writePlayer } from '../../src/engine/save/envelope';
import type { ImportPlan } from '../../src/engine/save/import';
import { ru } from '../../src/i18n/ru';

const kid = (pid: string, name: string, patch: Record<string, unknown> = {}) => writePlayer(createPlayer({ pid, name }, SECTIONS), patch);
const ORDER = ['ru.yard.ao', 'ru.yard.fj', 'ru.yard.dk'];

describe('К11 progressFacts: плитки игрока', () => {
  it('К11 числа берутся из кошелька, дней и курса; нет раздела — плитки нет (null), а не «0»', () => {
    // Ловит: родителю показывают «0 монет» там, где раздела нет, или номер урока без порядка уроков.
    const env = kid('p-a', 'Саша', {
      wallet: { coins: 204, rest: 0, paid: [] },
      day: { played: 5, days: 3, today: '2026-11-18', todayN: 1, last: 1 },
      'course:ru': { current: 'ru.yard.fj', lessons: { 'ru.yard.ao': { stars: 3, best: 1, tries: 1 }, 'ru.yard.fj': { stars: 0, best: 0, tries: 1 } }, archive: {}, leaguesDone: {} },
    });
    expect(progressFacts(env, ORDER)).toEqual({ coins: 204, stars: 3, matches: 5, days: 3, lessonNo: 2, lessonsAll: 3, passed: 1 });
    expect(progressFacts(env, [])).toMatchObject({ lessonNo: null, lessonsAll: null });
    const bare = { ...env, sections: {} };
    expect(progressFacts(bare, ORDER)).toEqual({ coins: null, stars: null, matches: null, days: null, lessonNo: null, lessonsAll: ORDER.length, passed: null });
  });
});

describe('К11 lastFile: «Последний файл»', () => {
  it('К11 не день — «ещё не сохраняли»; сегодня и будущее — «сегодня»; иначе число дней, через границу месяца тоже', () => {
    // Ловит: в строке «Последний файл» мусор из записи устройства или счёт дней по строкам (а не по датам).
    expect(lastFile(null, '2026-11-18')).toEqual({ kind: 'never' });
    expect(lastFile('вчера', '2026-11-18')).toEqual({ kind: 'never' });
    expect(lastFile('2026-11-18', '2026-11-18')).toEqual({ kind: 'today' });
    expect(lastFile('2026-11-20', '2026-11-18')).toEqual({ kind: 'today' });
    expect(lastFile('2026-10-30', '2026-11-02')).toEqual({ kind: 'ago', days: 3 });
  });
});

describe('К12 changeRows / defaultPicks: «Что изменится»', () => {
  const file = kid('p-a', 'Саша', { wallet: { coins: 204, rest: 0, paid: [] } });
  const mine = kid('p-a', 'Саша', { wallet: { coins: 89, rest: 0, paid: [] } });
  const other = kid('p-b', 'Миша');
  const sum = { name: 'Саша', lesson: null, stars: null, coins: null };
  const plan: ImportPlan = { kind: 'ok', add: [other], clash: [{ pid: 'p-a', mine: sum, theirs: sum, file }], overLimit: false, file: { app: '2.0.0', made: '2026-11-18T10:00:00.000Z' } };

  it('К12 совпавший — две стороны (на компьютере и в файле), новый — только файл; на компьютере не открывается — mine: null', () => {
    // Ловит: родитель выбирает «взять из файла», не видя, чем версии различаются; битого игрока показывают как пустого.
    const rows = changeRows(plan, [mine], ORDER);
    expect(rows.map((r) => [r.pid, r.kind])).toEqual([['p-a', 'clash'], ['p-b', 'new']]);
    expect(rows[0]!.mine).toContainEqual({ kind: 'coins', n: 89 });
    expect(rows[0]!.theirs).toContainEqual({ kind: 'coins', n: 204 });
    expect(changeRows(plan, [], ORDER)[0]!.mine).toBeNull();
    expect(changeRows({ kind: 'bad', why: [] }, [mine], ORDER)).toEqual([]);
  });

  it('К12 игрок есть на компьютере, но не в файле — строка «here» с его сводкой и без «в файле» (кадр Э6.54)', () => {
    // Ловит: игрок, которого в файле нет, пропадает из сводки — родитель не видит, что он «останется как есть»; чужого (из файла) принимают за такого.
    const rows = changeRows(plan, [mine, other, kid('p-c', 'Дима', { wallet: { coins: 7, rest: 0, paid: [] } })], ORDER);
    expect(rows.map((r) => [r.pid, r.kind])).toEqual([['p-a', 'clash'], ['p-b', 'new'], ['p-c', 'here']]);
    expect(rows[2]!.name).toBe('Дима');
    expect(rows[2]!.mine).toContainEqual({ kind: 'coins', n: 7 });
    expect(rows[2]!.theirs).toEqual([]);
  });

  it('К12 новый игрок из файла, что лежит в корзине, помечен binned — «в корзине» вместо «нет» в колонке «Сейчас» (063-Р66)', () => {
    // Ловит: родитель видит «нет» там, где игрок на самом деле в корзине и вернётся при загрузке; метка на чужом игроке или на совпавшем.
    const rows = changeRows(plan, [mine], ORDER, new Set(['p-b', 'p-a']));
    expect(rows.find((r) => r.pid === 'p-b')!.binned).toBe(true);
    expect(rows.find((r) => r.pid === 'p-a')!.binned).toBeUndefined();
    expect(changeRows(plan, [mine], ORDER).find((r) => r.pid === 'p-b')!.binned).toBeUndefined();
  });

  it('К12 выбор по умолчанию — «оставить на компьютере»: без решения родителя ничего не перезаписывается', () => {
    // Ловит: «взять из файла» по умолчанию — клик «Загрузить» вслепую затирает игрока.
    expect(defaultPicks(plan)).toEqual({ 'p-a': 'mine' });
    expect(defaultPicks({ kind: 'newer' })).toEqual({});
  });
});

describe('К13 binNoteKey: строка отказа корзины (063-Р66)', () => {
  it('К13 у каждой причины своя строка; listed — не «нет места»; незнакомая — общее «не записалось»', () => {
    // Ловит: игрок и в списке, и в корзине (`listed`) показан как «Игроков уже четверо» (ложное «нет места»); новая причина без строки пропадает молча.
    expect(binNoteKey('listed')).toBe('listed');
    expect(binNoteKey('limit')).toBe('limit');
    for (const why of ['phrase', 'conflict', 'readonly'] as const) expect(binNoteKey(why)).toBe(why);
    for (const why of ['quota', 'denied', 'absent', 'last', 'empty', 'busy', '']) expect(binNoteKey(why)).toBe('fail');
  });
});

describe('К12 (063-Р65) repair: что показать про игроков и клуб, которые не открываются (063-Р65)', () => {
  it('К12 (063-Р65) stuckRows: битому — «Загрузить файл» и «Начать заново», «новее» и «нет доступа» — без действий; порядок списка и имя сохраняются', () => {
    // Ловит: «Начать заново» у игрока «новее» (стёрли бы данные новой версии) или битый без выхода (тупик); имя из конверта теряется по дороге.
    const rows = stuckRows([
      { pid: 'p-b', kind: 'broken', name: 'Миша' },
      { pid: 'p-c', kind: 'newer', name: 'Аня' },
      { pid: 'p-d', kind: 'denied', name: null },
    ]);
    expect(rows.map((r) => [r.pid, r.name, r.actions])).toEqual([['p-b', 'Миша', ['load', 'restart']], ['p-c', 'Аня', []], ['p-d', null, []]]);
    // «в корзине» (оборванное удаление): строка без действий — «Начать заново» затёрло бы прогресс из корзины
    expect(stuckRows([{ pid: 'p-e', kind: 'binned', name: 'Вера' }])).toEqual([{ pid: 'p-e', kind: 'binned', name: 'Вера', actions: [] }]);
    expect(stuckRows([])).toEqual([]);
  });

  it('К12 (063-Р65) deviceRow: broken — «Загрузить файл» и «Новый клуб»; newer — только текст; ok, absent (первый запуск) и denied — строки нет', () => {
    // Ловит: «Новый клуб» на первом запуске или на устройстве «новее» (затёрли бы клуб новой версии); битое устройство без выхода.
    expect(deviceRow('broken')).toEqual({ pid: null, kind: 'broken', name: null, actions: ['load', 'newClub'] });
    expect(deviceRow('newer')).toEqual({ pid: null, kind: 'newer', name: null, actions: [] });
    for (const state of ['ok', 'absent', 'denied'] as const) expect(deviceRow(state)).toBeNull();
  });

  it('К12 (063-Р65) repairNoteKey: у busy, readonly, healthy, binned, quota, denied — своя строка; absent, conflict и незнакомое — «обновите страницу»', () => {
    // Ловит: отказ «Начать заново» показан как «не получилось» без причины или «нет места» там, где игрока держит другая вкладка; у `binned` («в корзине») нет своей строки.
    for (const why of ['busy', 'readonly', 'healthy', 'binned', 'quota', 'denied'] as const) expect(repairNoteKey(why)).toBe(why);
    // ParentStuck берёт `s[key]` для healthy/binned/quota/denied: строка должна быть непустой (иначе заметка пустая)
    for (const key of ['healthy', 'binned', 'quota', 'denied'] as const) expect(ru.parent.players.stuck[key].length).toBeGreaterThan(10);
    expect(ru.parent.players.stuck.inBin).toContain('Корзина');
    for (const why of ['absent', 'conflict', 'invalid', '']) expect(repairNoteKey(why)).toBe('conflict');
  });

  it('К12 (063-Р65) binLeftNames (063-Р64): имя берётся из плана по pid; нет такого — запасное слово; план не ok — запасное', () => {
    // Ловит: заметка «остался в корзине» без имени или с чужим именем, когда игроков из файла несколько.
    const plan: ImportPlan = { kind: 'ok', add: [kid('p-a', 'Саша'), kid('p-b', 'Миша')], clash: [], overLimit: false, file: { app: '2.0.0', made: '2026-11-18T10:00:00.000Z' } };
    expect(binLeftNames(['p-b'], plan, 'Игрок')).toEqual(['Миша']);
    expect(binLeftNames(['p-b', 'p-z'], plan, 'Игрок')).toEqual(['Миша', 'Игрок']);
    expect(binLeftNames(['p-b'], { kind: 'bad', why: [] }, 'Игрок')).toEqual(['Игрок']);
    expect(binLeftNames([], plan, 'Игрок')).toEqual([]);
  });
});

describe('К13 clearTyped: очистка корзины вводом имён в любом порядке (063-Р66)', () => {
  it('К13 порядок не важен, регистр и пробелы не важны, каждое имя ровно один раз; лишнее, нехватка и пустая корзина — нет', () => {
    // Ловит: имена принимаются только в порядке заголовка (поле «молчит» при верном вводе в другом порядке); лишнее или недостающее имя пропускается; пустая корзина «подтверждается».
    expect(clearTyped(['Миша', 'Аня'], 'Миша Аня')).toBe(true);
    expect(clearTyped(['Миша', 'Аня'], '  аня   МИША ')).toBe(true);
    expect(clearTyped(['Миша', 'Аня'], 'Миша')).toBe(false);
    expect(clearTyped(['Миша', 'Аня'], 'Миша Аня Аня')).toBe(false);
    expect(clearTyped(['Миша', 'Аня'], 'Миша Ань')).toBe(false);
    expect(clearTyped(['Миша'], '')).toBe(false);
    expect(clearTyped([], '')).toBe(false);
    expect(clearTyped([], 'Миша')).toBe(false);
  });

  it('К13 имена из нескольких слов и одинаковые имена: «Ваня Иванов» целиком в любом порядке; два Саши — два раза, не больше и не меньше', () => {
    // Ловит: многословное имя разбито по пробелам и не принято; два одинаковых имени сведены в одно (множество вместо набора) или принято третье.
    expect(clearTyped(['Ваня Иванов', 'Аня'], 'аня ваня иванов')).toBe(true);
    expect(clearTyped(['Ваня Иванов', 'Аня'], 'ваня иванов')).toBe(false);
    expect(clearTyped(['Ваня Иванов', 'Аня'], 'ваня аня иванов')).toBe(false);
    expect(clearTyped(['Саша', 'Саша'], 'Саша Саша')).toBe(true);
    expect(clearTyped(['Саша', 'Саша'], 'Саша')).toBe(false);
    expect(clearTyped(['Саша', 'Саша'], 'Саша Саша Саша')).toBe(false);
    expect(clearTyped(['Саша', 'Саша', 'Миша'], 'саша миша саша')).toBe(true);
    expect(clearTyped(['Ваня', 'Ваня Иванов'], 'Ваня Иванов Ваня')).toBe(true);
  });
});
