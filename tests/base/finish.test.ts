/** К5 (067 Т6): итог игры на интерес — 0 монет, рекорд (ТЗ-0.3, 7.10). */
import { describe, expect, it } from 'vitest';
import { finishFun, markSeen } from '../../src/engine/base/finish';
import { judge } from '../../src/engine/base/records';
import { baseDef, type Base } from '../../src/engine/base/section';
import { walletDef } from '../../src/engine/rewards/section';
import { finishKeepy, keepyChar, keepyEndNote, keepyInZone, keepyIsRecord, keepyKeys, keepyLeft, keepyLives, keepyOver, keepyProgress, keepyRules, keepyDay, seenPatch } from '../../src/app/base/keepy';
import { scoreKeepy, startKeepy, stepKeepy } from '../../src/engine/base/games/keepy';
import { startMemo, stepMemo, type MemoState } from '../../src/engine/base/games/memo';
import { startKeeper, stepKeeper } from '../../src/engine/base/games/keeper';
import { finishKeeper, keeperChar, keeperResults } from '../../src/app/base/keeper';
import { finishMemo, memoChar, memoFound, memoKits, memoMismatch, memoPairs } from '../../src/app/base/memo';
import { bestLine, bestOf, canBegin, endLine, endNote, strikerText } from '../../src/app/base/play';
import { baseCtxOf, baseScreen, boardRows, coachDue, firstOpen, gameGate, gameOfPath, recordFun, recordWhen, seeCoach } from '../../src/app/base/run';
import { ru } from '../../src/i18n/ru';
import { failWhy, unitOf } from '../../src/app/base/run';
import { rivalOf } from '../../src/engine/cup/teams';
import type { BaseCtx } from '../../src/engine/base/open';
import type { LearnCtx } from '../../src/engine/learn/queue';
import type { HomeInput } from '../../src/engine/home';

const day = { day: '2026-11-19' };
const empty = (): Base => baseDef.empty();

describe('К5 · рекорды', () => {
  it('Ловит: первый, побит, тот же; в Мемори меньше ходов — лучше (краснел на откате: да)', () => {
    expect(judge('keepy', 5, undefined)).toBe('first');
    expect(judge('keepy', 6, 5)).toBe('beaten');
    expect(judge('keepy', 5, 5)).toBe('same');
    expect(judge('keepy', 4, 5)).toBe('same');
    expect(judge('memo', 9, undefined)).toBe('first');
    expect(judge('memo', 8, 9)).toBe('beaten');
    expect(judge('memo', 10, 9)).toBe('same');
    // Ловит: Штрафной с тем же счётом и меньшим временем не стал рекордом (036-Р6: «голов из 5 и время»)
    expect(judge('free', 2, 2, 40, 47)).toBe('beaten');
    expect(judge('free', 2, 2, 50, 47)).toBe('same');
    expect(judge('free', 2, 2)).toBe('same');
    expect(judge('free', 2, 2, 47, 47)).toBe('same');
  });

  it('Ловит: ноль не рекорд', () => {
    expect(judge('keepy', 0, undefined)).toBe('same');
    expect(finishFun({ base: empty() }, { id: 'keepy', score: 0, run: 'r0' }, day).save.base.records).toEqual({});
  });

  it('Ловит: рекорд пишется только при улучшении', () => {
    const a = finishFun({ base: empty() }, { id: 'keepy', score: 5, run: 'r1' }, day);
    expect(a.view).toEqual({ score: 5, record: 'first', coins: 0 });
    const b = finishFun(a.save, { id: 'keepy', score: 3, run: 'r2' }, day);
    expect(b.save.base.records.keepy?.n).toBe(5);
    expect(b.save.base.today).toBe(2);
    const c = finishFun({ base: { ...b.save.base, today: 0 } }, { id: 'keepy', score: 8, run: 'r3' }, day);
    expect(c.save.base.records.keepy?.n).toBe(8);
    expect(c.view).toMatchObject({ record: 'beaten' });
  });
});

describe('К5 · 0 монет (ТЗ-0.3)', () => {
  it('Ловит: игра на интерес не трогает кошелёк — монет 0 в итоге, раздела wallet в ответе нет (краснел на откате: да)', () => {
    const save = { base: empty(), wallet: walletDef.empty() };
    const r = finishFun(save, { id: 'keepy', score: 40, run: 'r4' }, day);
    expect(r.view).toMatchObject({ coins: 0 });
    expect(Object.keys(r.save)).toEqual(['base']);
    expect(save.wallet).toEqual(walletDef.empty());
  });

  it('Ловит: игра помечается «видел», метку можно поставить без игры', () => {
    expect(finishFun({ base: empty() }, { id: 'keepy', score: 1, run: 'r5' }, day).save.base.seen).toEqual(['keepy']);
    expect(markSeen(empty(), 'memo').seen).toEqual(['memo']);
    expect(markSeen(empty(), 'nope').seen).toEqual([]);
  });

  it('Ловит: неизвестная игра — «закрыто», сохранение прежнее', () => {
    const b = empty();
    expect(finishFun({ base: b }, { id: 'nope', score: 1, run: 'r5' }, day)).toEqual({ save: { base: b }, view: 'closed' });
  });
});

describe('К5 · повтор и формат', () => {
  it('Ловит: повтор того же run — сохранение без изменений, счётчик дня не растёт (К5)', () => {
    const a = finishFun({ base: empty() }, { id: 'keepy', score: 5, run: 'x' }, day);
    const again = finishFun(a.save, { id: 'keepy', score: 9, run: 'x' }, day);
    expect(again).toEqual({ save: a.save, view: null });
    expect(finishFun(a.save, { id: 'keepy', score: 9, run: 'y' }, day).save.base.today).toBe(2);
  });

  it('Ловит: рекорд — {n, t?, day}; played — за текущий день, last.rec — «последняя игра — рекорд» (Э4.03, 4.05, 4.06, 4.08)', () => {
    const a = finishFun({ base: empty() }, { id: 'free', score: 2, t: 47, run: 'a' }, day).save.base;
    expect(a.records.free).toEqual({ n: 2, t: 47, day: '2026-11-19' });
    expect(a.played).toEqual(['free']);
    expect(a.last).toEqual({ run: 'a', id: 'free' });
    expect(a.lastN.free).toEqual({ n: 2, t: 47 });
    const b = finishFun({ base: a }, { id: 'free', score: 1, run: 'b' }, day).save.base;
    expect(b.records.free?.n).toBe(2);
    expect(b.played).toEqual(['free']);
    expect(b.lastN.free).toEqual({ n: 1 });
    const next = finishFun({ base: b }, { id: 'keepy', score: 3, run: 'c' }, { day: '2026-11-20' }).save.base;
    expect(next.played).toEqual(['keepy']);
  });
});

describe('К5 · время и пустой run', () => {
  it('Ловит: выход finishFun проходит baseDef.check — t нецелое округляется, исходы разные (К5)', () => {
    let b = empty();
    const runs: Array<[string, number, number | undefined]> = [['keepy', 3, undefined], ['free', 2, 47.3], ['free', 2, 46.6], ['memo', 8, undefined], ['free', 0, 0]];
    runs.forEach(([id, score, t], i) => {
      const r = finishFun({ base: { ...b, today: 0 } }, { id, score, ...(t === undefined ? {} : { t }), run: `c${i}` }, day);
      b = r.save.base;
      expect(baseDef.check(b), `${id} ${score} ${t}`).toEqual([]);
    });
    const r = finishFun({ base: empty() }, { id: 'free', score: 2, t: 47.3, run: 'z' }, day).save.base;
    expect(r.records.free?.t).toBe(47);
    expect(r.lastN.free?.t).toBe(47);
  });

  it('Ловит: отрицательное или не число t отвергается — сохранение прежнее, view null (К5)', () => {
    for (const t of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const base = empty();
      expect(finishFun({ base }, { id: 'free', score: 2, t, run: 'bad' }, day)).toEqual({ save: { base }, view: null });
    }
  });

  it('Ловит: пустой run — без защиты от повтора, last не пишется, check проходит (К5)', () => {
    const a = finishFun({ base: empty() }, { id: 'keepy', score: 5, run: '' }, day);
    expect(a.save.base.last).toBeNull();
    const b = finishFun(a.save, { id: 'keepy', score: 6, run: '' }, day);
    expect(b.save.base.today).toBe(2);
    expect(baseDef.check(b.save.base)).toEqual([]);
  });
});

/** Разделы сеанса в том виде, как их отдаёт `session.player.env.sections`. */
const secs = (b: Base, extra: Record<string, unknown> = {}): Record<string, { data: unknown }> => ({ base: { data: b }, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { data: v }])) });
const bctx = (p: Partial<BaseCtx> = {}): BaseCtx => ({ day: '2026-11-19', cur: 6, open: true, matchesToday: 1, cupPlayed: false, ...p });
const lctx = (p: Partial<LearnCtx> = {}): LearnCtx => ({ now: 0, day: '2026-11-19', lesson: 6, tour: 0, speeds: [], learned: [...'аоывфлджнр'], ...p });
const view = (b: Base, p: Partial<BaseCtx> = {}) => baseScreen(secs(b), bctx(p), lctx());

describe('К5 · Б-З1…Б-З3: запись итога через сеанс (app/base/run)', () => {
  it('К5 Б-З1: третья игра на интерес за день не пишется, патча сеанса нет; Б-З2: патч — один раздел base, кошелька нет', () => {
    // Ловит: связка пишет третью игру дня или трогает кошелёк (монеты за игру на интерес)
    const patches: Record<string, unknown>[] = [];
    let b = empty();
    const save = (p: Record<string, unknown>): { ok: boolean } => {
      patches.push(p);
      b = (p as { base: Base }).base;
      return { ok: true };
    };
    expect(recordFun(secs(b), save, { id: 'keepy', score: 5, run: 'r1' }, day.day)).toMatchObject({ record: 'first', coins: 0 });
    expect(recordFun(secs(b), save, { id: 'mini', score: 1, run: 'r2' }, day.day)).toMatchObject({ record: 'first' });
    expect(recordFun(secs(b), save, { id: 'keepy', score: 9, run: 'r3' }, day.day)).toBe('closed');
    expect(patches).toHaveLength(2);
    expect(patches.every((p) => Object.keys(p).join() === 'base')).toBe(true);
    expect(b.today).toBe(2);
  });

  it('К5: отказ сеанса — «unsaved», повтор того же run — null (ничего не записано)', () => {
    // Ловит: итог молча теряется или повтор (двойной Enter, F5 на итоге) записывается дважды
    const b = recordFun(secs(empty()), () => ({ ok: true }), { id: 'keepy', score: 3, run: 'x' }, day.day);
    expect(b).toMatchObject({ score: 3 });
    expect(recordFun(secs(empty()), () => ({ ok: false }), { id: 'keepy', score: 3, run: 'y' }, day.day)).toBe('unsaved');
    const done = finishFun({ base: empty() }, { id: 'keepy', score: 3, run: 'x' }, day).save.base;
    expect(recordFun(secs(done), () => ({ ok: true }), { id: 'keepy', score: 3, run: 'x' }, day.day)).toBeNull();
  });

  it('К5 Б-З3: лимит дня закрывает только игры на интерес — учебные остаются открытыми', () => {
    // Ловит: лимит игр на интерес закрывает учебные игры Базы (они «сколько хочешь»)
    const spent: Base = { ...empty(), day: day.day, today: 2, played: ['keepy', 'mini'] };
    const v = view(spent);
    expect(v.left).toBe(0);
    expect(v.fun.filter((f) => f.open)).toHaveLength(0);
    expect(v.fun.find((f) => f.id === 'keepy')?.wait).toBe('tomorrow');
    expect(v.learn.filter((r) => r.open).length).toBeGreaterThan(0);
    expect(firstOpen(v)).toBeNull();
    expect(firstOpen(view(empty()))).toBe('keepy');
  });

  it('К5 Э4.06: «Играть, Enter» — на новой игре («Новое»), а не на первой по порядку', () => {
    // Ловит: главная кнопка Базы стоит на Чеканке, хотя макет Э4.06 отдаёт её только что открывшемуся Вратарю
    const seen: Base = { ...empty(), seen: ['keepy', 'mini', 'free', 'memo'] };
    const v = view(seen, { cur: 22, cupPlayed: true });
    expect(v.fun.find((f) => f.id === 'keeper')?.newMark).toBe(true);
    expect(firstOpen(v)).toBe('keeper');
  });
});

describe('К5 · охрана /base/:game (Б-З4)', () => {
  it('К5 Б-З4: игра до своей вехи, лимит дня, Штрафной до Кубка и чужой id — на Базу; открытая — на свой экран', () => {
    // Ловит: адрес пускает в закрытую игру (охрана маршрута снята или смотрит не на `open`)
    const v = view(empty(), { cur: 3 }); // Мини-футбол откроется после урока 3: cur 3 — ещё закрыт
    expect(gameGate('mini', v, lctx())).toEqual({ kind: 'base' });
    expect(gameGate('keepy', v, lctx())).toEqual({ kind: 'fun', id: 'keepy' });
    expect(gameGate('free', view(empty(), { cur: 20 }), lctx())).toEqual({ kind: 'base' });
    expect(gameGate('nope', v, lctx())).toEqual({ kind: 'base' });
    const spent = view({ ...empty(), day: day.day, today: 2, played: ['keepy', 'mini'] }, { cur: 20 });
    expect(gameGate('keepy', spent, lctx())).toEqual({ kind: 'base' });
    expect(gameGate('keepy', view(empty(), { matchesToday: 0 }), lctx())).toEqual({ kind: 'base' });
  });

  it('К21 Р18: у входа Дома по умолчанию Кубок не сыгран — Штрафной на уроке 15 закрыт и охрана уводит на Базу', () => {
    // Ловит: `cupPlayed = true` по умолчанию — Штрафной открывается без Кубка (в Э1 Кубка нет, 067-Р18)
    const i: HomeInput = { cur: 15, day: 3, matchesToday: 1, played: 5, stars: {}, best: 0, coins: 0, fans: 0, bought: [], friendly: false, round: null, end: false, region: false, pause5: false, extras: {} };
    const ctx = baseCtxOf(i, day.day);
    expect(ctx.cupPlayed).toBe(false);
    expect(gameGate('free', baseScreen(secs(empty()), ctx, lctx()), lctx())).toEqual({ kind: 'base' });
    // стенд кадров ставит «Кубок сыгран» явно — тогда игра открыта
    expect(gameGate('free', baseScreen(secs(empty()), baseCtxOf(i, day.day, true), lctx()), lctx())).toEqual({ kind: 'fun', id: 'free' });
  });

  it('К5: учебная игра по адресу — только открытая и играемая окном; закрытая — на Базу (игры 5–8 играются окном с Т18)', () => {
    // Ловит: адрес учебной игры пускает в закрытую (mouse — с урока 2) или в игру без окна
    const v = view(empty());
    expect(gameGate('arrows', v, lctx())).toEqual({ kind: 'learn', id: 'arrows' });
    expect(gameGate('mouse', v, lctx({ lesson: 1 }))).toEqual({ kind: 'base' });
    expect(gameGate('squad', v, lctx({ lesson: 30, tour: 30 }))).toEqual({ kind: 'learn', id: 'squad' });
    expect(gameGate('squad', v, lctx({ lesson: 1 }))).toEqual({ kind: 'base' });
  });
});

describe('К5 · вид Базы: рекорд, доска, реплика тренера', () => {
  it('Ловит: «когда» рекорда — сегодня, вчера, день недели в пределах недели, иначе дата (18.11.2026 — среда)', () => {
    expect(recordWhen('2026-11-18', '2026-11-18')).toEqual({ kind: 'today' });
    expect(recordWhen('2026-11-17', '2026-11-18')).toEqual({ kind: 'yesterday' });
    expect(recordWhen('2026-11-13', '2026-11-18')).toEqual({ kind: 'weekday', weekday: 4 });
    expect(recordWhen('2026-11-11', '2026-11-18')).toEqual({ kind: 'date', day: 11, month: 11 });
  });

  it('Ловит: доска — последняя игра рекорд (100 %), «до рекорда» считается разностью, у Мемори меньше — лучше, закрытые — замок (Э4.08)', () => {
    const rec = { n: 10, day: '2026-11-10' };
    const memo = { n: 20, day: '2026-11-10' };
    const b: Base = { ...empty(), records: { keepy: rec, memo }, lastN: { keepy: { n: 7 }, memo: { n: 25 } } };
    const rows = boardRows(view(b, { cur: 16 }), '2026-11-19');
    const by = (id: string) => rows.find((r) => r.id === id);
    expect(by('keepy')).toMatchObject({ kind: 'rec', fill: 70, note: { kind: 'gap', last: 7, gap: 3 } });
    expect(by('memo')).toMatchObject({ better: 'low', fill: 80, note: { kind: 'gap', last: 25, gap: 5 } });
    expect(by('mini')?.kind).toBe('none');
    expect(by('keeper')?.kind).toBe('lock');
    const same = boardRows(view({ ...b, lastN: { keepy: { n: 10 }, memo } }, { cur: 16 }), '2026-11-10');
    expect(same.find((r) => r.id === 'keepy')).toMatchObject({ fill: 100, note: { kind: 'today' } });
    expect(boardRows(view({ ...b, lastN: { keepy: { n: 10 } } }, { cur: 16 }), '2026-11-19').find((r) => r.id === 'keepy')?.note).toEqual({ kind: 'record' });
  });

  it('Ловит: реплика тренера — только на первом входе; повтор патча нет, раздел seen не растёт сверх предела', () => {
    expect(coachDue(undefined)).toBe(true);
    const patch = seeCoach(undefined, day.day);
    expect(patch?.seen.firsts).toEqual({ base: day.day });
    expect(coachDue({ seen: { data: patch?.seen } })).toBe(false);
    expect(seeCoach({ seen: { data: patch?.seen } }, '2026-11-20')).toBeNull();
  });
});

// Чеканка на экране (067 Т19, Э4.27–29): связь движка с кадром — клавиша, ход до третьего промаха, рекорд, метка «видел», лимит дня.
describe('К5 · Чеканка на экране', () => {
  const sec = (b: Base) => ({ base: { data: b } });
  /** Сеанс-двойник: пишет патч раздела `base`, как `session.save`. */
  const saver = (ok = true) => {
    const saved: Base[] = [];
    return { saved, save: (p: Record<string, unknown>) => { if (ok) saved.push(p.base as Base); return { ok }; } };
  };
  const play = (n: number): Base => ({ ...empty(), day: day.day, today: n });

  it('К5 клавиша: место клавиши в русской раскладке, не включённая раскладка; служебные, повтор и Ctrl — не нажатие', () => {
    expect(keepyChar({ code: 'KeyF' })).toBe('а');
    expect(keepyChar({ code: 'KeyD' })).toBe('в');
    expect(keepyChar({ code: 'Enter' })).toBeNull();
    expect(keepyChar({ code: 'ShiftLeft' })).toBeNull();
    expect(keepyChar({ code: 'KeyF', repeat: true })).toBeNull();
    expect(keepyChar({ code: 'KeyF', ctrlKey: true })).toBeNull();
    expect(keepyKeys('вао.л ВА')).toEqual(['в', 'а', 'о', 'л']);
  });

  it('К5 ход игры: верная клавиша в зоне — +1, до зоны — без штрафа, три промаха — конец, счёт — касания подряд', () => {
    let g = startKeepy({ keys: keepyKeys('вао') }, 7, 0);
    const letter = g.letter as string;
    expect(keepyInZone(g, 0)).toBe(false);
    expect(keepyProgress(g, 900)).toBeCloseTo(0.5, 5);
    g = stepKeepy(g, { kind: 'key', key: letter }, 100); // рано: мяч ещё не в зоне
    expect(g).toMatchObject({ touches: 0, misses: 0 });
    expect(keepyInZone(g, 1700)).toBe(true);
    g = stepKeepy(g, { kind: 'key', key: g.letter as string }, 1700);
    expect(g.touches).toBe(1);
    for (let i = 0; i < 3; i++) g = stepKeepy(g, { kind: 'key', key: '!' }, 1800 + i);
    expect(g.over).toBe(true);
    expect(scoreKeepy(g)).toBe(1);
  });

  it('К5 рекорд: первая игра — рекорд, запись раздела (день, счётчик 1, «видел»), «осталось сегодня 1»', () => {
    const s = saver();
    const end = finishKeepy(sec(empty()), s.save, 33, 'k1', day.day);
    expect(end).toMatchObject({ score: 33, record: 'first', best: 33, left: 1, unsaved: false });
    expect(s.saved[0]).toMatchObject({ day: day.day, today: 1, records: { keepy: { n: 33 } }, seen: ['keepy'], played: ['keepy'] });
  });

  it('К5 рекорд: побит — новый, не побит — прежний рекорд и «до рекорда»; вторая игра дня — осталось 0', () => {
    const base: Base = { ...play(1), records: { keepy: { n: 20, day: '2026-11-10' } } };
    const s = saver();
    expect(finishKeepy(sec(base), s.save, 25, 'k2', day.day)).toMatchObject({ record: 'beaten', best: 25, left: 0 });
    expect(s.saved[0]?.records.keepy?.n).toBe(25);
    const t = saver();
    expect(finishKeepy(sec(base), t.save, 12, 'k3', day.day)).toMatchObject({ record: 'same', best: 20, left: 0 });
    expect(t.saved[0]?.records.keepy?.n).toBe(20);
  });

  it('К5 лимит дня: третья игра не пишется (лимит 2), счёт показан без рекорда; повтор того же прогона — один раз', () => {
    const s = saver();
    const end = finishKeepy(sec(play(2)), s.save, 40, 'k4', day.day);
    expect(end).toMatchObject({ record: 'same', left: 0, unsaved: false });
    expect(s.saved).toHaveLength(0);
    const once: Base = { ...play(1), last: { run: 'k5', id: 'keepy' }, records: { keepy: { n: 30, day: day.day } } };
    const r = saver();
    expect(finishKeepy(sec(once), r.save, 30, 'k5', day.day).left).toBe(1);
    expect(r.saved).toHaveLength(0);
  });

  it('К5 отказ записи: итог показан, лимит дня не потрачен', () => {
    const s = saver(false);
    expect(finishKeepy(sec(play(1)), s.save, 8, 'k6', day.day)).toMatchObject({ record: 'first', left: 1, unsaved: true });
  });

  it('К5 итог без записи: «Итог игры не записан.» и причина сеанса, без «побил рекорд» и «до рекорда»; значка рекорда нет', () => {
    const prev: Base = { ...play(0), records: { keepy: { n: 20, day: day.day } } };
    const end = finishKeepy(sec(prev), saver(false).save, 25, 'k7', day.day);
    expect(end).toMatchObject({ unsaved: true, left: 2 });
    const note = keepyEndNote(end, failWhy('busy'));
    expect(note).toBe(`${ru.learn.end.saveFail} ${ru.frame.notice.busyAnon}`);
    expect(note).not.toMatch(/побил|До рекорда|Раньше/);
    expect(keepyIsRecord(end)).toBe(false);
    // записанный итог: рекорд побит — значок и «было N»
    const ok = finishKeepy(sec(prev), saver().save, 25, 'k8', day.day);
    expect(keepyIsRecord(ok)).toBe(true);
    expect(keepyEndNote(ok, '')).toContain('было 20');
    expect(failWhy('ok')).toBe(ru.frame.notice.quota); // сеанс «ок», а запись не легла — места нет
    expect(failWhy(null)).toBe('');
  });

  it('К5 жизни — из контента (067-Р23): число мячей и «можно ещё» от `keepy.lives`, правило и заголовок итога — с числом и склонением', () => {
    expect(keepyLives).toBe(3);
    expect(keepyLeft(1)).toBe(2);
    expect(keepyLeft(1, 4)).toBe(3); // четыре жизни: после промаха можно ещё три
    expect(keepyLeft(9, 4)).toBe(0);
    expect(keepyRules(4)[0]).toBe('4 промаха — игра закончилась.');
    expect(keepyRules()[0]).toBe('3 промаха — игра закончилась.');
    expect(keepyRules(5)[0]).toBe('5 промахов — игра закончилась.');
    expect(keepyOver(4)).toBe('4 промаха — конец!');
    expect(keepyOver(1)).toBe('1 промах — конец!');
  });

  it('К5 метка «видел»: экран игры снимает «новое» один раз; игра дня — N из 2', () => {
    const patch = seenPatch(undefined, 'keepy');
    expect(patch?.base.seen).toEqual(['keepy']);
    expect(seenPatch(sec(patch?.base ?? empty()), 'keepy')).toBeNull();
    expect(seenPatch(undefined, 'неизвестная')).toBeNull();
    expect(keepyDay(undefined, day.day)).toEqual({ n: 1, of: 2 });
    expect(keepyDay(sec(play(1)), day.day)).toEqual({ n: 2, of: 2 });
  });
});

describe('К5 · адрес игры на стенде кадров (067 Т19)', () => {
  it('К5: игра берётся из адреса фикстуры /base/<игра>; без игры охрана уводит на Базу — так кадры Чеканки показывали Базу', () => {
    expect(gameOfPath('/base/keepy')).toBe('keepy');
    expect(gameOfPath('/base/keepy?x=1')).toBe('keepy');
    expect(gameOfPath('/base')).toBeUndefined();
    expect(gameOfPath('/match')).toBeUndefined();
    expect(gameGate(gameOfPath('/base/keepy') ?? '', view(empty(), { cur: 6 }), lctx())).toEqual({ kind: 'fun', id: 'keepy' });
    expect(gameGate('', view(empty(), { cur: 6 }), lctx())).toEqual({ kind: 'base' });
  });
});

describe('К5 · Мемори формы на экране (067 Т20)', () => {
  const sec = (b: Base, packs = 4) => ({ base: { data: b }, album: { data: { packs, shown: packs, worn: null, prize: [] } } });
  const saver = (ok = true) => {
    const saved: Base[] = [];
    return { saved, save: (p: Record<string, unknown>) => { if (ok) saved.push(p.base as Base); return { ok }; } };
  };
  const play = (n: number): Base => ({ ...empty(), day: day.day, today: n });
  /** Партия до конца: карты открываются парами по формам (без промахов), число ходов — число пар. */
  const solve = (kits: string[]): MemoState => {
    let g = startMemo({ keys: ['а', 'о', 'л', 'д', 'ж', 'ф', 'ы', 'в'], kits }, 5);
    for (const kit of kits.slice(0, 8)) {
      for (const c of g.cards.filter((x) => x.kit === kit)) g = stepMemo(g, { kind: 'key', key: c.key }, 10);
    }
    return g;
  };

  it('К5 формы на картах: форма клуба первой, дальше формы альбома с выданной футболкой (одной части достаточно); альбома нет — только клуб', () => {
    expect(memoKits(sec(empty(), 0))).toEqual(['club']);
    expect(memoKits(sec(empty(), 1))).toHaveLength(2);
    expect(memoKits(sec(empty(), 4))).toHaveLength(3);
    expect(memoKits(sec(empty(), 4))[0]).toBe('club');
    expect(memoKits(undefined)).toEqual(['club']);
  });

  it('К5 клавиша карты: буква и цифра по месту клавиши; служебная, повтор и Ctrl — не нажатие', () => {
    expect(memoChar({ code: 'KeyF' })).toBe('а');
    expect(memoChar({ code: 'Digit1' })).toBe('1');
    expect(memoChar({ code: 'ShiftLeft' })).toBeNull();
    expect(memoChar({ code: 'Digit1', repeat: true })).toBeNull();
    expect(memoChar({ code: 'KeyF', ctrlKey: true })).toBeNull();
  });

  it('К5 ход до конца: пара, не пара, счёт ходов; найденные формы и «найдено пар»', () => {
    const kits = ['club', 'scarlet', 'sand'];
    let g = startMemo({ keys: ['а', 'о', 'л', 'д', 'ж', 'ф'], kits }, 5);
    expect(memoPairs(g)).toEqual({ found: 0, total: 3 });
    const a = g.cards[0];
    const other = g.cards.find((c, i) => i > 0 && c.kit !== a?.kit);
    g = stepMemo(stepMemo(g, { kind: 'key', key: a?.key as string }, 0), { kind: 'key', key: other?.key as string }, 10);
    expect(memoMismatch(g)).toBe(true);
    expect(g.moves).toBe(1);
    const done = solve(kits);
    expect(done.done).toBe(true);
    expect(done.moves).toBe(3);
    expect(memoPairs(done)).toEqual({ found: 3, total: 3 });
    expect(memoFound(done).sort()).toEqual([...kits].sort());
    expect(memoMismatch(done)).toBe(false);
  });

  it('К33 Мемори: формы найденных пар — в порядке набора (альбом), форма клуба последней, а не по порядку карт на поле', () => {
    const card = (key: string, kit: string) => ({ key, kit, face: 'done' as const });
    const s = { cards: [card('1', 'c'), card('2', 'a'), card('3', 'club'), card('4', 'b'), card('5', 'c'), card('6', 'a'), card('7', 'club'), card('8', 'b')], up: [], shownAt: 0, moves: 4, done: true } as unknown as MemoState;
    expect(memoFound(s)).toEqual(['c', 'a', 'club', 'b']);
    expect(memoFound(s, ['club', 'a', 'b', 'c'])).toEqual(['a', 'b', 'c', 'club']);
  });

  it('К5 рекорд Мемори: первая игра — рекорд, запись (день, счётчик 1, «видел»); меньше ходов — рекорд побит; больше — прежний и «до рекорда»', () => {
    const s = saver();
    const first = finishMemo(sec(empty()), s.save, 16, 'm1', day.day);
    expect(first).toMatchObject({ score: 16, record: 'first', best: 16, left: 1, unsaved: false });
    expect(s.saved[0]).toMatchObject({ day: day.day, today: 1, records: { memo: { n: 16 } }, seen: ['memo'], played: ['memo'] });
    const base: Base = { ...play(1), records: { memo: { n: 20, day: '2026-11-10' } } };
    const better = saver();
    expect(finishMemo(sec(base), better.save, 15, 'm2', day.day)).toMatchObject({ record: 'beaten', best: 15, prev: 20 });
    expect(better.saved[0]?.records.memo?.n).toBe(15);
    const worse = saver();
    const end = finishMemo(sec(base), worse.save, 25, 'm3', day.day);
    expect(end).toMatchObject({ record: 'same', best: 20 });
    expect(worse.saved[0]?.records.memo?.n).toBe(20);
    expect(keepyEndNote(end, '')).toContain('До рекорда 5.');
    expect(keepyIsRecord(end)).toBe(false);
  });

  it('К5 первый рекорд с числом и единицей игры (067-Р225 «б», кадр Э4.33): без единицы — строка без числа (Чеканка, Э4.29), побитый и недобор — без изменений', () => {
    const first = finishMemo(sec(empty()), saver().save, 22, 'm9', day.day);
    expect(endNote(first, '', 'хода')).toContain('теперь он твой: 22 хода.');
    expect(endNote(first, '')).toContain('теперь он твой.');
    expect(endNote(first, '')).not.toContain('22');
    const base: Base = { ...play(1), records: { memo: { n: 20, day: '2026-11-10' } } };
    expect(endNote(finishMemo(sec(base), saver().save, 15, 'm10', day.day), '', 'ходов')).toContain('было 20');
    expect(endNote(finishMemo(sec(base), saver().save, 25, 'm11', day.day), '', 'ходов')).toContain('До рекорда 5.');
  });

  it('067 Т21 общие строки рекорда и итога игр на интерес: рекорд из раздела, «рекорда нет», единица игры, итог без единицы (Чеканка, Мини-футбол)', () => {
    const base: Base = { ...play(1), records: { memo: { n: 20, day: '2026-11-10' } } };
    expect(bestOf(sec(base), 'memo')).toEqual({ n: 20, day: '2026-11-10' });
    expect(bestOf(sec(base), 'keeper')).toBeNull();
    expect(bestOf(undefined, 'memo')).toBeNull();
    expect(bestLine('memo', bestOf(sec(base), 'memo'))).toBe(`20 ${unitOf('memo', 20)}`);
    expect(bestLine('keeper', null)).toBe(ru.base.recordNone);
    const first = finishMemo(sec(empty()), saver().save, 22, 'm20', day.day);
    expect(endLine('memo', first, null, true)).toBe(endNote(first, '', unitOf('memo', 22)));
    expect(endLine('memo', first, null, false)).toBe(endNote(first, ''));
    expect(endLine('memo', null, null, true)).toBe('');
    const lost = finishMemo(sec(empty()), saver(false).save, 22, 'm21', day.day);
    expect(endLine('memo', lost, 'busy', true)).toBe(`${ru.learn.end.saveFail} ${failWhy('busy')}`);
  });

  it('К5 счёт равен рекорду (не побит): строки «До рекорда 0.» нет, остаётся «Монет … нет»', () => {
    const base: Base = { ...play(1), records: { memo: { n: 20, day: '2026-11-10' } } };
    const end = finishMemo(sec(base), saver().save, 20, 'm12', day.day);
    expect(end).toMatchObject({ record: 'same', best: 20, score: 20 });
    const note = endNote(end, '', 'ходов');
    expect(note).not.toContain('До рекорда');
    expect(note).toBe(ru.base.keepy.noCoins);
  });

  it('К5 лимит дня Мемори: третья игра не пишется, счёт показан без рекорда; повтор того же прогона — один раз', () => {
    const s = saver();
    expect(finishMemo(sec(play(2)), s.save, 14, 'm4', day.day)).toMatchObject({ record: 'same', left: 0, unsaved: false });
    expect(s.saved).toHaveLength(0);
    const once: Base = { ...play(1), last: { run: 'm5', id: 'memo' }, records: { memo: { n: 14, day: day.day } } };
    const r = saver();
    expect(finishMemo(sec(once), r.save, 14, 'm5', day.day).left).toBe(1);
    expect(r.saved).toHaveLength(0);
  });

  it('К5 отказ записи Мемори: итог показан, лимит дня не потрачен, рекорда не показываем', () => {
    const end = finishMemo(sec(play(1)), saver(false).save, 12, 'm6', day.day);
    expect(end).toMatchObject({ record: 'first', left: 1, unsaved: true });
    expect(keepyIsRecord(end)).toBe(false);
    expect(keepyEndNote(end, failWhy('busy'))).toBe(`${ru.learn.end.saveFail} ${ru.frame.notice.busyAnon}`);
  });

  it('К5 клавиша Вратаря: только 8 букв ряда ФЫВА ОЛДЖ по месту клавиши; чужая буква, цифра, служебная, повтор и модификаторы — не нажатие', () => {
    const codes = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
    expect(codes.map((code) => keeperChar({ code }))).toEqual(['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж']);
    expect(keeperChar({ code: 'KeyG' })).toBeNull();
    expect(keeperChar({ code: 'Digit1' })).toBeNull();
    expect(keeperChar({ code: 'ShiftLeft' })).toBeNull();
    expect(keeperChar({ code: 'KeyF', repeat: true })).toBeNull();
    expect(keeperChar({ code: 'KeyF', ctrlKey: true })).toBeNull();
    expect(keeperChar({ code: 'KeyF', altKey: true })).toBeNull();
    expect(keeperChar({ code: 'KeyF', metaKey: true })).toBeNull();
  });

  it('К5 исходы Вратаря: сейв и пропуск различаются, шаг без смены удара ряд не меняет, последний удар закрывает over (сейв и пропуск)', () => {
    const row = ['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж'];
    const a = startKeeper({ keys: row }, 3);
    const hit = stepKeeper(a, { kind: 'key', key: a.cur as string }, 100);
    expect(keeperResults([], a, hit)).toEqual([true]);
    const wrong = row.find((k) => k !== a.cur) as string;
    expect(stepKeeper(a, { kind: 'key', key: wrong }, 100)).toBe(a);
    expect(keeperResults([true], a, a)).toEqual([true]);
    const late = stepKeeper(a, { kind: 'tick' }, a.since + 2501);
    expect(keeperResults([true], a, late)).toEqual([true, false]);
    // последний удар: сейв закрывает серию как сейв, пропуск — как пропуск
    const lastOf = (key: boolean): { res: boolean[]; over: boolean } => {
      let s = startKeeper({ keys: row }, 3);
      let res: boolean[] = [];
      let t = 0;
      for (let i = 0; i < 20; i++) {
        const n = key ? stepKeeper(s, { kind: 'key', key: s.cur as string }, t + 10) : stepKeeper(s, { kind: 'tick' }, s.since + 2501);
        res = keeperResults(res, s, n);
        t = n.since;
        s = n;
      }
      return { res, over: s.over };
    };
    const saved = lastOf(true);
    expect(saved.over).toBe(true);
    expect(saved.res).toHaveLength(20);
    expect(saved.res.every(Boolean)).toBe(true);
    const missed = lastOf(false);
    expect(missed.res).toHaveLength(20);
    expect(missed.res.some(Boolean)).toBe(false);
  });

  it('К5 рекорд Вратаря: первая серия — рекорд (запись: день, счётчик 1, «видел»); больше сейвов — побит; не больше — прежний и «до рекорда»', () => {
    const s = saver();
    expect(finishKeeper(sec(empty()), s.save, 12, 'v1', day.day)).toMatchObject({ score: 12, record: 'first', best: 12, left: 1, unsaved: false });
    expect(s.saved[0]).toMatchObject({ day: day.day, today: 1, records: { keeper: { n: 12 } }, seen: ['keeper'], played: ['keeper'] });
    const base: Base = { ...play(1), records: { keeper: { n: 12, day: '2026-11-10' } } };
    const better = saver();
    expect(finishKeeper(sec(base), better.save, 15, 'v2', day.day)).toMatchObject({ record: 'beaten', best: 15, prev: 12 });
    expect(better.saved[0]?.records.keeper?.n).toBe(15);
    const worse = saver();
    const end = finishKeeper(sec(base), worse.save, 9, 'v3', day.day);
    expect(end).toMatchObject({ record: 'same', best: 12 });
    expect(worse.saved[0]?.records.keeper?.n).toBe(12);
    expect(keepyEndNote(end, '')).toContain('До рекорда 3.');
    expect(finishKeeper(sec(base), saver().save, 12, 'v4', day.day).record).toBe('same');
  });

  it('К5 лимит дня Вратаря: третья серия не пишется, счёт показан без рекорда; повтор того же прогона — один раз', () => {
    const s = saver();
    expect(finishKeeper(sec(play(2)), s.save, 14, 'v5', day.day)).toMatchObject({ record: 'same', left: 0, unsaved: false });
    expect(s.saved).toHaveLength(0);
    const once: Base = { ...play(1), last: { run: 'v6', id: 'keeper' }, records: { keeper: { n: 14, day: day.day } } };
    const r = saver();
    expect(finishKeeper(sec(once), r.save, 14, 'v6', day.day).left).toBe(1);
    expect(r.saved).toHaveLength(0);
  });

  it('К5 отказ записи Вратаря: итог показан, лимит дня не потрачен, рекорда не показываем', () => {
    const end = finishKeeper(sec(play(1)), saver(false).save, 12, 'v7', day.day);
    expect(end).toMatchObject({ record: 'first', left: 1, unsaved: true });
    expect(keepyIsRecord(end)).toBe(false);
    expect(keepyEndNote(end, failWhy('busy'))).toBe(`${ru.learn.end.saveFail} ${ru.frame.notice.busyAnon}`);
  });
});

// Enter на старте и итоге игры на интерес (067 Т20): условие вынесено из Vue в чистую `canBegin`.
describe('К5 Б-З1 · Enter начинает партию (canBegin)', () => {
  const base = { phase: 'end' as const, left: 1, repeat: false, onButton: false, openedAt: 1000, now: 2000, delay: 400 };
  it('К5 Б-З1: на итоге с оставшимися играми дня и после паузы — начинает; игры дня кончились (left 0) — нет (партия не запишется)', () => {
    expect(canBegin(base)).toBe(true);
    expect(canBegin({ ...base, left: 0 })).toBe(false);
  });
  it('К5: пауза после показа итога, повтор клавиши и фокус на кнопке — не начинают', () => {
    expect(canBegin({ ...base, now: 1200 })).toBe(false);
    expect(canBegin({ ...base, now: 1400 })).toBe(true);
    expect(canBegin({ ...base, repeat: true })).toBe(false);
    expect(canBegin({ ...base, onButton: true })).toBe(false);
  });
  it('К5: на старте — всегда (игр дня и пауза не важны, итога нет), кроме повтора и кнопки; во время игры — нет', () => {
    expect(canBegin({ ...base, phase: 'start', left: 0, now: 0 })).toBe(true);
    expect(canBegin({ ...base, phase: 'start', repeat: true })).toBe(false);
    expect(canBegin({ ...base, phase: 'start', onButton: true })).toBe(false);
    expect(canBegin({ ...base, phase: 'play' })).toBe(false);
  });
});

describe('Т21 · подпись бьющего у Вратаря', () => {
  it('Т21 strikerText: «бьёт двор на <улица>» — улица соперника именно того урока, что передан; пробел после «двор» неразрывный', () => {
    // Ловит: номер урока не дошёл (подпись одна на все уроки), «двор» рвётся от «на».
    for (const n of [1, 12, 32]) expect(strikerText(n), String(n)).toBe(`бьёт двор\u00a0на ${rivalOf(n).street}`);
    expect(strikerText(1)).not.toBe(strikerText(32));
  });
});
