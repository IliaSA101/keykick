/**
 * К-Г (065 Т4): фикстуры стенда кадров валидны — разделы проходят проверку реестра сборки, сеанс в памяти открывается
 * и отдаёт игрока без обращения к хранилищу браузера. Сами фикстуры пишет `node tools/accepted/states.mjs`.
 */
import { describe, expect, it } from 'vitest';
import { frameRun, type FrameMatch } from '../../src/app/match/frame';
import { buildStart } from '../../src/app/match/run';
import { SECTIONS } from '../../src/app/save/sections';
import { courseLessons, dictionary } from '../course/yard';
import { journalView } from '../../src/app/school/journal';
import type { School } from '../../src/engine/school/section';
import { deviceRow } from '../../src/engine/parent/repair';
import { lessonLetters } from '../../src/app/base/play';
import { lineupOf } from '../../src/app/base/mini';
import { wordsFor } from '../../src/engine/base/games/free';
import { remind } from '../../src/engine/save/remind';
import { frameSession, type FrameFixture } from '../../src/screens/dev/frameSession';
import { MIN_DOT, MIN_TEXT, findSmall, formatSmall, type Scan } from '../../tools/textScan.mjs';

const files = import.meta.glob<FrameFixture>('../fixtures/accepted/*.json', { eager: true, import: 'default' });
const all = Object.entries(files).map(([path, fx]) => [path.replace(/^.*\/|\.json$/g, ''), fx] as const);

describe('К-Г: фикстуры стенда кадров', () => {
  it('фикстуры есть: Дом, Карта, матч, итог', () => {
    const screens = new Set(all.map(([, fx]) => fx.screen));
    for (const s of ['home', 'map', 'match', 'coach-minute']) expect(screens.has(s), s).toBe(true);
    expect(all.length).toBeGreaterThan(60);
  });

  it.each(all)('%s: имя файла = id, коды и маршрут заданы', (id, fx) => {
    expect(fx.id).toBe(id);
    expect(Object.values(fx.codes).length).toBeGreaterThan(0);
    expect(fx.route).toMatch(/^\/(home|map|match|result|coach|cup|parent|club|museum|start|path|shop|pack|locker|school|school\/tour|school\/waits|school\/kicks|base|base\/[a-z]+)$/);
    expect(Number.isInteger(fx.seed)).toBe(true);
  });

  it.each(all)('%s: каждый раздел проходит проверку реестра', (_id, fx) => {
    for (const [name, data] of Object.entries(fx.sections)) {
      const def = SECTIONS.find((d) => d.name === name);
      expect(def, `раздел ${name} не в реестре`).toBeDefined();
      expect(def!.check(data), `раздел ${name}`).toEqual([]);
    }
  });

  // битое устройство (063-Р65) — единственное состояние без игрока: его проверяет отдельный тест «broken-device» ниже
  it.each(all.filter(([, fx]) => fx.broken !== 'device'))('%s: сеанс в памяти собирается, игрок открыт, статус ok', async (_id, fx) => {
    const session = await frameSession(fx);
    expect(session.status.value).toBe('ok');
    const p = session.player.value;
    expect(p.kind).toBe('ok');
    if (p.kind === 'ok') {
      expect(p.pid).toBe(fx.player.pid);
      for (const name of Object.keys(fx.sections)) expect(p.env.sections[name]?.data).toEqual(fx.sections[name]);
    }
  });
});

describe('К4 (065-Р187): Карта — кадр с выбранным двором открывает окно уроков', () => {
  const fx = (id: string): FrameFixture => files[`../fixtures/accepted/${id}.json`]!;

  it('К4 map.pick (Э2.11, Э2.36): фикстура несёт ступень 2 — двор доступен на уроке 17; прочие кадры Карты выбора не несут', () => {
    expect(fx('map.pick').mapPick).toBe(2);
    expect(fx('map.pick').route).toBe('/map');
    const cur = (fx('map.pick').sections['course:ru'] as { current: string }).current;
    expect(cur).toBe('ru.yard.longer-words');
    for (const [id, f] of all) if (f.screen === 'map' && id !== 'map.pick') expect(f.mapPick, id).toBeUndefined();
  });
});

describe('К13: матч каждой фикстуры стенда строится', () => {
  const matches = all.filter(([, fx]) => (fx.match as Partial<FrameMatch> | undefined)?.spec !== undefined);

  it('есть фикстуры с ходом матча, в том числе перерыв (Э1.16, 29, 30)', () => {
    expect(matches.length).toBeGreaterThan(30);
    for (const id of ['match.game-pass', 'match.game-pass-2', 'match.break-2']) expect(matches.map(([k]) => k), id).toContain(id);
  });

  it.each(matches)('К13 %s: frameRun доигрывает матч до места кадра без исключения', (_id, fx) => {
    // Ловит: исходы фикстуры несовместимы с планом урока (frameRun бросает ошибку) — стенд показывает «Ой, что-то сломалось», а тесты были зелёными (Э1.16, 29, 30).
    const m = fx.match as FrameMatch;
    const lesson = courseLessons.find((l) => l.n === m.lesson);
    expect(lesson, `урок ${m.lesson}`).toBeDefined();
    expect(() => frameRun(buildStart(lesson!, m.seed, dictionary), m.spec)).not.toThrow();
  });

  it('К13 (068-Р100): перерыв Э1.15/.17 имеют состояние, а кадры «перерыв + микроразминка» стоят в перерыве с открытым окном', () => {
    // Ловит: DECIDE-кадры перерыва без фикстуры (стенд — окно сбоя) и кадр разминки, который встаёт на вступление или не в перерыве.
    const id = (k: string): FrameMatch => files[`../fixtures/accepted/${k}.json`]!.match as FrameMatch;
    expect(id('match.break').spec.toBreak).toBe(true);
    expect(id('match.break-after').after?.id).toBe('tab');
    for (const [k, step] of [['match.break-warm', 'shake'], ['match.break-warm-2', 'far']] as const) {
      const m = id(k);
      expect([m.started, m.spec.toBreak, m.warm], k).toEqual([true, true, step]);
      const run = frameRun(buildStart(courseLessons.find((l) => l.n === m.lesson)!, m.seed, dictionary), m.spec);
      expect(run.state.phase, k).toBe('break');
    }
  });
});

describe('К14 (063-Р58): фикстуры страницы родителя и окон (Т11)', () => {
  it('К14 (063-Р58): parent.main — два игрока на устройстве, игрок вкладки выбран, последний файл 2 дня назад; файл parent.load собирается и читается планом', async () => {
    // Ловит: стенд родителя показывает одного игрока или «ещё не сохраняли» (кадр Э6.47 сверяется не с тем состоянием), файл кадра «Загрузить» не открывается.
    const fx = files['../fixtures/accepted/parent.main.json']!;
    const s = await frameSession(fx);
    expect(s.transfer.here().players.map((p) => p.name)).toEqual(['Саша', 'Миша']);
    expect(s.transfer.here().device?.parent.exported).toBe('2026-11-16');
    expect(s.tabPid.value).toBe('p1');
    const load = files['../fixtures/accepted/parent.load.json']!;
    const first = load.file!.players[0]!;
    const made = await frameSession({ ...load, exportedAgo: 0, player: first, sections: first.sections, players: load.file!.players });
    const out = made.transfer.exportText(load.file!.made, 'https://example.org/keykick/next/');
    expect(out.ok).toBe(true);
    expect(out.ok && s.transfer.plan(out.text).kind).toBe('ok');
  });
});

describe('К14 (063-Р62, Р63): фикстуры плашки напоминания и корзины (Т12)', () => {
  const open = async (id: string) => {
    const fx = files[`../fixtures/accepted/${id}.json`]!;
    return { fx, s: await frameSession(fx) };
  };

  it('К14 плашка: «файла не было» и «12 дней назад» — remind сказал «пора», «сохранено сегодня» — нет', async () => {
    // Ловит: кадры Э6.83–88 снимаются не с тем состоянием (плашка там, где её нет, или без неё там, где она нужна).
    const states = await Promise.all(['parent.remind-none', 'parent.remind-old', 'parent.remind-fresh'].map(open));
    const [none, old, fresh] = states.map(({ s, fx }) => {
      const h = s.transfer.here();
      return { exported: h.device?.parent.exported, on: h.device !== null && remind(h.device, h.players, fx.clock.day) };
    });
    expect(none).toEqual({ exported: undefined, on: true });
    expect(old).toEqual({ exported: '2026-11-06', on: true });
    expect(fresh).toEqual({ exported: '2026-11-18', on: false });
  });

  it('К14 корзина: bin-after — Миша в корзине с сегодняшним днём, во вкладках один Саша; bin-ask — оба, открыт шаг ask; bin-back — «Вернуть» нажимает стенд', async () => {
    // Ловит: игрок «в корзине» остаётся в списке устройства (кадры Э6.91–94 без корзины) или лежит без дня (подпись без даты); шаг кадра не доходит до страницы.
    const after = await open('parent.bin-after');
    expect(after.s.transfer.here().players.map((p) => p.name)).toEqual(['Саша']);
    expect(after.s.bin.list('2026-11-18')).toMatchObject([{ pid: 'p2', name: 'Миша', day: '2026-11-18' }]);
    expect((await open('parent.bin-clear')).fx.stand).toEqual({ step: 'clear', scroll: 'players' });
    const ask = await open('parent.bin-ask');
    expect(ask.s.transfer.here().players.map((p) => p.name)).toEqual(['Саша', 'Миша']);
    expect(ask.fx.stand).toEqual({ tab: 'p2', step: 'ask', scroll: 'players' });
    expect((await open('parent.bin-back')).fx.stand?.step).toBe('back');
  });

  it('К12 (063-Р65) broken-player: Миша в списке, а файл не читается — here() держит его в stuck с именем из обрывка; Саша открыт', async () => {
    // Ловит: кадр «не открывается» собирается без битого игрока (стенд показывает здорового Мишу) или теряет имя.
    const { s } = await open('parent.broken-player');
    const h = s.transfer.here();
    expect(h.players.map((p) => p.name)).toEqual(['Саша']);
    expect(h.stuck).toEqual([{ pid: 'p2', kind: 'broken', name: 'Миша' }]);
  });

  it('К12 (063-Р65) broken-player: «Начать заново» оставляет Мишу с тем же pid и именем, Саша и список устройства не тронуты, корзина пуста, чужого игрока не появилось', async () => {
    // Ловит: фикстура ведёт себя не как ручная порча — restart создаёт игрока с другим pid или именем «Игрок», выкидывает Сашу из устройства, уводит Мишу в корзину.
    const { s } = await open('parent.broken-player');
    await s.init(); // страница зовёт init второй раз — состояние то же
    const before = s.transfer.here();
    expect(await s.bin.settle('2026-11-18')).toBe(false); // ParentBin при показе: сирот и оборванных удалений нет
    expect(await s.bin.restart('p2', 'Миша')).toEqual({ ok: true });
    const h = s.transfer.here();
    expect(h.stuck).toEqual([]);
    expect(h.players.map((p) => [p.pid, p.name])).toEqual([['p1', 'Саша'], ['p2', 'Миша']]);
    expect(h.device?.players).toEqual(before.device?.players);
    expect(s.bin.list('2026-11-18')).toEqual([]);
    expect(s.tabPid.value).toBe('p1');
    expect(s.player.value.kind === 'ok' && s.player.value.pid).toBe('p1');
  });
});

describe('К12 (063-Р65, Р72): фикстура битого устройства', () => {
  it('К12 (063-Р65) broken-device: список игроков не читается — статус broken, игрока нет, here() даёт state broken со строкой «Загрузить файл» и «Новый клуб»; «Новый клуб» возвращает здоровое устройство, прежние игроки — в корзине', async () => {
    // Ловит: стенд кадра «клуб не открывается» собирается со здоровым устройством (строки нет) или «Новый клуб» теряет прежних игроков.
    const fx = files['../fixtures/accepted/parent.broken-device.json']!;
    const s = await frameSession(fx);
    expect(s.status.value).toBe('broken');
    expect(s.player.value.kind).toBe('none');
    const h = s.transfer.here();
    expect(h.state).toBe('broken');
    expect(deviceRow(h.state)?.actions).toEqual(['load', 'newClub']);
    expect(await s.bin.newClub('2026-11-18')).toEqual({ ok: true });
    expect(s.transfer.here().state).toBe('ok');
    expect(s.bin.list('2026-11-18').map((e) => e.pid).sort()).toEqual(['p1', 'p2']);
  });
});

describe('К2 Школа (067 Т14): фикстуры журнала и тура', () => {
  const school = (id: string): School => (files[`../fixtures/accepted/${id}.json`] as FrameFixture).sections.school as School;
  const view = (id: string) => journalView(school(id));

  it('К2 Э3.09: у среднего 9 туров, сейчас тур 10, повтор не ждёт; Э3.11: повтор ждёт, карточка — над туром 10', () => {
    expect(school('school-hub.hub-mid').tours.filter((t) => t.kind !== 'repeat')).toHaveLength(9);
    expect(view('school-hub.hub-mid')).toMatchObject({ nowN: 10, due: false });
    expect(view('school-hub.hub-s22')).toMatchObject({ nowN: 14, due: true });
    expect((files['../fixtures/accepted/school-hub.hub-s22.json'] as FrameFixture).school).toEqual({ hover: 10 });
  });

  it('К2 Э3.08, Э3.13, Э3.12: без класса — вопрос; журнал пуст; конец — 30 туров и эмблема 10/10', () => {
    expect(school('school-hub.hub-day2').grade).toBeNull();
    expect(school('school-hub.hub-sch1').grade).not.toBeNull();
    expect(view('school-hub.hub-sch1')).toMatchObject({ nowN: 1 });
    expect(view('school-hub.hub-end')).toMatchObject({ emblem: 10 });
    expect(school('school-hub.hub-end').tours.filter((t) => t.kind !== 'repeat')).toHaveLength(30);
  });

  it('К2 Э3.20, Э3.22: итог тура n — журнал до тура n−1, исходы кадра: серебро 4 из 5, золото 5 из 5', () => {
    expect(view('school-path.result').nowN).toBe(9);
    expect(view('school-path.result-gold').nowN).toBe(3);
    const stand = (id: string) => (files[`../fixtures/accepted/${id}.json`] as FrameFixture).school?.tour;
    expect(stand('school-path.result')?.firsts.filter(Boolean)).toHaveLength(4);
    expect(stand('school-path.result-gold')?.firsts.every(Boolean)).toBe(true);
  });
});

describe('065-Р184: замер мелкого на 1024 (tools/textScan.mjs)', () => {
  const scan: Scan = {
    scale: 1,
    text: [
      { text: 'Enter', px: 9, where: 'button.key-btn > small' },
      { text: 'Карта', px: 12, where: 'nav > a' },
      { text: 'Дом', px: 11.9, where: 'nav > a' },
      { text: 'Кубок', px: 11.96, where: 'nav > a' },
    ],
    dots: [
      { px: 4, where: 'i.pip' },
      { px: 8, where: 'i.pip' },
      { px: 9, where: 'i.pip' },
    ],
  };

  it('Ловит: текст мельче 12 px и точку мельче 8 px; ровно порог и округление 0,05 px — не мелко', () => {
    expect([MIN_TEXT, MIN_DOT]).toEqual([12, 8]);
    const small = findSmall(scan);
    expect(small.text.map((t) => t.text)).toEqual(['Enter', 'Дом']);
    expect(small.dots.map((d) => d.px)).toEqual([4]);
  });

  it('порог текста задаётся флагом: при 10 px девять мельче, одиннадцать — нет', () => {
    expect(findSmall(scan, { minText: 10 }).text.map((t) => t.text)).toEqual(['Enter']);
  });

  it('итог — «код · мельче 12: N узлов» и по строке на узел; чистый экран — одна строка', () => {
    const out = formatSmall('Э2.13', findSmall(scan), { seen: scan });
    expect(out.split('\n')[0]).toBe('Э2.13 · мельче 12: 2 узлов · точек мельче 8: 1 · просмотрено: 4 текстовых, 3 точек');
    expect(out).toContain('«Enter» 9 px · button.key-btn > small');
    expect(out).toContain('точка 4 px · i.pip');
    expect(formatSmall('Э2.94', { text: [], dots: [] })).toBe('Э2.94 · мельче 12: 0 узлов · точек мельче 8: 0');
  });
});

describe('К22 (067-Р261): кадры «старт» Мини-футбола и Штрафного несут зерно — состав и слова на старте раздаст и игра', () => {
  const fx = (id: string) => files[`../fixtures/accepted/${id}.json`] as FrameFixture & { base: { mini?: { seed?: number; state?: unknown }; free?: { seed?: number; words?: unknown } } };
  const keysOf = (n: number): string[] => lessonLetters(courseLessons.find((l) => l.n === n)!.keys);

  it('К22 game-mini.start: зерно есть, состава в фикстуре нет, 2×2 на уроке 6 — две буквы из выученных', () => {
    const m = fx('game-mini.start').base.mini!;
    expect(Number.isInteger(m.seed)).toBe(true);
    expect(m.state).toBeUndefined();
    const lineup = lineupOf(keysOf(6), 6, m.seed!);
    expect(lineup).toHaveLength(2);
    expect(lineup.every((k) => keysOf(6).includes(k))).toBe(true);
  });

  it('К22 game-free.start: зерно есть, слов в фикстуре нет, три мишени по зерну из слов курса', () => {
    const f = fx('game-free.start').base.free!;
    expect(Number.isInteger(f.seed)).toBe(true);
    expect(f.words).toBeUndefined();
    const words = wordsFor(keysOf(11), f.seed!, dictionary.words).slice(0, 3);
    expect(words).toHaveLength(3);
    expect(words.every((w) => w.length >= 2)).toBe(true);
  });
});
