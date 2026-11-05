/**
 * Кубок лиги по ходу лиги (спека 002) и план открытий: вехи раундов, когда раунд открыт, соперники,
 * проход дальше, трофей и пак за финал, повтор кубка без второго трофея, старые записи,
 * «Скоро» и «что открылось». Чистые функции движка (engine/cup, engine/unlocks).
 */
import { describe, expect, it } from 'vitest';
import bootsJson from '../src/content/boots.json';
import clubsJson from '../src/content/clubs.json';
import lessonsJson from '../src/content/lessons.json';
import unlocksJson from '../src/content/unlocks.json';
import { ownedBoots, parseBoots } from '../src/engine/boots';
import { parseClubData } from '../src/engine/club';
import {
  CUP_STAGES,
  LEAGUES,
  applyCupMatch,
  cupAdvances,
  cupMilestones,
  cupRival,
  cupState,
  cupVisible,
  homeCup,
  openCupOnPass,
  playStage,
  restartCup,
  roundOpen,
  trophies,
  visibleCups,
  type CupStage,
  type League,
} from '../src/engine/cup';
import { addAttack, emptyScore, leagueRules } from '../src/engine/match';
import { applySetLesson, emptySave, parseSave, type SaveData } from '../src/engine/save';
import {
  featureOpen,
  milestoneOf,
  newlyOpened,
  openUnlocks,
  parseUnlocks,
  unlocksOf,
  upcoming,
} from '../src/engine/unlocks';

// Маленькая программа: двор — 6 уроков (0–5), район — 5 (6–10), город — 4 (11–14).
const lessons = [
  ...['y1', 'y2', 'y3', 'y4', 'y5', 'y6'].map((id) => ({ id, league: 'yard' })),
  ...['d1', 'd2', 'd3', 'd4', 'd5'].map((id) => ({ id, league: 'district' })),
  ...['c1', 'c2', 'c3', 'c4'].map((id) => ({ id, league: 'city' })),
];

// Вехи: двор — уроки 1, 3, 4, 5; район — 6, 8, 9, 10; город — 11–14. Возможность — после y2, вместе с 1/8 двора.
const rawPlan = {
  about: 'пропускается',
  cup: { yard: ['y2', 'y4', 'y5', 'y6'], district: ['d1', 'd3', 'd4', 'd5'], city: ['c1', 'c2', 'c3', 'c4'] },
  features: [{ id: 'midPenalty', after: 'y2' }],
};
const plan = parseUnlocks(rawPlan, lessons);

const at = (lessonIndex: number, cups: SaveData['cups'] = {}): SaveData => ({ ...emptySave(), lessonIndex, cups });

/** Матч кубка в маленькой программе. */
const play = (s: SaveData, league: League, stage: CupStage, advanced: boolean) =>
  applyCupMatch(s, lessons, plan, league, stage, advanced);

/** Счёт из ошибок по атакам: 0 — гол, 1–2 — сейв, 3+ — пропустили. */
const score = (...errors: number[]) => errors.reduce(addAttack, emptyScore);

describe('план открытий: разбор', () => {
  it('настоящий unlocks.json проходит разбор: вехи — уроки закрепления и последний урок лиги', () => {
    const real = lessonsJson.lessons;
    const realPlan = parseUnlocks(unlocksJson, real);
    const ids = (league: League) => cupMilestones(realPlan, real, league).map((i) => real[i]?.id);
    expect(ids('yard')).toEqual(['yard-4', 'yard-8', 'yard-10', 'yard-12']);
    expect(ids('district')).toEqual(['district-3', 'district-6', 'district-9', 'district-12']);
    expect(ids('city')).toEqual(['city-3', 'city-words-b', 'city-7', 'city-10']);
    expect(realPlan.features).toEqual([{ id: 'midPenalty', after: 'yard-2' }]);
  });

  it('пенальти по ходу матча (005): до урока 3 закрыто, с урока 3 — открыто, и в переигровках ранних уроков', () => {
    const real = lessonsJson.lessons;
    const realPlan = parseUnlocks(unlocksJson, real);
    const open = (lessonIndex: number) => featureOpen(at(lessonIndex), real, realPlan, 'midPenalty');
    expect([0, 1].map(open)).toEqual([false, false]);
    // Урок 3 и дальше: открыто по ходу игрока — матч урока 1 на уроке 9 тоже с пенальти.
    expect([2, 3, 8, real.length - 1].map(open)).toEqual([true, true, true, true]);
    expect(milestoneOf('yard-2', real, realPlan)).toEqual(['feature:midPenalty']);
    expect(newlyOpened(at(1), at(2), real, realPlan)).toEqual(['feature:midPenalty']);
    // Родитель вернул урок назад — снова закрыто: открытие идёт за уроком игрока.
    expect(featureOpen(applySetLesson(at(5), 1, real.map((l) => l.id)), real, realPlan, 'midPenalty')).toBe(false);
  });

  it('вехи — номера уроков; about и лишние поля пропускаются', () => {
    expect(cupMilestones(plan, lessons, 'yard')).toEqual([1, 3, 4, 5]);
    expect(cupMilestones(plan, lessons, 'city')).toEqual([11, 12, 13, 14]);
    expect(parseUnlocks({ ...rawPlan, extra: 1, cup: { ...rawPlan.cup, moon: [] } }, lessons)).toEqual(plan);
    expect(parseUnlocks({ cup: rawPlan.cup }, lessons).features).toEqual([]);
  });

  it('битый план — ошибка', () => {
    const cup = rawPlan.cup;
    const bad: unknown[] = [
      null,
      [],
      { features: [] },
      { cup: { ...cup, yard: ['y2', 'y4', 'y6'] } }, // три вехи
      { cup: { ...cup, yard: ['y1', 'y2', 'y4', 'y5', 'y6'] } }, // пять
      { cup: { district: cup.district, city: cup.city } }, // лиги нет
      { cup: { ...cup, yard: ['y2', 'y4', 'nope', 'y6'] } }, // урока нет
      { cup: { ...cup, yard: ['y2', 'y4', 7, 'y6'] } }, // не id
      { cup: { ...cup, yard: ['y2', 'd1', 'y5', 'y6'] } }, // урок чужой лиги
      { cup: { ...cup, yard: ['y4', 'y2', 'y5', 'y6'] } }, // не по порядку
      { cup: { ...cup, yard: ['y2', 'y4', 'y4', 'y6'] } }, // повтор
      { cup: { ...cup, yard: ['y1', 'y2', 'y4', 'y5'] } }, // финал — не последний урок лиги
      { cup, features: {} },
      { cup, features: [{ id: 'mid-penalty', after: 'y2' }] },
      { cup, features: [{ id: 'midPenalty', after: 'nope' }] },
      { cup, features: [{ id: 'midPenalty', after: 'y2' }, { id: 'midPenalty', after: 'y3' }] },
    ];
    for (const raw of bad) expect(() => parseUnlocks(raw, lessons), JSON.stringify(raw)).toThrow();
  });

  it('открытия по возрастанию урока; при равных — кубок раньше возможности', () => {
    const list = unlocksOf(plan, lessons);
    expect(list.slice(0, 3)).toEqual([
      { id: 'cup:yard:0', at: 1 },
      { id: 'feature:midPenalty', at: 1 },
      { id: 'cup:yard:1', at: 3 },
    ]);
    expect(list).toHaveLength(13);
    expect(list.at(-1)).toEqual({ id: 'cup:city:3', at: 14 });
  });
});

describe('кубок лиги: открытие и раунды', () => {
  it('раунд открыт, когда игрок ушёл дальше урока-вехи', () => {
    const open = (s: SaveData, league: League) => CUP_STAGES.filter((st) => roundOpen(s, lessons, plan, league, st));
    expect(open(at(1), 'yard')).toEqual([]);
    expect(open(at(2), 'yard')).toEqual([0]);
    expect(open(at(4), 'yard')).toEqual([0, 1]);
    expect(open(at(6), 'yard')).toEqual([0, 1, 2, 3]);
    expect(open(at(6), 'district')).toEqual([]);
  });

  it('финал последнего урока курса — по finalOpen; другие раунды finalOpen не открывает', () => {
    expect(roundOpen(at(14), lessons, plan, 'city', 3)).toBe(false);
    const s = at(14, { city: { stage: 0, won: false, finalOpen: true } });
    expect(roundOpen(s, lessons, plan, 'city', 3)).toBe(true);
    const early = at(0, { yard: { stage: 0, won: false, finalOpen: true } });
    expect(CUP_STAGES.filter((st) => roundOpen(early, lessons, plan, 'yard', st))).toEqual([3]);
  });

  it('кубок виден, когда открыт 1/8 или кубок записан', () => {
    expect(cupVisible(at(1), lessons, plan, 'yard')).toBe(false);
    expect(cupVisible(at(2), lessons, plan, 'yard')).toBe(true);
    expect(cupVisible(at(0, { yard: { stage: 0, won: false } }), lessons, plan, 'yard')).toBe(true);
    expect(visibleCups(at(5), lessons, plan)).toEqual(['yard']);
    expect(visibleCups(at(7), lessons, plan)).toEqual(['yard', 'district']);
  });

  it('зачёт последнего урока курса открывает финал его лиги (finalOpen), запись цела', () => {
    const s = openCupOnPass(at(14), lessons, plan, 'c4', 2);
    expect(s.cups).toEqual({ city: { stage: 0, won: false, finalOpen: true } });
    const going = openCupOnPass(at(14, { city: { stage: 2, won: true } }), lessons, plan, 'c4', 3);
    expect(going.cups.city).toEqual({ stage: 2, won: true, finalOpen: true });
    // Одна звезда, не последний урок курса (y6 — финал двора, но урок сдвигается), уже открыто — без перемен.
    expect(openCupOnPass(at(14), lessons, plan, 'c4', 1)).toEqual(at(14));
    expect(openCupOnPass(at(5), lessons, plan, 'y6', 3)).toEqual(at(5));
    expect(openCupOnPass(s, lessons, plan, 'c4', 3)).toBe(s);
  });

  it('кнопка на главной — самый ранний недоигранный видимый кубок; все доиграны — старший', () => {
    const home = (s: SaveData) => homeCup(s, lessons, plan);
    expect(home(at(1))).toBeNull();
    expect(home(at(2))).toBe('yard');
    // Двор не доигран (запись есть или нет), а игрок уже в районе — кнопка ведёт во двор.
    expect(home(at(7))).toBe('yard');
    expect(home(at(7, { yard: { stage: 3, won: false } }))).toBe('yard');
    // Двор доигран (трофей, в том числе после «Сыграть снова») — к районному.
    expect(home(at(7, { yard: { stage: 4, won: true } }))).toBe('district');
    expect(home(at(7, { yard: { stage: 0, won: true } }))).toBe('district');
    // Все видимые доиграны — старший.
    const done = { yard: { stage: 4, won: true }, district: { stage: 4, won: true } } as const;
    expect(home(at(10, done))).toBe('district');
  });

  it('«Поставить урок» назад: раунды закрыты, кубок виден, запись и трофей целы', () => {
    const s = at(7, { yard: { stage: 2, won: true } });
    const back = applySetLesson(s, 0, lessons.map((l) => l.id));
    expect(CUP_STAGES.filter((st) => roundOpen(back, lessons, plan, 'yard', st))).toEqual([]);
    expect(cupVisible(back, lessons, plan, 'yard')).toBe(true);
    expect([back.cups, trophies(back)]).toEqual([s.cups, ['yard']]);
    expect(play(back, 'yard', 2, true)).toBe(back);
  });

  it('соперник раунда постоянный, имена разные; у 1/4, 1/2 и финала — прежние, до 002', () => {
    const data = parseClubData(clubsJson);
    const own = { name: 'Полёт', kit: data.palettes[0] ?? { pattern: 'plain', body: '#000000', sleeves: '#000000', trim: '#000000' } };
    // Соперники трёх раундов прежней сетки (1/4, 1/2, финал) — сняты с кода до спеки 002.
    const before: Record<League, [string[], string[]]> = {
      yard: [['Импульс, Пермь', 'Полёт, Пенза', 'Авиатор, Мурманск'], ['Импульс, Пермь', 'Прибой, Ижевск', 'Авиатор, Мурманск']],
      // Финал района: город сменён 05.11 — два «Магадана» в одной сетке (находка тестировщика).
      district: [['Труд, Сургут', 'Пересвет, Магадан', 'Авангард, Абакан'], ['Труд, Сургут', 'Пересвет, Магадан', 'Авангард, Абакан']],
      city: [['Восток, Иркутск', 'Полёт, Пенза', 'Фрегат, Чита'], ['Восток, Иркутск', 'Фрегат, Пенза', 'Экспресс, Чита']],
    };
    for (const [k, club] of [null, own].entries()) {
      for (const league of LEAGUES) {
        const rounds = CUP_STAGES.map((st) => cupRival(data, club, league, st));
        expect(rounds).toEqual(CUP_STAGES.map((st) => cupRival(data, club, league, st)));
        expect(rounds.slice(1).map((r) => `${r.name}, ${r.city}`)).toEqual(before[league][k]);
        expect(new Set(rounds.map((r) => r.name)).size).toBe(4);
        expect(new Set(rounds.map((r) => r.city)).size).toBe(4);
        if (club) expect(rounds.map((r) => r.name)).not.toContain(club.name);
      }
    }
  });
});

describe('кубок лиги: итог матча', () => {
  it('победа по счёту — дальше; ничья — по решающей атаке; поражение — нет', () => {
    const yard = leagueRules('yard');
    expect(cupAdvances(score(0, 3), 5, yard)).toBe(false);
    expect(cupAdvances(score(0, 0, 3), 5, yard)).toBe(true);
    expect(cupAdvances(score(0, 3), 2, yard)).toBe(true);
    expect(cupAdvances(score(1, 1), 0, yard)).toBe(true);
    expect(cupAdvances(score(0, 3, 3), 0, yard)).toBe(false);
  });

  it('ничья в кубке района — по серии: 3 ошибки на обе атаки — дальше, 4 — нет; во дворе 3 — нет (спека 008)', () => {
    const draw = score(0, 3);
    expect(cupAdvances(draw, 3, leagueRules('district'))).toBe(true);
    expect(cupAdvances(draw, 3, leagueRules('yard'))).toBe(false);
    expect(cupAdvances(draw, 4, leagueRules('district'))).toBe(false);
    expect(cupAdvances(draw, 3, leagueRules('city'))).toBe(true);
  });

  it('урок каждой вехи кубка — из лиги кубка: правило решающей берётся от урока и не расходится с кубком', () => {
    const real = lessonsJson.lessons;
    const realPlan = parseUnlocks(unlocksJson, real);
    for (const league of LEAGUES) {
      const own = cupMilestones(realPlan, real, league).map((i) => real[i]?.league);
      expect(own, league).toEqual([league, league, league, league]);
    }
  });

  it('проход: 1/8 → 1/4 → 1/2 → финал; поражение — тот же раунд', () => {
    let s = at(6);
    s = play(s, 'yard', 0, false);
    expect(cupState(s, 'yard')).toEqual({ stage: 0, won: false });
    s = play(s, 'yard', 0, true);
    expect(cupState(s, 'yard')).toEqual({ stage: 1, won: false });
    s = play(s, 'yard', 1, true);
    s = play(s, 'yard', 2, true);
    expect(cupState(s, 'yard')).toEqual({ stage: 3, won: false });
    expect([s.pendingPacks, s.lessonIndex]).toEqual([0, 6]);
  });

  it('финал впервые — трофей и бесплатный пак; урок не сдвигается; finalOpen остаётся', () => {
    const s = play(at(6, { yard: { stage: 3, won: false } }), 'yard', 3, true);
    expect(cupState(s, 'yard')).toEqual({ stage: 4, won: true });
    expect([s.pendingPacks, s.lessonIndex]).toEqual([1, 6]);
    expect(trophies(s)).toEqual(['yard']);
    const city = play(at(14, { city: { stage: 3, won: false, finalOpen: true } }), 'city', 3, true);
    expect(cupState(city, 'city')).toEqual({ stage: 4, won: true, finalOpen: true });
  });

  it('закрытый раунд (адрес из закладок) — без перемен, и победа, и поражение', () => {
    const s = at(4, { yard: { stage: 2, won: false } });
    expect(play(s, 'yard', 2, true)).toBe(s);
    expect(play(s, 'yard', 2, false)).toBe(s);
    expect(play(at(1), 'yard', 0, true)).toEqual(at(1));
  });

  it('раунд не тот, с которым начинался матч (двойная запись) — без перемен', () => {
    const s = at(6, { yard: { stage: 1, won: false } });
    expect(play(s, 'yard', 0, true)).toBe(s);
    expect(play(s, 'yard', 2, true)).toBe(s);
    const done = play(at(6, { yard: { stage: 3, won: false } }), 'yard', 3, true);
    expect(play(done, 'yard', 3, true)).toBe(done);
  });

  it('кубок снова: с 1/8, трофей и finalOpen остаются, второго трофея и пака нет', () => {
    const done = at(6, { yard: { stage: 4, won: true } });
    expect(playStage(cupState(done, 'yard'))).toBe(0);
    const again = restartCup(done, 'yard');
    expect(cupState(again, 'yard')).toEqual({ stage: 0, won: true });
    expect(restartCup(again, 'yard')).toBe(again);
    let s = again;
    for (const stage of CUP_STAGES) s = play(s, 'yard', stage, true);
    expect(cupState(s, 'yard')).toEqual({ stage: 4, won: true });
    expect([s.pendingPacks, trophies(s)]).toEqual([0, ['yard']]);
    // Без «Сыграть снова» матч 1/8 тоже идёт с начала; поражение снимает отметку «пройден».
    expect(cupState(play(done, 'yard', 0, false), 'yard')).toEqual({ stage: 0, won: true });
    const city = restartCup(at(14, { city: { stage: 4, won: true, finalOpen: true } }), 'city');
    expect(cupState(city, 'city')).toEqual({ stage: 0, won: true, finalOpen: true });
  });

  const goalsSave = { ...emptySave(), goals: 7 };

  // Разбор поля кубков (перенесено из tests/save.test.ts: тот файл у предела 600 строк).
  it('кубки: битая запись — кубок с начала, чужая лига и мусор — выбрасываются', () => {
    for (const bad of ['да', 7, [], null]) {
      const s = parseSave({ ...goalsSave, cups: bad });
      expect(s.cups).toEqual({});
      expect(s.goals).toBe(goalsSave.goals);
    }
    const cups = {
      yard: { stage: 7, won: 'да' },
      city: null,
      district: { stage: 4, won: true, finalOpen: 'да' },
      moon: { stage: 1 },
    };
    expect(parseSave({ ...goalsSave, cups }).cups).toEqual({
      yard: { stage: 0, won: false },
      city: { stage: 0, won: false },
      district: { stage: 4, won: true },
    });
  });

  it('старая запись (round, до 002): раунд + 1 и finalOpen; пишется только stage; версия 1', () => {
    const old = {
      yard: { round: 0 },
      district: { round: 2 },
      city: { round: 3, won: true },
    };
    const s = parseSave({ ...goalsSave, cups: old });
    expect(s.version).toBe(1);
    expect(s.cups).toEqual({
      yard: { stage: 1, won: false, finalOpen: true },
      district: { stage: 3, won: false, finalOpen: true },
      city: { stage: 4, won: true, finalOpen: true },
    });
    // Кубок разыгран снова, битый раунд, оба поля (новое главнее).
    const more = { yard: { round: 0, won: true }, district: { round: 7 }, city: { stage: 2, round: 0 } };
    expect(parseSave({ ...goalsSave, cups: more }).cups).toEqual({
      yard: { stage: 1, won: true, finalOpen: true },
      district: { stage: 0, won: false },
      city: { stage: 2, won: false },
    });
    expect(JSON.stringify(s)).not.toContain('round');
    // Трофей и кубковые бутсы — целы.
    const boots = parseBoots(bootsJson);
    expect(trophies(s)).toEqual(['city']);
    expect(ownedBoots(s, boots)).toContain('cup-city');
  });

  it('кубок переживает сохранение и разбор', () => {
    const s = play(at(14, { city: { stage: 3, won: false, finalOpen: true } }), 'city', 3, true);
    expect(parseSave(JSON.parse(JSON.stringify(s))).cups).toEqual(s.cups);
  });
});

describe('открытия: «Скоро» и что открылось', () => {
  it('upcoming — ближайшее неоткрытое и сколько уроков осталось; всё открыто — null', () => {
    expect(upcoming(at(0), lessons, plan)).toEqual({ id: 'cup:yard:0', lesson: 2, left: 2 });
    expect(upcoming(at(1), lessons, plan)).toEqual({ id: 'cup:yard:0', lesson: 2, left: 1 }); // «пройди этот урок»
    expect(upcoming(at(2), lessons, plan)).toEqual({ id: 'cup:yard:1', lesson: 4, left: 2 });
    expect(upcoming(at(14), lessons, plan)).toEqual({ id: 'cup:city:3', lesson: 15, left: 1 });
    expect(upcoming(at(14, { city: { stage: 0, won: false, finalOpen: true } }), lessons, plan)).toBeNull();
  });

  it('«Поставить урок» назад: раунды, пройденные по записи, «Скоро» пропускает', () => {
    // 1/8 двора пройден (запись stage 1), урок поставлен на 0 — зовём к 1/4, а не к 1/8.
    expect(upcoming(at(0, { yard: { stage: 1, won: false } }), lessons, plan)).toEqual({ id: 'feature:midPenalty', lesson: 2, left: 2 });
    expect(upcoming(at(2, { yard: { stage: 2, won: false } }), lessons, plan)).toEqual({ id: 'cup:yard:2', lesson: 5, left: 3 });
    // Кубок двора доигран (и после «Сыграть снова») — его раунды не зовут, следующий — 1/8 района.
    expect(upcoming(at(2, { yard: { stage: 0, won: true } }), lessons, plan)).toEqual({ id: 'cup:district:0', lesson: 7, left: 5 });
    // Запись без прохода (stage 0) — 1/8 по-прежнему впереди.
    expect(upcoming(at(0, { yard: { stage: 0, won: false } }), lessons, plan)).toEqual({ id: 'cup:yard:0', lesson: 2, left: 2 });
  });

  it('настоящий план: на уроке 2 — пенальти после урока 2; на уроке 3 — «1/8 финала — после урока 4, ещё 2 урока»', () => {
    const real = lessonsJson.lessons;
    const realPlan = parseUnlocks(unlocksJson, real);
    // Пенальти по ходу матча (005) открывается раньше кубка — «Скоро» на уроках 1–2 о нём.
    expect(upcoming(at(0), real, realPlan)).toEqual({ id: 'feature:midPenalty', lesson: 2, left: 2 });
    expect(upcoming(at(1), real, realPlan)).toEqual({ id: 'feature:midPenalty', lesson: 2, left: 1 });
    expect(upcoming(at(2), real, realPlan)).toEqual({ id: 'cup:yard:0', lesson: 4, left: 2 });
    expect(upcoming(at(4), real, realPlan)).toEqual({ id: 'cup:yard:1', lesson: 8, left: 4 });
  });

  it('newlyOpened: веха — новое; повтор вехи — ничего; последний урок курса — финал', () => {
    expect(newlyOpened(at(1), at(2), lessons, plan)).toEqual(['cup:yard:0', 'feature:midPenalty']);
    expect(newlyOpened(at(2), at(2), lessons, plan)).toEqual([]);
    expect(newlyOpened(at(2), at(3), lessons, plan)).toEqual([]);
    const final = openCupOnPass(at(14), lessons, plan, 'c4', 2);
    expect(newlyOpened(at(14), final, lessons, plan)).toEqual(['cup:city:3']);
  });

  it('открытое сейчас, возможности — по ходу игрока; что открывает урок', () => {
    expect(openUnlocks(at(1), lessons, plan)).toEqual([]);
    expect(openUnlocks(at(4), lessons, plan)).toEqual(['cup:yard:0', 'feature:midPenalty', 'cup:yard:1']);
    expect(featureOpen(at(1), lessons, plan, 'midPenalty')).toBe(false);
    expect(featureOpen(at(2), lessons, plan, 'midPenalty')).toBe(true);
    expect(featureOpen(at(9), lessons, plan, 'nope')).toBe(false);
    expect(milestoneOf('y2', lessons, plan)).toEqual(['cup:yard:0', 'feature:midPenalty']);
    expect(milestoneOf('y1', lessons, plan)).toEqual([]);
    expect(milestoneOf('c4', lessons, plan)).toEqual(['cup:city:3']);
    expect(milestoneOf('nope', lessons, plan)).toEqual([]);
  });
});
