/**
 * Обёртка прогресса (src/app/progress) поверх хранилища: чтение, запись после каждого
 * изменения, сломанное хранилище. Отдельно от tests/save.test.ts — другая подготовка:
 * хранилище в памяти и перезагрузка модулей (и тот файл у предела 600 строк).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isProxy } from 'vue';
import lessonsJson from '../src/content/lessons.json';
import { CLUB_KIT_ID } from '../src/engine/club';
import { LEGACY_ORDER } from '../src/engine/lessonOrder';
import { APP_VERSION } from '../src/app/version';
import { PENALTY_KICKS, emptySave, parseSave } from '../src/engine/save';
import { DUP_COINS } from '../src/engine/rewards';
import { emptyStats } from '../src/engine/typing';

describe('обёртка прогресса и хранилище', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /** Хранилище в памяти; broken — каждое обращение бросает, как в приватном окне. */
  function fakeStorage(initial: Record<string, string> = {}, broken = false) {
    const data = new Map(Object.entries(initial));
    const guard = () => {
      if (broken) throw new Error('SecurityError');
    };
    return {
      data,
      getItem: (k: string) => (guard(), data.get(k) ?? null),
      setItem: (k: string, v: string) => (guard(), void data.set(k, v)),
      removeItem: (k: string) => (guard(), void data.delete(k)),
    };
  }

  const KIT = { pattern: 'plain', body: '#000000', sleeves: '#ffffff', trim: '#ffffff' } as const;
  const load = async () => import('../src/app/progress');

  it('читает сохранение и сохраняет после каждого изменения', async () => {
    const storage = fakeStorage({
      'keykick.save': JSON.stringify({ ...emptySave(), goals: 4, ownedKits: ['sky', 'gone'] }),
    });
    vi.stubGlobal('localStorage', storage);
    const p = await load();
    const stored = () => parseSave(JSON.parse(storage.data.get(p.currentSaveKey() ?? '') ?? 'null'));
    expect(p.progress.goals).toBe(4);
    expect(p.progress.ownedKits).toEqual(['sky']);
    const stats = { ...emptyStats, keyErrors: { KeyF: 2 } };
    p.recordHalf({ lessonId: p.currentLesson().id, stars: 3, goals: 2, stats });
    const s = stored();
    expect([s.goals, s.matches, s.pendingPacks, s.lessonIndex, s.lessonId]).toEqual([6, 1, 1, 1, 'yard-2']);
    expect(p.typingStats().keyErrors).toEqual({ KeyF: 2 });
    const pack = p.openPendingPack();
    expect(pack?.isNew).toBe(true);
    expect(p.progress.pendingPacks).toBe(0);
    expect(p.openPendingPack()).toBeNull();
    expect(stored().ownedKits).toContain(pack?.kitId);
  });

  it('битый JSON в хранилище — чистое состояние', async () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'keykick.save': '{не json' }));
    const p = await load();
    // Как новый игрок: отметка новостей — текущая версия, карточки нет (010-Р6).
    expect(p.progress).toEqual(emptySave(APP_VERSION));
  });

  it('кубок: зачёт последнего урока курса открывает финал кубка его лиги; матч кубка урок не сдвигает', async () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'keykick.save': JSON.stringify({ ...emptySave(), lessonIndex: 999 }) }));
    const p = await load();
    const final = p.currentLesson();
    expect(final.id).toBe('city-10');
    p.recordHalf({ lessonId: final.id, stars: 2, goals: 0, stats: emptyStats });
    expect(p.progress.cups.city).toEqual({ stage: 0, won: false, finalOpen: true });
    const index = p.progress.lessonIndex;
    p.recordCupHalf({ lessonId: final.id, stars: 3, goals: 1, stats: emptyStats }, 'city', 0, true);
    expect([p.progress.cups.city?.stage, p.progress.lessonIndex, p.progress.coins]).toEqual([1, index, 50]);
  });

  it('открытия: «Скоро» на уроках 1–2 — пенальти посреди матча; итог вехи и «Новое!» — на уроке 3', async () => {
    const at = async (lessonIndex: number) => {
      vi.resetModules();
      vi.stubGlobal('localStorage', fakeStorage({ 'keykick.save': JSON.stringify({ ...emptySave(), lessonIndex }) }));
      return import('../src/app/unlocks');
    };
    const u = await at(1);
    // Без подписи возможности «Скоро» пустело бы до урока 4 (005-Р16).
    expect(u.soon()).toEqual({ label: 'пенальти посреди матча', lesson: 2, left: 1 });
    expect(u.openedText('feature:midPenalty')).toBe('Новое: пенальти в матче!');
    expect(u.openedText('cup:yard:0')).toBe('Открыт 1/8 финала кубка!');
    expect([u.unlockLabel('feature:unknown'), u.openedText('feature:unknown')]).toEqual([null, null]);
    // «Новое!» — только на первом уроке после вехи (урок 2 — yard-2).
    expect(u.featureFresh('midPenalty')).toBe(false);
    expect((await at(2)).featureFresh('midPenalty')).toBe(true);
    expect((await at(3)).featureFresh('midPenalty')).toBe(false);
  });

  it('кубок: страж пускает на матч только открытого раунда; итог — «после урока N» у закрытого', async () => {
    // Урок 9 (yard-9): 1/8 и 1/4 открыты, 1/2 — после урока 10; районный кубок ещё не виден.
    const raw = { ...emptySave(), lessonIndex: 8, cups: { yard: { stage: 2, won: false } } };
    vi.stubGlobal('localStorage', fakeStorage({ 'keykick.save': JSON.stringify(raw) }));
    const c = await import('../src/app/cup');
    const to = (name: string, params: object, query: object) => ({ name, params, query }) as Parameters<typeof c.cupGuard>[0];
    expect(c.cupGuard(to('cup', { league: 'yard' }, {}))).toBe(true);
    expect(c.cupGuard(to('cup', { league: 'district' }, {}))).toBe('/');
    expect(c.cupGuard(to('match', {}, { cup: 'yard' }))).toBe('/cup/yard');
    expect(c.cupGuard(to('match', {}, { cup: 'district' }))).toBe('/');
    expect(c.cupGuard(to('match', {}, { cup: 'yard', round: '2' }))).toBe(true);
    expect(c.cupGuard(to('match', {}, {}))).toBe(true);
    expect(c.cupRounds('yard').map((r) => [r.lessonNumber, r.open])).toEqual([[4, true], [8, true], [10, false], [12, false]]);
    expect(c.firstMilestoneNumber('district')).toBe(15);
    const half = { lessonId: 'yard-8', stars: 3 as const, goals: 6, stats: emptyStats };
    const win = { goals: 6, conceded: 0, attacks: [], penalties: { taken: 0, scored: 0 } };
    const note = c.finishCupMatch(c.cupMatch('yard', 1), half, win, 0, true);
    // Строка итога — до 52 знаков (спека 002): иначе переносится, и итог вылезает за 640 px.
    expect(note.text).toBe('Проход дальше! 1/2 финала — после урока 10.');
    expect(c.finishCupMatch(c.cupMatch('yard', 0), half, win, 0, true).text).toBe(
      'Проход дальше! Следующий раунд — 1/4 финала.',
    );
  });

  it('хранилище бросает — игра идёт без сохранения', async () => {
    vi.stubGlobal('localStorage', fakeStorage({}, true));
    const p = await load();
    p.setClub({ name: 'Гром', kit: KIT });
    p.recordHalf({ lessonId: p.currentLesson().id, stars: 1, goals: 0, stats: emptyStats });
    p.fillPenaltySeries(7);
    p.recordPenalty(p.progress.penalty?.tasks[0] ?? '', true);
    expect(p.progress.club?.name).toBe('Гром');
    expect(p.progress.goals).toBe(1);
  });

  it('серия пенальти: задачи выбраны один раз и переживают перезагрузку', async () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    let p = await load();
    p.recordFirstHalf({ goals: 1, stats: emptyStats });
    expect(p.progress.penalty).toBeNull();
    p.recordHalf({ lessonId: p.currentLesson().id, stars: 2, goals: 0, stats: emptyStats });
    expect([p.progress.pendingPacks, p.progress.coins]).toEqual([1, 20]);
    p.fillPenaltySeries(11);
    const picked = [...(p.progress.penalty?.tasks ?? [])];
    expect(picked).toHaveLength(PENALTY_KICKS);
    p.fillPenaltySeries(12);
    expect(p.progress.penalty?.tasks).toEqual(picked);
    p.recordPenalty(picked[0] ?? '', false);
    p.recordPenalty(picked[0] ?? '', true);
    vi.resetModules();
    p = await load();
    expect(p.progress.penalty).toEqual({ kicks: PENALTY_KICKS, tasks: picked, results: [false] });
    expect(p.progress.solvedTasks).toEqual([]);
  });

  it('без клуба матч ведёт на экран клуба, с клубом — пускает', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    // Сам роутер в node не поднять (тянет .vue), поэтому проверяем функцию, которую он зовёт.
    const p = await load();
    expect(p.clubFirst()).toBe('/club');
    p.setClub({ name: 'Гром', kit: KIT });
    expect(p.clubFirst()).toBe(true);
  });

  it('имя и номер на спине сохраняются, без них — полей нет', async () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    const p = await load();
    const stored = () => parseSave(JSON.parse(storage.data.get(p.currentSaveKey() ?? '') ?? 'null')).club;
    p.setClub({ name: 'Гром', kit: KIT, shirtName: 'Илья', shirtNumber: 10 });
    expect(stored()).toEqual({ name: 'Гром', kit: KIT, shirtName: 'Илья', shirtNumber: 10 });
    p.setClub({ name: 'Гром', kit: KIT });
    expect(stored()).toEqual({ name: 'Гром', kit: KIT });
    expect(p.progress.club && 'shirtName' in p.progress.club).toBe(false);
  });

  it('надеть форму: сохраняется, в ней команда на матч; неполученную — нельзя', async () => {
    const storage = fakeStorage({ 'keykick.save': JSON.stringify({ ...emptySave(), ownedKits: ['sky'] }) });
    vi.stubGlobal('localStorage', storage);
    let p = await load();
    expect(p.ourKit()).toBeNull();
    p.setClub({ name: 'Гром', kit: KIT });
    expect(p.ourKit()?.id).toBe(CLUB_KIT_ID);
    p.wear('scarlet');
    expect(p.progress.wornKit).toBeNull();
    p.wear('sky');
    vi.resetModules();
    p = await load();
    expect([p.progress.wornKit, p.ourKit()?.id]).toEqual(['sky', 'sky']);
    p.wear(null);
    expect(p.ourKit()?.id).toBe(CLUB_KIT_ID);
  });

  it('справка «Как держать руки» показана — флаг сохраняется и переживает перезагрузку', async () => {
    const storage = fakeStorage({ 'keykick.save': JSON.stringify({ ...emptySave(), goals: 3 }) });
    vi.stubGlobal('localStorage', storage);
    const p = await load();
    expect(p.progress.handsHelpSeen).toBe(false);
    p.markHandsHelpSeen();
    const key = p.currentSaveKey() ?? '';
    // Первая запись несёт и id урока (007).
    expect(parseSave(JSON.parse(storage.data.get(key) ?? 'null'))).toEqual({
      ...emptySave(),
      goals: 3,
      handsHelpSeen: true,
      lessonId: 'yard-1',
    });
    vi.resetModules();
    expect((await load()).progress.handsHelpSeen).toBe(true);
  });

  it('бутсы: покупка — одной записью, движку — копия без обёрток; «Надеть» переживает перезагрузку', async () => {
    const raw = { ...emptySave(), coins: 400, boughtBoots: ['blue', 'gone'], cups: { yard: { stage: 4, won: true } } };
    const storage = fakeStorage({ 'keykick.save': JSON.stringify(raw) });
    vi.stubGlobal('localStorage', storage);
    const seen: unknown[] = [];
    vi.doMock('../src/engine/boots', async (importOriginal) => {
      const real = await importOriginal<typeof import('../src/engine/boots')>();
      const buyBoots: typeof real.buyBoots = (save, list, id) => {
        seen.push(save.boughtBoots);
        return real.buyBoots(save, list, id);
      };
      return { ...real, buyBoots };
    });
    let p = await load();
    expect(p.progress.boughtBoots).toEqual(['blue']);
    expect(p.ourBoots().id).toBe('basic');
    const writes = vi.spyOn(storage, 'setItem');
    expect(p.buyBootsNow('white')).toBe(true);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(p.buyBootsNow('white')).toBe(false);
    expect(p.buyBootsNow('neon')).toBe(false);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(seen.length).toBe(3);
    expect(seen.some((x) => isProxy(x))).toBe(false);
    p.wearBootsNow('red');
    expect(p.progress.wornBoots).toBeNull();
    p.wearBootsNow('cup-yard');
    vi.resetModules();
    p = await load();
    expect([p.progress.coins, p.progress.boughtBoots, p.ourBoots().id]).toEqual([100, ['blue', 'white'], 'cup-yard']);
    vi.doUnmock('../src/engine/boots');
  });

  it('пак за монеты и повтор с монетами — через обёртку, всё сохраняется', async () => {
    const storage = fakeStorage({ 'keykick.save': JSON.stringify({ ...emptySave(), coins: 120 }) });
    vi.stubGlobal('localStorage', storage);
    const p = await load();
    const stored = () => parseSave(JSON.parse(storage.data.get(p.currentSaveKey() ?? '') ?? 'null'));
    expect(p.buyPackForCoins()).toBe(true);
    expect([stored().coins, stored().pendingPacks]).toEqual([20, 1]);
    expect(p.buyPackForCoins()).toBe(false);
    expect(p.openPendingPack()?.coins).toBe(0);
  });

  it('повтор из полной коллекции: монеты по редкости выпавшей формы', async () => {
    const { kits } = await import('../src/app/kits');
    const all = kits.map((k) => k.id);
    const raw = JSON.stringify({ ...emptySave(), ownedKits: all, pendingPacks: 1 });
    vi.stubGlobal('localStorage', fakeStorage({ 'keykick.save': raw }));
    const p = await load();
    const r = p.openPendingPack();
    const rarity = kits.find((k) => k.id === r?.kitId)?.rarity ?? 'common';
    expect(r?.isNew).toBe(false);
    expect(r?.coins).toBe(DUP_COINS[rarity]);
    expect(p.progress.coins).toBe(DUP_COINS[rarity]);
  });

  it('время игры копится по действиям и переживает перезагрузку', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    let p = await load();
    const t0 = 1_800_000_000_000;
    for (let i = 0; i <= 10; i++) p.noteAction(t0 + i * 30_000, '2026-11-04');
    expect(p.progress.days['2026-11-04']).toBe(300_000);
    vi.resetModules();
    p = await load();
    expect(p.progress.days['2026-11-04']).toBe(300_000);
  });

  it('перерыв переживает перезагрузку; родитель выключил — снят', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    let p = await load();
    const t0 = 1_800_000_000_000;
    p.setBreakSettings({ enabled: true, playMinutes: 10, breakMinutes: 5 });
    for (let i = 0; i <= 20; i++) p.noteAction(t0 + i * 30_000, '2026-11-04');
    expect(p.shared.clock.breakDue).toBe(true);
    p.beginDueBreak(t0 + 600_001);
    vi.resetModules();
    p = await load();
    expect(p.shared.clock.breakUntil).toBe(t0 + 600_001 + 300_000);
    p.setBreakSettings({ ...p.shared.breakSettings, enabled: false });
    expect(p.shared.clock.breakUntil).toBeNull();
  });

  it('рекорд урока: с зачётом пишется и переживает перезагрузку; у другого игрока свой', async () => {
    const storage = fakeStorage({
      'keykick.save': JSON.stringify({ ...emptySave(), lessonBest: { 'yard-1': { cpm: 80, acc: 0.9 } } }),
      'keykick.save.p2': JSON.stringify({ ...emptySave(), lessonBest: { 'yard-1': { cpm: 150, acc: 1 } } }),
    });
    vi.stubGlobal('localStorage', storage);
    const p = await load();
    const anna = p.activeId() ?? '';
    const stored = (id: string) => parseSave(JSON.parse(storage.data.get(`keykick.save.${id}`) ?? 'null'));
    // Без зачёта и медленнее — не пишется.
    p.recordLessonBest('yard-1', 1, { cpm: 120, acc: 1 });
    p.recordLessonBest('yard-1', 3, { cpm: 70, acc: 1 });
    expect(stored(anna).lessonBest).toEqual({ 'yard-1': { cpm: 80, acc: 0.9 } });
    p.recordLessonBest('yard-1', 2, { cpm: 95, acc: 0.92 });
    expect(stored(anna).lessonBest).toEqual({ 'yard-1': { cpm: 95, acc: 0.92 } });
    p.loadPlayer('p2');
    expect(p.progress.lessonBest['yard-1']).toEqual({ cpm: 150, acc: 1 });
    p.recordLessonBest('yard-1', 2, { cpm: 100, acc: 1 });
    expect(stored('p2').lessonBest['yard-1']).toEqual({ cpm: 150, acc: 1 });
    vi.resetModules();
    const again = await load();
    expect(again.activeId()).toBe(anna);
    expect(again.progress.lessonBest).toEqual({ 'yard-1': { cpm: 95, acc: 0.92 } });
  });

  /** Урок игрока в хранилище как есть, без разбора: номер и id (007). */
  const storedPlace = (storage: ReturnType<typeof fakeStorage>, key: string) =>
    JSON.parse(storage.data.get(key) ?? 'null') as { lessonIndex: number; lessonId?: string };
  const lessonIds = lessonsJson.lessons.map((l) => l.id);

  it('старое сохранение после вставок (007): без поля урок — по старому порядку; первая запись содержит lessonId', async () => {
    const old = (lessonIndex: number) => ({ ...emptySave(), lessonIndex });
    const read = (lessonIndex: number) => lessonIds[parseSave(old(lessonIndex), { lessonIds }).lessonIndex];
    expect([4, 33, 30, 999].map(read)).toEqual(['yard-5', 'city-10', 'city-7', 'city-10']);
    // Через обёртку: тот же урок, первое же действие пишет его id рядом с номером.
    const storage = fakeStorage({ 'keykick.save': JSON.stringify(old(30)) });
    vi.stubGlobal('localStorage', storage);
    const p = await load();
    expect(p.currentLesson().id).toBe('city-7');
    p.markHandsHelpSeen();
    const place = storedPlace(storage, p.currentSaveKey() ?? '');
    expect([place.lessonId, lessonIds[place.lessonIndex]]).toEqual(['city-7', 'city-7']);
  });

  it('старый порядок (007): 34 id, все есть в lessons.json, взаимный порядок прежний', () => {
    expect([LEGACY_ORDER.length, new Set(LEGACY_ORDER).size]).toEqual([34, 34]);
    const at = LEGACY_ORDER.map((id) => lessonIds.indexOf(id));
    expect(LEGACY_ORDER.filter((_, i) => (at[i] ?? -1) < 0)).toEqual([]);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('родитель ставит урок игроку не из этой вкладки (007): в хранилище номер и lessonId', async () => {
    const storage = fakeStorage({
      'keykick.save': JSON.stringify(emptySave()),
      'keykick.save.p2': JSON.stringify({ ...emptySave(), lessonIndex: 2 }),
    });
    vi.stubGlobal('localStorage', storage);
    const p = await load();
    expect(p.activeId()).not.toBe('p2');
    p.setLessonOf('p2', 25);
    expect(storedPlace(storage, 'keykick.save.p2')).toMatchObject({ lessonIndex: 25, lessonId: lessonIds[25] });
    // Своему игроку — сразу в память и в хранилище.
    p.setLessonOf(p.activeId() ?? '', 3);
    expect([p.progress.lessonId, storedPlace(storage, p.currentSaveKey() ?? '').lessonId]).toEqual(['yard-4', 'yard-4']);
  });

  it('сброс: ключ сохранения удалён, прогресс пустой', async () => {
    const storage = fakeStorage({ 'keykick.save': JSON.stringify({ ...emptySave(), goals: 9 }) });
    vi.stubGlobal('localStorage', storage);
    const p = await load();
    const { resetPlayer } = await import('../src/app/roster');
    expect(p.progress.goals).toBe(9);
    const key = p.currentSaveKey() ?? '';
    expect(storage.data.has(key)).toBe(true);
    resetPlayer(p.activeId() ?? '');
    expect(storage.data.has(key)).toBe(false);
    expect(p.progress).toEqual(emptySave(APP_VERSION));
  });
});
