/**
 * Касса наград и переход «свисток → сохранение» (065 Т2, К2; ТЗ-0.3, 3.1, 3.4, 2.7, 10.2): `finishMatch`, `finishMinute`,
 * разделы `wallet`, `day`, `school`, `form`; цепочка двух игроков на сеансе. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { matchRead } from '../../src/app/match/finish';
import { SECTIONS, walletOf } from '../../src/app/save/sections';
import { createSession } from '../../src/app/save/session';
import { createKeyValue } from '../../src/app/save/storage';
import { createStore } from '../../src/app/save/store';
import { coachDef } from '../../src/engine/coach/section';
import { dayDef } from '../../src/engine/day/section';
import { formDef } from '../../src/engine/form/section';
import { stadiumDef } from '../../src/engine/home/section';
import { finishMatch, finishMinute, matchPatch, type MatchSave } from '../../src/engine/match';
import type { MatchResult, Press } from '../../src/engine/match';
import { credit, debit, type AlbumPurse, type Purse } from '../../src/engine/rewards/cash';
import { albumDef } from '../../src/engine/album/section';
import { walletDef } from '../../src/engine/rewards/section';
import { schoolDef } from '../../src/engine/school/section';
import { ruCourseDef } from '../../src/engine/course/section';
import { FOREIGN, MemStorage, P, fakeLocks } from '../fixtures/storageKit';

const stats = (correct: number, errors = 0) => ({ correct, errors, keyErrors: {}, fingerErrors: {}, startedAt: 0, lastAt: 60000, intervals: Array.from({ length: Math.max(1, correct) }, () => 60000 / Math.max(1, correct)) });

/** Итог матча: счёт печатью, верные нажатия, пенальти — по желанию. */
function result(me: number, opp: number, correct: number, o: { errors?: number; penalty?: boolean; friendly?: boolean; presses?: Press[] } = {}): MatchResult {
  const total = { me: me + (o.penalty ? 1 : 0), opp };
  const verdict = total.me > total.opp ? 'win' : total.me < total.opp ? 'loss' : 'draw';
  const s = stats(correct, o.errors ?? 0);
  return {
    verdict,
    score: { me, opp },
    total,
    penalty: { offered: o.penalty !== undefined, scored: o.penalty === true },
    half1: { me, opp },
    half2: { me: 0, opp: 0 },
    extra: { me: 0, opp: 0 },
    replay: verdict === 'win' ? null : 'half2',
    counted: o.friendly === true || verdict === 'win',
    stats: s,
    play: s,
    presses: o.presses ?? [],
  };
}

const empty = (): MatchSave => ({
  album: albumDef.empty(),
  course: ruCourseDef.empty(),
  wallet: walletDef.empty(),
  day: dayDef.empty(),
  school: schoolDef.empty(),
  form: formDef.empty(),
  coach: coachDef.empty(),
  stadium: stadiumDef.empty(),
});
const ctx = (matchId: string, over: object = {}) => ({ now: 1_000_000, day: '2026-11-18', lessonId: 'ru.yard.ao', matchId, ...over });

describe('К2: касса — монеты за верные нажатия (ТЗ-3.1)', () => {
  it('К2: 1 монета за 20 верных, остаток переходит в следующий матч, ошибки не платят', () => {
    // Ловит: монеты за ошибки, потерянный остаток, неверный делитель.
    const a = finishMatch(empty(), result(3, 0, 45), ctx('m1'));
    expect(a.view?.coins).toBe(2);
    expect(a.save.wallet).toMatchObject({ coins: 2, rest: 5 });
    const b = finishMatch(a.save, result(3, 0, 45, { errors: 50 }), ctx('m2'));
    expect(b.view?.coins).toBe(2);
    expect(b.save.wallet).toMatchObject({ coins: 4, rest: 10 });
    const same = finishMatch(empty(), result(3, 0, 45, { errors: 0 }), ctx('x'));
    expect(same.view?.coins).toBe(finishMatch(empty(), result(3, 0, 45, { errors: 50 }), ctx('x')).view?.coins);
  });

  it('К2: урок старше прошлой лиги (pays: false) — 0 монет и 0 болельщиков, остаток не трогается', () => {
    // Ловит: ферма монет на старых уроках (ТЗ-0.2).
    const start = { ...empty(), wallet: { coins: 3, rest: 7, paid: [] } };
    const r = finishMatch(start, result(3, 0, 100), ctx('m1', { pays: false }));
    expect(r.view).toMatchObject({ coins: 0, fans: 0 });
    expect(r.save.wallet).toMatchObject({ coins: 3, rest: 7 });
  });

  it('К2: болельщики (065-Р26) — 1 за верное нажатие через кассу, голы копятся с пенальти, повтор матча ничего не меняет', () => {
    // Ловит: болельщики мимо кассы или за ошибки, гол пенальти не в счёте, вторая награда на повторе matchId.
    const a = finishMatch(empty(), result(2, 1, 45, { errors: 9, penalty: true }), ctx('m1'));
    expect(a.view?.fans).toBe(45);
    expect(a.save.stadium).toEqual({ fans: 45, goals: 3 });
    const b = finishMatch(a.save, result(1, 0, 10), ctx('m2'));
    expect(b.save.stadium).toEqual({ fans: 55, goals: 4 });
    expect(finishMatch(b.save, result(1, 0, 10), ctx('m2')).save).toBe(b.save);
    expect(finishMatch(empty(), result(3, 0, 100), ctx('m3', { pays: false })).save.stadium).toEqual({ fans: 0, goals: 3 });
  });

  it('К2: пенальти — монет столько же, как без него; верный удар — +1 к Знатоку, промах — нет', () => {
    // Ловит: монеты за пенальти (ТЗ-2.7: 0 монет), «Знаток» без гола, звезда за счёт пенальти.
    const without = finishMatch(empty(), result(1, 1, 60), ctx('m1'));
    const hit = finishMatch(empty(), result(1, 1, 60, { penalty: true }), ctx('m1'));
    const miss = finishMatch(empty(), result(1, 1, 60, { penalty: false }), ctx('m1'));
    expect(hit.view?.coins).toBe(without.view?.coins);
    expect(hit.save.school.knower).toBe(1);
    expect(miss.save.school.knower).toBe(0);
    expect(hit.view).toMatchObject({ passed: true, stars: 0, knower: true });
    expect(without.view).toMatchObject({ passed: false });
  });

  it('К2: повтор того же matchId (двойной Enter, F5) — сохранение без изменений, награда один раз', () => {
    // Ловит: двойные монеты, дни и попытки на повторе итога.
    const a = finishMatch(empty(), result(3, 0, 100), ctx('m1'));
    const again = finishMatch(a.save, result(3, 0, 100), ctx('m1'));
    expect(again.save).toBe(a.save);
    expect(again.view).toBeNull();
    expect(finishMatch(a.save, result(3, 0, 100), ctx('m2')).save.wallet.coins).toBe(10);
  });
});

describe('К2: отметка урока, день, форма', () => {
  it('К2: проход — звёзды, рекорд, done и переход на следующий урок; провал — fails растёт, звёзды не убывают', () => {
    // Ловит: потерю звёзд при худшем матче, сброс done, счётчик провалов, что проход не двигает current.
    const a = finishMatch(empty(), result(3, 0, 100), ctx('m1', { next: 'ru.yard.b' }));
    expect(a.save.course.current).toBe('ru.yard.b');
    expect(a.save.course.lessons['ru.yard.ao']).toMatchObject({ stars: 3, tries: 1, done: '2026-11-18', fails: 0, back: false });
    expect(a.view).toMatchObject({ stars: 3, newStars: 3, record: { kind: 'first' } });
    const b = finishMatch(a.save, result(0, 2, 100), ctx('m2', { day: '2026-11-19' }));
    expect(b.save.course.lessons['ru.yard.ao']).toMatchObject({ stars: 3, tries: 2, done: '2026-11-18', fails: 1 });
    expect(b.view).toMatchObject({ passed: false, newStars: 0, missing: { kind: 'goals', n: 3 }, help: 'none' });
    const c = finishMatch(b.save, result(0, 2, 100), ctx('m3'));
    expect(c.view?.help).toBe('minute');
    expect(c.save.course.lessons['ru.yard.ao']?.fails).toBe(2);
  });

  it('К2: помощь «с запасом» по счётчику провалов — звёзды не выше ★★, метка back до прохода без помощи', () => {
    // Ловит: ★★★ с помощью, метку «вернуться за звёздами» не поставили или не сняли.
    const start = empty();
    start.course = { ...start.course, lessons: { 'ru.yard.ao': { stars: 0, best: 0, tries: 3, fails: 3 } } };
    const a = finishMatch(start, result(3, 0, 100), ctx('m1'));
    expect(a.view).toMatchObject({ stars: 2, back: true });
    expect(a.save.course.lessons['ru.yard.ao']).toMatchObject({ fails: 0, back: true });
    const b = finishMatch(a.save, result(3, 0, 100), ctx('m2'));
    expect(b.view).toMatchObject({ stars: 3, back: false });
  });

  it('К2: игровой день — первый матч дня считает день, второй — только матч; пропуск ничего не сжигает', () => {
    // Ловит: день за каждый матч, день без матча, потерю времени последнего матча.
    const a = finishMatch(empty(), result(3, 0, 40), ctx('m1'));
    const b = finishMatch(a.save, result(3, 0, 40), ctx('m2', { now: 2_000_000 }));
    expect(b.save.day).toEqual({ played: 2, days: 1, today: '2026-11-18', todayN: 2, last: 2_000_000 });
    const c = finishMatch(b.save, result(3, 0, 40), ctx('m3', { day: '2026-11-25' }));
    expect(c.save.day).toMatchObject({ played: 3, days: 2, today: '2026-11-25', todayN: 1 });
  });

  it('К2: форма клавиш растёт от нажатий матча и в проигранном тоже', () => {
    // Ловит: нажатия матча не доходят до раздела `form`.
    const presses: Press[] = Array.from({ length: 60 }, () => ({ ch: 'ф', ok: true }));
    const r = finishMatch(empty(), result(0, 2, 60, { presses }), ctx('m1'));
    expect(r.save.form.fingers['lp']?.w.length).toBe(60);
    expect(r.view?.grew.length).toBeGreaterThan(0);
  });
});

describe('К5: раздел coach — запись матча (067 Т24)', () => {
  const bits = (ch: string, n: number, miss = 0): Press[] => Array.from({ length: n }, (_, i) => ({ ch, ok: i >= miss }));

  it('К5: свисток пишет окна букв (пробел не пишется, окно ≤ 300, хвост — последние); тот же matchId второй раз — без изменений', () => {
    // Ловит: двойной Enter удваивает окно; рост окна без предела; пробел и знаки в «трудных».
    const presses = [...bits('ы', 400), ...bits(' ', 10), ...bits('.', 5), { ch: 'Ж', ok: false }];
    const a = finishMatch(empty(), result(3, 0, 40, { presses }), ctx('m1'));
    expect(a.save.coach.keys['ы']).toBe('1'.repeat(300));
    expect(a.save.coach.keys['ж']).toBe('0');
    expect(Object.keys(a.save.coach.keys).sort()).toEqual(['ж', 'ы']);
    const again = finishMatch(a.save, result(3, 0, 40, { presses }), ctx('m1'));
    expect(again.view).toBeNull();
    expect(again.save.coach).toEqual(a.save.coach);
    expect(matchPatch(a.save).coach).toBe(a.save.coach);
    const next = finishMatch(a.save, result(3, 0, 40, { presses: bits('ы', 10, 4) }), ctx('m2'));
    expect(next.save.coach.keys['ы']).toBe('1'.repeat(290) + '0000111111');
  });
});

describe('К6: раздел coach — итог минуты (067 Т24)', () => {
  const win = (ok: number, miss: number): string => '1'.repeat(ok) + '0'.repeat(miss);

  it('К6: окна клавиш минуты выросли; view.keys — «было → стало» из раздела, ранг — из формы после минуты', () => {
    // Ловит: «было → стало» берётся не из сохранения (а из заглушки) или ранг «после» из старой формы.
    const before = { ...empty(), coach: { keys: { ы: win(80, 20), ж: win(45, 5) } }, form: { fingers: { lr: { w: win(80, 20), max: 0, cand: { rank: 0, n: 0 } } } } };
    const list: Press[] = [...Array.from({ length: 100 }, () => ({ ch: 'ы', ok: true })), ...Array.from({ length: 10 }, () => ({ ch: 'ж', ok: true }))];
    const out = finishMinute(before, { presses: 110, correct: 110, list }, { matchId: 'min1', keys: 'ыж' });
    expect(out.save.coach.keys['ы']).toBe((win(80, 20) + '1'.repeat(100)).slice(-300));
    expect(out.save.coach.keys['ж']).toBe(win(45, 5) + '1'.repeat(10));
    const ys = out.view!.keys;
    expect(ys.map((k) => k.after.ch)).toEqual(['ы', 'ж']);
    expect(ys[0]!.before).toMatchObject({ permille: 800, rank: 0 });
    expect(ys[0]!.after.permille).toBe(900);
    expect(ys[0]!.after.rank).toBe(1);
    expect(ys[0]!.after.rank).toBeGreaterThan(ys[0]!.before.rank);
    expect(out.view!.grew).toEqual([{ finger: 'lr', from: 0, to: 1 }]);
    expect(finishMinute({ ...before, ...out.save }, { presses: 110, correct: 110, list }, { matchId: 'min1', keys: 'ыж' }).view).toBeNull();
  });
});

describe('К2: минута тренера (ТЗ-3.4)', () => {
  it('К2: платит как печать (1 за 20 верных), в дни и матчи не идёт, повтор — без второй награды', () => {
    // Ловит: минута считается матчем (ТЗ-10.9), платит иначе, повторно.
    const m = { presses: 70, correct: 60, list: Array.from({ length: 60 }, () => ({ ch: 'ф', ok: true })) };
    const a = finishMinute(empty(), m, { matchId: 'min1' });
    expect(a.view).toMatchObject({ coins: 3, correct: 60 });
    expect(a.save.wallet).toMatchObject({ coins: 3, rest: 0 });
    expect(Object.keys(a.save)).toEqual(['wallet', 'school', 'form', 'coach', 'stadium', 'album']);
    const again = finishMinute({ ...empty(), ...a.save }, m, { matchId: 'min1' });
    expect(again.view).toBeNull();
    expect(again.save.wallet.coins).toBe(3);
  });

  it('К2: касса — остаток копится между матчем и минутой (общий кошелёк), отрицательное и дробь не ломают', () => {
    // Ловит: минус монет от отрицательного входа; потерю остатка между источниками.
    const one = credit({ wallet: walletDef.empty(), school: schoolDef.empty(), stadium: stadiumDef.empty(), album: albumDef.empty() }, 'match-coins', 15);
    const two = credit(one.purse, 'minute-coins', 7.9);
    expect(two.purse.wallet).toMatchObject({ coins: 1, rest: 2 });
    expect(credit(two.purse, 'match-coins', -5).purse.wallet).toMatchObject({ coins: 1, rest: 2 });
  });
});

describe('К2: разделы сборки', () => {
  it('К2: check берёт пустое и отвергает порчу', () => {
    // Ловит: раздел принимает минус, дробь, чужую форму.
    for (const d of [walletDef, dayDef, schoolDef, formDef]) expect(d.check(d.empty() as never)).toEqual([]);
    expect(walletDef.check({ coins: -1, rest: 20, paid: [1] })).toEqual(['coins', 'rest', 'paid']);
    expect(dayDef.check({ played: 1.5, days: 0, today: '2026-13-01', todayN: 0, last: -1 })).toEqual(['played', 'today', 'last']);
    // школа v2 (067 Т1): та же порча — минус у «Знатока», остальные поля целые
    expect(schoolDef.check({ ...schoolDef.empty(), knower: -1 })).toEqual(['knower']);
    expect(SECTIONS.map((d) => d.name)).toEqual(expect.arrayContaining(['wallet', 'day', 'school', 'form']));
  });
});

describe('К2: цепочка двух игроков на сеансе (065 Т2)', () => {
  it('К2: у каждого игрока свои монеты, дни и Знаток; повтор итога в одной вкладке ничего не меняет', async () => {
    // Ловит: общий кошелёк игроков, запись итога не тому pid, двойную награду при втором save.
    const mem = new MemStorage();
    for (const [k, v] of Object.entries(FOREIGN)) mem.map.set(k, v);
    const locks = fakeLocks();
    let n = 0;
    const tab = () => {
      const store = createStore({ prefix: P, local: createKeyValue(mem), session: createKeyValue(new MemStorage()), locks });
      return createSession({ store, newPid: () => `p${++n}` });
    };
    const a = tab();
    await a.init();
    await a.create({ name: 'Аня' });
    const b = tab();
    await b.init();
    await b.create({ name: 'Боря' });
    const read = (s: ReturnType<typeof tab>): MatchSave => {
      const p = s.player.value;
      if (p.kind !== 'ok') throw new Error('player');
      const d = (name: string): unknown => p.env.sections[name]!.data;
      return { course: d('course:ru'), wallet: d('wallet'), day: d('day'), school: d('school'), form: d('form'), coach: d('coach'), stadium: d('stadium'), album: d('album') } as MatchSave;
    };
    const play = (s: ReturnType<typeof tab>, id: string, r: MatchResult) => {
      const out = finishMatch(read(s), r, ctx(id));
      expect(s.save(matchPatch(out.save))).toEqual({ ok: true });
    };
    play(a, 'a1', result(3, 0, 100, { penalty: true }));
    play(a, 'a1', result(3, 0, 100, { penalty: true }));
    play(b, 'b1', result(0, 2, 40));
    expect(read(a).wallet.coins).toBe(5);
    expect(read(a).school.knower).toBe(1);
    expect(read(a).day.played).toBe(1);
    expect(read(b).wallet.coins).toBe(2);
    expect(read(b).school.knower).toBe(0);
    expect(read(a).album.packs).toBe(1);
    expect(read(b).album.packs).toBe(0);
    expect(read(b).course.lessons['ru.yard.ao']?.fails).toBe(1);
    expect(read(a).course.lessons['ru.yard.ao']?.fails).toBe(0);
  });
});

describe('чтение кошелька экраном (063 Т8, страж С1)', () => {
  it('walletOf: баланс из разделов игрока; нет раздела или игрока — пустой кошелёк', () => {
    // Ловит: экран матча читает монеты мимо слоя app (значение walletDef в файле показа) или падает на пустом сеансе.
    expect(walletOf({ wallet: { data: { coins: 7, rest: 2, paid: ['m1'] } } })).toEqual({ coins: 7, rest: 2, paid: ['m1'] });
    expect(walletOf({})).toEqual(walletDef.empty());
    expect(walletOf(undefined)).toEqual(walletDef.empty());
  });

  it('matchRead: экран матча отдаёт свистку кошелёк игрока, а не пустой (очередь п. 12)', () => {
    // Ловит: проводка экрана матча теряет монеты игрока (пустой кошелёк вместо раздела) — касса начислит поверх нуля,
    // и после матча монеты «сгорят»; прежний тест walletOf не видел, что экран им пользуется.
    const read = matchRead({ wallet: { data: { coins: 7, rest: 2, paid: ['m1'] } }, day: { data: { ...dayDef.empty(), last: 1_763_380_000_000 } } });
    expect(read.wallet).toEqual({ coins: 7, rest: 2, paid: ['m1'] });
    expect(read.day.last).toBe(1_763_380_000_000);
    expect(matchRead({ album: { data: { ...albumDef.empty(), packs: 5, shown: 5 } } }).album.packs).toBe(5);
    expect(matchRead({ coach: { data: { keys: { ы: '110' } } } }).coach).toEqual({ keys: { ы: '110' } }); // окна «трудных клавиш» доезжают до свистка
    expect(matchRead(undefined)).toEqual({
      course: ruCourseDef.empty(), wallet: walletDef.empty(), day: dayDef.empty(), school: schoolDef.empty(), form: formDef.empty(), coach: coachDef.empty(), stadium: stadiumDef.empty(), album: albumDef.empty(),
    });
  });
});

describe('К6: касса волны 4 (067 Т1)', () => {
  const purse = (coins = 10): AlbumPurse => ({ wallet: { ...walletDef.empty(), coins }, school: schoolDef.empty(), stadium: stadiumDef.empty(), album: albumDef.empty() });

  it('К6: новые награды растят своё поле; пак без альбома в кассе не выдаётся', () => {
    // Ловит: награда пишет не туда (монеты вместо «Знатока»), теряет монеты учебной игры, выдаёт пак в пустоту.
    expect(credit(purse(), 'tour-knower', 2).purse.school.knower).toBe(2);
    expect(credit(purse(), 'kicks-knower', 1).purse.school.knower).toBe(1);
    expect(credit(purse(), 'lesson-pack', 1).purse.album.packs).toBe(1);
    const l = credit(purse(), 'learn-coins', 4, 'run1');
    expect(l.purse.wallet).toMatchObject({ coins: 14, paid: ['run1'] });
  });

  it('К6: debit — списывает один раз, в минус не уходит, плохая цена и пустой ref отвергаются', () => {
    // Ловит: двойное списание на двойном Enter, минус монет, покупку за 0 или дробь, покупку без идентификатора.
    const a = debit(purse(), 'shop-buy', 6, 'buy1');
    expect(a).toMatchObject({ result: 'paid' });
    expect(a.purse.wallet.coins).toBe(4);
    const again = debit(a.purse, 'shop-buy', 6, 'buy1');
    expect(again.result).toBe('again');
    expect(again.purse.wallet.coins).toBe(4);
    const poor = debit(a.purse, 'shop-buy', 5, 'buy2');
    expect(poor.result).toBe('coins');
    expect(poor.purse.wallet.coins).toBe(4);
    const exact = debit(purse(6), 'shop-buy', 6, 'b');
    expect(exact.result).toBe('paid');
    expect(exact.purse.wallet.coins).toBe(0);
    for (const price of [0, -3, 1.5, NaN]) expect(debit(purse(), 'shop-buy', price, 'x').result).toBe('bad');
    expect(debit(purse(), 'shop-buy', 1, '').result).toBe('bad');
  });
});

describe('К6: пак за первый проход урока (ТЗ-5.1)', () => {
  it('К6: победа в уроке впервые — +1 пак через кассу; повтор урока, поражение и повтор matchId — без пака', () => {
    // Ловит: пак за повтор или поражение (ферма), пак мимо кассы, второй пак на двойном Enter.
    const a = finishMatch(empty(), result(3, 0, 45), ctx('m1'));
    expect(a.save.album.packs).toBe(1);
    expect(finishMatch(a.save, result(3, 0, 45), ctx('m2')).save.album.packs).toBe(1);
    expect(finishMatch(a.save, result(3, 0, 45), ctx('m1')).save).toBe(a.save);
    expect(finishMatch(empty(), result(0, 2, 45), ctx('m3')).save.album.packs).toBe(0);
    expect(finishMatch(a.save, result(3, 0, 45), ctx('m4', { lessonId: 'ru.yard.ab' })).save.album.packs).toBe(2);
  });

  it('К6: чемпионат — пака нет; урок старше прошлой лиги (`pays: false`) пак даёт (ТЗ-0.2, 5.1)', () => {
    // Ловит: пак за чемпионат (ферма); потерянный пак за старый урок, когда монеты не платятся.
    expect(finishMatch(empty(), result(3, 0, 45), ctx('m1', { championship: true })).save.album.packs).toBe(0);
    const old = finishMatch(empty(), result(3, 0, 45), ctx('m2', { pays: false }));
    expect(old.save.album.packs).toBe(1);
    expect(old.save.wallet.coins).toBe(0);
  });

  it('К6: кошелёк без альбома — источник без пака работает', () => {
    // Ловит: `credit` требует альбом у всех источников (ломало сборку учебных игр без `album`).
    const bare: Purse = { wallet: walletDef.empty(), school: schoolDef.empty(), stadium: stadiumDef.empty() };
    expect(credit(bare, 'tour-knower', 2).purse.school.knower).toBe(2);
    expect(credit(bare, 'learn-coins', 3, 'r').purse.wallet.coins).toBe(3);
  });

  it('К6: во Дворе 39 паков — дальше пак не выдаётся', () => {
    // Ловит: пак 40+ (формы нет), рост `packs` за пределы альбома.
    const full = { ...empty(), album: { ...albumDef.empty(), packs: 39, shown: 39 } };
    expect(finishMatch(full, result(3, 0, 45), ctx('m1')).save.album.packs).toBe(39);
  });
});
