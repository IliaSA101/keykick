/**
 * Сохранение: разбор не падает ни на каком мусоре и чинит поля по одному;
 * переходы прогресса (тайм, пенальти, пак) — чистые функции.
 */
import { describe, expect, it } from 'vitest';
import {
  COINS_MAX,
  KEY_ERROR_CAP,
  SAVE_VERSION,
  PENALTY_KICKS,
  PENALTY_MAX,
  applyFirstHalf,
  applyHalf,
  applyHandsHelpSeen,
  applyLessonBest,
  applyMinigame,
  applyPack,
  applyPenalty,
  applyPuzzleRecord,
  applySetLesson,
  beatsBest,
  bestNote,
  buyPack,
  canBuyPack,
  emptySave,
  fillPenalty,
  kicksLeft,
  kicksToFill,
  lessonBestOf,
  matchKit,
  mergeKeyErrors,
  nextKick,
  parseSave,
  wearKit,
  type SaveData,
} from '../src/engine/save';
import { CLUB_KIT_ID } from '../src/engine/club';
import { DUP_COINS, PACK_PRICE } from '../src/engine/rewards';
import { emptyStats } from '../src/engine/typing';
import { PUZZLE_TIME_MAX } from '../src/engine/keyboardPuzzle';
import { LEGACY_ORDER } from '../src/engine/lessonOrder';

const ctx = { kitIds: ['scarlet', 'sky', 'comet'], bootIds: ['blue', 'red'], lessonIds: LEGACY_ORDER.slice(0, 5) };
const KIT_COLORS = { pattern: 'plain', body: '#ffffff', sleeves: '#ffffff', trim: '#16161a' } as const;

const full: SaveData = {
  version: 1,
  club: {
    name: 'Метеор',
    kit: { pattern: 'stripes', body: '#c8102e', alt: '#ffffff', sleeves: '#c8102e', trim: '#16161a' },
  },
  ownedKits: ['scarlet', 'comet'],
  wornKit: 'comet',
  boughtBoots: ['blue'],
  wornBoots: 'cup-yard',
  lessonIndex: 3,
  lessonId: 'yard-4',
  keyErrors: { KeyF: 4, KeyJ: 1 },
  matches: 7,
  goals: 12,
  pendingPacks: 2,
  penalty: { kicks: 3, tasks: ['t3', 't4'], results: [true] },
  solvedTasks: ['t1', 't2'],
  coins: 140,
  handsHelpSeen: true,
  days: { '2026-11-03': 600_000, '2026-11-04': 120_000 },
  cups: { yard: { stage: 4, won: true, finalOpen: true }, district: { stage: 2, won: false } },
  puzzleBest: { 'home:ваол': 41_000, 'top:йцук': 63_250 },
  lessonBest: { 'yard-1': { cpm: 87, acc: 0.95 }, 'yard-2': { cpm: 112, acc: 1 } },
  newsSeen: '0.10.0',
};

describe('разбор сохранения', () => {
  it('круг «сохранить → JSON → разобрать» без потерь', () => {
    expect(parseSave(JSON.parse(JSON.stringify(full)), ctx)).toEqual(full);
    // Со списком уроков разбор дописывает id урока — его несёт первая же запись (007).
    expect(parseSave(JSON.parse(JSON.stringify(emptySave())), ctx)).toEqual({ ...emptySave(), lessonId: 'yard-1' });
  });

  it('мусор и чужая версия — чистое состояние, без исключений', () => {
    for (const raw of [null, undefined, 'строка', 42, [], [full], true, { ...full, version: 2 }, { ...full, version: '1' }]) {
      expect(parseSave(raw, ctx)).toEqual(emptySave());
    }
  });

  it('битое поле чинится, остальные живут', () => {
    const broken = parseSave({ ...full, ownedKits: 5, goals: -3 }, ctx);
    expect(broken.ownedKits).toEqual([]);
    expect(broken.goals).toBe(0);
    expect(broken.club).toEqual(full.club);
    expect(broken.matches).toBe(7);
    expect(broken.solvedTasks).toEqual(['t1', 't2']);
  });

  it('числа: отрицательные, дробные, не числа, бесконечность', () => {
    const s = parseSave({ ...full, matches: -1, goals: 3.7, pendingPacks: 'два', lessonId: undefined, lessonIndex: Infinity }, ctx);
    expect([s.matches, s.goals, s.pendingPacks, s.lessonIndex]).toEqual([0, 3, 0, 0]);
  });

  it('урок — не дальше последнего', () => {
    expect(parseSave({ ...full, lessonId: undefined, lessonIndex: 99 }, ctx).lessonIndex).toBe(4);
  });

  it('lessonId (007): знаком — номер из id; нет поля — по старому порядку; чужой id или не строка — по номеру с обрезкой; id и номер расходятся — верим id', () => {
    const at = (lessonId: unknown, lessonIndex: number, lessonIds = ctx.lessonIds) =>
      parseSave({ ...full, lessonId, lessonIndex }, { ...ctx, lessonIds });
    expect(at('yard-2', 4)).toMatchObject({ lessonIndex: 1, lessonId: 'yard-2' });
    // Поля нет — номер старый (34 урока): вставка урока перед ним игрока не сдвигает, за пределом — последний старый.
    const inserted = ['yard-1', 'yard-new', ...LEGACY_ORDER.slice(1)];
    expect(at(undefined, 5, inserted)).toMatchObject({ lessonIndex: 6, lessonId: 'yard-6' });
    expect(at(undefined, 999, [...inserted, 'city-new'])).toMatchObject({ lessonIndex: 34, lessonId: 'city-10' });
    for (const bad of ['gone', '', 7, null, {}]) expect(at(bad, 99)).toMatchObject({ lessonIndex: 4, lessonId: 'yard-5' });
    // Старого урока нет в списке — тоже по номеру; без списка уроков — номер и годный id как есть.
    expect(at(undefined, 2, ['a', 'b', 'c'])).toMatchObject({ lessonIndex: 2, lessonId: 'c' });
    expect(parseSave({ ...full, lessonIndex: 40 })).toMatchObject({ lessonIndex: 40, lessonId: 'yard-4' });
  });

  it('списки: неизвестные формы, не строки и повторы выкидываются', () => {
    const s = parseSave(
      { ...full, ownedKits: ['scarlet', 'gone', 7, null, 'scarlet', 'sky'], solvedTasks: ['t1', 't1', {}, ''] },
      ctx,
    );
    expect(s.ownedKits).toEqual(['scarlet', 'sky']);
    expect(s.solvedTasks).toEqual(['t1']);
    expect(parseSave({ ...full, solvedTasks: 'abc' }, ctx).solvedTasks).toEqual([]);
  });

  it('ошибки по клавишам: мусор выкидывается, потолок на клавишу', () => {
    expect(parseSave({ ...full, keyErrors: [1, 2] }, ctx).keyErrors).toEqual({});
    expect(parseSave({ ...full, keyErrors: null }, ctx).keyErrors).toEqual({});
    const s = parseSave({ ...full, keyErrors: { KeyA: 'x', KeyB: -2, KeyC: 0, KeyD: 500, KeyE: 2 } }, ctx);
    expect(s.keyErrors).toEqual({ KeyD: KEY_ERROR_CAP, KeyE: 2 });
  });

  it('клуб: без имени или с битой формой — нет клуба', () => {
    expect(parseSave({ ...full, club: { name: '', kit: full.club?.kit } }, ctx).club).toBeNull();
    expect(parseSave({ ...full, club: { name: 'Гром', kit: { pattern: 'plain' } } }, ctx).club).toBeNull();
    expect(parseSave({ ...full, club: 'Гром' }, ctx).club).toBeNull();
    expect(parseSave({ ...full, club: { name: 'x'.repeat(200), kit: full.club?.kit } }, ctx).club).toBeNull();
  });

  it('форма на матч: только из полученных; чужая, битая и старое сохранение без поля — домашняя', () => {
    // sky известна игре, но не получена — надеть её нельзя.
    for (const bad of ['sky', 'gone', CLUB_KIT_ID, '', 7, null, {}]) {
      expect(parseSave({ ...full, wornKit: bad }, ctx).wornKit).toBeNull();
    }
    const { wornKit, ...old } = full;
    expect(wornKit).toBe('comet');
    expect(parseSave(JSON.parse(JSON.stringify(old)), ctx)).toEqual({ ...full, wornKit: null });
    // Форму убрали с сайта — она уходит из полученных, а команда выходит в домашней.
    expect(parseSave(full, { ...ctx, kitIds: ['scarlet'] }).wornKit).toBeNull();
  });

  it('старое сохранение без монет, времени игры и кубков читается: 0 и пусто', () => {
    const { coins, days, cups, ...old } = full;
    expect([coins, days, cups]).not.toContain(undefined);
    const s = parseSave(JSON.parse(JSON.stringify(old)), ctx);
    expect(s).toEqual({ ...full, coins: 0, days: {}, cups: {} });
  });

  it('бутсы: старое сохранение без полей — [] и null, версия та же, остальное без потерь', () => {
    expect(SAVE_VERSION).toBe(1);
    const { boughtBoots, wornBoots, ...old } = full;
    expect([boughtBoots, wornBoots]).not.toContain(undefined);
    expect(parseSave(JSON.parse(JSON.stringify(old)), ctx)).toEqual({ ...full, boughtBoots: [], wornBoots: null });
  });

  it('бутсы: купленные — только из лавки, мусор и повторы выкидываются; надетые — строка или null', () => {
    const bought = ['blue', 'gone', 'cup-yard', 'basic', 7, null, '', 'blue', 'red'];
    expect(parseSave({ ...full, boughtBoots: bought }, ctx).boughtBoots).toEqual(['blue', 'red']);
    expect(parseSave({ ...full, boughtBoots: 'blue' }, ctx).boughtBoots).toEqual([]);
    // Без списка лавки (контекст не знает бутс) — только мусор долой.
    expect(parseSave({ ...full, boughtBoots: bought }).boughtBoots).toEqual(['blue', 'gone', 'cup-yard', 'basic', 'red']);
    for (const bad of [7, '', null, {}, ['blue'], 'x'.repeat(65)]) {
      expect(parseSave({ ...full, wornBoots: bad }, ctx).wornBoots).toBeNull();
    }
    // Владение здесь не проверяется: оно зависит от трофеев и контента (wornBootsOf).
    expect(parseSave({ ...full, wornBoots: 'gone' }, ctx).wornBoots).toBe('gone');
  });

  it('рекорды «Собери клавиатуру»: старое сохранение без поля — пусто; мусор отбрасывается, остальное живёт', () => {
    const { puzzleBest, ...old } = full;
    expect(Object.keys(puzzleBest)).toHaveLength(2);
    expect(parseSave(JSON.parse(JSON.stringify(old)), ctx)).toEqual({ ...full, puzzleBest: {} });
    for (const bad of [null, 'home:ваол', [41_000], 5]) expect(parseSave({ ...full, puzzleBest: bad }, ctx).puzzleBest).toEqual({});
    const mixed = {
      'home:ваол': 41_000,
      'home:ао': -3,
      'home:аовл': 0,
      'top:йцук': '30000',
      'bottom:ячс': PUZZLE_TIME_MAX + 1,
      'bottom:ям': Number.NaN,
      'side:ао': 5_000,
      '': 5_000,
      'top:й': 12_345.6,
    };
    expect(parseSave({ ...full, puzzleBest: mixed }, ctx).puzzleBest).toEqual({ 'home:ваол': 41_000, 'top:й': 12_346 });
  });

  it('рекорды уроков: старое сохранение без поля — пусто, версия та же; мусор отбрасывается, остальное живёт', () => {
    const { lessonBest, ...old } = full;
    expect(Object.keys(lessonBest)).toHaveLength(2);
    const migrated = parseSave(JSON.parse(JSON.stringify(old)), ctx);
    expect(migrated).toEqual({ ...full, lessonBest: {} });
    expect(migrated.version).toBe(SAVE_VERSION);
    for (const bad of [null, 'yard-1', [87], 5]) expect(parseSave({ ...full, lessonBest: bad }, ctx).lessonBest).toEqual({});
    const mixed = {
      'yard-1': { cpm: 87, acc: 0.95 },
      'yard-2': { cpm: 0, acc: 1 },
      'yard-3': { cpm: 90.5, acc: 1 },
      'yard-4': { cpm: 2001, acc: 1 },
      'yard-5': { cpm: 90, acc: 1.2 },
      'yard-6': { cpm: 90, acc: -0.1 },
      'yard-7': { cpm: '90', acc: 1 },
      'yard-8': { cpm: 90 },
      'yard-9': null,
      '': { cpm: 90, acc: 1 },
      ['x'.repeat(65)]: { cpm: 90, acc: 1 },
      'yard-10': { cpm: 2000, acc: 0, extra: true },
    };
    expect(parseSave({ ...full, lessonBest: mixed }, ctx).lessonBest).toEqual({
      'yard-1': { cpm: 87, acc: 0.95 },
      'yard-10': { cpm: 2000, acc: 0 },
    });
  });

  it('справка «Как держать руки»: старое сохранение без поля и мусор — не показана; показана — держится', () => {
    const { handsHelpSeen, ...old } = full;
    expect(handsHelpSeen).toBe(true);
    expect(parseSave(JSON.parse(JSON.stringify(old)), ctx)).toEqual({ ...full, handsHelpSeen: false });
    for (const v of ['true', 1, null, {}, false]) expect(parseSave({ ...full, handsHelpSeen: v }, ctx).handsHelpSeen).toBe(false);
    expect(emptySave().handsHelpSeen).toBe(false);
    const seen = applyHandsHelpSeen(emptySave());
    expect(seen).toEqual({ ...emptySave(), handsHelpSeen: true });
    expect(applyHandsHelpSeen(seen)).toBe(seen);
  });

  it('сохранение одного игрока (до 04.11): время по дням — из session.days, перерыв и настройки не здесь', () => {
    const { days, ...rest } = full;
    const legacy = {
      ...rest,
      session: { days, lastAction: 1_700_000_000_000, sinceBreak: 300_000, breakDue: true, breakUntil: null },
      breakSettings: { enabled: false, playMinutes: 20, breakMinutes: 10 },
    };
    expect(parseSave(JSON.parse(JSON.stringify(legacy)), ctx)).toEqual(full);
    // Своё поле важнее старого.
    expect(parseSave({ ...legacy, days: { '2026-11-05': 60_000 } }, ctx).days).toEqual({ '2026-11-05': 60_000 });
  });

  it('монеты: мусор — 0, дробные — вниз, потолок', () => {
    for (const coins of [-5, 'сто', null, Number.NaN, Infinity]) expect(parseSave({ ...full, coins }, ctx).coins).toBe(0);
    expect(parseSave({ ...full, coins: 12.9 }, ctx).coins).toBe(12);
    expect(parseSave({ ...full, coins: 1e12 }, ctx).coins).toBe(COINS_MAX);
  });

  it('время по дням: битое — пусто, остальное живёт', () => {
    const { days, ...rest } = full;
    expect(days).not.toEqual({});
    for (const bad of ['да', 7, [], null]) {
      const s = parseSave({ ...full, days: bad }, ctx);
      expect(s.days).toEqual({});
      expect(s.goals).toBe(full.goals);
      expect(parseSave({ ...rest, session: bad }, ctx).days).toEqual({});
    }
    expect(parseSave({ ...full, days: { '2026-11-04': -5, bad: 10, '2026-11-03': 60_000 } }, ctx).days).toEqual({
      '2026-11-03': 60_000,
    });
  });

  it('старое сохранение с одним пенальти (penaltyReady) читается как серия из одного удара', () => {
    const { penalty, ...old } = full;
    expect(penalty).not.toBeNull();
    expect(parseSave({ ...old, penaltyReady: true }, ctx).penalty).toEqual({ kicks: 1, tasks: [], results: [] });
    for (const penaltyReady of [false, 'да', 1, undefined]) {
      expect(parseSave({ ...old, penaltyReady }, ctx).penalty).toBeNull();
    }
    // Новое поле важнее старого: серия уже есть — флаг не читается.
    expect(parseSave({ ...full, penaltyReady: true }, ctx).penalty).toEqual(full.penalty);
  });

  it('серия пенальти: мусор — нет серии или чинится по полям; ушедшие задачи — только непробитые', () => {
    for (const penalty of ['да', 7, [], { kicks: 0 }, { kicks: -2 }, { kicks: 'три' }]) {
      expect(parseSave({ ...full, penalty }, ctx).penalty).toBeNull();
    }
    expect(parseSave({ ...full, penalty: { kicks: 99, tasks: 'x', results: [true] } }, ctx).penalty).toEqual({
      kicks: PENALTY_MAX,
      tasks: [],
      results: [],
    });
    const raw = { kicks: 3, tasks: ['t1', 't2', 'gone', 't3', 't9'], results: [false, 'да', true] };
    expect(parseSave({ ...full, penalty: raw }, { ...ctx, taskIds: ['t1', 't3'] }).penalty).toEqual({
      kicks: 3,
      tasks: ['t1', 't2'],
      results: [false, true],
    });
    const fresh = { kicks: 3, tasks: ['t1', 'gone', 't3'], results: [] };
    expect(parseSave({ ...full, penalty: fresh }, { ...ctx, taskIds: ['t1', 't3'] }).penalty?.tasks).toEqual(['t1']);
  });

  it('клуб: старое сохранение без имени и номера читается как есть', () => {
    expect(parseSave(JSON.parse(JSON.stringify(full)), ctx).club).toEqual(full.club);
  });

  it('клуб: поле id настоящего клуба (было 04.11) не читается — название и цвета остаются', () => {
    const club = parseSave({ ...full, club: { ...full.club, name: 'Зенит', id: 'zenit' } }, ctx).club;
    expect(club).toEqual({ name: 'Зенит', kit: full.club?.kit });
  });

  it('клуб: имя и номер на спине держатся; битые отбрасываются, клуб остаётся', () => {
    const ok = { ...full.club, shirtName: 'Илья', shirtNumber: 7 };
    expect(parseSave({ ...full, club: ok }, ctx).club).toEqual(ok);
    const bad: [unknown, unknown][] = [
      ['Я', 0],
      ['', 100],
      [7, '7'],
      ['Илья1', 1.5],
      [null, Number.NaN],
    ];
    for (const [shirtName, shirtNumber] of bad) {
      const club = parseSave({ ...full, club: { ...full.club, shirtName, shirtNumber } }, ctx).club;
      expect(club).toEqual(full.club);
    }
  });
});

describe('переходы прогресса', () => {
  const lessonIds = ['a', 'b', 'c'];
  const stats = { ...emptyStats, keyErrors: { KeyF: 3, KeyK: 1 } };
  const half = { lessonId: 'a', stars: 2 as const, goals: 3, stats };

  it('тайм: матч, голы, пак, ошибки клавиш', () => {
    const s = applyHalf({ ...emptySave(), keyErrors: { KeyF: 4 } }, half, lessonIds);
    expect([s.matches, s.goals, s.pendingPacks]).toEqual([1, 3, 1]);
    expect(s.keyErrors).toEqual({ KeyF: 3 + 3, KeyK: 1 });
  });

  it('пак — за каждый тайм, даже без звёзд', () => {
    expect(applyHalf(emptySave(), { ...half, stars: 0, goals: 0 }, lessonIds).pendingPacks).toBe(1);
  });

  it('монеты за игру: 10 за звезду тайма и 10 за забитый пенальти, мимо — 2 (005-Р9)', () => {
    expect(applyHalf(emptySave(), { ...half, stars: 0 }, lessonIds).coins).toBe(0);
    expect(applyHalf(emptySave(), { ...half, stars: 3 }, lessonIds).coins).toBe(30);
    expect(applyHalf({ ...emptySave(), coins: COINS_MAX }, half, lessonIds).coins).toBe(COINS_MAX);
    const series = fillPenalty(applyHalf(emptySave(), { ...half, stars: 0 }, lessonIds), ['t1', 't2', 't3']);
    expect(applyPenalty(series, 't1', true).coins).toBe(10);
    expect(applyPenalty(series, 't1', false).coins).toBe(2);
  });

  it('конец матча с пенальти посреди тайма: монеты к звёздным, забитая — в решённые, повтор — один раз', () => {
    const kicks = [
      { taskId: 'q1', result: 'scored' as const },
      { taskId: 'q1', result: 'scored' as const },
    ];
    const s = applyHalf({ ...emptySave(), solvedTasks: ['t1'] }, { ...half, penalties: kicks }, lessonIds);
    expect([s.coins, s.solvedTasks, s.goals, s.lessonIndex]).toEqual([20 + 10, ['t1', 'q1'], 3, 1]);
    const missed = applyHalf(emptySave(), { ...half, stars: 1, penalties: [{ taskId: 'q2', result: 'missed' }] }, lessonIds);
    expect([missed.coins, missed.solvedTasks, missed.lessonIndex]).toEqual([10 + 2, [], 0]);
  });

  it('родитель ставит урок: в пределах уроков, остальное не трогает', () => {
    const save = { ...emptySave(), coins: 40, goals: 7 };
    // Пишется и id урока (007).
    expect(applySetLesson(save, 11, LEGACY_ORDER)).toEqual({ ...save, lessonIndex: 11, lessonId: 'yard-12' });
    expect(applySetLesson(save, 99, LEGACY_ORDER)).toMatchObject({ lessonIndex: 33, lessonId: 'city-10' });
    expect(applySetLesson(save, -3, LEGACY_ORDER).lessonIndex).toBe(0);
    expect(applySetLesson({ ...save, lessonIndex: 5 }, 2.5, LEGACY_ORDER).lessonIndex).toBe(5);
  });

  it('задание перерыва: 10 монет, потолок тот же', () => {
    expect(applyMinigame(emptySave()).coins).toBe(10);
    expect(applyMinigame({ ...emptySave(), coins: COINS_MAX }).coins).toBe(COINS_MAX);
  });

  it('рекорд «Собери клавиатуру»: хранится меньшее время по заданию; мусор и медленнее — без изменений', () => {
    const first = applyPuzzleRecord(emptySave(), 'home:ваол', 52_400);
    expect(first.puzzleBest).toEqual({ 'home:ваол': 52_400 });
    expect(applyPuzzleRecord(first, 'home:ваол', 60_000)).toBe(first);
    expect(applyPuzzleRecord(first, 'home:ваол', 52_400)).toBe(first);
    const better = applyPuzzleRecord(first, 'home:ваол', 38_000);
    expect(better.puzzleBest).toEqual({ 'home:ваол': 38_000 });
    // Другое задание (больше фишек) — свой рекорд, прежний не трогается.
    expect(applyPuzzleRecord(better, 'home:фываолдж', 70_000).puzzleBest).toEqual({
      'home:ваол': 38_000,
      'home:фываолдж': 70_000,
    });
    for (const ms of [0, -1, Number.NaN, Infinity, PUZZLE_TIME_MAX + 1]) expect(applyPuzzleRecord(first, 'home:ваол', ms)).toBe(first);
    for (const key of ['', 'home', 'side:ао', 'home:АО']) expect(applyPuzzleRecord(first, key, 1_000)).toBe(first);
    // Круг через JSON: рекорд читается тем же.
    expect(parseSave(JSON.parse(JSON.stringify(better))).puzzleBest).toEqual(better.puzzleBest);
  });

  it('рекорд урока: с зачётом и только лучше — быстрее, а при равной скорости точнее', () => {
    const first = applyLessonBest(emptySave(), 'yard-1', 2, { cpm: 87, acc: 0.9 });
    expect(first.lessonBest).toEqual({ 'yard-1': { cpm: 87, acc: 0.9 } });
    // Без зачёта (одна звезда) не пишет, даже если быстрее и рекорда нет.
    expect(applyLessonBest(emptySave(), 'yard-1', 1, { cpm: 300, acc: 1 })).toEqual(emptySave());
    expect(applyLessonBest(first, 'yard-1', 1, { cpm: 300, acc: 1 })).toBe(first);
    // Медленнее, равный и мусорный — без изменений.
    expect(applyLessonBest(first, 'yard-1', 3, { cpm: 80, acc: 1 })).toBe(first);
    expect(applyLessonBest(first, 'yard-1', 3, { cpm: 87, acc: 0.9 })).toBe(first);
    expect(applyLessonBest(first, 'yard-1', 3, { cpm: 0, acc: 1 })).toBe(first);
    expect(applyLessonBest(first, 'yard-1', 3, { cpm: 95, acc: Number.NaN })).toBe(first);
    expect(applyLessonBest(first, 'yard-1', 2, { cpm: 87, acc: 0.95 }).lessonBest['yard-1']).toEqual({ cpm: 87, acc: 0.95 });
    const faster = applyLessonBest(first, 'yard-1', 2, { cpm: 95, acc: 0.8 });
    expect(faster.lessonBest['yard-1']).toEqual({ cpm: 95, acc: 0.8 });
    // У другого урока — свой рекорд, прежний не трогается.
    expect(applyLessonBest(faster, 'yard-2', 2, { cpm: 60, acc: 1 }).lessonBest).toEqual({
      'yard-1': { cpm: 95, acc: 0.8 },
      'yard-2': { cpm: 60, acc: 1 },
    });
    expect([beatsBest({ cpm: 1, acc: 0 }, undefined), beatsBest({ cpm: 87, acc: 0.9 }, { cpm: 87, acc: 0.9 })]).toEqual([
      true,
      false,
    ]);
    expect(parseSave(JSON.parse(JSON.stringify(faster))).lessonBest).toEqual(faster.lessonBest);
  });

  it('рекорд урока в итоге: первый — без праздника, побит — с прибавкой, не побит — прежний; без зачёта — ничего', () => {
    const old = { cpm: 95, acc: 0.9 };
    expect(bestNote(undefined, { cpm: 87, acc: 1 }, 2)).toEqual({ kind: 'first', cpm: 87 });
    expect(bestNote(old, { cpm: 103, acc: 0.8 }, 2)).toEqual({ kind: 'fresh', cpm: 103, gain: 8 });
    expect(bestNote(old, { cpm: 95, acc: 0.95 }, 3)).toEqual({ kind: 'fresh', cpm: 95, gain: 0 });
    expect(bestNote(old, { cpm: 90, acc: 1 }, 3)).toEqual({ kind: 'kept', cpm: 95 });
    expect(bestNote(old, { cpm: 200, acc: 1 }, 1)).toBeNull();
    expect(bestNote(undefined, { cpm: 0, acc: 1 }, 2)).toBeNull();
    // Скорость и точность — за оба тайма (matchStats), как в итоге матча.
    const stats = { ...emptyStats, correct: 90, errors: 10, intervals: Array.from({ length: 100 }, () => 600) };
    expect(lessonBestOf(stats)).toEqual({ cpm: 90, acc: 0.9 });
  });

  it('рекорд — в сохранении своего игрока: у второго игрока свой', () => {
    const anna = applyPuzzleRecord(emptySave(), 'home:ваол', 30_000);
    const petya = applyPuzzleRecord(emptySave(), 'home:ваол', 45_000);
    expect([anna.puzzleBest['home:ваол'], petya.puzzleBest['home:ваол']]).toEqual([30_000, 45_000]);
    expect(applyPuzzleRecord(petya, 'home:ваол', 20_000).puzzleBest['home:ваол']).toBe(20_000);
    expect(anna.puzzleBest['home:ваол']).toBe(30_000);
  });

  it('первый тайм: матч, голы и ошибки клавиш — без пака, звёзд, монет, урока и пенальти', () => {
    const s = applyFirstHalf({ ...emptySave(), keyErrors: { KeyF: 4 } }, { goals: 2, stats });
    expect([s.matches, s.goals, s.pendingPacks, s.coins, s.lessonIndex]).toEqual([1, 2, 0, 0, 0]);
    expect(s.keyErrors).toEqual({ KeyF: 3 + 3, KeyK: 1 });
    expect(s.penalty).toBeNull();
    // Полный матч: один пак — в конце; второй тайм решает урок и открывает серию.
    const match = applyHalf(s, half, lessonIds);
    expect([match.matches, match.goals, match.pendingPacks, match.lessonIndex]).toEqual([2, 5, 1, 1]);
  });

  it('две звезды на текущем уроке — следующий урок; меньше или чужой урок — тот же', () => {
    // Номер и id урока пишутся вместе (007).
    expect(applyHalf(emptySave(), half, lessonIds)).toMatchObject({ lessonIndex: 1, lessonId: 'b' });
    expect(applyHalf(emptySave(), { ...half, stars: 3 }, lessonIds).lessonIndex).toBe(1);
    expect(applyHalf(emptySave(), { ...half, stars: 1 }, lessonIds)).toMatchObject({ lessonIndex: 0, lessonId: 'a' });
    expect(applyHalf(emptySave(), { ...half, lessonId: 'b' }, lessonIds).lessonIndex).toBe(0);
  });

  it('матч кубка урок не сдвигает, даже на текущем уроке; звёзды, монеты и пак — как обычно', () => {
    const cup = applyHalf(emptySave(), { ...half, stars: 3 }, lessonIds, false);
    expect([cup.lessonIndex, cup.coins, cup.pendingPacks, cup.matches]).toEqual([0, 30, 1, 1]);
    expect(cup.penalty).not.toBeNull();
  });

  it('последний урок повторяется', () => {
    const s = applyHalf({ ...emptySave(), lessonIndex: 2 }, { ...half, lessonId: 'c' }, lessonIds);
    expect(s.lessonIndex).toBe(2);
  });

  it('ошибки клавиш: старые затухают, новые прибавляются, потолок держится', () => {
    expect(mergeKeyErrors({ KeyA: 1 }, {})).toEqual({});
    expect(mergeKeyErrors({ KeyA: 8 }, {})).toEqual({ KeyA: 6 });
    expect(mergeKeyErrors({ KeyA: KEY_ERROR_CAP }, { KeyA: 50 })).toEqual({ KeyA: KEY_ERROR_CAP });
    let errors: Record<string, number> = { KeyA: KEY_ERROR_CAP };
    for (let i = 0; i < 12; i++) errors = mergeKeyErrors(errors, {});
    expect(errors).toEqual({});
  });

  it('пенальти: верно — гол и задача в решённые; мимо — удар записан, гола нет', () => {
    const series = fillPenalty(applyHalf(emptySave(), half, lessonIds), ['t1', 't2', 't3']);
    const once = applyPenalty(series, 't1', true);
    expect([once.goals - series.goals, once.solvedTasks, once.penalty?.results]).toEqual([1, ['t1'], [true]]);
    const miss = applyPenalty(once, 't2', false);
    expect([miss.goals, miss.coins, miss.solvedTasks]).toEqual([once.goals, once.coins + 2, ['t1']]);
    expect(miss.penalty?.results).toEqual([true, false]);
  });

  it('недобитая серия не пропадает: её удары с задачами переходят в серию следующего матча', () => {
    const old = { ...emptySave(), penalty: { kicks: 3, tasks: ['t1', 't2', 't3'], results: [true] } };
    const next = applyHalf(old, half, lessonIds);
    expect(next.penalty).toEqual({ kicks: 5, tasks: ['t2', 't3'], results: [] });
    expect(kicksToFill(next.penalty)).toBe(3);
    // Копятся не бесконечно: потолок PENALTY_MAX и при разборе сохранения.
    let s = emptySave();
    for (let i = 0; i < 5; i++) s = applyHalf(s, half, lessonIds);
    expect(s.penalty?.kicks).toBe(PENALTY_MAX);
    expect(parseSave({ ...full, penalty: { kicks: 99, tasks: [], results: [] } }, ctx).penalty?.kicks).toBe(PENALTY_MAX);
  });

  it('серия пенальти: матч открывает 3 удара, задачи выбираются один раз', () => {
    const ready = applyHalf(emptySave(), half, lessonIds);
    expect(ready.penalty).toEqual({ kicks: PENALTY_KICKS, tasks: [], results: [] });
    expect([kicksLeft(ready.penalty), kicksToFill(ready.penalty), nextKick(ready.penalty)]).toEqual([3, 3, null]);
    // Без выбранной задачи удар не засчитать.
    expect(applyPenalty(ready, 't1', true)).toBe(ready);
    const filled = fillPenalty(ready, ['t1', 't1', 't2', 't3', 't4']);
    expect(filled.penalty?.tasks).toEqual(['t1', 't2', 't3']);
    expect(fillPenalty(filled, ['t9'])).toBe(filled);
    expect(nextKick(filled.penalty)).toBe('t1');
    // Задач в игре меньше трёх — серия короче; нет совсем — серии нет.
    expect(fillPenalty(ready, ['t1']).penalty).toEqual({ kicks: 1, tasks: ['t1'], results: [] });
    expect(fillPenalty(ready, []).penalty).toBeNull();
  });

  it('серия пенальти: одна попытка на задачу — повтор, двойной Enter и чужая задача ничего не дают', () => {
    const filled = fillPenalty(applyHalf(emptySave(), half, lessonIds), ['t1', 't2', 't3']);
    const one = applyPenalty(filled, 't1', false);
    expect(applyPenalty(one, 't1', true)).toBe(one);
    expect(applyPenalty(one, 't3', true)).toBe(one);
    // Перезагрузка посреди серии: тот же следующий удар, пробитый не перебить.
    const reloaded = parseSave(JSON.parse(JSON.stringify(one)), { ...ctx, taskIds: ['t1', 't2', 't3'] });
    expect(nextKick(reloaded.penalty)).toBe('t2');
    expect(applyPenalty(reloaded, 't1', true)).toBe(reloaded);
    const done = applyPenalty(applyPenalty(reloaded, 't2', true), 't3', true);
    expect([kicksLeft(done.penalty), nextKick(done.penalty), done.penalty?.results]).toEqual([0, null, [false, true, true]]);
    expect(applyPenalty(done, 't3', true)).toBe(done);
    expect(done.coins - filled.coins).toBe(2 + 20);
    expect(applyPenalty(emptySave(), 't1', true)).toEqual(emptySave());
  });

  it('пак: минус пак, новая форма в коллекцию, дубль коллекцию не меняет', () => {
    const s = applyPack({ ...emptySave(), pendingPacks: 2 }, 'sky');
    expect([s.pendingPacks, s.ownedKits]).toEqual([1, ['sky']]);
    const dup = applyPack(s, 'sky');
    expect([dup.pendingPacks, dup.ownedKits]).toEqual([0, ['sky']]);
    expect(applyPack(dup, 'sky').pendingPacks).toBe(0);
  });

  it('пак: повтор даёт монеты по редкости, новая форма — нет; потолок монет держится', () => {
    const base = { ...emptySave(), pendingPacks: 5, ownedKits: ['sky'] };
    expect(applyPack(base, 'comet', 'epic').coins).toBe(0);
    expect(applyPack(base, 'sky', 'common').coins).toBe(DUP_COINS.common);
    expect(applyPack(base, 'sky', 'rare').coins).toBe(DUP_COINS.rare);
    expect(applyPack(base, 'sky', 'epic').coins).toBe(DUP_COINS.epic);
    expect([DUP_COINS.common, DUP_COINS.rare, DUP_COINS.epic]).toEqual([10, 25, 50]);
    expect(applyPack({ ...base, coins: COINS_MAX }, 'sky', 'epic').coins).toBe(COINS_MAX);
  });

  it('пак за монеты: минус цена, плюс пак; не хватает или всё собрано — ничего', () => {
    expect(PACK_PRICE).toBe(100);
    const rich = { ...emptySave(), coins: 130, ownedKits: ['sky'] };
    expect(canBuyPack(rich, 3)).toBe(true);
    const bought = buyPack(rich, 3);
    expect([bought.coins, bought.pendingPacks]).toEqual([30, 1]);
    expect(buyPack(bought, 3)).toBe(bought);
    expect(canBuyPack({ ...rich, coins: 99 }, 3)).toBe(false);
    const done = { ...rich, ownedKits: ['sky', 'scarlet', 'comet'] };
    expect(canBuyPack(done, 3)).toBe(false);
    expect(buyPack(done, 3)).toBe(done);
  });

  it('надеть: полученную — она, домашнюю — null, неполученную — ничего не меняется', () => {
    const s = wearKit(full, 'scarlet');
    expect(s.wornKit).toBe('scarlet');
    expect(wearKit(s, null).wornKit).toBeNull();
    expect(wearKit(s, CLUB_KIT_ID).wornKit).toBeNull();
    expect(wearKit(s, 'sky')).toBe(s);
    expect(wearKit(s, 'scarlet')).toBe(s);
  });

  it('форма на матч: надетая из коллекции, иначе домашняя клуба; без клуба — нет', () => {
    const kitList = [{ id: 'comet', name: 'Комета', rarity: 'rare' as const, ...KIT_COLORS }];
    expect(matchKit(full, kitList)?.id).toBe('comet');
    const home = matchKit({ ...full, wornKit: null }, kitList);
    expect([home?.id, home?.name, home?.body]).toEqual([CLUB_KIT_ID, 'Метеор', '#c8102e']);
    // Надетой нет среди форм игры — домашняя.
    expect(matchKit(full, [])?.id).toBe(CLUB_KIT_ID);
    expect(matchKit({ club: null, wornKit: null }, kitList)).toBeNull();
  });

  it('переходы не меняют исходное сохранение', () => {
    const before = JSON.parse(JSON.stringify(full)) as SaveData;
    applyHalf(full, half, lessonIds);
    applyFirstHalf(full, half);
    applyPenalty(full, 't4', true);
    fillPenalty(full, ['t5']);
    applyPack(full, 'sky');
    applyPack(full, 'scarlet', 'epic');
    buyPack(full, 10);
    wearKit(full, 'scarlet');
    applyPuzzleRecord(full, 'home:ваол', 1_000);
    applyLessonBest(full, 'yard-1', 3, { cpm: 500, acc: 1 });
    applyLessonBest(full, 'yard-9', 2, { cpm: 50, acc: 1 });
    expect(full).toEqual(before);
  });
});
