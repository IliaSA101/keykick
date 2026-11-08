/**
 * Курс v2 (спека 016, Т1, Т3): разбор трёх схем контента (лиги, уроки лиг, словарь).
 * Фикстуры — в самом тесте: таблица 32 уроков Двора из design §2.
 * Лестница по настоящим файлам, модель победы и цепочка профилей — в `course.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { courseLessons, dictionary } from '../src/app/course/load';
import { keymap } from '../src/app/keymap';
import { checkDictionaryFits, parseDictionary, parseLeagueLessons, parseLeagues, type CourseLesson, type League } from '../src/engine/course/model';

const STAGES = [
  ['А и О', 'ао'],
  ['В и Л', 'вл'],
  ['Ы и Д', 'ыд'],
  ['Ф и Ж', 'фж'],
  ['П и Р', 'пр'],
  ['Э', 'э'],
  ['Слова ряда', ''],
  ['Ответные матчи', ''],
  ['Фразы', ''],
  ['Финал двора', ''],
];

// [ступень, Т/К, потолок, атаки, строк, g, c, разминка, особое]
type Row = [number, string, string, number[], number, number, number, number, Record<string, unknown>?];
const L = (a: number, b: number, c: number, d: number) => [a, b, c, d];
const ROWS: Row[] = [
  [1, 'T', 'letters', L(16, 18, 20, 22), 1, 1, 5, 124, { trap: true }],
  [1, '', 'pairs', L(16, 18, 20, 22), 1, 1, 5, 120],
  [2, 'T', 'pairs', L(16, 18, 20, 23), 1, 1, 5, 116],
  [2, '', 'combos', L(16, 18, 20, 23), 1, 1, 5, 116],
  [2, '', 'words', L(17, 19, 22, 24), 1, 1, 5, 114],
  [3, 'T', 'pairs', L(14, 17, 19, 21), 1, 1, 4, 128],
  [3, '', 'combos', L(14, 17, 19, 21), 1, 1, 4, 128],
  [3, '', 'words', L(16, 18, 20, 22), 1, 1, 4, 118],
  [3, '', 'words', L(17, 19, 22, 24), 1, 1, 4, 106],
  [4, 'T', 'pairs', L(17, 20, 22, 24), 1, 1, 4, 104],
  [4, '', 'words', L(17, 20, 22, 24), 1, 1, 4, 104],
  [4, '', 'combos', L(19, 21, 23, 26), 1, 1, 4, 94, { focus: 'фж' }],
  [4, '', 'words', L(21, 23, 25, 27), 1, 1, 4, 96],
  [4, 'K', 'words', L(22, 25, 27, 29), 1, 1, 4, 98, { focus: 'фываолдж' }],
  [5, 'T', 'pairs', L(34, 37, 39, 41), 2, 2, 5, 138],
  [5, '', 'words', L(34, 37, 39, 41), 2, 2, 5, 132],
  [5, '', 'words', L(37, 39, 41, 44), 2, 2, 5, 134],
  [5, '', 'words', L(39, 42, 44, 46), 2, 2, 5, 136],
  [6, 'T', 'combos', L(40, 42, 44, 47), 2, 2, 5, 132, { focus: 'эж' }],
  [6, '', 'combos', L(40, 42, 44, 47), 2, 2, 5, 126, { focus: 'э' }],
  [6, 'K', 'words', L(43, 45, 47, 49), 2, 2, 5, 126, { focus: 'э' }],
  [7, '', 'words', L(46, 48, 50, 52), 2, 2, 5, 128, { wordLen: [1, 4] }],
  [7, '', 'words', L(49, 51, 53, 56), 2, 2, 5, 116, { wordLen: [5, 10] }],
  [7, '', 'words', L(50, 53, 55, 57), 2, 2, 5, 104],
  [8, '', 'words', L(50, 53, 55, 57), 2, 2, 5, 104, { focusWeak: 3 }],
  [8, '', 'words', L(50, 53, 55, 57), 2, 2, 5, 104, { focusWeak: 3 }],
  [9, 'T', 'phrases', L(48, 52, 57, 61), 3, 2, 5, 134],
  [9, '', 'phrases', L(48, 52, 57, 61), 3, 2, 5, 134],
  [9, '', 'phrases', L(52, 56, 60, 64), 3, 2, 5, 106],
  [9, '', 'combos', L(55, 60, 64, 68), 3, 2, 5, 100, { focus: 'фжэпр', focusWeak: 3, noWords: true }],
  [10, '', 'phrases', L(60, 64, 68, 72), 3, 2, 5, 92, { chants: true }],
  [10, '', 'phrases', L(60, 64, 68, 72), 3, 2, 5, 92, { chants: true }],
];

const yardLeague: League = {
  id: 'yard', name: 'Двор', depth: 'full', part: 'основной ряд', keys: 'фывапролджэ', lessons: 32,
  cup: 'Кубок двора', stadium: 'коробка', skill: 'навык', story: 'сюжет',
};

function yardRaw(): Record<string, unknown> {
  return {
    about: 'фикстура', league: 'yard', layout: 'ru', rowWidth: 29,
    ladders: {
      letters: ['letters', 'letters', 'letters', 'letters'], pairs: ['letters', 'pairs', 'pairs', 'pairs'],
      combos: ['pairs', 'combos', 'combos', 'combos'], words: ['pairs', 'combos', 'words', 'words'],
      phrases: ['combos', 'words', 'phrases', 'phrases'],
    },
    lengthBands: [
      { stages: [1, 4], min: 270, max: 345 }, { stages: [5, 8], min: 420, max: 534 }, { stages: [9, 10], min: 570, max: 620 },
    ],
    stages: STAGES.map(([name, newKeys], i) => ({ n: i + 1, name, newKeys })),
    lessons: ROWS.map(([stage, tr, material, attacks, rows, g, c, warmup, extra], i) => ({
      id: `yard-${String(i + 1).padStart(2, '0')}`, stage, name: `Урок ${i + 1}`, material, attacks, rows, g, c, warmup,
      tip: ['совет один', 'совет два'],
      ...(tr === 'T' ? { friendly: true } : {}), ...(tr === 'K' ? { control: true } : {}), ...extra,
    })),
  };
}

const edit = (change: (raw: Record<string, unknown>, lessons: Record<string, unknown>[]) => void): unknown => {
  const raw = yardRaw();
  change(raw, raw.lessons as Record<string, unknown>[]);
  return raw;
};
const parseYard = (raw: unknown) => parseLeagueLessons(raw, keymap, yardLeague);

const league = (id: string, extra: Record<string, unknown> = {}) => ({
  id, name: 'Лига', depth: 'full', part: 'часть', keys: 'фы', lessons: 10, cup: 'Кубок', stadium: 'коробка',
  skill: 'навык', story: 'сюжет', anchors: { cup: [1], stadium: [{ after: 1, name: 'Ворота' }] }, ...extra,
});

// --- каркас лиг -------------------------------------------------------------------------------------------

describe('каркас лиг: parseLeagues', () => {
  const six = [
    league('yard', { lessons: 32, keys: 'фывапролджэ' }),
    league('district', { lessons: 36, depth: 'base', keys: 'йцукенгшщзхъ', games: { learn: ['Правка', 'Полоса'], fun: ['Этаж'] } }),
    league('city', { lessons: 30, depth: 'frame', keys: 'ячсмитьбю.' }),
    league('country', { lessons: 32, depth: 'frame', keys: 'ё,', shiftFrom: 17, games: { learn: ['Заглавная'], fun: ['Комментатор'] } }),
    league('europe', { lessons: 40, depth: 'frame', keys: keymap.rows.flat().filter((k) => k.code.startsWith('Digit')).flatMap((k) => k.chars?.ru ?? []).join('') }),
    league('world', { lessons: 30, depth: 'frame', keys: '' }),
  ];

  it('читает шесть лиг каркаса; сумма уроков — 200, Shift не с первого урока, у последней лиги ключей нет', () => {
    // Ловит: разбор падает на допустимых полях (games, shiftFrom, пустые keys) или каркас ТЗ-1.1 / ТЗ-1.11 нарушен.
    const parsed = parseLeagues({ leagues: six }, keymap);
    expect(parsed.map((x) => x.id)).toEqual(['yard', 'district', 'city', 'country', 'europe', 'world']);
    expect(parsed.reduce((s, x) => s + x.lessons, 0)).toBe(200);
    expect(parsed.every((x) => x.shiftFrom === undefined || x.shiftFrom > 1)).toBe(true);
    expect(parsed.at(-1)?.keys).toBe('');
    expect(parsed[3]?.games).toEqual({ learn: ['Заглавная'], fun: ['Комментатор'] });
  });

  it('отвергает: повтор id, кириллицу в id, чужую глубину, пустое поле, лишний знак, shiftFrom 1, games не по форме', () => {
    // Ловит: схема пропускает ошибку в leagues.json, и она всплывает уже в игре.
    const bad = (item: unknown, ...more: unknown[]) => () => parseLeagues({ leagues: [item, ...more] }, keymap);
    expect(bad(league('a'), league('a'))).toThrow(/duplicate id/);
    expect(bad(league('двор'))).toThrow(/latin/);
    expect(bad(league('a', { depth: 'half' }))).toThrow(/bad depth/);
    expect(bad(league('a', { cup: '' }))).toThrow(/expected cup/);
    expect(bad(league('a', { keys: 'ф?x' }))).toThrow(/not on the ru layout/);
    expect(bad(league('a', { shiftFrom: 1 }))).toThrow(/shiftFrom/);
    expect(bad(league('a', { lessons: 0 }))).toThrow(/lessons/);
    expect(bad(league('a', { games: { learn: [], fun: ['x'] } }))).toThrow(/games\.learn/);
    expect(bad(league('a', { games: { learn: ['x'], fun: ['x', 'y'] } }))).toThrow(/games\.fun/);
    expect(bad(league('a', { shiftFrom: 11 }))).toThrow(/shiftFrom/);
    expect(bad(league('a', { colour: 'red' }))).toThrow(/unknown field colour/);
    expect(bad(league('a', { games: { learn: ['x'], fun: ['x'], extra: [] } }))).toThrow(/unknown field extra/);
    expect(() => parseLeagues({ leagues: [league('a')], lol: 1 }, keymap)).toThrow(/unknown field lol/);
    expect(() => parseLeagues({ leagues: [] }, keymap)).toThrow();
  });
});

describe('якоря карты: anchors в leagues.json (019-Р5)', () => {
  const bad = (anchors: unknown, extra: Record<string, unknown> = {}) => () => parseLeagues({ leagues: [league('a', { anchors, ...extra })] }, keymap);
  const st = (...after: number[]) => after.map((n) => ({ after: n, name: 'я' }));
  const ok = { cup: [3, 10], stadium: st(2) };

  it('отвергает кривые якоря; у full/base якоря обязательны, у frame — нет', () => {
    // Ловит: флажок на несуществующем уроке или дважды на одном; лига с картой без якорей.
    expect(bad(ok)).not.toThrow();
    for (const cup of [[3, 11], [0, 3], [2.5], []]) expect(bad({ ...ok, cup })).toThrow(/cup/);
    for (const cup of [[5, 3], [3, 3]]) expect(bad({ ...ok, cup })).toThrow(/ascending/);
    expect(bad({ ...ok, stadium: st(4, 4) })).toThrow(/ascending/);
    expect(bad({ ...ok, stadium: st(11) })).toThrow(/after/);
    expect(bad({ ...ok, stadium: [{ after: 2, name: '', x: 1 }] })).toThrow(/unknown field x/);
    expect(bad({ ...ok, extra: 1 })).toThrow(/unknown field extra/);
    expect(bad(undefined, { depth: 'base' })).toThrow(/expected anchors/);
    expect(bad(undefined, { depth: 'frame' })).not.toThrow();
  });
});

// --- уроки лиги -------------------------------------------------------------------------------------------

describe('уроки лиги: parseLeagueLessons', () => {
  const lessons = parseYard(yardRaw());

  it('читает 32 урока Двора: буквы накапливаются по ступеням, новые — у первого урока ступени', () => {
    // Ловит: «забыл букву» — keys урока не равны накопленным newKeys ступеней; newKeys не у первого урока ступени.
    expect(lessons).toHaveLength(32);
    expect(lessons[0]).toMatchObject({ id: 'yard-01', n: 1, stage: 1, keys: 'ао', newKeys: 'ао', focus: 'ао', trap: true, friendly: true });
    expect(lessons[1]).toMatchObject({ keys: 'ао', newKeys: '', focus: '' });
    expect(lessons[14]).toMatchObject({ keys: 'аовлыдфжпр', newKeys: 'пр' });
    expect(lessons[18]?.keys).toBe('аовлыдфжпрэ');
    expect(lessons[31]?.keys).toBe('аовлыдфжпрэ');
    expect(lessons[13]).toMatchObject({ control: true, focus: 'фываолдж' });
    expect(lessons[29]).toMatchObject({ noWords: true, focusWeak: 3 });
    expect(lessons[21]?.wordLen).toEqual([1, 4]);
    expect(lessons[30]?.chants).toBe(true);
  });

  it('товарищеские — 1, 3, 6, 10, 15, 19, 27; контрольные — 14 и 21', () => {
    // Ловит: флаг friendly/control читается не из того поля или теряется.
    expect(lessons.filter((x) => x.friendly).map((x) => x.n)).toEqual([1, 3, 6, 10, 15, 19, 27]);
    expect(lessons.filter((x) => x.control).map((x) => x.n)).toEqual([14, 21]);
  });

  it('фикстура: разбор принял все 32 урока (полосы проверяет он сам); итог — 13 302 знака; rowWidth и лесенка в уроке', () => {
    // Ловит: фикстуру, разошедшуюся с таблицей design (13 302 знака); потерянные rowWidth и лесенку материала в уроке.
    expect(lessons.every((x) => x.rowWidth === 29 && x.ladder.length === x.attacks.length)).toBe(true);
    expect(lessons[1]!.ladder).toEqual(['letters', 'pairs', 'pairs', 'pairs']);
    const total = lessons.reduce((s, x) => s + x.warmup + 2 * x.attacks.reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(13302);
  });

  it('отвергает: чужую лигу, число уроков, чужой или повторный id, откат ступени, неизвестную ступень; вставка с новым id проходит', () => {
    // Ловит: файл другой лиги, чужой id или повтор проходят молча; а вставка урока ломает разбор (id после выпуска не меняются, 016-Р4).
    expect(() => parseYard(edit((r) => { r.league = 'district'; }))).toThrow(/league/);
    expect(() => parseYard(edit((_, l) => { l.pop(); }))).toThrow(/expected 32 lessons/);
    expect(() => parseYard(edit((_, l) => { l[4]!.id = 'city-05'; }))).toThrow(/yard-NN/);
    expect(() => parseYard(edit((_, l) => { l[4]!.id = 'yard-1'; }))).toThrow(/yard-NN/);
    expect(() => parseYard(edit((_, l) => { l[4]!.id = 'yard-01'; }))).toThrow(/duplicate id/);
    expect(parseYard(edit((_, l) => { l[4]!.id = 'yard-77'; }))[4]).toMatchObject({ id: 'yard-77', n: 5 });
    expect(() => parseYard(edit((_, l) => { l[5]!.stage = 1; }))).toThrow(/goes down/);
    expect(() => parseYard(edit((_, l) => { l[5]!.stage = 99; }))).toThrow(/unknown stage/);
  });

  it('отвергает: g ≥ c, атаки вне 3–6, атаку шире строк, матч вне полосы, focus вне букв урока', () => {
    // Ловит: нарушение правил схемы §1.2 — урок с невозможным счётом, обрезанной атакой или фокусом на чужой букве.
    expect(() => parseYard(edit((_, l) => { l[0]!.g = 5; }))).toThrow(/g < c/);
    expect(() => parseYard(edit((_, l) => { l[0]!.attacks = [16, 18]; }))).toThrow(/3\.\.6 attacks/);
    expect(() => parseYard(edit((_, l) => { l[0]!.attacks = [16, 18, 20, 30]; }))).toThrow(/does not fit/);
    expect(() => parseYard(edit((_, l) => { l[0]!.warmup = 10; }))).toThrow(/outside/);
    expect(() => parseYard(edit((_, l) => { l[0]!.focus = 'п'; }))).toThrow(/focus/);
    expect(() => parseYard(edit((_, l) => { l[0]!.material = 'sentences'; }))).toThrow(/bad material/);
    expect(() => parseYard(edit((_, l) => { l[0]!.rows = 4; }))).toThrow(/rows/);
    // trap строится на двух новых буквах: у урока без них (2) ловушка молча стала бы обычной атакой (016-Р10).
    expect(() => parseYard(edit((_, l) => { l[1]!.trap = true; }))).toThrow(/trap needs exactly two new keys/);
    expect(() => parseYard(edit((_, l) => { l[0]!.tip = ['']; }))).toThrow(/tip/);
  });

  it('отвергает: букву не с раскладки, битую лесенку, повтор ступени', () => {
    // Ловит: ступень с буквой, которой нет на раскладке (её не напечатать), и порча общих таблиц файла.
    expect(() => parseYard(edit((r) => { (r.stages as { newKeys: string }[])[0]!.newKeys = 'ao'; }))).toThrow(/not on the ru layout/);
    expect(() => parseYard(edit((r) => { (r.ladders as Record<string, unknown>).words = ['words']; }))).toThrow(/expected 1 attacks for ladder of words/);
    expect(() => parseYard(edit((r) => { (r.stages as { n: number }[])[1]!.n = 1; }))).toThrow(/duplicate stage/);
  });

  it('отвергает: пустой совет, лишний ключ, нечисловые и нецелые атаки, нет rowWidth, раскладку не из списка, лесенку не по числу атак', () => {
    // Ловит: опечатка в имени поля, пропавшая молча; пустой tip; атаки, не совпадающие с лесенкой материала (design §3).
    expect(() => parseYard(edit((_, l) => { l[0]!.tip = []; }))).toThrow(/tip/);
    expect(() => parseYard(edit((_, l) => { delete l[0]!.tip; }))).toThrow(/tip/);
    expect(() => parseYard(edit((_, l) => { l[0]!.frendly = true; }))).toThrow(/unknown field frendly/);
    expect(() => parseYard(edit((r) => { r.colour = 1; }))).toThrow(/unknown field colour/);
    expect(() => parseYard(edit((r) => { (r.stages as Record<string, unknown>[])[0]!.title = 'x'; }))).toThrow(/unknown field title/);
    expect(() => parseYard(edit((r) => { (r.lengthBands as Record<string, unknown>[])[0]!.top = 1; }))).toThrow(/unknown field top/);
    expect(() => parseYard(edit((_, l) => { l[0]!.attacks = [16, 18, 20.5, 22]; }))).toThrow(/attacks/);
    expect(() => parseYard(edit((_, l) => { l[0]!.attacks = [16, 18, 20, 'x']; }))).toThrow(/attacks/);
    expect(() => parseYard(edit((r) => { delete r.rowWidth; }))).toThrow(/rowWidth/);
    expect(() => parseYard(edit((r) => { r.layout = 'fr'; }))).toThrow(/bad layout/);
    expect(() => parseYard(edit((r) => { r.ladders = { ...(r.ladders as object), letters: ['letters', 'letters', 'letters'] }; }))).toThrow(/expected 3 attacks/);
    expect(() => parseYard(edit((r) => { (r.ladders as Record<string, unknown>).words = []; }))).toThrow(/ladders\.words/);
    expect(() => parseYard(edit((r) => { (r.ladders as Record<string, unknown>).words = ['words', 'tales']; }))).toThrow(/ladders\.words/);
  });

  it('лесенка не зашита четырьмя: пять атак при лесенке из пяти ступеней проходят', () => {
    // Ловит: число атак, жёстко привязанное к 4, — следующим лигам нужны другие лесенки.
    const five = parseYard(edit((r, l) => {
      (r.ladders as Record<string, unknown>).letters = ['letters', 'letters', 'letters', 'letters', 'letters'];
      l[0]!.attacks = [16, 18, 20, 22, 22];
      l[0]!.warmup = 124 - 44;
    }));
    expect(five[0]).toMatchObject({ attacks: [16, 18, 20, 22, 22], ladder: ['letters', 'letters', 'letters', 'letters', 'letters'] });
  });

  it('отвергает: флаги не boolean, focusWeak вне 0–5, wordLen не по форме, пустое имя урока и ступени, ступень без полосы', () => {
    // Ловит: «'true'» вместо true, который молча читается как false; focusWeak 9; wordLen [5,1]; безымянный урок; ступень без длины матча.
    for (const key of ['friendly', 'control', 'trap', 'noWords', 'chants']) {
      expect(() => parseYard(edit((_, l) => { l[2]![key] = 'yes'; })), key).toThrow(new RegExp(`boolean ${key}`));
    }
    expect(() => parseYard(edit((_, l) => { l[2]!.focusWeak = 6; }))).toThrow(/focusWeak/);
    expect(() => parseYard(edit((_, l) => { l[2]!.focusWeak = -1; }))).toThrow(/focusWeak/);
    expect(parseYard(edit((_, l) => { l[2]!.focusWeak = 5; }))[2]!.focusWeak).toBe(5);
    for (const w of [[5, 1], [1], [0, 3], [1.5, 3], 'ab']) {
      expect(() => parseYard(edit((_, l) => { l[2]!.wordLen = w; })), JSON.stringify(w)).toThrow(/wordLen/);
    }
    expect(() => parseYard(edit((_, l) => { l[2]!.name = ''; }))).toThrow(/expected name/);
    expect(() => parseYard(edit((r) => { (r.stages as Record<string, unknown>[])[2]!.name = ''; }))).toThrow(/expected name/);
    expect(() => parseYard(edit((r) => { (r.lengthBands as unknown[]).pop(); }))).toThrow(/no length band for stage 9/);
  });

  it('отвергает полосы длины: не [от, до], дробные, от > до, min > max, перекрытие', () => {
    // Ловит: кривая таблица полос, при которой урок попадает не в ту полосу или проверка длины матча молча не срабатывает.
    const band = (change: (b: Record<string, unknown>[]) => void) => edit((r) => change(r.lengthBands as Record<string, unknown>[]));
    expect(() => parseYard(band((b) => { b[0]!.stages = [1]; }))).toThrow(/stages \[from, to\]/);
    expect(() => parseYard(band((b) => { b[0]!.stages = 'ab'; }))).toThrow(/stages \[from, to\]/);
    expect(() => parseYard(band((b) => { b[0]!.stages = [1, 4.5]; }))).toThrow(/integers/);
    expect(() => parseYard(band((b) => { b[0]!.stages = [4, 1]; }))).toThrow(/after to/);
    expect(() => parseYard(band((b) => { b[0]!.min = 400; }))).toThrow(/above max/);
    expect(() => parseYard(band((b) => { b[1]!.stages = [4, 8]; }))).toThrow(/overlap/);
    expect(() => parseYard(band((b) => { b[0]!.min = 0.5; }))).toThrow(/min/);
  });
});

// --- словарь ----------------------------------------------------------------------------------------------

describe('словарь: parseDictionary', () => {
  const dict = (ru: Record<string, unknown>) => ({ ru: { words: ['а', 'ад'], phrases: ['повар подал плов'], chants: ['двор рад'], ...ru } });
  const parse = (ru: Record<string, unknown> = {}) => parseDictionary(dict(ru), keymap, 'ru');

  it('читает слова, фразы и кричалки', () => {
    // Ловит: разбор путает списки или портит строки.
    expect(parse()).toEqual({ words: ['а', 'ад'], phrases: ['повар подал плов'], chants: ['двор рад'] });
  });

  it('отвергает: повтор, заглавную, пробел в слове, пробел по краям и двойной, длинную фразу, чужой знак', () => {
    // Ловит: в словарь просочились имена собственные, кривые пробелы или фраза, не влезающая в строку.
    expect(() => parse({ words: ['а', 'а'] })).toThrow(/duplicate/);
    expect(() => parse({ words: ['Ад'] })).toThrow(/lowercase/);
    expect(() => parse({ words: ['а д'] })).toThrow(/lowercase/);
    expect(() => parse({ phrases: [' двор рад'] })).toThrow(/spaces/);
    expect(() => parse({ phrases: ['двор рад '] })).toThrow(/spaces/);
    expect(() => parse({ chants: ['двор  рад'] })).toThrow(/spaces/);
    expect(() => checkDictionaryFits(parse({ phrases: ['повар подал плов повар подал плов'] }), 29)).toThrow(/longer/);
    expect(() => checkDictionaryFits(parse({ phrases: ['а б'], chants: ['двор рад'] }), 7)).toThrow(/chants\[0\]/);
    expect(() => checkDictionaryFits(parse(), 29)).not.toThrow();
    expect(() => parse({ words: ['ад1'] })).toThrow(/lowercase/);
    expect(() => parse({ words: ['ab'] })).toThrow(/lowercase/);
    expect(() => parse({ words: [''] })).toThrow(/expected string/);
    expect(() => parseDictionary({ ru: { words: ['а'] } }, keymap, 'ru')).toThrow(/phrases/);
  });
});

// --- модель A80 -------------------------------------------------------------------------------------------

describe('словарь', () => {
  const raw = JSON.parse(readFileSync(join(__dirname, '../src/content/dictionary.json'), 'utf8')) as unknown;
  const dict = parseDictionary(raw, keymap, 'ru');
  const ROW = 'фывапролджэ';
  const fits = (text: string, keys: string) => [...text].every((ch) => ch === ' ' || keys.includes(ch));

  it('разбирается как есть; повтор слова parseDictionary отвергает', () => {
    // Ловит: повтор, заглавную, чужую раскладку, лишний пробел или фразу длиннее 29 знаков в dictionary.json.
    expect(dict.words.length).toBeGreaterThan(0);
    expect(() => parseDictionary({ ru: { ...dict, words: [...dict.words, dict.words[0]] } }, keymap, 'ru')).toThrow();
  });

  it('фразы и кричалки влезают в самую узкую строку курса (сверка load.ts уже прошла при загрузке)', () => {
    // Ловит: фразу длиннее строки атаки — она переносилась бы посреди слова; и что load.ts отдаёт тот же словарь.
    const width = Math.min(...courseLessons.map((x) => x.rowWidth));
    expect(width).toBe(29);
    expect(() => checkDictionaryFits(dict, width)).not.toThrow();
    expect(dictionary).toEqual(dict);
  });

  it('объём: слов ≥ 200, фраз ≥ 60, кричалок ≥ 10 (016-Р2, Р3)', () => {
    // Ловит: вычеркнули слишком много при вычитке — словарь не хватит на 32 урока.
    expect(dict.words.length).toBeGreaterThanOrEqual(200);
    expect(dict.phrases.length).toBeGreaterThanOrEqual(60);
    expect(dict.chants.length).toBeGreaterThanOrEqual(10);
  });

  it('всё — только из букв основного ряда ФЫВАОЛДЖПРЭ', () => {
    // Ловит: слово с буквой, которой нет во Дворе (е, у, и, я, ё), — урок его не сможет взять.
    for (const w of [...dict.words, ...dict.phrases, ...dict.chants]) expect(fits(w, ROW), w).toBe(true);
  });

  it('пулы по ступеням не пустеют: слов и фраз хватает на уроки со словами и фразами', () => {
    // Ловит: ступень без слов (генератор уйдёт в сочетания, MIN_POOL = 8) и мало фраз для уроков 27–32.
    const pool = (keys: string) => dict.words.filter((w) => fits(w, keys)).length;
    expect(pool('ыдвалоф')).toBeGreaterThanOrEqual(8);
    expect(pool('фываолдж')).toBeGreaterThanOrEqual(30);
    expect(pool('фываолджпр')).toBeGreaterThanOrEqual(150);
    expect(dict.phrases.filter((p) => fits(p, 'фываолджпр')).length).toBeGreaterThanOrEqual(40);
    expect(dict.chants.filter((c) => fits(c, 'фываолджпр')).length).toBeGreaterThanOrEqual(8);
  });

  it('фразы — 2–5 слов, кричалки — 2–3 слова', () => {
    // Ловит: одиночное слово среди фраз или слишком длинная строка, которую ребёнок не удержит в голове.
    for (const p of dict.phrases) expect(p.split(' ').length, p).toBeGreaterThanOrEqual(2);
    for (const p of dict.phrases) expect(p.split(' ').length, p).toBeLessThanOrEqual(5);
    for (const c of dict.chants) expect(c.split(' ').length, c).toBeLessThanOrEqual(3);
  });
});

describe('лестница Двора: файл против фикстуры', () => {
  const yard = courseLessons.filter((x) => x.league === 'yard');

  it('файл Двора совпадает с фикстурой по строгости: ступень, потолок, атаки, строки, g/c, разминка, флаги', () => {
    // Ловит: правку лестницы в файле без правки проверенной фикстуры (или наоборот).
    const fixture = parseYard(yardRaw());
    const key = (x: CourseLesson) => [x.stage, x.material, x.attacks, x.rows, x.g, x.c, x.warmup, x.friendly, x.control];
    expect(yard.map(key)).toEqual(fixture.map(key));
  });
});
