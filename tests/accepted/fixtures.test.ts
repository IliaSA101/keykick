/**
 * К-Г (065 Т4): фикстуры стенда кадров валидны — разделы проходят проверку реестра сборки, сеанс в памяти открывается
 * и отдаёт игрока без обращения к хранилищу браузера. Сами фикстуры пишет `node tools/accepted/states.mjs`.
 */
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../../src/app/save/sections';
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
    expect(fx.route).toMatch(/^\/(home|map|match|result|parent)$/);
    expect(Number.isInteger(fx.seed)).toBe(true);
  });

  it.each(all)('%s: каждый раздел проходит проверку реестра', (_id, fx) => {
    for (const [name, data] of Object.entries(fx.sections)) {
      const def = SECTIONS.find((d) => d.name === name);
      expect(def, `раздел ${name} не в реестре`).toBeDefined();
      expect(def!.check(data), `раздел ${name}`).toEqual([]);
    }
  });

  it.each(all)('%s: сеанс в памяти собирается, игрок открыт, статус ok', async (_id, fx) => {
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
    expect(s.bin.settle('2026-11-18')).toBe(false); // ParentBin при показе: сирот и оборванных удалений нет
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
