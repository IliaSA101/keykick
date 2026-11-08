/**
 * Матч v2 (спека 017-Т5б, design §10): итог матча пишется в разделы сохранения 018 и в журнал.
 * Подготовка — две вкладки на одном хранилище (`twoTabs`); поток ведёт настоящий матч прыжком `jumpWith`,
 * запись идёт в сохранение рядом с памятью. У каждого теста — «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { courseLessons } from '../src/app/course/load';
import { createMatchFlow } from '../src/app/match/flow';
import { drive, jumpWith } from '../src/app/match/jump';
import { matchRules } from '../src/app/match/load';
import { memoryMatchStore, type ReadableMatchStore } from '../src/app/match/store';
import type { JournalInput } from '../src/engine/journal/records';
import { entryFor, initMatch, type PendingSecond } from '../src/engine/match/resume';
import { pendingFromHalf2 } from '../src/engine/match/commit';
import { section as matchSection } from '../src/engine/match/save';
import type { Help } from '../src/engine/match/verdict';
import { beginOf, captured, finishOf, lesson, lying, saveOf, tee, type Got } from './matchCommitFixtures';
import { twoTabs } from './saveFixtures';
import { ctx as saveCtx } from './saveStoreHelpers';

describe('commit: матч v2 → разделы (К17), продолжение: переигровка, F5 и журнал', () => {
  /** Настоящий матч: 1-й тайм выигран, 2-й проигран подчистую; запись идёт в сохранение. Поток стоит на итоге. */
  function lostSecondHalf(t: ReturnType<typeof twoTabs>, fails = 0) {
    const save = saveOf(t);
    let now = 1_800_000_000_000;
    const mem = memoryMatchStore(matchRules, { lessons: fails ? { [lesson.id]: { best: 0, fails } } : {} });
    const flow = createMatchFlow({ lesson, store: tee(mem, save), clock: () => (now += 100), seed: () => 7, live: false });
    flow.start();
    drive(flow, (s) => s.phase === 'break');
    flow.toSecondHalf();
    drive(flow, (s) => s.phase === 'result' || s.phase === 'coach', () => lesson.c);
    return { flow, save };
  }

  // Ловит: F5 на итоге поражения (до «Переиграть тайм»), после которого выигранный 1-й тайм пропадает (`half2` пуст → вступление)
  // или возвращается обычным перерывом «Второй тайм» вместо «Продолжить 2-й тайм (a:b)» (017-Р4, Р36, Р37).
  it('поражение во 2-м тайме при выигранном 1-м: F5 на итоге — «Продолжить 2-й тайм (a:b)», а не вступление', () => {
    const t = twoTabs();
    const { flow } = lostSecondHalf(t);
    expect(flow.view.value.result?.offer?.options).toContain('replay2');
    expect(lying(t, 'match')?.half2).toMatchObject({ lessonId: lesson.id, started: 0, reason: 'replay' });
    expect(entryFor(saveOf(t).read().pending, lesson.id).kind).toBe('continue2');
    // Страница после F5: тот же поток поверх сохранения — перерыв со счётом 1-го тайма и баннером «Продолжить».
    const back = createMatchFlow({ lesson, store: saveOf(t), clock: () => 1_800_000_100_000, seed: () => 9, live: false });
    expect(back.view.value).toMatchObject({ phase: 'break', banner: 'continue2', replay: true });
    expect(back.view.value.firstScore).toMatchObject({ typed: flow.state().firstScore.typed, conceded: 0 });
  });

  // Ловит: возврат минуты тренера после F5 (она повторялась бы при каждом входе в урок и не оплачивалась, 017-Р47-б)
  // и рост `fails` на этом пути.
  it('F5 в минуте тренера (fails = coachAt): «Продолжить 2-й тайм (a:b)», минуты нет, fails тот же', () => {
    const t = twoTabs();
    const { flow } = lostSecondHalf(t, 1);
    expect(flow.state().phase).toBe('coach');
    expect(flow.state().result?.fails).toBe(matchRules.help.coachAt);
    expect(lying(t, 'match')?.half2).toMatchObject({ started: 0, reason: 'replay' });
    const back = createMatchFlow({ lesson, store: saveOf(t), clock: () => 1_800_000_100_000, seed: () => 9, live: false });
    expect(back.view.value).toMatchObject({ phase: 'break', banner: 'continue2', replay: true, coach: null });
    expect(back.view.value.firstScore).toMatchObject({ typed: flow.state().firstScore.typed, conceded: 0 });
    expect(back.state().fails).toBe(matchRules.help.coachAt);
    expect(lying(t, 'course')?.lessons).toMatchObject({ [lesson.id]: { fails: matchRules.help.coachAt } });
  });

  /** Провал с «Переиграть 2-й тайм»: закрытый `loss` матча `seed`, `half2` с зерном проигранного матча. */
  function failedWithReplay(store: ReadableMatchStore, seed: number) {
    const first = { correct: 10, errors: 2, ms: 5000, score: { typed: 1, kick: 0, conceded: 0 } };
    const pending: PendingSecond = { lessonId: lesson.id, seed, started: false, reason: 'replay', first };
    store.begin(beginOf(lesson.id, { seed }));
    store.finish({ ...finishOf(lesson.id, { win: false, fails: 1 }), pending });
  }
  const ofId = (got: Array<{ recs: JournalInput[] }>, id: string): Array<{ outcome: string; signs: number; errors: number; ms: number }> =>
    got.flatMap((g) => g.recs).filter((r) => r.kind === 'match' && r.id === id).map((r) => r.data as { outcome: string; signs: number; errors: number; ms: number });

  // Ловит: «Продолжить» после F5 во 2-м тайме переигровки, переоткрывающее закрытый `loss` проигранного матча (id по его зерну).
  it('провал → переигровка → F5 → «Продолжить»: loss не тронут, закрывается запись переигровки', () => {
    const t = twoTabs();
    const got: Got = [];
    const before = saveOf(t, got);
    failedWithReplay(before, 7);
    before.begin(beginOf(lesson.id, { seed: 55, fails: 1, replay: true }));
    before.half2Started();
    expect((lying(t, 'match')?.half2 as { seed: number }).seed).toBe(55);
    const after = saveOf(t, got);
    after.begin(beginOf(lesson.id, { seed: 99, fails: 1, replay: true, resumed: true }));
    after.half2Started();
    after.finish(finishOf(lesson.id));
    expect(ofId(got, 'p1.7.m').map((r) => r.outcome)).toEqual(['open', 'loss']);
    const replay = ofId(got, `p1.${(55).toString(36)}.m`);
    expect(replay.at(-1)?.outcome).toBe('win');
    expect(replay.some((r) => r.outcome === 'open')).toBe(true);
    expect(ofId(got, `p1.${(99).toString(36)}.m`)).toHaveLength(0);
  });

  // Ловит: F5 сразу после провала (переигровка ещё не начата): «Продолжить» берёт зерно нового матча, а не проигранного.
  it('провал → F5 до переигровки → «Продолжить»: своя запись, loss не тронут', () => {
    const t = twoTabs();
    const got: Got = [];
    failedWithReplay(saveOf(t, got), 7);
    const after = saveOf(t, got);
    after.begin(beginOf(lesson.id, { seed: 99, fails: 1, replay: true, resumed: true }));
    after.half2Started();
    after.finish(finishOf(lesson.id));
    expect(ofId(got, 'p1.7.m').map((r) => r.outcome)).toEqual(['open', 'loss']);
    expect(ofId(got, `p1.${(99).toString(36)}.m`).at(-1)?.outcome).toBe('win');
  });

  // Ловит: переигровка в той же вкладке, у которой метрики 1-го тайма в журнале (signs/errors/ms) нули, а после F5 — нет (017-Р36).
  it('метрики 1-го тайма в записи переигровки — одинаковые в той же вкладке и после F5', () => {
    const t1 = twoTabs();
    const g1: Got = [];
    const s1 = saveOf(t1, g1);
    failedWithReplay(s1, 7);
    s1.begin(beginOf(lesson.id, { seed: 55, fails: 1, replay: true }));
    const t2 = twoTabs();
    const g2: Got = [];
    failedWithReplay(saveOf(t2, g2), 7);
    saveOf(t2, g2).begin(beginOf(lesson.id, { seed: 55, fails: 1, replay: true, resumed: true }));
    const same = ofId(g1, `p1.${(55).toString(36)}.m`)[0];
    expect(same).toMatchObject({ signs: 12, errors: 2, ms: 5000 });
    expect(ofId(g2, `p1.${(55).toString(36)}.m`)[0]).toEqual(same);
  });

  // То же правило в памяти (`app/match/store.ts`): расхождение памяти и сохранения ломало бы смягчение до перезагрузки.
  it('смягчение в памяти: то же правило', () => {
    const mem = memoryMatchStore(matchRules);
    const [n0, n1] = [courseLessons[0]!.id, courseLessons[1]!.id];
    const play = (id: string, help: Help): void => (mem.begin(beginOf(id)), mem.finish(finishOf(id, { help })));
    play(n0, 'reserve');
    play(n0, 'none');
    expect(mem.read().softenFrom).toBe(n0);
    play(n1, 'none');
    expect(mem.read().softenFrom).toBeNull();
  });

  // Ловит: перезагрузка на перерыве, после которой «Продолжить» заводит вторую запись журнала.
  it('F5 на перерыве → «Продолжить» → итог: одна запись журнала, закрытая', () => {
    const t = twoTabs();
    const got: Got = [];
    const { begin, blocks, pending } = captured();
    const before = saveOf(t, got);
    before.begin(begin);
    for (const b of blocks) before.block(b);
    before.toBreak(pending);
    const after = saveOf(t, got); // новый стор на том же хранилище
    expect(after.read().pending).toEqual(pending);
    after.begin({ ...begin, seed: 99, resumed: true, fails: 0 });
    after.half2Started();
    after.finish(finishOf(lesson.id));
    const matches = got.flatMap((g) => g.recs).filter((r) => r.kind === 'match');
    expect(new Set(matches.map((r) => r.id))).toEqual(new Set([`p1.${pending.seed.toString(36)}.m`]));
    const last = matches.at(-1)?.data as { outcome: string; signs: number };
    expect(last.outcome).toBe('win');
    expect(last.signs).toBeGreaterThanOrEqual(pending.first.correct + pending.first.errors);
  });

  /** Страница после F5: новый поток поверх того же сохранения (память не нужна — всё берётся из раздела). */
  function reopened(t: ReturnType<typeof twoTabs>, now = 1_800_000_100_000) {
    return createMatchFlow({ lesson, store: saveOf(t), clock: () => (now += 100), seed: () => 9, live: false });
  }
  /** Что итог победы обязан оставить: урок, звёзды, монеты, `played`, закрытый `half2`. */
  function expectWinSaved(t: ReturnType<typeof twoTabs>, played = 1): void {
    const course = lying(t, 'course') as { passed: string[]; lessons: Record<string, { stars: number }> };
    expect(course.passed).toContain(lesson.id);
    expect(course.lessons[lesson.id]?.stars).toBeGreaterThan(0);
    expect(lying(t, 'wallet')?.coins).toBeGreaterThan(0);
    expect((lying(t, 'match')?.played as Record<string, unknown[]>)[lesson.league]).toHaveLength(played);
    expect(lying(t, 'match')?.half2).toBeNull();
  }

  // Ловит: победа 2-го тайма, не записанная, если перед ним была перезагрузка (журнал не открыт, `finish` молча пропускается; 017-Т9ж).
  // Три пути к ждущему тайму: F5 на перерыве; F5 уже во 2-м тайме (`started`); «Продолжить» с итога поражения.
  it.each([
    ['F5 на перерыве → 2-й тайм → победа', false],
    ['F5 на перерыве, F5 во 2-м тайме → «Продолжить» → победа', true],
  ])('настоящий поток: %s — урок, звёзды, монеты и played записаны', (_, secondReload) => {
    const t = twoTabs();
    const first = createMatchFlow({ lesson, store: saveOf(t), clock: () => 1_800_000_000_100, seed: () => 7, live: false });
    first.start();
    drive(first, (s) => s.phase === 'break');
    expect(lying(t, 'match')?.half2).toMatchObject({ started: 0, reason: 'break' });
    let flow = reopened(t);
    expect(flow.view.value).toMatchObject({ phase: 'break', banner: null });
    flow.toSecondHalf();
    if (secondReload) {
      drive(flow, (s) => s.phase === 'half2' && s.attack >= 1);
      expect(lying(t, 'match')?.half2).toMatchObject({ started: expect.any(Number) as number });
      flow = reopened(t, 1_800_000_200_000);
      expect(flow.view.value).toMatchObject({ phase: 'break', banner: 'continue2' });
      flow.toSecondHalf();
    }
    drive(flow, (s) => s.phase === 'result');
    expect(flow.view.value.result).toMatchObject({ outcome: 'win' });
    expectWinSaved(t);
    // F5 на итоге победы: вступление нового матча, «Продолжить» нет, запись цела.
    expect(reopened(t).view.value).toMatchObject({ phase: 'intro' });
    expectWinSaved(t);
  });

  // Ловит: то же после «Продолжить» с итога поражения 2-го тайма (`reason: 'replay'`): победа переигровки пишется целиком.
  it('настоящий поток: поражение 2-го тайма → F5 → «Продолжить» → победа — урок записан', () => {
    const t = twoTabs();
    lostSecondHalf(t);
    const flow = reopened(t);
    expect(flow.view.value).toMatchObject({ phase: 'break', banner: 'continue2' });
    flow.toSecondHalf();
    drive(flow, (s) => s.phase === 'result');
    expect(flow.view.value.result).toMatchObject({ outcome: 'win' });
    expectWinSaved(t, 2); // в played и проигрыш, и победа
    expect(reopened(t).view.value).toMatchObject({ phase: 'intro' });
  });

  // Ловит: матч без игрока, пишущий в «никого» (падение) или в игрока, появившегося позже.
  it('нет игрока на begin: ничего не пишется, матч не падает', () => {
    const t = twoTabs();
    t.cur.value = null;
    const got: Got = [];
    const save = saveOf(t, got);
    const text = t.data.get(t.key);
    const { begin, blocks } = captured();
    expect(() => {
      save.begin(begin);
      t.cur.value = 'p1';
      save.block(blocks[0]!);
      save.finish(finishOf(lesson.id));
    }).not.toThrow();
    expect(t.data.get(t.key)).toBe(text);
    expect(got).toHaveLength(0);
  });

  // Ловит: продвижение `course.lesson` по «следующему», а не по первому непройденному (пройден 2-й при открытом 1-м).
  it('course.lesson — первый непройденный по порядку курса', () => {
    const t = twoTabs();
    const save = saveOf(t);
    const [n0, n1, n2] = [courseLessons[0]!.id, courseLessons[1]!.id, courseLessons[2]!.id];
    save.begin(beginOf(n1));
    save.finish(finishOf(n1));
    expect((lying(t, 'course') as { lesson: string }).lesson).toBe(n0);
    save.begin(beginOf(n0));
    save.finish(finishOf(n0));
    expect((lying(t, 'course') as { lesson: string }).lesson).toBe(n2);
  });

  // Ловит: проигрыш, считающийся пройденным, или `fails`, не растущий.
  it('проигрыш: fails +1, passed без изменений', () => {
    const t = twoTabs();
    const save = saveOf(t);
    const l = courseLessons[0]!.id;
    save.begin(beginOf(l));
    save.finish(finishOf(l, { win: false, fails: 1 }));
    const c = lying(t, 'course') as { passed: string[]; lessons: Record<string, { fails: number; stars: number }> };
    expect(c.passed).toEqual([]);
    expect(c.lessons[l]).toMatchObject({ fails: 1, stars: 0 });
    save.begin(beginOf(l, { fails: 1 }));
    save.finish(finishOf(l, { win: false, fails: 2 }));
    expect((lying(t, 'course') as typeof c).lessons[l]?.fails).toBe(2);
    expect((lying(t, 'course') as typeof c).passed).toEqual([]);
  });

  // Ловит: помощь, что теряется на перерыве (017-Р56): после F5 метка «С запасом» и потолок ★★ пропадали, звёзды ★★★ без помощи.
  it('«С запасом» → перерыв → F5: help цел, метка видна, потолок ★★; итог пишет проход с помощью и смягчение N+1', () => {
    const t = twoTabs();
    const save = saveOf(t);
    const j = jumpWith('reserve', lesson, false, (m) => tee(m, save));
    j.flow.start();
    drive(j.flow, (s) => s.phase === 'break');
    expect(lying(t, 'match')?.half2).toMatchObject({ lessonId: lesson.id, reason: 'break', help: 'reserve' });
    j.flow.dispose();
    // «Перезагрузка»: новый поток на тех же данных.
    const f = createMatchFlow({ lesson, store: saveOf(t), live: false });
    expect(f.state()).toMatchObject({ phase: 'break', half: 2, help: 'reserve' });
    f.toSecondHalf();
    expect(f.view.value).toMatchObject({ help: 'reserve', phase: 'half2' });
    expect(f.view.value.reserve).not.toBeNull();
    drive(f, (s) => s.phase === 'result');
    expect(f.view.value.result?.verdict).toMatchObject({ passed: true, stars: 2 });
    const next = courseLessons[courseLessons.findIndex((l) => l.id === lesson.id) + 1]!;
    expect(lying(t, 'match')?.soften).toEqual({ lessonId: next.id, from: lesson.id });
    expect((lying(t, 'course') as { lessons: Record<string, { help: string; back: boolean }> }).lessons[lesson.id]).toMatchObject({ help: 'reserve', back: true });
  });

  // Ловит: поле `help` в образце без чтения (мусор в нём не должен ломать загрузку) и файл без поля, читающийся не как `none`.
  it('half2.help: старый файл без поля — none; мусор — none; перерыв без помощи поле не пишет', () => {
    const base = matchSection.sample().half2!;
    const old = { lessonId: base.lessonId, seed: base.seed, started: base.started, score: base.score, first: base.first, reason: base.reason };
    const read = (h: unknown) => matchSection.parse({ half2: h }, saveCtx).half2;
    expect(read(old)?.help).toBeUndefined();
    expect(read({ ...old, help: 'coach' })?.help).toBe('coach');
    expect(read({ ...old, help: 'zzz' })?.help).toBeUndefined();
    expect(read({ ...old, help: 'none' })).not.toHaveProperty('help');
    const pending = pendingFromHalf2(read(old));
    expect(pending?.help ?? 'none').toBe('none');
    const cfg = createMatchFlow({ lesson, store: memoryMatchStore(matchRules), live: false }).state().cfg;
    expect(initMatch(cfg, { seed: 1, fails: 0, entry: entryFor(pending, base.lessonId) }).help).toBe('none');
    // С помощью — переходник туда и обратно сохраняет её.
    const back = pendingFromHalf2(read({ ...old, help: 'coach' }));
    expect(back?.help).toBe('coach');
    expect(initMatch(cfg, { seed: 1, fails: 0, entry: { kind: 'break', pending: back! } }).help).toBe('coach');
  });
});
