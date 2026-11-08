/**
 * Карта Двора и матчдэй (спека 019). Здесь пока блок «матчдэй» (Т3): очередь шагов и итог матча для цепочки;
 * блоки модели карты, «Пути клуба», lockText и фокуса добавляют Т2 и следующие.
 */
import { describe, expect, it } from 'vitest';
import { resultModel, type ResultExtras } from '../src/engine/matchResult/resultModel';
import type { MatchResultInfo } from '../src/engine/match/view';
import { planMatchday, type StepKind, type StepOffer } from '../src/engine/matchday/queue';
import { summaryOf, type MatchBefore } from '../src/engine/matchday/summary';
import { courseLessons, leagues } from '../src/app/course/load';
import mapYard from '../src/content/map-yard.json';
import { MIN_ANY, MIN_NEIGHBOUR, parseMapLayout } from '../src/engine/map/layout';
import { nextFocus } from '../src/engine/map/focus';
import { lockText } from '../src/engine/map/lock';
import { buildMapModel, FLAG_LIFT, playable, type MapInput } from '../src/engine/map/model';
import { keyCount, leagueDone, pathModel } from '../src/engine/map/path';
import { entryRedirect, START_PATH, type EntryDeps, type EntryTarget } from '../src/app/firstRun/entry';
import { MAP_PATH, MATCH_PATH, PATH_PATH } from '../src/app/map/go';

const offer = (id: string, kind: StepKind): StepOffer<string> => ({ id, kind, route: `/${id}` });
const ids = (l: StepOffer<string>[]) => l.map((o) => o.id);

describe('матчдэй: очередь шагов (design §7, ТЗ-10.11)', () => {
  it('порядок: пак → праздник → школа → конец дня, как бы ни пришли', () => {
    // Ловит: шаги в порядке прихода (а не по виду), школа раньше пака.
    const plan = planMatchday([offer('d', 'dayEnd'), offer('s', 'school'), offer('c', 'celebration'), offer('p', 'pack')]);
    expect(ids(plan.steps)).toEqual(['p', 'c', 's', 'd']);
    expect(plan.queued).toEqual([]);
  });

  it('4 шага и 3 праздника: до карты ≤ 4, праздник один (первый по id), остальные — в queued', () => {
    // Ловит: два праздника подряд (ребёнка заваливают), потерю лишнего (праздник пропал, а не отложен), >4 шагов.
    const plan = planMatchday([
      offer('c3', 'celebration'), offer('p', 'pack'), offer('c1', 'celebration'),
      offer('d', 'dayEnd'), offer('c2', 'celebration'), offer('s', 'school'),
    ]);
    expect(ids(plan.steps)).toEqual(['p', 'c1', 's', 'd']);
    expect(ids(plan.queued)).toEqual(['c2', 'c3']);
    expect(plan.steps.length).toBeLessThanOrEqual(4);
  });

  it('пустой реестр — пустая цепочка (сразу карта); сверх четырёх шагов — в queued; вход не меняется', () => {
    // Ловит: падение на пустом входе, цепочку длиннее 4, порчу входного массива сортировкой.
    expect(planMatchday([])).toEqual({ steps: [], queued: [] });
    const input = [offer('p2', 'pack'), offer('p1', 'pack'), offer('s1', 'school'), offer('s2', 'school'), offer('d', 'dayEnd')];
    const copy = [...input];
    const plan = planMatchday(input);
    expect(ids(plan.steps)).toEqual(['p1', 'p2', 's1', 's2']);
    expect(ids(plan.queued)).toEqual(['d']);
    expect(input).toEqual(copy);
  });
});

describe('матчдэй: summaryOf (design §7.1)', () => {
  const extras: ResultExtras = {
    help: 'none', softened: false, paid: true,
    rules: { help: { reserveCap: 2, coachCap: 1 }, threeStar: 0.9, coinPer: 10 } as ResultExtras['rules'],
    correct: 40, coins: 4, carry: 0, growth: [], report: null,
  };
  const win = (stars: number): MatchResultInfo => ({
    verdict: { passed: true, typedWin: true, stars, newStars: stars, couldBeBetter: false },
    score: { typed: 3, kick: 0, conceded: 1 }, outcome: 'win', fails: 0, offer: null, accuracy: 0.95, correct: 95, errors: 5, cpm: 120,
  });
  const loss: MatchResultInfo = {
    verdict: { passed: false, typedWin: false, stars: 0, newStars: 0, couldBeBetter: false },
    score: { typed: 1, kick: 0, conceded: 3 }, outcome: 'loss', fails: 1, offer: { coachMinute: false, options: ['replay'] },
    accuracy: 0.6, correct: 60, errors: 40, cpm: 80,
  };
  const before: MatchBefore = { lessonId: 'yard-05', league: 'yard', wasPassed: false, stars: 0, lastDay: '2026-11-07' };
  const sum = (info: MatchResultInfo, b: MatchBefore, today = '2026-11-08') =>
    summaryOf(info, resultModel(info, extras), b, today, 1234);

  it('победа с первого прохода: firstPass, звёзды выросли, монеты и время из итога', () => {
    // Ловит: потерю firstPass (пак не выдастся), starsAfter < starsBefore, неверные монеты/вид.
    const s = sum(win(2), before);
    expect(s).toMatchObject({
      lessonId: 'yard-05', league: 'yard', kind: 'win', outcome: 'win', passed: true,
      firstPass: true, starsBefore: 0, starsAfter: 2, coins: 4, at: 1234,
    });
  });

  it('повтор пройденного: нет firstPass, лучшие звёзды не падают', () => {
    // Ловит: второй пак за тот же урок, откат звёзд при худшем повторе.
    const s = sum(win(1), { ...before, wasPassed: true, stars: 3 });
    expect(s).toMatchObject({ firstPass: false, passed: true, starsBefore: 3, starsAfter: 3 });
  });

  it('второй матч дня — не firstMatchToday; первый (и самый первый в жизни) — да', () => {
    // Ловит: «первый матч дня» на каждом матче, null вместо «не играл».
    expect(sum(win(1), { ...before, lastDay: '2026-11-08' }).firstMatchToday).toBe(false);
    expect(sum(win(1), before).firstMatchToday).toBe(true);
    expect(sum(win(1), { ...before, lastDay: null }).firstMatchToday).toBe(true);
  });

  it('провал: passed = false, нет firstPass, звёзды прежние', () => {
    // Ловит: зачёт провала (пак за непройденное), рост звёзд без прохода.
    const s = sum(loss, { ...before, stars: 1 });
    expect(s).toMatchObject({ kind: 'loss', outcome: 'loss', passed: false, firstPass: false, starsBefore: 1, starsAfter: 1 });
  });
});

describe('раскладка: parseMapLayout (design §4.1, 019-Р4)', () => {
  interface RawMap {
    league: string;
    points: [number, number][];
    places: { stage: number; name: string }[];
    buildings: Record<string, [number, number]>;
    gate?: number[];
    extra?: number;
  }
  const clone = () => structuredClone(mapYard) as unknown as RawMap;
  const at = (m: RawMap, i: number): [number, number] => m.points[i]!;
  const place = (m: RawMap, i: number) => m.places[i]!;
  const parse = (raw: unknown) => parseMapLayout(raw, leagues, courseLessons);
  const bad = (edit: (m: RawMap) => void) => () => {
    const m = clone();
    edit(m);
    return parse(m);
  };

  it('Двор: 32 точки по числу уроков, 10 мест по ступеням, 4 здания, ворота; всё разобрано', () => {
    // Ловит: map-yard.json разошёлся с lessons-yard.json (число точек, ступени) или с форматом разбора.
    const l = parse(mapYard);
    expect(l.league).toBe('yard');
    expect(l.points).toHaveLength(leagues.find((x) => x.id === 'yard')!.lessons);
    expect(l.places.map((p) => p.stage).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(Object.keys(l.buildings).sort()).toEqual(['base', 'museum', 'school', 'stadium']);
  });

  it('якоря Двора: кубки 9/14/18/21/24/28/32 и 9 этапов стадиона по возрастанию', () => {
    // Ловит: якоря Двора разошлись с ТЗ-8.3 / ТЗ-1.5 (число флажков, номера).
    const yard = leagues.find((x) => x.id === 'yard')!;
    expect(yard.anchors?.cup).toEqual([9, 14, 18, 21, 24, 28, 32]);
    expect(yard.anchors?.stadium.map((x) => x.after)).toEqual([2, 5, 9, 14, 18, 21, 24, 26, 30]);
  });

  it('точки Двора: соседние ≥ 48, любые две ≥ 40, внутри поля с полем 40', () => {
    // Ловит: тесный путь (точки не нажать пальцем/мышью) или точка у самого края поля.
    const { points, view } = parse(mapYard);
    points.forEach((p, i) => {
      expect(p[0]).toBeGreaterThanOrEqual(40);
      expect(p[1]).toBeGreaterThanOrEqual(40);
      expect(p[0]).toBeLessThanOrEqual(view[0] - 40);
      expect(p[1]).toBeLessThanOrEqual(view[1] - 40);
      if (i > 0) expect(Math.hypot(p[0] - points[i - 1]![0], p[1] - points[i - 1]![1])).toBeGreaterThanOrEqual(MIN_NEIGHBOUR);
      for (let j = 0; j < i; j++) expect(Math.hypot(p[0] - points[j]![0], p[1] - points[j]![1])).toBeGreaterThanOrEqual(MIN_ANY);
    });
  });

  it('отвергает: чужая лига, число точек, точка вне поля, тесные точки, места, здания, лишний ключ', () => {
    // Ловит: ошибка в map-<лига>.json всплывает уже на экране, а не при загрузке; разбор молча чинит данные.
    expect(bad((m) => { m.league = 'nowhere'; })).toThrow(/unknown league/);
    expect(bad((m) => { m.points.pop(); })).toThrow(/points/);
    expect(bad((m) => { m.points[3] = [10, 400]; })).toThrow(/outside the field/);
    expect(bad((m) => { m.points[3] = [at(m, 3)[0], 1000]; })).toThrow(/outside the field/);
    expect(bad((m) => { m.points[5] = [at(m, 4)[0] + 10, at(m, 4)[1]]; })).toThrow(/too close/);
    expect(bad((m) => { m.points[9] = [at(m, 2)[0] + 5, at(m, 2)[1]]; })).toThrow(/too close/);
    expect(bad((m) => { m.points[2] = [1.5, 400]; })).toThrow(/integers/);
    expect(bad((m) => { m.places.pop(); })).toThrow(/no place for stage/);
    expect(bad((m) => { place(m, 1).stage = 1; })).toThrow(/duplicate stage/);
    expect(bad((m) => { place(m, 0).stage = 11; })).toThrow(/no lessons/);
    expect(bad((m) => { place(m, 0).name = ''; })).toThrow(/name/);
    expect(bad((m) => { delete m.buildings.museum; })).toThrow(/museum/);
    expect(bad((m) => { m.buildings.castle = [800, 400]; })).toThrow(/unknown field castle/);
    expect(bad((m) => { m.buildings.stadium = [1590, 100]; })).toThrow(/outside the field/);
    expect(bad((m) => { delete m.gate; })).toThrow(/gate/);
    expect(bad((m) => { m.extra = 1; })).toThrow(/unknown field extra/);
  });
});

// --- модель карты (Т2) ---------------------------------------------------------------------------------

const yardId = (n: number) => `yard-${String(n).padStart(2, '0')}`;
const yardIds = (ns: number[]) => ns.map(yardId);
const mapLayout = parseMapLayout(mapYard, leagues, courseLessons);
const yardLeague = leagues.find((x) => x.id === 'yard')!;
const mapInput = (passed: string[], over: Partial<MapInput> = {}): MapInput => ({
  league: yardLeague, lessons: courseLessons, layout: mapLayout, nextLeague: leagues[1]!, passed,
  records: {}, half2: null, provided: {}, ...over,
});
const stateOf = (m: ReturnType<typeof buildMapModel>, n: number) => m.points[n - 1]!.state;

describe('карта: модель (design §5.1)', () => {
  it('passed {1–5, 7}: c = 6, 7 пройден, 8–10 впереди, 11 в тумане', () => {
    // Ловит: c как «максимум пройденного + 1» (стал бы 8); ahead считает пройденные; туман ближе трёх.
    const m = buildMapModel(mapInput(yardIds([1, 2, 3, 4, 5, 7])));
    expect(m.focus).toBe('yard-06');
    expect([1, 2, 3, 4, 5, 7].map((n) => stateOf(m, n))).toEqual(Array(6).fill('passed'));
    expect(stateOf(m, 6)).toBe('current');
    expect([8, 9, 10].map((n) => stateOf(m, n))).toEqual(['ahead', 'ahead', 'ahead']);
    expect(stateOf(m, 11)).toBe('fog');
  });

  it('playable: пройденный и текущий — да, yard-30 при c = 6 — нет, чужой id — нет', () => {
    // Ловит: адрес матча открывает урок из тумана/«впереди»; пройденный за текущим теряет игру.
    const input = { leagues, lessons: courseLessons, passed: yardIds([1, 2, 3, 4, 5, 7]) };
    expect(playable(input, 'yard-30')).toBe(false);
    expect(playable(input, 'yard-08')).toBe(false);
    expect(playable(input, 'yard-07')).toBe(true);
    expect(playable(input, 'yard-06')).toBe(true);
    expect(playable(input, 'nope-01')).toBe(false);
  });

  it('звёзды, значки, кольцо, продолжить; незнакомые id пропускаются', () => {
    // Ловит: звёзды вне 0…3, значок не у товарищеских и 14/21, resume у неиграемой точки, падение на чужом id в passed.
    const m = buildMapModel(mapInput([...yardIds([1, 2]), 'ghost-1'], {
      records: { 'yard-01': { stars: 7, back: true }, 'yard-02': { stars: -2, back: false } },
      half2: { lessonId: 'yard-03', score: [1, 1] },
    }));
    expect(m.points[0]).toMatchObject({ stars: 3, back: true, resume: null });
    expect(m.points[1]!.stars).toBe(0);
    expect(m.points[2]!.resume).toEqual([1, 1]);
    expect(m.points[0]!.badge).toBe('friendly');
    expect(m.points[13]!.badge).toBe('control');
    expect(m.points[20]!.badge).toBe('control');
    expect(m.stars).toEqual({ got: 3, max: 96 });
    const far = buildMapModel(mapInput([], { half2: { lessonId: 'yard-09', score: [0, 0] } }));
    expect(far.points[8]!.resume).toBeNull();
  });

  it('места ступеней, флажки (крупный — первый ≥ c), стадион, замки по умолчанию', () => {
    // Ловит: большой флажок не там, замок кубка не меняется после урока 9, стадион не сдвигается, места без «next».
    const fresh = buildMapModel(mapInput([]));
    expect(fresh.places.map((p) => p.state).slice(0, 3)).toEqual(['open', 'next', 'fog']);
    expect(fresh.flags.map((f) => f.after)).toEqual([9, 14, 18, 21, 24, 28, 32]);
    expect(fresh.flags.filter((f) => f.big).map((f) => f.after)).toEqual([9]);
    expect(fresh.flags[0]!.lock).toEqual({ lesson: 9 });
    expect(fresh.flags[0]!.at[1]).toBe(mapLayout.points[8]![1] - FLAG_LIFT);
    // Правая колонка пути: флажок слева от точки, не над ней (иначе ложится на точку-соседа сверху, 019-Р41).
    expect(fresh.flags.map((f) => f.side)).toEqual(['up', 'up', 'up', 'up', 'up', 'left', 'left']);
    expect(fresh.flags[5]!.at).toEqual(mapLayout.points[27]);
    expect(fresh.buildings.find((b) => b.id === 'stadium')).toMatchObject({ lock: null, next: { after: 2, name: 'Ворота' } });
    expect(fresh.buildings.find((b) => b.id === 'school')!.lock).toEqual({ soon: true });
    const mid = buildMapModel(mapInput(yardIds(Array.from({ length: 10 }, (_, i) => i + 1))));
    expect(mid.flags.filter((f) => f.big).map((f) => f.after)).toEqual([14]);
    expect(mid.flags[0]!.lock).toEqual({ soon: true });
    expect(mid.buildings.find((b) => b.id === 'stadium')!.next).toEqual({ after: 14, name: 'Сетка' });
  });

  it('поставщики подменяют замки; 32 пройдены без кубка — ворота «строится» (Район frame), base — открыты', () => {
    // Ловит: ворота «открыты» к недостроенному Району, игнор поставщика, большой флажок после прохода всего не последний.
    const all = yardIds(Array.from({ length: 32 }, (_, i) => i + 1));
    const m = buildMapModel(mapInput(all, { provided: {
      cup: () => ({ lock: { matches: 2 }, hint: 'x' }),
      buildings: { school: () => ({ lock: null, mark: 'new' }) },
    } }));
    expect(m.gate.state).toBe('building');
    expect(m.focus).toBe('gate');
    expect(m.flags.filter((f) => f.big).map((f) => f.after)).toEqual([32]);
    expect(m.flags[0]).toMatchObject({ lock: { matches: 2 }, hint: 'x' });
    expect(m.buildings.find((b) => b.id === 'school')).toMatchObject({ lock: null, mark: 'new' });
    expect(m.buildings.find((b) => b.id === 'stadium')!.next).toBeNull();
    expect(buildMapModel(mapInput(all, { nextLeague: { ...leagues[1]!, depth: 'base' } })).gate.state).toBe('open');
    expect(buildMapModel(mapInput(all.slice(0, 31))).gate.state).toBe('fog');
  });
});

describe('карта: модель, правки ревью (019-Р18)', () => {
  const fake = Array.from({ length: 36 }, (_, i) => ({ ...courseLessons[0]!, id: `district-${i + 1}`, league: 'district', n: i + 1, stage: 1 }));
  const lessons = [...courseLessons, ...fake];
  const all = yardIds(Array.from({ length: 32 }, (_, i) => i + 1));

  it('playable: урок следующей лиги закрыт, пока предыдущая не пройдена', () => {
    // Ловит: адрес открывает первый урок Района при пустом прогрессе (раньше Двора) или после Двора не открывает.
    expect(playable({ leagues, lessons, passed: [] }, 'district-1')).toBe(false);
    expect(playable({ leagues, lessons, passed: yardIds([1, 2]) }, 'district-1')).toBe(false);
    expect(playable({ leagues, lessons, passed: all }, 'district-1')).toBe(true);
    expect(playable({ leagues, lessons, passed: all }, 'district-2')).toBe(false);
    expect(playable({ leagues, lessons, passed: [] }, 'yard-01')).toBe(true);
  });

  it('«дыра»: passed {1–5, 7–32} — лига пройдена по последнему уроку, ворота и путь согласны, фокус на c', () => {
    // Ловит: ворота «в тумане» при пройденной по пути лиге (расхождение с «Путём клуба»); фокус на воротах при c ≠ null.
    const hole = yardIds([1, 2, 3, 4, 5, ...Array.from({ length: 26 }, (_, i) => i + 7)]);
    const m = buildMapModel(mapInput(hole));
    expect(leagueDone(yardLeague, courseLessons, hole)).toBe(true);
    expect(pathModel(leagues, courseLessons, hole)[0]!.state).toBe('done');
    expect(m.gate.state).toBe('building');
    expect(m.focus).toBe('yard-06');
  });

  it('место ступени с пройденным уроком открыто, даже если текущая точка раньше', () => {
    // Ловит: ступень урока 20 остаётся туманом при c = 6; «next» достаётся уже открытой ступени.
    const m = buildMapModel(mapInput(yardIds([1, 2, 3, 4, 5, ...Array.from({ length: 14 }, (_, i) => i + 7)])));
    const stage20 = courseLessons.find((l) => l.id === 'yard-20')!.stage;
    expect(m.places.find((p) => p.stage === stage20)!.state).toBe('open');
    const nexts = m.places.filter((p) => p.state === 'next');
    expect(nexts).toHaveLength(1);
    expect(nexts[0]!.stage).toBeGreaterThan(stage20);
  });

  it('якорь: passed 1–8 → c = 9 и крупный флажок на 9 (не следующий)', () => {
    // Ловит: сравнение «a > c» вместо «a ≥ c» — крупный флажок уезжает на 14, пока кубок 9 ещё впереди.
    const m = buildMapModel(mapInput(yardIds([1, 2, 3, 4, 5, 6, 7, 8])));
    expect(m.focus).toBe('yard-09');
    expect(m.flags.filter((f) => f.big).map((f) => f.after)).toEqual([9]);
  });

  it('нет следующей лиги — ворота в тумане; ключи у «строится»', () => {
    // Ловит: ворота «открыты» в никуда; пустая подпись клавиш у строящегося Района.
    expect(buildMapModel(mapInput(all, { nextLeague: null })).gate.state).toBe('fog');
    expect(pathModel(leagues, courseLessons, all)[1]).toMatchObject({ state: 'building', keys: 12 });
  });
});

describe('карта: «Путь клуба» (design §6)', () => {
  it('день 1: Двор — текущий, Район — следующий с числом клавиш, остальные туман, кубок мира виден', () => {
    // Ловит: не шесть мест, нет подписи следующего, кубок мира пропал в тумане, подсчёт клавиш с пробелами.
    const p = pathModel(leagues, courseLessons, []);
    expect(p.map((x) => x.state)).toEqual(['current', 'next', 'fog', 'fog', 'fog', 'fog']);
    expect(p[1]!.keys).toBe(12);
    expect(p.filter((x) => x.alwaysVisible).map((x) => x.league)).toEqual(['world']);
    expect(keyCount(leagues[4]!)).toBe(20);
    // Ход и номер текущего урока — для «N из 32» и кнопки «К уроку N» (019-Р37).
    expect(p[0]).toMatchObject({ progress: { done: 0, total: 32 }, lessonN: 1 });
    expect(pathModel(leagues, courseLessons, yardIds([1, 2, 3]))[0]).toMatchObject({ progress: { done: 3, total: 32 }, lessonN: 4 });
    expect(p[1]).toMatchObject({ progress: null, lessonN: null });
  });

  it('32 пройдены: Двор готов, Район «строится»; Район base и пройден — Город текущий', () => {
    // Ловит: лига «пройдена» по кубку/школе, а не по последнему уроку; frame-лига считается открытой.
    const all = yardIds(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(leagueDone(yardLeague, courseLessons, all)).toBe(true);
    expect(leagueDone(yardLeague, courseLessons, all.slice(0, 31))).toBe(false);
    // 019-Р37: пока Район строится, он — следующее место; Город в тумане, а не «следующий».
    expect(pathModel(leagues, courseLessons, all).map((x) => x.state)).toEqual(['done', 'building', 'fog', 'fog', 'fog', 'fog']);
    const district = leagues[1]!;
    const fake = Array.from({ length: 36 }, (_, i) => ({ ...courseLessons[0]!, id: `district-${i + 1}`, league: 'district', n: i + 1 }));
    const lessons = [...courseLessons, ...fake];
    const passed = [...all, 'district-36'];
    expect(leagueDone(district, lessons, passed)).toBe(true);
    expect(pathModel(leagues, lessons, passed).map((x) => x.state)).toEqual(['done', 'done', 'building', 'fog', 'fog', 'fog']);
    expect(pathModel(leagues, lessons, all)[1]!.state).toBe('building');
  });
});

describe('карта: замки (ТЗ-1.9)', () => {
  it('lockText: четыре вида, число только у lesson и matches', () => {
    // Ловит: потерянное число для склонения, лишнее n у nextTime/soon, перепутанный ключ.
    expect(lockText({ lesson: 9 })).toEqual({ key: 'lesson', n: 9 });
    expect(lockText({ matches: 3 })).toEqual({ key: 'matches', n: 3 });
    expect(lockText({ nextTime: true })).toEqual({ key: 'nextTime' });
    expect(lockText({ soon: true })).toEqual({ key: 'soon' });
  });
});

describe('карта: фокус (design §5.3, ТЗ-0.16)', () => {
  const m = buildMapModel(mapInput(yardIds([1, 2, 3])));
  it('→/← ходят по играемым точкам, края — на месте, из чужого фокуса — к c', () => {
    // Ловит: стрелка уходит на «впереди»/в туман, выход за край, потеря фокуса по умолчанию.
    expect(m.focus).toBe('yard-04');
    expect(nextFocus(m, 'yard-02', 'right')).toBe('yard-03');
    expect(nextFocus(m, 'yard-04', 'right')).toBeNull();
    expect(nextFocus(m, 'yard-01', 'left')).toBeNull();
    expect(nextFocus(m, 'flag:9', 'left')).toBe('yard-04');
  });

  it('ворота входят в круг стрелок, только когда не в тумане; все пройдены — фокус на ворота', () => {
    // Ловит: ворота в тумане фокусируются; после 32 фокус остаётся на несуществующем c.
    const all = buildMapModel(mapInput(yardIds(Array.from({ length: 32 }, (_, i) => i + 1))));
    expect(all.focus).toBe('gate');
    expect(nextFocus(all, 'yard-32', 'right')).toBe('gate');
    expect(nextFocus(all, 'gate', 'left')).toBe('yard-32');
  });

  it('Tab: точки → ближайший флажок → флажки → здания → шапка; Shift+Tab обратно', () => {
    // Ловит: порядок групп Tab, потерю ближайшего флажка, зацикливание на краях.
    const seen: string[] = [m.focus];
    for (let cur: string | null = m.focus; (cur = nextFocus(m, cur, 'tab')); ) seen.push(cur);
    expect(seen).toEqual(['yard-04', 'flag:9', 'flag:14', 'flag:18', 'flag:21', 'flag:24', 'flag:28', 'flag:32',
      'building:stadium', 'building:school', 'building:base', 'building:museum', 'header']);
    expect(nextFocus(m, 'header', 'shiftTab')).toBe('building:museum');
    expect(nextFocus(m, 'yard-02', 'tab')).toBe('flag:9');
    expect(nextFocus(m, 'yard-04', 'shiftTab')).toBeNull();
  });
});

describe('охрана входа (019-Т11): needsClub и playable', () => {
  const deps = (over: Partial<EntryDeps> = {}): EntryDeps => ({ hasClub: true, dev: false, playable: (id) => id === 'yard-01', ...over });
  const to = (path: string, query: Record<string, unknown> = {}, free = false): EntryTarget => ({ path, query, free });

  it('без клуба любой адрес игры ведёт на /start; /start, родитель и «Кто играет?» открыты', () => {
    // Ловит: адрес игры мимо клуба (v1-экраны, карта, «Путь клуба», матч) и петлю /start → /start.
    const none = deps({ hasClub: false });
    for (const p of [MAP_PATH, PATH_PATH, '/club', '/match', '/locker', '/stats', MATCH_PATH]) {
      expect(entryRedirect(to(p, { lesson: 'yard-01' }), none), p).toBe(START_PATH);
    }
    for (const p of [START_PATH, '/parent', '/players']) expect(entryRedirect(to(p), none), p).toBe(true);
    expect(entryRedirect(to('/dev/frames', {}, true), none)).toBe(true);
  });

  it('с клубом адреса игры открыты (в том числе при несвязанном query)', () => {
    // Ловит: лишний редирект игрока с клубом.
    for (const p of [MAP_PATH, PATH_PATH, '/club', '/locker']) expect(entryRedirect(to(p), deps()), p).toBe(true);
  });

  it('урок «впереди», неизвестный урок и адрес матча без урока ведут на карту; открытый урок пускает', () => {
    // Ловит: матч урока, который ещё не открыт, адресом; падение на пустом и массивном lesson.
    expect(entryRedirect(to(MATCH_PATH, { lesson: 'yard-01' }), deps())).toBe(true);
    expect(entryRedirect(to(MATCH_PATH, { lesson: 'yard-30' }), deps())).toBe(MAP_PATH);
    expect(entryRedirect(to(MATCH_PATH, { lesson: 'nope' }), deps())).toBe(MAP_PATH);
    expect(entryRedirect(to(MATCH_PATH), deps())).toBe(MAP_PATH);
    expect(entryRedirect(to(MATCH_PATH, { lesson: ['yard-01', 'yard-30'] }), deps())).toBe(true);
    expect(entryRedirect(to(MATCH_PATH, { lesson: ['yard-30'] }), deps())).toBe(MAP_PATH);
  });

  it('витрина #/match2?at=win&lesson=yard-05 на чистом профиле: в dev — витрина, в выпуске — /start', () => {
    // Ловит: витрина, не пускающая на чистом профиле (кадры), и витрина-обход охраны в выпуске.
    const q = { at: 'win', lesson: 'yard-05' };
    const clean = { hasClub: false, playable: () => false };
    expect(entryRedirect(to(MATCH_PATH, q), deps({ ...clean, dev: true }))).toBe(true);
    expect(entryRedirect(to(MATCH_PATH, q), deps({ ...clean, dev: false }))).toBe(START_PATH);
    // С клубом, но урок «впереди»: витрина тоже открыта в dev, в выпуске — на карту.
    expect(entryRedirect(to(MATCH_PATH, q), deps({ hasClub: true, playable: () => false, dev: true }))).toBe(true);
    expect(entryRedirect(to(MATCH_PATH, q), deps({ hasClub: true, playable: () => false, dev: false }))).toBe(MAP_PATH);
    // Одно правило «есть `at`»: незнакомая фаза и массив — тоже витрина (в dev), в выпуске — не обход охраны.
    for (const at of ['zzz', ['win'], '']) {
      expect(entryRedirect(to(MATCH_PATH, { at, lesson: 'yard-05' }), deps({ ...clean, dev: true })), String(at)).toBe(true);
      expect(entryRedirect(to(MATCH_PATH, { at, lesson: 'yard-05' }), deps({ hasClub: true, playable: () => false, dev: false })), String(at)).toBe(MAP_PATH);
    }
    // Выпуск, урок открыт: адрес с `at` всё равно на карту (ревью 017-Т8д, 019-Р33).
    expect(entryRedirect(to(MATCH_PATH, q), deps({ hasClub: true, playable: () => true, dev: false }))).toBe(MAP_PATH);
    // Витрина — только у матча: `at` в чужом адресе ничего не открывает.
    expect(entryRedirect(to('/club', { at: 'win' }), deps({ ...clean, dev: true }))).toBe(START_PATH);
  });
});
