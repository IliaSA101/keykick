/**
 * Ядро игрока и общая часть (src/app/players/active, shared) поверх хранилища: сломанное хранилище, перерыв,
 * сброс, сохранение новее, урок от родителя. Другая подготовка, чем у tests/save*.test.ts: хранилище в памяти
 * и перезагрузка модулей (спека 018-Т6б2; раньше — обёртка прогресса `app/progress` над разделом `legacy`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAYERS_KEY, SHARED_KEY, TAB_KEY, saveKey } from '../src/app/storage';
import { section as courseSection, type CourseSave } from '../src/engine/course/save';
import { nextEnvelope } from '../src/engine/save/format';
import { firstOpenIndex, lessonIndexOf, parentView, setLesson } from '../src/engine/parent/view';
import { section as walletSection } from '../src/engine/wallet/save';

describe('ядро игрока и общая часть', () => {
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

  const boot = async () => ({
    shared: await import('../src/app/players/shared'),
    active: await import('../src/app/players/active'),
    sections: await import('../src/app/save/sections'),
  });

  /** Конверт игрока с монетами. */
  const walletEnvelope = (coins: number): string =>
    JSON.stringify(nextEnvelope({ rev: 0 }, { wallet: { ...walletSection.empty({}), coins } }, '0.10.1'));
  const coinsAt = (storage: ReturnType<typeof fakeStorage>, key: string): number =>
    (JSON.parse(storage.data.get(key) ?? 'null') as { sections: { wallet: { coins: number } } }).sections.wallet.coins;

  // Ловит: хранилище недоступно, а ядро роняет игру или не держит ход в памяти.
  it('хранилище бросает — игра идёт без сохранения, ход живёт в памяти', async () => {
    vi.stubGlobal('localStorage', fakeStorage({}, true));
    vi.stubGlobal('sessionStorage', fakeStorage());
    const { active, sections } = await boot();
    expect(active.activeId()).not.toBeNull();
    sections.updateSection(walletSection, (w) => ({ ...w, coins: 4 }));
    expect(sections.readSection(walletSection).coins).toBe(4);
  });

  // Ловит: ТЗ-10.6 — перерыв включён по умолчанию (ребёнка прерывают без просьбы родителя).
  it('перерыв по умолчанию выключен: время набралось, перерыв не назначен', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    vi.stubGlobal('sessionStorage', fakeStorage());
    const { shared } = await boot();
    expect(shared.shared.breakSettings.enabled).toBe(false);
    const t0 = 1_800_000_000_000;
    for (let i = 0; i <= 40; i++) shared.noteAction(t0 + i * 30_000, '2026-11-04');
    expect(shared.shared.clock.breakDue).toBe(false);
  });

  // Ловит: родитель включил перерыв, а он не доживает до перезагрузки или не снимается выключением.
  it('перерыв переживает перезагрузку; родитель выключил — снят', async () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', fakeStorage());
    let { shared } = await boot();
    const t0 = 1_800_000_000_000;
    shared.setBreakSettings({ enabled: true, playMinutes: 10, breakMinutes: 5 });
    for (let i = 0; i <= 20; i++) shared.noteAction(t0 + i * 30_000, '2026-11-04');
    expect(shared.shared.clock.breakDue).toBe(true);
    shared.beginDueBreak(t0 + 600_001);
    vi.resetModules();
    ({ shared } = await boot());
    expect(shared.shared.clock.breakUntil).toBe(t0 + 600_001 + 300_000);
    shared.setBreakSettings({ ...shared.shared.breakSettings, enabled: false });
    expect(shared.shared.clock.breakUntil).toBeNull();
  });

  // Ловит: 018-Р28 — дни игры снова попали в общую часть или в сохранение игрока (раздела дня ещё нет).
  it('время по дням не пишется: общая часть — только часы и настройки', async () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', fakeStorage());
    const { shared } = await boot();
    const t0 = 1_800_000_000_000;
    shared.setBreakSettings({ enabled: true, playMinutes: 10, breakMinutes: 5 });
    for (let i = 0; i <= 10; i++) shared.noteAction(t0 + i * 30_000, '2026-11-04');
    const written = JSON.parse(storage.data.get(SHARED_KEY) ?? 'null') as Record<string, unknown>;
    expect(Object.keys(written).sort()).toEqual(['breakSettings', 'clock']);
    expect(storage.data.get(saveKey('p1')) ?? '').not.toContain('2026-11-04');
  });

  // Ловит: сброс не очищает разделы v2 или теряет сырое «до» (копия `pre.<id>.reset.<ms>`).
  it('сброс: разделы чистые, сырое «до» лежит в копии', async () => {
    const storage = fakeStorage({ [saveKey('p1')]: walletEnvelope(9) });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', fakeStorage());
    const { active, sections } = await boot();
    const { resetPlayer } = await import('../src/app/roster');
    expect(active.activeId()).toBe('p1');
    expect(sections.readSection(walletSection).coins).toBe(9);
    resetPlayer('p1');
    expect(sections.readSection(walletSection).coins).toBe(0);
    expect(coinsAt(storage, saveKey('p1'))).toBe(0);
    const copies = [...storage.data.keys()].filter((k) => k.includes('.reset.'));
    expect(copies).toHaveLength(1);
    expect(coinsAt(storage, copies[0] ?? '')).toBe(9);
  });

  // Ловит: родитель ставит урок игроку, который не играет в этой вкладке, а запись уходит не в его ключ.
  it('родитель ставит урок другому игроку: в его ключе lesson и пройденные до него, у играющего — прежнее', async () => {
    const storage = fakeStorage({
      [PLAYERS_KEY]: JSON.stringify({ players: [{ id: 'p1', name: 'Миша' }, { id: 'p2', name: 'Аня' }], current: 'p1', lastId: 2 }),
      [saveKey('p1')]: walletEnvelope(1),
      [saveKey('p2')]: walletEnvelope(2),
    });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', fakeStorage({ [TAB_KEY]: 'p1' }));
    const { active, sections } = await boot();
    const { courseLessons } = await import('../src/app/course/load');
    const { setLesson } = await import('../src/engine/parent/view');
    const ids = courseLessons.map((l) => l.id);
    sections.updatePlayer((tx) => tx.set(courseSection, setLesson(tx.get(courseSection) as CourseSave, 3, ids)), { player: 'p2' });
    const p2 = active.peekSave('p2').course as CourseSave;
    expect(p2.lesson).toBe(ids[3]);
    expect(p2.passed).toEqual(ids.slice(0, 3));
    expect(active.peekSave('p1').course).toEqual(courseSection.empty({}));
    expect(coinsAt(storage, saveKey('p2'))).toBe(2);
  });

  // Ловит: после сброса показ (`sectionRef`: клуб, монеты, карта) держит прежнее до F5 — слушатели не вызваны.
  it('сброс игрока вкладки: sectionRef равен readSection (не прежнее до F5)', async () => {
    vi.stubGlobal('localStorage', fakeStorage({ [saveKey('p1')]: walletEnvelope(9) }));
    vi.stubGlobal('sessionStorage', fakeStorage());
    const { sections } = await boot();
    const { resetPlayer } = await import('../src/app/roster');
    const ref = sections.sectionRef(walletSection);
    expect(ref.value.coins).toBe(9);
    resetPlayer('p1');
    expect(sections.readSection(walletSection).coins).toBe(0);
    expect(ref.value).toEqual(sections.readSection(walletSection));
  });

  // Ловит: родитель играющего видит лежащее в хранилище, а не то, что держит слой, когда запись не легла.
  it('viewSave: у играющего — память слоя (запись не легла), у другого — лежащее', async () => {
    const storage = fakeStorage({
      [PLAYERS_KEY]: JSON.stringify({ players: [{ id: 'p1', name: 'Миша' }, { id: 'p2', name: 'Аня' }], current: 'p1', lastId: 2 }),
      [saveKey('p1')]: walletEnvelope(1),
      [saveKey('p2')]: walletEnvelope(2),
    });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', fakeStorage({ [TAB_KEY]: 'p1' }));
    const { active, sections } = await boot();
    const set = storage.setItem;
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    sections.updateSection(walletSection, (w) => ({ ...w, coins: 5 }));
    storage.setItem = set;
    expect(coinsAt(storage, saveKey('p1'))).toBe(1);
    expect((active.viewSave('p1').wallet as { coins: number }).coins).toBe(5);
    expect((active.peekSave('p1').wallet as { coins: number }).coins).toBe(1);
    expect((active.viewSave('p2').wallet as { coins: number }).coins).toBe(2);
  });

  // Ловит: сохранение новее программы — а смена настроек перерыва пишет общую часть.
  it('сохранение новее: настройки перерыва меняются в памяти, общая часть и список побайтно прежние', async () => {
    const future = JSON.stringify({ format: 0, draft: 99, rev: 5, app: '9', sections: { wallet: {} } });
    const init = {
      [PLAYERS_KEY]: JSON.stringify({ players: [{ id: 'p1', name: 'Игрок 1' }], current: 'p1', lastId: 1 }),
      [saveKey('p1')]: future,
      [SHARED_KEY]: JSON.stringify({ clock: {}, breakSettings: { enabled: true, playMinutes: 30, breakMinutes: 5 } }),
    };
    const storage = fakeStorage(init);
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', fakeStorage());
    const { shared } = await boot();
    shared.setBreakSettings({ enabled: false, playMinutes: 20, breakMinutes: 3 });
    expect(shared.shared.breakSettings.enabled).toBe(false);
    expect(Object.fromEntries(storage.data)).toEqual(init);
  });
});

describe('родитель на разделах v2 (engine/parent/view)', () => {
  const ids = ['yard-01', 'yard-02', 'yard-03', 'yard-04'];
  const course = (lesson: string, passed: string[]): CourseSave => ({ lesson, passed, lessons: {} });

  // Ловит: родитель видит пустое вместо урока, монет и ошибок клавиш из разделов v2.
  it('parentView: урок, монеты, ошибки клавиш и клуб — из разделов; пустое — по умолчанию', () => {
    expect(parentView({})).toEqual({ lessonId: '', passed: [], coins: 0, keyErrors: {}, clubName: '' });
    const v = parentView({
      course: { ...courseSection.empty({}), lesson: 'yard-03' },
      wallet: { ...walletSection.empty({}), coins: 7 },
      match: { keyErrors: { KeyF: 4 } },
      club: { name: 'Метеор', createdAt: 1_800_000_000_000 },
    });
    expect([v.lessonId, v.coins, v.keyErrors, v.clubName]).toEqual(['yard-03', 7, { KeyF: 4 }, 'Метеор']);
  });

  // Ловит: «Поставить урок» ставит указатель, но не засчитывает прошлые уроки (карта пути смотрит на `passed`).
  it('setLesson: вперёд — урок и пройденные до него; уже пройденное остаётся', () => {
    expect(setLesson(course('', []), 2, ids)).toEqual(course('yard-03', ['yard-01', 'yard-02']));
    expect(setLesson(course('yard-02', ['yard-02', 'yard-01']), 3, ids)).toEqual(course('yard-04', ['yard-02', 'yard-01', 'yard-03']));
    const same = course('yard-02', ['yard-01']);
    expect(setLesson(same, 1, ids)).toBe(same);
  });

  // Ловит: 018-Р31 — «назад» принимается, и родитель видит «урок 1», а карта (passed не снят) — прежний.
  it('setLesson назад: раньше первого не пройденного — отказ, сохранение как было', () => {
    const c = course('yard-04', ['yard-01', 'yard-02', 'yard-03']);
    expect(setLesson(c, 0, ids)).toBe(c);
    expect(setLesson(c, 2, ids)).toBe(c);
    expect(firstOpenIndex(c.passed, ids)).toBe(3);
    expect(firstOpenIndex([], ids)).toBe(0);
    expect(firstOpenIndex(ids, ids)).toBe(3);
  });

  // Ловит: номер за границами или дробь роняют родителя; пустой курс меняет сохранение.
  it('setLesson и lessonIndexOf: границы, дробь, пустой курс, незнакомый id', () => {
    expect(setLesson(course('', []), 99, ids).lesson).toBe('yard-04');
    expect(setLesson(course('', []), -3, ids).lesson).toBe('yard-01');
    expect(setLesson(course('', []), 1.5, ids).lesson).toBe('yard-01');
    const c = course('x', []);
    expect(setLesson(c, 2, [])).toBe(c);
    expect([lessonIndexOf('', ids), lessonIndexOf('zzz', ids), lessonIndexOf('yard-03', ids)]).toEqual([0, 0, 2]);
  });
});
