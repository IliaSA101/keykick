/**
 * Матч v2 (спека 017, Т5а): связка машины с видом и памятью на уровне `app/match`, без DOM.
 * Прыжки `jump.ts` ведут настоящий поток настоящими текстами урока, поэтому заодно ловят разрыв между
 * машиной (Т4) и генератором курса (016): не та сигнатура текстов, пустая строка, пропущенная фаза.
 */
import { describe, expect, it } from 'vitest';
import { kickTaskOf, matchCtx, matchSides, resultExtras, rivalSeed, tipFor, yardSides, type CtxInput } from '../src/app/match/context';
import { createMatchFlow } from '../src/app/match/flow';
import { JUMPS, drive, jumpFlow, jumpQuery, jumpWith } from '../src/app/match/jump';
import { DAY_MS } from '../src/engine/matchResult/played';
import { courseTexts, lessonById, matchRival, matchRules, yardStreets } from '../src/app/match/load';
import { resultModel } from '../src/engine/matchResult/resultModel';
import { starCap } from '../src/engine/match/verdict';
import { hasAt } from '../src/app/match/showcase';
import { memoryMatchStore } from '../src/app/match/store';
import { tallyStore, type TalliedStore } from '../src/app/match/tally';
import { clubData, kits } from '../src/app/kits';
import { tasks } from '../src/app/tasks';
import { formGrowth } from '../src/engine/matchResult/form';
import { reactive } from 'vue';
import { ru } from '../src/i18n/ru';
import { section as courseSection } from '../src/engine/course/save';
import { courseLessons } from '../src/app/course/load';
import { createSaveMatchStore } from '../src/app/match/saveStore';
import { section as matchSection } from '../src/engine/match/save';
import { twoTabs } from './saveFixtures';
import { ctx as saveCtx } from './saveStoreHelpers';
import { nextTabIndex } from '../src/components/focusTrap';

const lesson = courseLessons.find((l) => l.league === 'yard' && !l.friendly)!;

const phaseAt = (at: (typeof JUMPS)[number]): string => jumpFlow(at, lesson, false).view.value.phase;

describe('быстрые проверки матча v2 (design §14)', () => {
  it('витрина — любой `at` в адресе, в том числе незнакомый и массивом', () => {
    // Ловит: расхождение страницы (знакомые `at`), каркаса и охраны входа — незнакомый `at` писал бы в сохранение.
    expect(hasAt({ at: 'win' })).toBe(true);
    expect(hasAt({ at: 'zzz' })).toBe(true);
    expect(hasAt({ at: ['win', 'loss'] })).toBe(true);
    expect(hasAt({ lesson: 'yard-01' })).toBe(false);
    expect(hasAt({})).toBe(false);
  });

  it('каждый прыжок приводит в свою фазу', () => {
    // Ловит: прыжок, который проскакивает фазу или застревает (драйвер печати не совпал с машиной).
    expect(Object.fromEntries(JUMPS.map((at) => [at, phaseAt(at)]))).toEqual({
      warmup: 'warmup', half1: 'half1', kick: 'kick', decisive: 'half2', break: 'break', extra: 'extra',
      coach: 'coach', stuck3: 'result', stuck5: 'result', reserve: 'half1', win: 'result', loss: 'result', draw: 'result',
      comeback: 'intro', resume: 'break',
    });
  });

  it('содержимое фаз: решающая, возврат, «Продолжить 2-й тайм», предложения застрявшему', () => {
    // Ловит: потерянную подсветку решающей, баннер возврата не по 5 дням, потерю ожидающего 2-го тайма и «Застрял» не по fails. Прыжок «ничья» с неровным счётом (4:5).
    const view = (at: (typeof JUMPS)[number]) => jumpFlow(at, lesson, false).view.value;
    expect(view('decisive')).toMatchObject({ decisive: true, attack: lesson.attacks.length });
    expect(jumpFlow('comeback', lesson, false).comeback).toBe(true);
    expect(jumpFlow('warmup', lesson, false).comeback).toBe(false);
    expect(view('resume')).toMatchObject({ banner: 'continue2', half: 2, firstScore: { typed: lesson.attacks.length, conceded: 0 } });
    // «Тайм с запасом»: метка помощи есть только при выбранной помощи и мячах запаса (её видит e2e match-height).
    expect(view('reserve')).toMatchObject({ help: 'reserve', phase: 'half1' });
    expect(view('reserve').reserve).not.toBeNull();
    expect(view('win')).toMatchObject({ result: { outcome: 'win', offer: null } });
    expect(view('loss').offer?.options).toEqual(['replay']);
    expect(view('draw').offer?.options).toEqual(['replay2']);
    // Прыжок «ничья» — ровный счёт (017-Р33; раньше после доп. времени было 4:5).
    const level = view('draw').score;
    expect(level.typed + level.kick).toBe(level.conceded);
    expect(view('stuck3').offer?.options).toEqual(['reserve', 'again', 'quit']);
    expect(view('stuck5').offer?.options).toEqual(['coach', 'reserve', 'quit']);
    expect(view('coach').coach?.keys.length).toBeGreaterThan(0);
  });

  it('адрес: знакомая фаза и урок разбираются, незнакомая — обычный матч', () => {
    // Ловит: прыжок по опечатке в адресе вместо вступления.
    expect(jumpQuery({ at: 'win', lesson: 'yard-03' })).toEqual({ at: 'win', lessonId: 'yard-03' });
    expect(jumpQuery({ at: 'win' })).toEqual({ at: 'win', lessonId: null });
    expect(jumpQuery({ at: 'nope' })).toBeNull();
    expect(jumpQuery({})).toBeNull();
    expect(lessonById(lesson.id)).toBe(lesson);
  });
});

describe('поток и память (design §10)', () => {
  const newFlow = (store = memoryMatchStore(matchRules)) => {
    let t = 1_000_000;
    return { store, flow: createMatchFlow({ lesson, store, live: false, clock: () => (t += 100), seed: () => 11 }) };
  };

  it('зерно и часы снаружи: тексты одного зерна одинаковы, 2-й тайм не повторяет 1-й', () => {
    // Ловит: случайность внутри обёрток текстов (нельзя повторить урок) и повтор строк 1-го тайма во 2-м.
    const x = courseTexts(lesson);
    expect(x.half(5, false)).toEqual(x.half(5, false));
    expect(x.half(5, true)).not.toEqual(x.half(5, false));
    expect(x.coachLine('фы', 3)).toEqual(x.coachLine('фы', 3));
  });

  it('брошенный матч: экран закрыт посреди — запись «брошен», ничего не теряется из сделанного', () => {
    // Ловит: матч, который остаётся «открытым» навсегда после ухода с экрана, и потерю монет блока.
    const { store, flow } = newFlow();
    flow.start();
    const w = flow.state().warm[0]![0]!;
    for (const ch of w) flow.press({ code: '', key: ch, repeat: false, mod: false, caps: false, time: 0 });
    flow.dispose();
    const d = store.read();
    expect(d.log).toHaveLength(1);
    expect(d.log[0]).toMatchObject({ lessonId: lesson.id, outcome: 'abandoned' });
    expect(flow.view.value.phase).toBe('quit');
  });

  it('пауза глушит нажатия; нажатия идут с часов потока', () => {
    // Ловит: печать на паузе и время нажатия не из часов потока.
    const { flow } = newFlow();
    flow.start();
    const before = flow.view.value.cursor;
    flow.pause();
    expect(flow.view.value).toMatchObject({ paused: true, beforeUnload: false });
    const ch = flow.state().typing!.text[0]!;
    flow.press({ code: '', key: ch, repeat: false, mod: false, caps: false, time: 5 });
    expect(flow.view.value.cursor).toBe(before);
    flow.resume();
    flow.press({ code: '', key: ch, repeat: false, mod: false, caps: false, time: 5 });
    expect(flow.state().now).toBeGreaterThan(1_000_000);
  });

  it('память: перерыв пишет ожидающий 2-й тайм, итог — звёзды, fails, монеты, журнал, доигранный матч', () => {
    // Ловит: потерю ожидающего 2-го тайма на перерыве, пропажу провала, монет и закрытия журнала на итоге.
    const br = jumpWith('break', lesson, false);
    expect(br.store.read().pending).toMatchObject({ lessonId: lesson.id, started: false, reason: 'break' });
    br.flow.toSecondHalf();
    expect(br.store.read().pending?.started).toBe(true);
    const lost = jumpWith('loss', lesson, false);
    const d = lost.store.read();
    expect(d.lessons[lesson.id]).toEqual({ best: 0, fails: 1 });
    // 1-й тайм проигран — переигрывается весь матч, ожидающего 2-го тайма нет; при ничьей (1-й тайм цел) он есть.
    expect(d.pending).toBeNull();
    expect(jumpWith('draw', lesson, false).store.read().pending).toMatchObject({ reason: 'replay', started: false });
    expect(d.wallet.coins).toBeGreaterThan(0);
    expect(d.log).toHaveLength(1);
    expect(d.log[0]).toMatchObject({ outcome: 'loss' });
    expect(d.played.byLeague[lesson.league]).toHaveLength(1);
    const won = jumpWith('win', lesson, false).store.read();
    expect(won.lessons[lesson.id]?.best).toBeGreaterThan(0);
    expect(won.pending).toBeNull();
    expect(won.log[0]).toMatchObject({ outcome: 'win' });
  });

  it('вход после перерыва: «Продолжить 2-й тайм» с новым зерном, счёт 1-го тайма цел', () => {
    // Ловит: вход в урок «заново» вместо продолжения и потерю счёта 1-го тайма.
    const resumed = jumpFlow('resume', lesson, false);
    expect(resumed.view.value.banner).toBe('continue2');
    resumed.toSecondHalf();
    expect(resumed.view.value.phase).toBe('half2');
    expect(resumed.view.value.score.typed).toBe(lesson.attacks.length);
  });
});

describe('смягчение в матче (017-Р55, К5, К7)', () => {
  // Пара подряд идущих уроков с разной длиной атак, оба не товарищеские: смягчение видно по `attacks`.
  const i = courseLessons.findIndex((l, k) => !l.friendly && !courseLessons[k + 1]?.friendly && courseLessons[k + 1]?.attacks.join() !== l.attacks.join());
  const [n, n1] = [courseLessons[i]!, courseLessons[i + 1]!];
  const flowOn = (l: typeof n, store: ReturnType<typeof memoryMatchStore>) => {
    let t = Date.now();
    return createMatchFlow({ lesson: l, store, live: false, clock: () => (t += 100), seed: () => 11 });
  };
  /** Матч от вступления до итога, как играет ребёнок: без ошибок. */
  const playOut = (f: ReturnType<typeof flowOn>): void => {
    f.start();
    drive(f, (s) => s.phase === 'break');
    f.toSecondHalf();
    drive(f, (s) => s.phase === 'result');
  };
  /** Урок `n` пройден «с запасом» в памяти: после третьего провала выбрана помощь. */
  const passedWithHelp = () => {
    const j = jumpWith('reserve', n, false);
    j.flow.start();
    drive(j.flow, (s) => s.phase === 'break');
    j.flow.toSecondHalf();
    drive(j.flow, (s) => s.phase === 'result');
    return j;
  };
  const fiveDays = () => {
    const wall = Date.now();
    return { wall, played: { byLeague: {}, lastFinishedAt: wall - 5 * DAY_MS } };
  };

  it('после прохода с помощью урок N+1 идёт копией: длины N, потолок ★★', () => {
    // Ловит: `soften()` без вызова — смягчение пишется в сохранение, а матч идёт обычным уроком.
    expect(n1.attacks).not.toEqual(n.attacks);
    const { store, flow } = passedWithHelp();
    expect(flow.view.value.result).toMatchObject({ verdict: { passed: true } });
    expect(store.read().softenFrom).toBe(n.id);
    const soft = flowOn(n1, store);
    expect(soft.state().cfg).toMatchObject({ softened: true });
    expect(soft.state().cfg.lesson).toMatchObject({ id: n1.id, attacks: n.attacks, g: Math.max(n1.g, n.g), c: Math.max(n1.c, n.c) });
    playOut(soft);
    expect(soft.view.value.result?.verdict).toMatchObject({ passed: true, stars: 2 });
    // Урок через один (смягчение не на нём) идёт как есть.
    const far = courseLessons[i + 2]!;
    expect(flowOn(far, store).state().cfg).toMatchObject({ softened: false, lesson: far });
    // Контроль: тот же чистый матч без смягчения даёт ★★★ — потолок ★★ настоящий.
    const plain = flowOn(n1, memoryMatchStore(matchRules));
    playOut(plain);
    expect(plain.view.value.result?.verdict.stars).toBe(3);
  });

  it('возврат ≥ 5 × 24 ч — текущий урок смягчён до прохода; 5 × 24 ч − 1 мс — нет', () => {
    // Ловит: возврат, который только показывает баннер, и границу «5 дней» не по часам.
    const { played, wall } = fiveDays();
    const store = memoryMatchStore(matchRules, { played });
    const f = createMatchFlow({ lesson: n1, store, live: false, clock: () => wall, seed: () => 11 });
    expect(f.comeback).toBe(true);
    expect(store.read().softenFrom).toBe(n.id);
    expect(f.state().cfg).toMatchObject({ softened: true });
    expect(f.state().cfg.lesson.attacks).toEqual(n.attacks);
    const short = memoryMatchStore(matchRules, { played: { byLeague: {}, lastFinishedAt: wall - 5 * DAY_MS + 1 } });
    const g = createMatchFlow({ lesson: n1, store: short, live: false, clock: () => wall, seed: () => 11 });
    expect(g.comeback).toBe(false);
    expect(short.read().softenFrom).toBeNull();
    expect(g.state().cfg).toMatchObject({ softened: false, lesson: n1 });
    // Пройденный урок возвратом не смягчается.
    const done = memoryMatchStore(matchRules, { played, lessons: { [n1.id]: { best: 2, fails: 0 } } });
    createMatchFlow({ lesson: n1, store: done, live: false, clock: () => wall, seed: () => 11 });
    expect(done.read().softenFrom).toBeNull();
  });

  it('«Продолжить» с перерыва и товарищеский урок возвратом не смягчаются', () => {
    // Ловит: возврат, что подменяет длины урока посреди начатого матча (1-й тайм сыгран обычным уроком), и смягчение товарищеского.
    const { played, wall } = fiveDays();
    const pending = { lessonId: n1.id, seed: 7, started: false, reason: 'break' as const, first: { correct: 80, errors: 0, ms: 40_000, score: { typed: n1.attacks.length, kick: 0, conceded: 0 } } };
    const resume = memoryMatchStore(matchRules, { played, pending });
    const f = createMatchFlow({ lesson: n1, store: resume, live: false, clock: () => wall, seed: () => 11 });
    expect(f.comeback).toBe(true);
    expect(f.view.value.phase).toBe('break');
    expect(resume.read().softenFrom).toBeNull();
    expect(f.state().cfg).toMatchObject({ softened: false, lesson: n1 });
    const k = courseLessons.findIndex((l, j) => j > 0 && l.friendly);
    const friendly = courseLessons[k]!;
    const store = memoryMatchStore(matchRules, { played });
    const g = createMatchFlow({ lesson: friendly, store, live: false, clock: () => wall, seed: () => 11 });
    expect(g.comeback).toBe(true);
    expect(store.read().softenFrom).toBeNull();
    expect(g.state().cfg.softened).toBe(false);
  });

  it('в сохранении возврат не смягчает уже пройденный урок', () => {
    // Ловит: смягчение на пройденном уроке (проход его уже не снимет — «до прохода»).
    const t = twoTabs();
    const store = createSaveMatchStore({ layer: t.a, player: () => t.cur.value, rules: matchRules });
    t.a.updatePlayer((tx) => tx.set(courseSection, { ...courseSection.empty(saveCtx), passed: [n1.id] }), { player: 'p1' });
    store.soften?.(n1.id, n.id);
    expect(t.a.readSection(matchSection).soften).toBeNull();
    store.soften?.(courseLessons[i + 2]!.id, n1.id);
    expect(t.a.readSection(matchSection).soften).toEqual({ lessonId: courseLessons[i + 2]!.id, from: n1.id });
  });

  it('строка «Сегодня матч полегче» (017-Р57): контекст вступления несёт смягчение только у смягчённого матча', () => {
    // Ловит: строку без смягчения (ребёнок не поймёт, о чём она) и смягчение без строки (потолок ★★ без объяснения).
    expect(ru.match2.intro.soft).toBe('Сегодня матч полегче — звёзды до\u00a0★★');
    const { wall, played } = fiveDays();
    const f = createMatchFlow({ lesson: n1, store: memoryMatchStore(matchRules, { played }), live: false, clock: () => wall, seed: () => 11 });
    const base = { lesson: n1, rules: matchRules, tasks, sides: { usName: 'Вихрь', rivalName: 'Ураган', usKit: null, rivalKit: null }, state: { kick: null, kickId: null, fails: 0 }, comeback: false };
    expect(matchCtx({ ...base, softened: f.state().cfg.softened }).softened).toBe(true);
    expect(matchCtx(base).softened).toBe(false);
  });

  it('возврат пишет смягчение и в сохранение; чужое смягчение не затирает', () => {
    // Ловит: запись возврата мимо раздела `match` (после F5 смягчения нет) и затирание смягчения другого урока.
    const t = twoTabs();
    const wall = Date.now();
    t.a.updatePlayer((tx) => tx.set(matchSection, { ...matchSection.empty(saveCtx), lastFinishedAt: wall - 5 * DAY_MS }), { player: 'p1' });
    const open = () => tallyStore(createSaveMatchStore({ layer: t.a, player: () => t.cur.value, rules: matchRules }));
    const f = createMatchFlow({ lesson: n1, store: open(), live: false, clock: () => wall, seed: () => 11 });
    expect(f.state().cfg.softened).toBe(true);
    expect(t.a.readSection(matchSection).soften).toEqual({ lessonId: n1.id, from: n.id });
    // Смягчение другого урока уже стоит — возврат его не трогает.
    t.a.updatePlayer((tx) => tx.set(matchSection, { ...matchSection.empty(saveCtx), lastFinishedAt: wall - 6 * DAY_MS, soften: { lessonId: 'yard-30', from: 'yard-29' } }), { player: 'p1' });
    createMatchFlow({ lesson: n1, store: open(), live: false, clock: () => wall, seed: () => 11 });
    expect(t.a.readSection(matchSection).soften).toEqual({ lessonId: 'yard-30', from: 'yard-29' });
  });

  it('проход снимает смягчение', () => {
    // Ловит: смягчение, которое после прохода N+1 остаётся навсегда (урок N+2 шёл бы копией).
    const { played, wall } = fiveDays();
    const store = memoryMatchStore(matchRules, { played });
    const f = createMatchFlow({ lesson: n1, store, live: false, clock: () => wall, seed: () => 11 });
    expect(store.read().softenFrom).toBe(n.id);
    playOut(f);
    expect(f.view.value.result?.verdict).toMatchObject({ passed: true, stars: 2 });
    expect(store.read().softenFrom).toBeNull();
    const next = flowOn(courseLessons[i + 2]!, store);
    expect(next.state().cfg.softened).toBe(false);
  });
});

describe('сборка контекста и итога страницы матча (Т5в)', () => {
  const sides = { usName: 'Вихрь', rivalName: 'Ураган', usKit: null, rivalKit: null };
  const input = (over: Partial<CtxInput> = {}): CtxInput => ({
    lesson, rules: matchRules, tasks, sides, state: { kick: null, kickId: null, fails: 0 }, comeback: false, ...over,
  });
  /** Прыжок со счётчиком: хранилище с подсчётом, как на странице. */
  const jumpTallied = (at: (typeof JUMPS)[number], l = lesson) => {
    let tally: TalliedStore | undefined;
    const j = jumpWith(at, l, false, (s) => (tally = tallyStore(s)));
    return { ...j, tally: tally! };
  };

  it('контекст урока: название, новые клавиши, раскладка, пороги, длина минуты тренера, имена', () => {
    // Ловит: перепутанные g и c, потерю новых клавиш/раскладки, коэффициент минуты тренера не из правил, потерю имён сторон.
    const withKeys = courseLessons.find((l) => l.newKeys !== '')!;
    const c = matchCtx(input({ lesson: withKeys }));
    expect(c).toMatchObject({
      lessonName: withKeys.name, newKeys: withKeys.newKeys, layout: withKeys.layout, g: withKeys.g, c: withKeys.c,
      coachMs: matchRules.coach.ms, usName: 'Вихрь', rivalName: 'Ураган', usKit: null, rivalKit: null,
    });
    expect(withKeys.newKeys).not.toBe('');
    expect(c.tip).toBe(withKeys.tips[0]);
  });

  it('совет идёт по кругу от провала к провалу; без советов — null', () => {
    // Ловит: один и тот же совет на каждом повторе и выход за край списка.
    expect(tipFor(['а', 'б', 'в'], 0)).toBe('а');
    expect(tipFor(['а', 'б', 'в'], 4)).toBe('б');
    expect(tipFor(['а'], 7)).toBe('а');
    expect(tipFor([], 2)).toBeNull();
  });

  it('задача пенальти: есть после выбора на тайм, нет без удара и при неизвестном id', () => {
    // Ловит: задачу из чужого тайма, пенальти там, где удара не будет (kickId = null), и падение на неизвестном id.
    const k = jumpFlow('kick', lesson, false);
    const id = k.state().kick!.taskId;
    expect(kickTaskOf(tasks, k.state())?.id).toBe(id);
    expect(matchCtx(input({ state: k.state() })).kickTask?.id).toBe(id);
    expect(matchCtx(input()).kickTask).toBeNull();
    expect(kickTaskOf(tasks, { kick: null, kickId: 'нет-такой' })).toBeNull();
    // Выбрана на 2-й тайм, но удар ещё не начался: задача уже известна экрану.
    const br = jumpFlow('break', lesson, false);
    br.toSecondHalf();
    const h2 = br.state();
    expect(h2).toMatchObject({ phase: 'half2', kick: null });
    expect(h2.kickId).not.toBeNull();
    expect(kickTaskOf(tasks, h2)?.id).toBe(h2.kickId);
  });

  it('возврат после паузы: баннер только при comeback потока', () => {
    // Ловит: потерю баннера «Капитан вернулся!» между потоком и контекстом.
    const back = jumpFlow('comeback', lesson, false);
    expect(matchCtx(input({ comeback: back.comeback })).comeback).toBe(true);
    expect(matchCtx(input({ comeback: jumpFlow('warmup', lesson, false).comeback })).comeback).toBe(false);
  });

  it('стороны: свой клуб или «Мы», соперник другого имени и формы', () => {
    // Ловит: соперник с названием своего клуба, потерю формы и подмену имени без клуба.
    const data = { club: { name: 'Вихрь', kit: clubData.palettes[0]! }, usKit: kits[0]!, usDefault: 'Мы', data: clubData, seed: 3 };
    const own = matchSides(data);
    expect(own.usName).toBe('Вихрь');
    expect(own.usKit).toBe(data.usKit);
    expect(own.rivalName).not.toBe('Вихрь');
    expect(own.rivalKit).not.toBeNull();
    expect(matchSides({ ...data, club: null, usKit: null }).usName).toBe('Мы');
  });

  it('стороны Двора: «Двор на <улица>» города клуба, форма против нашей; зерно то же — тот же соперник', () => {
    // Ловит: соперник v1 вместо «Двор на …», шаблон не из i18n, форму соперника, похожую на нашу, нестабильность по зерну.
    const club = { name: 'Вихрь', kit: clubData.palettes[0]!, city: 'Тверь' };
    const sides = (worn: typeof kits[number] | null, seed: number) => yardSides({ club, worn, rivalOf: (kit) => matchRival({ city: club.city, kit }, seed) });
    const a = sides(null, 5);
    expect(a.usName).toBe('Вихрь');
    expect(a.usKit).toMatchObject({ name: 'Вихрь', ...club.kit });
    expect(a.rivalName).toMatch(/^Двор на /);
    expect(yardStreets).toContain(a.rivalName.replace('Двор на ', ''));
    expect(a.rivalKit).not.toBeNull();
    expect(sides(null, 5)).toEqual(a);
    expect(matchRival({ city: 'Тверь', kit: club.kit }, 5).city).toBe('Тверь');
    // Надета форма из коллекции: она и идёт на поле.
    expect(sides(kits[0]!, 5).usKit).toBe(kits[0]);
  });

  it('итог после победы: помощи нет, потолок 3, монеты — прирост кошелька, верные считаются с начала матча', () => {
    // Ловит: монеты за прошлые матчи в итоге, потерю остатка кошелька и счёт верных не с начала.
    const { flow, store, tally } = jumpTallied('win');
    const x = resultExtras(flow.state(), store.read(), tally.totals());
    const d = store.read();
    expect(x).toMatchObject({
      help: 'none', softened: false, paid: true, carry: d.wallet.carry, rules: matchRules, report: null,
    });
    expect(resultModel(flow.view.value.result!, x).cap).toBe(3);
    expect(x.correct).toBeGreaterThan(0);
    expect(x.coins).toBe(d.wallet.coins);
    expect(Math.floor(x.correct / matchRules.coinPer)).toBe(x.coins);
    expect(x.growth).toEqual(formGrowth(tally.totals().before.form, d.form, matchRules.squad, matchRules.form));
  });

  it('итог считает прирост: монеты прошлых матчей и рост формы берутся разницей «до» и «после»', () => {
    // Ловит: абсолютный кошелёк вместо прироста (монеты прошлых матчей в «M монет») и потерю роста формы пальца.
    const { flow, store, tally } = jumpTallied('win');
    const after = store.read();
    const finger = matchRules.squad[0]!.finger;
    const before = { ...tally.totals().before, wallet: { coins: 10, carry: 0 } };
    const grown = { ...after, wallet: { coins: 10 + after.wallet.coins, carry: after.wallet.carry }, form: { [finger]: { recent: [], maxRank: 5, candidate: null } } };
    const x = resultExtras(flow.state(), grown, { before, correct: 3 });
    expect(x.coins).toBe(after.wallet.coins);
    expect(x.carry).toBe(after.wallet.carry);
    expect(x.correct).toBe(3);
    expect(x.growth).toEqual([{ finger, name: matchRules.squad[0]!.name, from: 0, rank: 5, percent: 0 }]);
  });

  it('новый матч в том же потоке обнуляет счёт: «Ещё раз» не копит монеты и верные прошлого', () => {
    // Ловит: счёт, который тянется через «Ещё раз» (в итоге были бы монеты двух матчей).
    const { flow, store, tally } = jumpTallied('stuck3');
    const first = tally.totals();
    expect(first.correct).toBeGreaterThan(0);
    const coinsBefore = store.read().wallet.coins;
    flow.choose('again');
    flow.start();
    expect(tally.totals().correct).toBe(0);
    expect(tally.totals().before.wallet.coins).toBe(coinsBefore);
  });

  it('контрольный урок: отчёт по 8 игрокам; обычный — без отчёта', () => {
    // Ловит: отчёт на обычном уроке и пропажу игроков на контрольном.
    const control = courseLessons.find((l) => l.control && !l.friendly)!;
    const c = jumpTallied('win', control);
    const rep = resultExtras(c.flow.state(), c.store.read(), c.tally.totals()).report;
    expect(rep).toHaveLength(matchRules.squad.length);
    expect(rep?.map((r) => r.name)).toEqual(matchRules.squad.map((p) => p.name));
    expect(lesson.control).toBe(false);
  });

  it('потолок звёзд: пройденный с помощью матч режет потолок', () => {
    // Ловит: итог, который не знает про помощь (потолок 3 после «С запасом»).
    const { flow, store, tally } = jumpTallied('stuck3');
    flow.choose('reserve');
    flow.start();
    expect(flow.state().help).toBe('reserve');
    // Ловит: матч «с запасом» без видимой метки — ребёнок не видит, что помощь включена (017-Р46).
    expect(flow.view.value.help).toBe('reserve');
    const x = resultExtras(flow.state(), store.read(), tally.totals());
    expect(x).toMatchObject({ help: 'reserve', softened: false, rules: matchRules });
    expect(starCap(x.help, x.softened, x.rules)).toBe(matchRules.help.reserveCap);
  });

  it('нажатия в журнал: id записи матча, игрок закреплён, ошибки с тем, что нажато; до записи итога; Proxy Vue не падает', () => {
    // Ловит: нажатия без id матча (не связать с записью `match`), без ошибочных знаков, после итоговой записи или мимо игрока,
    // и DataCloneError, когда в хранилище попадает reactive (страница отдаёт ему данные реактивного окружения).
    const t = twoTabs();
    const keys: Array<{ player: string; match: string; typed: string; expected: string; dt: number[] }> = [];
    const order: string[] = [];
    t.a.setJournalSink((recs) => void order.push(...recs.map((r) => r.kind)));
    const store = createSaveMatchStore({
      layer: t.a, player: () => t.cur.value, rules: matchRules,
      keys: (player, k) => (order.push('keys'), void keys.push({ player, ...k })),
    });
    const flow = createMatchFlow({ lesson: reactive(structuredClone(lesson)), store, live: false });
    flow.start();
    drive(flow, (s) => s.phase === 'break', (_half, attack) => (attack === 0 ? 1 : 0));
    const last = keys.at(-1)!;
    expect(last.player).toBe('p1');
    expect(last.match).toMatch(/^p1\..+\.m$/);
    // Длины сходятся; есть и верные, и ошибочные нажатия; время — мс от прошлого, первое — 0.
    expect(last.typed.length).toBe(last.expected.length);
    expect(last.dt).toHaveLength(last.typed.length);
    expect(last.dt[0]).toBe(0);
    expect([...last.typed].some((c, i) => c !== last.expected[i])).toBe(true);
    expect([...last.typed].some((c, i) => c === last.expected[i])).toBe(true);
    // Нажатия уходят раньше записи журнала блока и растут: каждая запись — с начала матча.
    // Журнал: сначала открытая запись `match` (begin), затем на каждый блок — нажатия и следом его запись `match`.
    expect(order.slice(0, 2)).toEqual(['match', 'keys']);
    expect(order.indexOf('match', 1)).toBeGreaterThan(order.indexOf('keys'));
    expect(keys.every((k) => k.match === last.match)).toBe(true);
    expect(keys.map((k) => k.typed.length)).toEqual([...keys.map((k) => k.typed.length)].sort((a, b) => a - b));
  });

  it('нажатия в журнал: последнее нажатие каждой строки не теряется, знаков ровно столько, сколько принято', () => {
    // Ловит: строку, закончившуюся на нажатии, без этого знака (typing уже сменился) и склейку двух интервалов в `dt` следующего знака.
    const t = twoTabs();
    let last: { typed: string; expected: string; dt: number[] } | null = null;
    let accepted = 0;
    const inner = createSaveMatchStore({ layer: t.a, player: () => t.cur.value, rules: matchRules, keys: (_p, k) => void (last = k) });
    const store = { ...inner, block: (e: Parameters<typeof inner.block>[0]) => (accepted += e.correct + e.errors, inner.block(e)) };
    const flow = createMatchFlow({ lesson, store, live: false });
    flow.start();
    drive(flow, (s) => s.phase === 'break');
    expect(last!.typed.length).toBe(accepted);
    expect(last!.typed).toBe(last!.expected);
    expect(Math.max(...last!.dt)).toBeLessThan(1000);
  });

  it('нажатия в журнал: перезагрузка на перерыве — нажатия 1-го тайма на месте, 2-й тайм под своим ключом', () => {
    // Ловит: «Продолжить» после F5, пишущее нажатия 2-го тайма под ключ 1-го (запись журнала `keys` затирается, 017-Р39),
    // и страницу, у которой обёртка `tallyStore` теряет `keys` (нажатия не доходят до журнала).
    const t = twoTabs();
    const journal = new Map<string, string>();
    const open = () => tallyStore(createSaveMatchStore({ layer: t.a, player: () => t.cur.value, rules: matchRules, keys: (_p, k) => void journal.set(k.match, k.typed) }));
    const flow1 = createMatchFlow({ lesson, store: open(), live: false });
    flow1.start();
    drive(flow1, (s) => s.phase === 'break');
    flow1.dispose();
    const [id] = [...journal.keys()];
    expect(journal.size).toBe(1);
    expect(id).toMatch(/^p1\..+\.m$/);
    const firstHalf = journal.get(id!)!;
    expect(firstHalf.length).toBeGreaterThan(0);
    // F5: новый поток на тех же данных, «Продолжить 2-й тайм».
    const flow2 = createMatchFlow({ lesson, store: open(), live: false });
    expect(flow2.view.value.phase).toBe('break');
    flow2.toSecondHalf();
    drive(flow2, (s) => s.result !== null);
    expect(journal.get(id!)).toBe(firstHalf);
    expect(journal.get(`${id}.2`)!.length).toBeGreaterThan(0);
    expect(journal.size).toBe(2);
  });
});

describe('доправка QA Т9д', () => {
  it('соперник один на матч: зерно от урока и клуба, не от часов; на другом уроке — другое (017-Р43)', () => {
    // Ловит: зерно по часам — после F5 соперник менялся (Южная → Липовая → Мельничная).
    const club = { city: 'Тверь', kit: clubData.palettes[0]! };
    const rival = (l: string, name: string) => matchRival(club, rivalSeed(l, name)).name;
    expect(rivalSeed('yard-02', 'Орлы')).toBe(rivalSeed('yard-02', 'Орлы'));
    expect(rival('yard-02', 'Орлы')).toBe(rival('yard-02', 'Орлы'));
    expect(rivalSeed('yard-02', 'Орлы')).not.toBe(rivalSeed('yard-03', 'Орлы'));
    expect(rivalSeed('yard-02', 'Орлы')).not.toBe(rivalSeed('yard-02', 'Совы'));
    const seeds = courseLessons.map((l) => rivalSeed(l.id, 'Орлы'));
    expect(Math.min(...seeds)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seeds)).toBeLessThan(0x7fffffff);
    expect(new Set(courseLessons.map((l) => rival(l.id, 'Орлы'))).size).toBeGreaterThan(1);
  });

  it('ловушка фокуса: Tab и Shift+Tab ходят по кругу, снаружи — в начало или конец окна', () => {
    // Ловит: фокус, уходящий из паузы на ссылку меню под ней.
    expect(nextTabIndex(2, 0, false)).toBe(1);
    expect(nextTabIndex(2, 1, false)).toBe(0);
    expect(nextTabIndex(2, 0, true)).toBe(1);
    expect(nextTabIndex(2, 1, true)).toBe(0);
    expect(nextTabIndex(2, -1, false)).toBe(0);
    expect(nextTabIndex(2, -1, true)).toBe(1);
    expect(nextTabIndex(1, 0, false)).toBe(0);
    expect(nextTabIndex(0, -1, false)).toBe(-1);
  });
});
