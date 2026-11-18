/**
 * Снимок клуба и план импорта (060 Т5б, design §4): круг «снимок → planImport → то же», совпадение pid, лимит игроков,
 * недоверенный вход. У каждого теста строка «Ловит:» — какую поломку он видит.
 */
import { describe, expect, it } from 'vitest';
import type { Registry } from '../../src/content/schema/ids';
import type { CourseProgress, LessonMark } from '../../src/engine/course/reconcile';
import { createPlayer, serializePlayer, writePlayer, type Envelope } from '../../src/engine/save/envelope';
import { MAX_IMPORT_CHARS, MAX_PLAYERS, MAX_SNAPSHOT_PLAYERS, planImport, type CourseContext, type ImportPlan } from '../../src/engine/save/import';
import { openPlayer } from '../../src/engine/save/open';
import { isInt, type SectionDef } from '../../src/engine/save/section';
import type { Device } from '../../src/engine/save/device';
import { makeSnapshot, serializeSnapshot, summarize } from '../../src/engine/save/snapshot';
import { createRandom, pick, randomInt } from '../../src/engine/random';

// --- Разделы и курс-образец ------------------------------------------------------------------------------------

const ORDER = ['ru.yard.a', 'ru.yard.b', 'ru.yard.c', 'ru.yard.d'];
const REG: Registry = { course: 'ru', released: [...ORDER, 'ru.yard.old'], retired: { 'ru.yard.old': 'ru.yard.b' } };
const COURSES: Record<string, CourseContext> = { ru: { reg: REG, order: ORDER } };

const mk = (stars: LessonMark['stars'], best: number, tries: number, done?: string): LessonMark =>
  done === undefined ? { stars, best, tries } : { stars, best, tries, done };

/** Курс на версии 2: v1 была `{current, lessons}`, v2 добавила `archive` и `leaguesDone`. */
const courseDef: SectionDef<CourseProgress> = {
  name: 'course:ru',
  v: 2,
  empty: () => ({ current: 'ru.yard.a', lessons: {}, archive: {}, leaguesDone: {} }),
  up: { 2: (d) => ({ archive: {}, leaguesDone: {}, ...(d as object) }) },
  check: (d) => {
    const c = d as Partial<CourseProgress> | null;
    if (!c || typeof c.current !== 'string' || !c.lessons || !c.archive || !c.leaguesDone) return ['shape'];
    return Object.values(c.lessons).every((m) => isInt(m.stars) && m.stars >= 0 && m.stars <= 3) ? [] : ['stars'];
  },
};
const walletDef: SectionDef<{ coins: number }> = {
  name: 'wallet',
  v: 1,
  empty: () => ({ coins: 0 }),
  up: {},
  check: (d) => (d && isInt((d as { coins?: unknown }).coins) ? [] : ['coins']),
};
const defs = [courseDef, walletDef] as SectionDef<unknown>[];

const device = (pids: string[] = []): Device => ({
  kind: 'keykick-device',
  fmt: 1,
  rev: 3,
  players: pids.map((pid, order) => ({ pid, order })),
  uiLang: 'ru',
  sound: { music: 0.5 },
  parent: { gate: 'none' },
});
const META = { app: '2.0.0', made: '2026-11-18T10:00:00.000Z', from: 'https://example.org/keykick/next/' };
const EMPTY_HERE = { device: device(), players: [] as Envelope[] };

function player(pid: string, patch: Record<string, unknown> = {}): Envelope {
  return writePlayer(createPlayer({ pid, name: `Игрок ${pid}` }, defs), patch);
}

/** Случайный игрок: уроки только из `ORDER`, незнакомый раздел с вложенными данными и «неудобными» ключами. */
function randomPlayer(rnd: () => number, pid: string): Envelope {
  const lessons: Record<string, LessonMark> = {};
  for (const id of ORDER) {
    if (randomInt(rnd, 2) === 0) lessons[id] = mk(randomInt(rnd, 4) as 0 | 1 | 2 | 3, randomInt(rnd, 100), randomInt(rnd, 9), randomInt(rnd, 2) === 0 ? '2026-11-0' + (1 + randomInt(rnd, 9)) : undefined);
  }
  const progress: CourseProgress = { current: pick(rnd, ORDER), lessons, archive: {}, leaguesDone: {} };
  const env = player(pid, { 'course:ru': progress, wallet: { coins: randomInt(rnd, 500) } });
  const unknown = { b: [1, 'two', null, { 'ключ': randomInt(rnd, 9) }], a: { 2: 'x', z: true, nested: [[], {}] }, text: 'Привет, мир', big: 1e21 * rnd() };
  return { ...env, rev: randomInt(rnd, 50), sections: { ...env.sections, 'league:ru.yard': { v: 1 + randomInt(rnd, 7), data: unknown } } };
}

function okPlan(plan: ImportPlan): Extract<ImportPlan, { kind: 'ok' }> {
  if (plan.kind !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(plan)}`);
  return plan;
}

function validText(pids = ['p-1', 'p-2']): string {
  return serializeSnapshot(makeSnapshot(device(pids), pids.map((p) => player(p)), META));
}

// --- makeSnapshot ----------------------------------------------------------------------------------------------

describe('makeSnapshot', () => {
  it('К16: форма снимка: kind, snap, метки снаружи, конверты теми же объектами; journal — только если задан', () => {
    // Ловит: часы или адрес берутся изнутри (Date.now) и снимок нельзя воспроизвести; конверты копируются и теряют незнакомое; пустой journal пишется ключом.
    const a = player('p-1');
    const snap = makeSnapshot(device(['p-1']), [a], META);
    expect(snap).toMatchObject({ kind: 'keykick-club', snap: 1, ...META });
    expect(snap.players[0]).toBe(a);
    expect('journal' in snap).toBe(false);
    expect(makeSnapshot(device(), [a], { ...META, journal: [{ t: 1 }] }).journal).toEqual([{ t: 1 }]);
  });

  it('К16: одинаковый pid или не конверт — ошибка программиста', () => {
    // Ловит: в снимок попадают два игрока с одним ключом хранилища — при импорте один затирает другого.
    expect(() => makeSnapshot(device(), [player('p-1'), player('p-1')], META)).toThrow('duplicate');
    expect(() => makeSnapshot(device(), [{ kind: 'x' } as unknown as Envelope], META)).toThrow();
  });
});

// --- К16: круг ---------------------------------------------------------------------------------------------------

describe('К16: снимок → planImport → то же', () => {
  it('К16: на 60 семенах конверты байт в байт, незнакомые разделы и rev целы, журнал переживает текст', () => {
    // Ловит: импорт «чинит» или пересобирает конверт (порядок ключей, rev, незнакомый раздел, пустые разделы) — перенос клуба менял бы данные детей.
    for (let seed = 1; seed <= 60; seed++) {
      const rnd = createRandom(seed);
      const n = 1 + randomInt(rnd, MAX_PLAYERS);
      const players = Array.from({ length: n }, (_, i) => randomPlayer(rnd, `p${i}-${randomInt(rnd, 1e6)}`));
      const snap = makeSnapshot(device(players.map((p) => p.pid)), players, { ...META, journal: { events: [seed, 'x'] } });
      const text = serializeSnapshot(snap);
      expect(JSON.parse(text)).toEqual(snap);
      const plan = okPlan(planImport(text, EMPTY_HERE, defs, COURSES));
      expect(plan.add.map(serializePlayer), `seed ${seed}`).toEqual(players.map(serializePlayer));
      expect(plan.clash).toEqual([]);
      expect(plan.overLimit).toBe(false);
    }
  });

  it('К16: второй круг: импортированное снова в снимок и в план — то же (идемпотентно)', () => {
    // Ловит: каждый перенос меняет конверты чуть-чуть (миграция или reconcile применяются повторно и дрейфуют).
    const rnd = createRandom(7);
    const players = [randomPlayer(rnd, 'p-a'), randomPlayer(rnd, 'p-b')];
    const once = okPlan(planImport(validTextOf(players), EMPTY_HERE, defs, COURSES)).add;
    const twice = okPlan(planImport(validTextOf(once), EMPTY_HERE, defs, COURSES)).add;
    expect(twice.map(serializePlayer)).toEqual(once.map(serializePlayer));
  });

  it('К16: старый игрок: разделы мигрируют, снятый урок уходит в архив к наследнику, rev и незнакомое целы', () => {
    // Ловит: план отдаёт данные «как в файле» без миграции и reconcile — после записи игрок сломается или потеряет отметку снятого урока.
    const old = createPlayer({ pid: 'p-old', name: 'Старый' }, defs);
    const stored = {
      ...old,
      rev: 41,
      sections: {
        'course:ru': { v: 1, data: { current: 'ru.yard.old', lessons: { 'ru.yard.old': mk(2, 70, 3, '2026-11-01'), 'ru.yard.a': mk(3, 90, 1, '2026-10-30') } } },
        wallet: { v: 1, data: { coins: 12 } },
        'league:ru.yard': { v: 9, data: { keep: ['me'] } },
      },
    };
    const text = JSON.stringify({ ...makeSnapshot(device(['p-old']), [], META), players: [stored] });
    const [env] = okPlan(planImport(text, EMPTY_HERE, defs, COURSES)).add;
    const course = env!.sections['course:ru']!;
    expect(course.v).toBe(2);
    const data = course.data as CourseProgress;
    expect(data.current).toBe('ru.yard.b');
    expect(data.lessons['ru.yard.b']).toEqual(mk(2, 70, 3, '2026-11-01'));
    expect(data.archive['ru.yard.old']).toEqual(mk(2, 70, 3, '2026-11-01'));
    expect('ru.yard.old' in data.lessons).toBe(false);
    expect(env!.rev).toBe(41);
    expect(env!.sections['league:ru.yard']).toEqual({ v: 9, data: { keep: ['me'] } });
    // Без реестра курса reconcile не делается: миграция есть, снятый урок на месте.
    const plain = okPlan(planImport(text, EMPTY_HERE, defs, {})).add[0]!.sections['course:ru']!.data as CourseProgress;
    expect(plain.current).toBe('ru.yard.old');
    expect(plain.archive).toEqual({});
  });
});

function validTextOf(players: Envelope[]): string {
  return serializeSnapshot(makeSnapshot(device(players.map((p) => p.pid)), players, META));
}

// --- К17: clash и лимит --------------------------------------------------------------------------------------------

/** Образец конверта из файла: достаточно `pid` (остальное проверено сводкой). */
const withPid = (pid: string): Envelope => expect.objectContaining({ pid }) as Envelope;

describe('К17: совпадение pid и лимит игроков', () => {
  const stars2: CourseProgress = { current: 'ru.yard.c', lessons: { 'ru.yard.a': mk(2, 80, 1, '2026-11-01'), 'ru.yard.b': mk(1, 60, 2) }, archive: {}, leaguesDone: {} };

  it('К17: тот же pid — clash со сводками «моё» и «из файла», в add не попадает; остальные — в add', () => {
    // Ловит: чужой игрок с тем же pid молча затирает своего (или дублируется); сводка берёт не тот конверт и родитель выбирает вслепую.
    const mine = player('p-1', { 'course:ru': stars2, wallet: { coins: 40 } });
    const theirs = player('p-1', { 'course:ru': { ...stars2, current: 'ru.yard.a', lessons: {} }, wallet: { coins: 5 } });
    const other = player('p-2');
    const here = { device: device(['p-1']), players: [mine] };
    const plan = okPlan(planImport(validTextOf([theirs, other]), here, defs, COURSES));
    expect(plan.clash).toEqual([
      {
        pid: 'p-1',
        mine: { name: 'Игрок p-1', lesson: 'ru.yard.c', stars: 3, coins: 40 },
        theirs: { name: 'Игрок p-1', lesson: 'ru.yard.a', stars: 0, coins: 5 },
        file: withPid('p-1'), // конверт из файла рядом со сводкой (запись «из файла» берёт его)
      },
    ]);
    expect(plan.add.map((e) => e.pid)).toEqual(['p-2']);
    expect(plan.overLimit).toBe(false);
  });

  it('К17: сводка без разделов — null, а не ошибка', () => {
    // Ловит: игрок без раздела курса или клуба роняет сводку (TypeError на undefined).
    const bare: Envelope = { ...createPlayer({ pid: 'p-9', name: 'Пустой' }, []), course: 'xx' };
    expect(summarize(bare)).toEqual({ name: 'Пустой', lesson: null, stars: null, coins: null });
  });

  it('К17: монеты сводки — из wallet; club.coins старой раскладки не читается', () => {
    // Ловит: summarize берёт монеты из раздела club, а они с 065 Т2 лежат в wallet (сводка конфликтов всегда null).
    const withWallet = player('p-1', { wallet: { coins: 7 } });
    expect(summarize(withWallet).coins).toBe(7);
    const old: Envelope = { ...withWallet, sections: { club: { v: 1, data: { coins: 9 } } } };
    expect(summarize(old).coins).toBeNull();
  });

  it('К17: overLimit: 3 на устройстве + 2 новых — да; + 1 новый — нет; совпавший не считается дважды', () => {
    // Ловит: лимит считается по числу игроков в файле (а не по занятым местам) или совпавший pid занимает второе место.
    const here = (pids: string[]) => ({ device: device(pids), players: pids.map((p) => player(p)) });
    const h3 = here(['a', 'b', 'c']);
    expect(okPlan(planImport(validTextOf([player('d'), player('e')]), h3, defs, {})).overLimit).toBe(true);
    expect(okPlan(planImport(validTextOf([player('d')]), h3, defs, {})).overLimit).toBe(false);
    expect(okPlan(planImport(validTextOf([player('a'), player('d')]), h3, defs, {})).overLimit).toBe(false);
    expect(okPlan(planImport(validTextOf([player('a'), player('b'), player('c'), player('d')]), h3, defs, {})).overLimit).toBe(false);
    expect(okPlan(planImport(validTextOf(['a', 'b', 'c', 'd', 'e'].map((p) => player(p))), EMPTY_HERE, defs, {})).overLimit).toBe(true);
  });

  it('К17: место в записи устройства без конверта тоже занято', () => {
    // Ловит: лимит смотрит только на открытые конверты, а игрок с потерянным конвертом освобождает место, которое ему ещё положено.
    const h = { device: device(['a', 'b', 'c', 'ghost']), players: [player('a')] };
    const plan = okPlan(planImport(validTextOf([player('d')]), h, defs, {}));
    expect(plan.overLimit).toBe(true);
    expect(plan.clash).toEqual([]);
  });

  it('К17: pid из записи устройства без конверта и тот же pid в файле — clash с mine: null, не add', () => {
    // Ловит: игрок с pid, чей конверт на диске новее или битый, считается «новым» и импорт перезаписывает его без выбора родителя (design §4: совпал pid — clash).
    const h = { device: device(['p-1', 'p-2']), players: [player('p-2')] };
    const plan = okPlan(planImport(validTextOf([player('p-1', { wallet: { coins: 5 } }), player('p-3')]), h, defs, {}));
    expect(plan.clash).toEqual([
      { pid: 'p-1', mine: null, theirs: { name: 'Игрок p-1', lesson: 'ru.yard.a', stars: 0, coins: 5 }, file: withPid('p-1') },
    ]);
    expect(plan.add.map((e) => e.pid)).toEqual(['p-3']);
    // Занятых мест три (p-1 без конверта, p-2, новый p-3), лимит не превышен — совпавший не считается дважды.
    expect(plan.overLimit).toBe(false);
  });

  it('К17: входы не меняются и не замораживаются в ошибку: план ничего не пишет', () => {
    // Ловит: planImport правит here или defs (запись «втихую» в обход адаптера).
    const here = { device: device(['p-1']), players: [player('p-1')] };
    const frozen = (o: unknown): unknown => (o !== null && typeof o === 'object' ? (Object.values(o).forEach(frozen), Object.freeze(o)) : o);
    frozen(here);
    const before = JSON.stringify(here);
    okPlan(planImport(validTextOf([player('p-1', { wallet: { coins: 9 } })]), here, defs, COURSES));
    expect(JSON.stringify(here)).toBe(before);
  });
});

// --- К17: недоверенный вход ----------------------------------------------------------------------------------------

describe('К17: мусор → bad, не исключение', () => {
  const bad = (text: string, here = EMPTY_HERE): string[] => {
    const plan = planImport(text, here, defs, COURSES);
    if (plan.kind !== 'bad') throw new Error(`expected bad, got ${plan.kind} for ${text.slice(0, 80)}`);
    expect(plan.why.length).toBeGreaterThan(0);
    return plan.why;
  };
  const snapObj = (): Record<string, unknown> => JSON.parse(validText()) as Record<string, unknown>;
  const withPlayer0 = (patch: Record<string, unknown>): string => {
    const o = snapObj();
    (o.players as Record<string, unknown>[])[0] = { ...(o.players as Record<string, unknown>[])[0], ...patch };
    return JSON.stringify(o);
  };

  it('К17: не JSON, не снимок, чужой kind, плохой snap', () => {
    // Ловит: файл не от keykick (чужой JSON, конверт одного игрока, пустота) принимается за клуб или роняет разбор.
    expect(bad('')).toEqual(['json']);
    expect(bad('{"kind":"keykick-club"')).toEqual(['json']);
    for (const t of ['null', '5', '"x"', '[]', '{}', '[1,2]']) expect(bad(t)).toEqual(['kind']);
    expect(bad(JSON.stringify({ ...snapObj(), kind: 'keykick-player' }))).toEqual(['kind']);
    expect(bad(JSON.stringify(createPlayer({ pid: 'p', name: 'n' }, defs)))).toEqual(['kind']);
    for (const snap of [0, -1, 1.5, '1', null, true, NaN, 2 ** 53]) expect(bad(JSON.stringify({ ...snapObj(), snap }))).toEqual(['snap']);
    expect(bad(JSON.stringify({ ...snapObj(), snap: undefined }))).toEqual(['snap']);
  });

  it('К17: метки, устройство и список игроков', () => {
    // Ловит: снимок без устройства/игроков или с нестроковыми метками проходит и ломает потребителя дальше.
    for (const key of ['app', 'made', 'from']) {
      expect(bad(JSON.stringify({ ...snapObj(), [key]: 5 }))).toEqual([`meta:${key}`]);
      expect(bad(JSON.stringify({ ...snapObj(), [key]: 'x'.repeat(257) }))).toEqual([`meta:${key}`]);
    }
    expect(bad(JSON.stringify({ ...snapObj(), device: { kind: 'keykick-player' } }))).toEqual(['device']);
    expect(bad(JSON.stringify({ ...snapObj(), device: null }))).toEqual(['device']);
    expect(bad(JSON.stringify({ ...snapObj(), players: {} }))).toEqual(['players']);
    expect(bad(JSON.stringify({ ...snapObj(), players: 'x' }))).toEqual(['players']);
    const many = Array.from({ length: MAX_SNAPSHOT_PLAYERS + 1 }, (_, i) => player(`p${i}`));
    expect(bad(JSON.stringify({ ...snapObj(), players: many }))).toEqual(['players-count']);
  });

  it('К17: игрок — не конверт: число, null, строка, чужой kind, битый раздел', () => {
    // Ловит: один мусорный «игрок» в массиве пропускается или роняет разбор остальных; причины не называют, какой по счёту.
    for (const junk of [5, null, 'x', [], {}, { kind: 'keykick-club' }]) {
      const o = snapObj();
      (o.players as unknown[])[1] = junk;
      const why = bad(JSON.stringify(o));
      expect(why.every((w) => w.startsWith('player:1:'))).toBe(true);
    }
    expect(bad(withPlayer0({ rev: -1 }))).toEqual(['player:0:rev']);
    expect(bad(withPlayer0({ sections: { 'course:ru': { v: 2, data: { current: 5 } } } }))).toContain('player:0:section:course:ru:shape');
    expect(bad(withPlayer0({ sections: { wallet: { v: 1, data: { coins: 1.5 } } } }))).toContain('player:0:section:wallet:coins');
  });

  it('К17: pid и строки: знаки ключа хранилища, огромные имя и pid, дубли', () => {
    // Ловит: pid «x.c1» или «../» попадает в ключ хранилища и перезаписывает чужую копию; имя в мегабайт раздувает сохранение; два игрока с одним pid.
    for (const pid of ['a.b', 'p 1', '../x', 'p/1', 'x'.repeat(65), 'кот']) expect(bad(withPlayer0({ pid }))).toEqual(['player:0:pid-chars']);
    expect(bad(withPlayer0({ name: 'я'.repeat(65) }))).toEqual(['player:0:name-length']);
    expect(bad(withPlayer0({ name: 'я'.repeat(1_000_000) }))).toEqual(['player:0:name-length']);
    expect(bad(withPlayer0({ course: 'c'.repeat(33) }))).toEqual(['player:0:course-length']);
    const o = snapObj();
    (o.players as Record<string, unknown>[])[1] = { ...(o.players as Record<string, unknown>[])[0] };
    expect(bad(JSON.stringify(o))).toEqual(['player:1:pid-duplicate']);
  });

  it('К17: огромный текст и глубокая вложенность — bad, не зависание и не переполнение стека', () => {
    // Ловит: файл на сотни мегабайт разбирается целиком; глубокий массив роняет обход рекурсией.
    expect(bad('x'.repeat(MAX_IMPORT_CHARS + 1))).toEqual(['too-big']);
    expect(bad('['.repeat(200_000))).toEqual(['json']);
    const deep = '{"kind":"keykick-club","snap":1,"app":"a","made":"m","from":"f","device":{"kind":"keykick-device"},"players":[],"journal":' + '['.repeat(50_000) + ']'.repeat(50_000) + '}';
    expect(['bad', 'ok']).toContain(planImport(deep, EMPTY_HERE, defs, {}).kind);
  });

  it('К17: pid «device» — bad: ключ устройства занят, validPid один на хранилище и импорт', () => {
    // Ловит: импорт пропускает pid «device» (регулярка без запрета), а хранилище потом отказывает при записи — «ok» не доходит до диска.
    expect(bad(withPlayer0({ pid: 'device' }))).toEqual(['player:0:pid-chars']);
  });

  it('К17: глубина внутри игрока — в незнакомом разделе и как сам элемент players — bad, не RangeError', () => {
    // Ловит: обход считает только вложенность журнала, а JSON.stringify глубокого игрока падает RangeError — планировщик бросает на файле в 400 КБ.
    const depth = 200_000;
    const deepArr = '['.repeat(depth) + ']'.repeat(depth);
    const head = (players: string): string => `{"kind":"keykick-club","snap":1,"app":"a","made":"m","from":"f","device":{"kind":"keykick-device"},"players":${players}}`;
    const inSection = JSON.stringify(player('p-1')).replace('"sections":{', `"sections":{"league:ru.yard":{"v":1,"data":${deepArr}},`);
    expect(inSection.length).toBeGreaterThan(300_000);
    expect(bad(head(`[${inSection}]`))).toContain('depth');
    expect(bad(head(`[${deepArr}]`))).toContain('depth');
    // Глубина в разумных пределах (журнал, незнакомый раздел) файл не портит.
    const fine = '['.repeat(50) + ']'.repeat(50);
    const okText = JSON.stringify(player('p-1')).replace('"sections":{', `"sections":{"league:ru.yard":{"v":1,"data":${fine}},`);
    expect(planImport(head(`[${okText}]`), EMPTY_HERE, defs, {}).kind).toBe('ok');
  });

  it('К17: отметка null при слабой проверке раздела — bad, не TypeError из reconcile', () => {
    // Ловит: reconcile без страховки падает на archive:{id:null} или отметке null, а разбор недоверенного файла бросает исключение.
    const weakDefs = [{ ...courseDef, check: (d: unknown) => (d && typeof (d as { current?: unknown }).current === 'string' ? [] : ['shape']) }, walletDef] as SectionDef<unknown>[];
    const withCourse = (data: unknown): string => withPlayer0({ sections: { 'course:ru': { v: 2, data } } });
    const old = mk(2, 70, 3);
    const archiveNull = { current: 'ru.yard.a', lessons: { 'ru.yard.old': old }, archive: { 'ru.yard.old': null }, leaguesDone: {} };
    const markNull = { current: 'ru.yard.a', lessons: { 'ru.yard.old': null, 'ru.yard.b': old }, archive: {}, leaguesDone: {} };
    for (const data of [archiveNull, markNull]) {
      const plan = planImport(withCourse(data), EMPTY_HERE, weakDefs, COURSES);
      expect(plan).toEqual({ kind: 'bad', why: ['player:0:section:course:ru:reconcile-failed'] });
    }
  });

  it('К17: __proto__ в любом месте — bad, прототип не загрязнён', () => {
    // Ловит: ключ __proto__ из файла доезжает до присваивания по имени раздела/урока и меняет прототип всех объектов.
    const raw = validText(['p-1']);
    const inSection = raw.replace('"sections":{', '"sections":{"__proto__":{"polluted":"yes"},');
    const inJournal = raw.slice(0, -1) + ',"journal":[{"__proto__":{"polluted":"yes"}}]}';
    const top = raw.slice(0, -1) + ',"__proto__":{"polluted":"yes"}}';
    for (const text of [inSection, inJournal, top]) {
      expect(text).toContain('__proto__');
      expect(bad(text)).toContain('proto-key');
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // Имя урока __proto__ внутри курсового раздела — тоже в дереве.
    const lessons = withPlayer0({ sections: { 'course:ru': { v: 2, data: JSON.parse('{"current":"ru.yard.a","archive":{},"leaguesDone":{},"lessons":{"__proto__":{"stars":1}}}') as unknown } } });
    expect(bad(lessons)).toContain('proto-key');
  });

  it('К17: набор на семенах: случайная порча годного снимка не бросает, ok — только с годными конвертами', () => {
    // Ловит: исключение из planImport на любой странной форме (TypeError, RangeError) или «ok» с конвертом, который openPlayer не принял бы.
    const base = JSON.parse(serializeSnapshot(makeSnapshot(device(['p-1', 'p-2']), [randomPlayer(createRandom(3), 'p-1'), randomPlayer(createRandom(4), 'p-2')], META))) as unknown;
    const junk: unknown[] = [null, 0, -1, 1.5, 1e308, '', 'x', [], {}, true, [null], { kind: 'keykick-player' }, 'я'.repeat(300), 2 ** 53];
    let seenBad = 0;
    let seenOk = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rnd = createRandom(seed);
      const root = structuredClone(base) as Record<string, unknown>;
      const edits = 1 + randomInt(rnd, 3);
      for (let e = 0; e < edits; e++) {
        let cur: Record<string, unknown> = root;
        for (;;) {
          const keys = Object.keys(cur);
          if (keys.length === 0) break; // ранее подставленный пустой объект или массив — править нечего
          const key = pick(rnd, keys);
          const next = cur[key];
          if (next !== null && typeof next === 'object' && randomInt(rnd, 3) > 0) cur = next as Record<string, unknown>;
          else {
            if (randomInt(rnd, 4) === 0 && !Array.isArray(cur)) delete cur[key];
            else cur[key] = pick(rnd, junk);
            break;
          }
        }
      }
      const plan = planImport(JSON.stringify(root), EMPTY_HERE, defs, COURSES);
      expect(['ok', 'bad', 'newer'], `seed ${seed}`).toContain(plan.kind);
      if (plan.kind === 'bad') seenBad++;
      if (plan.kind === 'ok') {
        seenOk++;
        for (const env of plan.add) expect(openPlayer(serializePlayer(env), defs).kind, `seed ${seed}`).toBe('ok');
      }
    }
    // Набор не вырожден: порча чаще ломает снимок, но часть правок (незнакомые разделы, журнал) безвредна.
    expect(seenBad).toBeGreaterThan(100);
    expect(seenOk).toBeGreaterThan(0);
  });

  it('К17: обрыв файла в любом месте — bad "json"', () => {
    // Ловит: недокачанный файл принимается за пустой клуб или частичный импорт.
    const text = validText();
    for (let cut = 0; cut < text.length; cut += 37) expect(bad(text.slice(0, cut))).toEqual(['json']);
  });
});

// --- newer ---------------------------------------------------------------------------------------------------------

describe('К17: newer — всё новее программы', () => {
  const snapObj = (): Record<string, unknown> => JSON.parse(validText()) as Record<string, unknown>;

  it('К17: snap новее, fmt игрока новее, раздел игрока новее — newer; ничего не импортируется частично', () => {
    // Ловит: снимок из будущей версии открывается «как получится» и портит данные, которых программа не понимает.
    expect(planImport(JSON.stringify({ ...snapObj(), snap: 2 }), EMPTY_HERE, defs, {})).toEqual({ kind: 'newer' });
    const o = snapObj();
    (o.players as Record<string, unknown>[])[1] = { ...(o.players as Record<string, unknown>[])[1], fmt: 2 };
    expect(planImport(JSON.stringify(o), EMPTY_HERE, defs, {})).toEqual({ kind: 'newer' });
    const s = snapObj();
    (s.players as Record<string, unknown>[])[0] = { ...(s.players as Record<string, unknown>[])[0], sections: { wallet: { v: 5, data: {} } } };
    expect(planImport(JSON.stringify(s), EMPTY_HERE, defs, {})).toEqual({ kind: 'newer' });
  });

  it('К17: snap новее — newer даже при нечитаемом остальном; плохой игрок сильнее newer другого', () => {
    // Ловит: будущий формат с незнакомой формой игроков отвечает «мусор» вместо «обновите программу»; а мусор рядом с новым прячется за «обновите».
    expect(planImport(JSON.stringify({ kind: 'keykick-club', snap: 2, players: 'whatever' }), EMPTY_HERE, defs, {})).toEqual({ kind: 'newer' });
    const o = snapObj();
    (o.players as unknown[]).push({ ...player('p-3'), fmt: 2 }, 7);
    expect(planImport(JSON.stringify(o), EMPTY_HERE, defs, {}).kind).toBe('bad');
  });
});

// --- К4: выгрузка newer и карантина (063-Р10) ------------------------------------------------------------------------

describe('К4: выгрузка — newer сырым с пометкой, quarantine отдельным полем', () => {
  const NEWER_RAW = JSON.stringify({ ...player('p-9'), fmt: 2, sections: { club: { v: 9, data: { будущее: [1, { x: null }] } } } });

  it('К4: newer — сырой конверт в players и pid в newer; поля нет, пока таких игроков нет', () => {
    // Ловит: игрок «новее» на диске пропадает из выгрузки (pid в устройстве есть, конверта нет) или сырое переписывается при выгрузке.
    const a = player('p-1');
    const snap = makeSnapshot(device(['p-1', 'p-9']), [a], { ...META, newer: [{ pid: 'p-9', raw: NEWER_RAW }] });
    expect(snap.players).toHaveLength(2);
    expect(JSON.stringify(snap.players[1])).toBe(NEWER_RAW);
    expect(snap.newer).toEqual(['p-9']);
    expect('newer' in makeSnapshot(device(['p-1']), [a], META)).toBe(false);
    expect('quarantine' in makeSnapshot(device(['p-1']), [a], { ...META, newer: [], quarantine: { 'p-1': [] } })).toBe(false);
  });

  it('К4: файл с newer читается как «новее программы» целиком — ничего не импортируется частично', () => {
    // Ловит: старая программа забирает из файла «новее» только понятных игроков (импорт всё-или-ничего, 060-Р16).
    const text = serializeSnapshot(makeSnapshot(device(['p-1', 'p-9']), [player('p-1')], { ...META, newer: [{ pid: 'p-9', raw: NEWER_RAW }] }));
    expect(planImport(text, EMPTY_HERE, defs, {})).toEqual({ kind: 'newer' });
  });

  it('К4: quarantine — только непустые владельцы, свежая первой; planImport поле не читает (мусор в нём не ломает импорт)', () => {
    // Ловит: импорт читает карантин (битое сырое идёт в игроков) или падает на его форме; карантин пишется пустыми списками.
    const quarantine = { 'p-1': ['{"битый":1', 'мусор'], device: [], 'p-2': ['x'] };
    const snap = makeSnapshot(device(['p-1']), [player('p-1')], { ...META, quarantine });
    expect(snap.quarantine).toEqual({ 'p-1': ['{"битый":1', 'мусор'], 'p-2': ['x'] });
    const clean = validText(['p-1']);
    const plain = okPlan(planImport(clean, EMPTY_HERE, defs, COURSES));
    const withQ = okPlan(planImport(serializeSnapshot(snap), EMPTY_HERE, defs, COURSES));
    expect(withQ.add.map(serializePlayer)).toEqual(plain.add.map(serializePlayer));
    for (const junk of [7, 'строка', null, [1, 2], { 'p-1': 5, 'p-7': { a: { b: [] } } }]) {
      const o = JSON.parse(clean) as Record<string, unknown>;
      o.quarantine = junk;
      const plan = okPlan(planImport(JSON.stringify(o), EMPTY_HERE, defs, COURSES));
      expect(plan.add.map(serializePlayer)).toEqual(plain.add.map(serializePlayer));
    }
  });

  it('К4: newer: тот же pid, что у открытого игрока, или не JSON — ошибка программиста', () => {
    // Ловит: два конверта с одним pid в файле (импорт «плохой») или сырое, которое не разобрать, молча теряется.
    expect(() => makeSnapshot(device(), [player('p-9')], { ...META, newer: [{ pid: 'p-9', raw: NEWER_RAW }] })).toThrow('duplicate');
    expect(() => makeSnapshot(device(), [], { ...META, newer: [{ pid: 'p-9', raw: '{оборвано' }] })).toThrow('not JSON');
    expect(() => makeSnapshot(device(), [], { ...META, newer: [{ pid: 'p-9', raw: '[1]' }] })).toThrow('not an object');
  });
});
