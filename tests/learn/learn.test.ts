/**
 * Учебные игры (067 Т4, К4; ТЗ-7.1–7.6, 3.3): очередь, карточки перерыва, ступени, «Права», ставка, конец игры и касса.
 * У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { learnDef, type Learn } from '../../src/engine/learn/section';
import { baseList, breakCards, GAMES, isOpen, queue, type LearnCtx } from '../../src/engine/learn/queue';
import { rateHundredths } from '../../src/engine/learn/rate';
import { bronzeCount, rightsCard, startLearn, stepLearn, stepOf, type LearnRun } from '../../src/engine/learn/steps';
import { finishLearn, type LearnSave } from '../../src/engine/learn/finish';
import { REWARD_SOURCES } from '../../src/engine/rewards/sources';
import { walletDef } from '../../src/engine/rewards/section';
import { schoolDef } from '../../src/engine/school/section';
import { stadiumDef } from '../../src/engine/home/section';
import { endLadder, endOf, mmss, mouseView, missOf, playLadder, stakeOf } from '../../src/app/learn/view';
import { frameFlow, missInput, playUntil } from '../../src/app/learn/frame';
import { breakGames, enterBreak, learnRead, type EntryFacts } from '../../src/app/learn/entry';
import { beginLearn, commitLearn, inputLearn, learnCtxOf, openLearn, type LearnFlow } from '../../src/app/learn/run';

const ctxOf = (o: Partial<LearnCtx> = {}): LearnCtx => ({ now: 1000, day: '2026-11-19', lesson: 30, tour: 20, speeds: [60, 60, 60], learned: ['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж'], ...o });
const emptyLearn = (): Learn => learnDef.empty();
const saveOf = (learn: Learn = emptyLearn()): LearnSave => ({ learn, wallet: walletDef.empty(), school: schoolDef.empty(), stadium: stadiumDef.empty() });

/** Игра: промахи и время (мс) → запуск, готовый к концу. */
function played(game: string, misses: number, ms: number, now = 1000, seed = 1): LearnRun {
  let run = startLearn(game, { now }, seed);
  for (let i = 0; i < misses; i++) run = stepLearn(run, { type: 'miss' });
  return stepLearn(run, { type: 'finish', at: now + ms });
}

describe('К4: открытие игр (ТЗ-7.2)', () => {
  it('К4: восемь игр, id уникальны, открытие по туру или уроку, что раньше', () => {
    // Ловит: игра открывается только по уроку (тур игнорируется) или по позднему из двух.
    expect(GAMES.map((g) => g.id)).toHaveLength(8);
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(8);
    const squad = GAMES.find((g) => g.id === 'squad')!;
    expect(isOpen(squad, { lesson: 8, tour: 0 })).toBe(false);
    expect(isOpen(squad, { lesson: 9, tour: 0 })).toBe(true);
    expect(isOpen(squad, { lesson: 3, tour: 5 })).toBe(true);
    expect(isOpen(GAMES[0]!, { lesson: 0, tour: 99 })).toBe(false);
  });

  it('К4: урок и тур каждой из восьми игр — по таблице ТЗ-7.2', () => {
    // Ловит: правка learn.json разошлась с ТЗ-7.2 (урок-запас или тур игры).
    expect(GAMES.map((g) => [g.id, g.lesson, g.tour])).toEqual([
      ['arrows', 1, null],
      ['mouse', 2, null],
      ['tab', 3, null],
      ['keyboard', 6, null],
      ['squad', 9, 5],
      ['board', 12, 7],
      ['roster', 18, 13],
      ['pairs', 24, 17],
    ]);
  });

  it('К4: список Базы — все восемь, закрытые помечены, «новое» только у открытых и не игранных', () => {
    // Ловит: закрытая игра в списке как открытая; метка «новое» у сыгранной.
    const learn = emptyLearn();
    learn.games.arrows = { step: 1, plays: 1, best: 40000, last: '2026-11-18' };
    const list = baseList(learn, ctxOf({ lesson: 2, tour: 0 }));
    expect(list).toHaveLength(8);
    expect(list.filter((i) => i.open).map((i) => i.id)).toEqual(['arrows', 'mouse']);
    expect(list.find((i) => i.id === 'arrows')!.isNew).toBe(false);
    expect(list.find((i) => i.id === 'mouse')!.isNew).toBe(true);
    expect(list.find((i) => i.id === 'tab')!.isNew).toBe(false);
  });
});

describe('К4: очередь и перерыв (ТЗ-7.3, 7.4)', () => {
  it('К4: новая игра — в первый же перерыв, раньше сыгранных', () => {
    // Ловит: новая игра уходит за сыгранные.
    const learn = emptyLearn();
    learn.games.arrows = { step: 1, plays: 1, best: 1, last: '2026-11-01' };
    expect(queue(learn, ctxOf({ lesson: 2, tour: 0 }))[0]).toBe('mouse');
  });

  it('К4: три последние игры не повторяются, если есть другая', () => {
    // Ловит: игра из последних трёх встаёт первой, хотя сыграна меньше и есть другая.
    const learn = emptyLearn();
    learn.games.arrows = { step: 1, plays: 1, best: 1, last: '2026-11-19' };
    learn.games.mouse = { step: 1, plays: 5, best: 1, last: '2026-11-10' };
    learn.recent = ['arrows'];
    expect(queue(learn, ctxOf({ lesson: 2, tour: 0 }))).toEqual(['mouse', 'arrows']);
  });

  it('К4: все восемь открыты — на 44, 56 и 60 перерывах одна игра подряд не идёт, разница сыгранных ≤ 2, на 44 ни одна > 7', () => {
    // Ловит: повтор одной игры подряд; перекос очереди; игра чаще 7 раз за 44 перерыва (критерий ТЗ-7.3 дословно).
    for (const n of [44, 56, 60]) {
      let save = saveOf();
      let prev = '';
      for (let i = 0; i < n; i++) {
        const ctx = ctxOf({ now: 1000 + i * 100000, day: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}` });
        const first = breakCards(save.learn, ctx)[0]!;
        expect(first.id, `перерыв ${i}`).not.toBe(prev);
        prev = first.id;
        save = finishLearn(save, played(first.id, 1, 120000, ctx.now, i), ctx).save;
        save = { ...save, wallet: walletDef.empty() };
      }
      const plays = GAMES.map((g) => save.learn.games[g.id]?.plays ?? 0);
      expect(Math.max(...plays) - Math.min(...plays)).toBeLessThanOrEqual(2);
      if (n === 44) expect(Math.max(...plays)).toBeLessThanOrEqual(7);
    }
  });

  it('К4: на 44, 56 и 60 перерывах урок растёт, повтор подряд — только при одной открытой игре, перекос очереди ограничен', () => {
    // Ловит: повтор одной игры подряд при двух и более открытых; игра, ушедшая в хвост очереди навсегда; перекос открытых игр.
    for (const n of [44, 56, 60]) {
      let save = saveOf();
      let prev = '';
      for (let i = 0; i < n; i++) {
        const lesson = 1 + Math.floor((i * 32) / n);
        const ctx = ctxOf({ lesson, tour: 0, now: 1000 + i * 100000, day: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}` });
        const open = GAMES.filter((g) => isOpen(g, ctx));
        const first = breakCards(save.learn, ctx)[0]!;
        if (open.length > 1) expect(first.id, `перерыв ${i}, урок ${lesson}`).not.toBe(prev);
        prev = first.id;
        // «серебро»: до золота никто не доходит, очередь без «золотых»
        save = finishLearn(save, played(first.id, 1, 120000, ctx.now, i), ctx).save;
        save = { ...save, wallet: walletDef.empty() };
      }
      const plays = GAMES.map((g) => save.learn.games[g.id]?.plays ?? 0);
      expect(plays.every((p) => p > 0), `n=${n}: все игры сыграны`).toBe(true);
      // arrows и mouse открыты с начала — между собой не расходятся больше чем на 2 лишних игры от открытия других
      expect(Math.max(...plays)).toBeLessThanOrEqual(Math.ceil(n / 3));
    }
  });

  it('К4: игра с одной игрой не встаёт первой после игры, если открыта другая (хвост — по месту в последних)', () => {
    // Ловит: хвост из трёх последних сортируется по числу игр — только что сыгранная снова первая (mouse, mouse).
    const learn = emptyLearn();
    learn.games.arrows = { step: 1, plays: 1, best: 1, last: '2026-11-19' };
    learn.games.mouse = { step: 1, plays: 3, best: 1, last: '2026-11-17' };
    learn.games.tab = { step: 1, plays: 3, best: 1, last: '2026-11-18' };
    learn.recent = ['mouse', 'tab', 'arrows'];
    expect(queue(learn, ctxOf({ lesson: 3, tour: 0 }))).toEqual(['mouse', 'tab', 'arrows']);
  });

  it('К4: из пяти открытых ни одна из трёх последних не впереди свободной', () => {
    // Ловит: игра из трёх последних обгоняет игру вне них.
    const learn = emptyLearn();
    const day = '2026-11-10';
    for (const id of ['arrows', 'mouse', 'tab', 'keyboard', 'squad']) learn.games[id] = { step: 1, plays: id === 'keyboard' || id === 'squad' ? 9 : 1, best: 1, last: day };
    learn.recent = ['arrows', 'mouse', 'tab'];
    const q = queue(learn, ctxOf({ lesson: 9, tour: 0 }));
    expect(q).toHaveLength(5);
    expect(q.slice(0, 2).sort()).toEqual(['keyboard', 'squad']);
    expect(q.slice(2)).toEqual(['arrows', 'mouse', 'tab']);
  });

  it('К4: при равенстве числа игр раньше та, что давно не игралась', () => {
    // Ловит: порядок по каталогу вместо даты последней игры.
    const learn = emptyLearn();
    learn.games.arrows = { step: 1, plays: 2, best: 1, last: '2026-11-18' };
    learn.games.mouse = { step: 1, plays: 2, best: 1, last: '2026-11-05' };
    expect(queue(learn, ctxOf({ lesson: 2, tour: 0 }))).toEqual(['mouse', 'arrows']);
  });

  it('К4: метка «к Школе» зависит только от того, тренажёр ли игра (хоть серебро, хоть игран)', () => {
    // Ловит: метка пропадает после первой игры тренажёра (057-Р21, кадр e4-brk).
    const learn = emptyLearn();
    for (const id of ['arrows', 'mouse', 'tab', 'keyboard']) learn.games[id] = { step: 1, plays: 9, best: 1, last: '2026-11-18' };
    learn.games.squad = { step: 2, plays: 1, best: 1, last: '2026-11-18' };
    const cards = breakCards(learn, ctxOf({ lesson: 9, tour: 0 }));
    expect(cards.find((c) => c.kind === 'game' && c.id === 'squad')).toEqual({ kind: 'game', id: 'squad', toSchool: true });
  });

  it('К4: перерыв — две разные карточки, тренажёр без бронзы помечен «к Школе»', () => {
    // Ловит: две одинаковые карточки; тренажёр без пометки; пометка у игры без тура.
    const cards = breakCards(emptyLearn(), ctxOf({ lesson: 9, tour: 0 }));
    expect(cards).toHaveLength(2);
    expect(cards[0]!.id).not.toBe(cards[1]!.id);
    const learn = emptyLearn();
    learn.games.arrows = { step: 1, plays: 3, best: 1, last: '2026-11-18' };
    learn.games.mouse = { step: 1, plays: 3, best: 1, last: '2026-11-18' };
    learn.games.tab = { step: 1, plays: 3, best: 1, last: '2026-11-18' };
    learn.games.keyboard = { step: 1, plays: 3, best: 1, last: '2026-11-18' };
    const c = breakCards(learn, ctxOf({ lesson: 9, tour: 0 }));
    expect(c[0]).toEqual({ kind: 'game', id: 'squad', toSchool: true });
    expect(c[1]).toMatchObject({ kind: 'game', toSchool: false });
  });

  it('К4: «золотая» уходит из очереди; «побей рекорд» — только если не-«золотых» меньше двух, без монет; все на золоте — две разные', () => {
    // Ловит: «золотая» в очереди; «золотая» карточка при двух не-«золотых»; вторая карточка пропала при одной.
    const learn = emptyLearn();
    learn.games.arrows = { step: 3, plays: 2, best: 30000, last: '2026-11-10' };
    const ctx = ctxOf({ lesson: 3, tour: 0 });
    expect(queue(learn, ctx)).not.toContain('arrows');
    expect(breakCards(learn, ctx).map((c) => c.kind)).toEqual(['game', 'game']);
    learn.games.mouse = { step: 3, plays: 2, best: 30000, last: '2026-11-11' };
    const one = breakCards(learn, ctx);
    expect(one.map((c) => c.kind)).toEqual(['game', 'record']);
    expect(one[1]).toEqual({ kind: 'record', id: 'arrows', best: 30000 });
    learn.games.tab = { step: 3, plays: 2, best: 30000, last: '2026-11-12' };
    // 067-Р201 (макет Э4.19): все на золоте — две РАЗНЫЕ «побей рекорд», а не одна
    const allGold = breakCards(learn, ctx);
    expect(allGold.map((c) => c.kind)).toEqual(['record', 'record']);
    expect(allGold[0]!.id).not.toBe(allGold[1]!.id);
    expect(breakCards(emptyLearn(), ctxOf({ lesson: 0, tour: 0 }))).toEqual([]);
  });

  it('К4: золотая игра одна на весь перерыв (больше не открыто) — одна карточка «побей рекорд», не две', () => {
    // Ловит: одна и та же золотая дважды при единственной золотой (067-Р201).
    const ctx = ctxOf({ lesson: 1, tour: 0 });
    const learn = emptyLearn();
    const open = baseList(learn, ctx).filter((b) => b.open).map((b) => b.id);
    expect(open).toHaveLength(1);
    learn.games[open[0]!] = { step: 3, plays: 2, best: 30000, last: '2026-11-10' };
    expect(breakCards(learn, ctx)).toEqual([{ kind: 'record', id: open[0], best: 30000 }]);
  });
});

describe('К4: ступени (ТЗ-7.5)', () => {
  it('К4: бронза — доделал, серебро — ≤ 1 промаха, золото — 0 промахов и время ≤ T; не доделал — не засчитано', () => {
    // Ловит: границы ступеней (T включительно, 1 промах — серебро, 2 — бронза); пропуск засчитан.
    const t = GAMES.find((g) => g.id === 'arrows')!.t * 1000;
    expect(stepOf(played('arrows', 0, t))).toBe(3);
    expect(stepOf(played('arrows', 0, t + 1))).toBe(2);
    expect(stepOf(played('arrows', 1, 1))).toBe(2);
    expect(stepOf(played('arrows', 2, 1))).toBe(1);
    expect(stepOf(startLearn('arrows', { now: 0 }, 1))).toBeNull();
  });

  it('К4: ступень за игру не теряется (максимум), рекорд времени — лучшее', () => {
    // Ловит: худшая игра понижает ступень или лучшее время.
    const a = finishLearn(saveOf(), played('arrows', 0, 20000, 1000, 1), ctxOf());
    expect(a.view!.stepAll).toBe(3);
    expect(a.view!.record).toBe(true);
    const b = finishLearn(a.save, played('arrows', 3, 90000, 5000, 2), ctxOf({ now: 5000 }));
    expect(b.save.learn.games.arrows).toMatchObject({ step: 3, plays: 2, best: 20000 });
    expect(b.view!.step).toBe(1);
    expect(b.view!.record).toBe(false);
  });

  it('К4: ступень до игры 2 платит, золото за игру — тоже; следующая игра на золоте — 0 монет', () => {
    // Ловит: граница «золота» монет (prev.step < 3 → stepAll < 3): игра, дающая золото, остаётся без оплаты.
    const learn = emptyLearn();
    learn.games.arrows = { step: 2, plays: 1, best: 90000, last: '2026-11-10' };
    const a = finishLearn(saveOf(learn), played('arrows', 0, 20000, 1000, 1), ctxOf());
    expect(a.view!.stepAll).toBe(3);
    expect(a.view!.coins).toBeGreaterThan(0);
    const b = finishLearn({ ...a.save, wallet: walletDef.empty() }, played('arrows', 0, 20000, 2000, 2), ctxOf({ now: 2000 }));
    expect(b.view!.coins).toBe(0);
  });

  it('К4: ввод после конца игры не меняет запуск', () => {
    // Ловит: промах после финиша портит ступень.
    const run = played('arrows', 0, 1000);
    expect(stepLearn(run, { type: 'miss' })).toBe(run);
  });
});

describe('К4: «Права на компьютер» (ТЗ-7.6)', () => {
  it('К4: карточка — со второй бронзы, не посреди тайма, силуэты всех игр', () => {
    // Ловит: карточка с первой бронзы; показ посреди тайма; без новых умений.
    const learn = emptyLearn();
    learn.games.arrows = { step: 1, plays: 1, best: 1, last: null };
    expect(bronzeCount(learn)).toBe(1);
    expect(rightsCard(learn, true, 'break')).toBeNull();
    learn.games.mouse = { step: 1, plays: 1, best: 1, last: null };
    expect(rightsCard(learn, false, 'break')).toBeNull();
    expect(rightsCard(learn, true, 'half')).toBeNull();
    const card = rightsCard(learn, true, 'break')!;
    expect(card.items).toHaveLength(8);
    expect(card.showMs).toBe(10000);
    expect(card.items.find((i) => i.id === 'arrows')).toMatchObject({ have: true, step: 1 });
    expect(card.items.find((i) => i.id === 'squad')).toEqual({ id: 'squad', have: false, step: 0, tour: 5 });
  });
});

describe('К4: «Права» после конца игры', () => {
  it('К4: вторая бронза — карточка есть; повтор уже бронзовой игры — карточки нет', () => {
    // Ловит: карточка за повтор игры (prev.step === 0 → true) или не выдана на второй бронзе.
    const first = finishLearn(saveOf(), played('arrows', 1, 90000, 1000, 1), ctxOf());
    expect(first.view!.rights).toBeNull();
    const second = finishLearn(first.save, played('mouse', 1, 90000, 2000, 2), ctxOf({ now: 2000 }));
    expect(second.view!.rights).not.toBeNull();
    const again = finishLearn(second.save, played('mouse', 1, 90000, 3000, 3), ctxOf({ now: 3000 }));
    expect(again.view!.rights).toBeNull();
  });
});

describe('К4: ставка (ТЗ-3.3)', () => {
  it('К4: медиана трёх последних, предел 1–6, до первого матча — 2', () => {
    // Ловит: среднее вместо медианы; выход за предел; нет значения по умолчанию.
    expect(rateHundredths([], 1)).toBe(200);
    expect(rateHundredths([10, 500, 60], 1)).toBe(240);
    expect(rateHundredths([999, 10, 60, 60, 60], 1)).toBe(240);
    expect(rateHundredths([5, 5, 5], 1)).toBe(100);
    expect(rateHundredths([5, 5, 5, 60, 60, 60], 1)).toBe(240);
    expect(rateHundredths([900, 900, 900], 1.25)).toBe(600);
  });

  it('К4: при 25…150 зн/мин игра платит как печать ±10 % там, где ставка не упирается в предел', () => {
    // Ловит: неверный множитель или норма: монет в минуту игры не равны 0,8 печати.
    for (const cpm of [60, 90, 120]) {
      const g = GAMES.find((x) => x.id === 'squad')!;
      const perMin = rateHundredths([cpm, cpm, cpm], g.norm) / 100 / g.norm;
      expect(Math.abs(perMin / ((cpm * 0.8) / 20) - 1)).toBeLessThanOrEqual(0.1);
    }
  });
});

describe('К4: конец игры и касса (ТЗ-7.1, 3.3)', () => {
  it('К4: монеты по ставке, остаток копится в сотых', () => {
    // Ловит: дробь теряется; монеты не доходят до кошелька.
    let save = saveOf();
    let total = 0;
    for (let i = 0; i < 5; i++) {
      const ctx = ctxOf({ now: 10000 * (i + 1), speeds: [60, 60, 60] });
      const out = finishLearn(save, played('arrows', 1, 90000, ctx.now, i), ctx);
      total += out.view!.coins;
      save = out.save;
    }
    expect(total).toBe(save.wallet.coins);
    // ставка 2,11 (60 × 0,8 × 0,88 / 20, в сотых округлена) × 5 = 10,55 → 10 монет, остаток 55 сотых
    expect(save.wallet.coins).toBe(10);
    expect(save.learn.rest).toBe(55);
  });

  it('К4: на «золоте» монет нет, рекорд времени пишется', () => {
    // Ловит: платит игра, уже бывшая на золоте (ТЗ-7.1).
    const learn = emptyLearn();
    learn.games.arrows = { step: 3, plays: 2, best: 30000, last: '2026-11-10' };
    const out = finishLearn(saveOf(learn), played('arrows', 0, 25000), ctxOf());
    expect(out.view!.coins).toBe(0);
    expect(out.save.wallet.coins).toBe(0);
    expect(out.view!.record).toBe(true);
    expect(out.save.learn.games.arrows!.best).toBe(25000);
  });

  it('К4: повтор того же запуска — без второй награды; пропуск — без изменений', () => {
    // Ловит: двойной Enter платит дважды; недоделанная игра засчитана.
    const run = played('arrows', 1, 90000);
    const first = finishLearn(saveOf(), run, ctxOf());
    expect(first.view!.coins).toBeGreaterThan(0);
    const again = finishLearn(first.save, run, ctxOf());
    expect(again.view).toBeNull();
    expect(again.save).toBe(first.save);
    const skip = saveOf();
    expect(finishLearn(skip, startLearn('arrows', { now: 5 }, 1), ctxOf()).save).toBe(skip);
  });

  it('К4: последние игры — не больше трёх, без повторов, день записан', () => {
    // Ловит: recent растёт или хранит дубли.
    let save = saveOf();
    for (const [i, id] of ['arrows', 'mouse', 'arrows', 'tab', 'keyboard'].entries()) {
      save = finishLearn(save, played(id, 1, 90000, 1000 + i * 1000, i), ctxOf({ now: 1000 + i * 1000 })).save;
    }
    expect(save.learn.recent).toEqual(['arrows', 'tab', 'keyboard']);
    expect(save.learn.games.arrows!.last).toBe('2026-11-19');
    expect(learnDef.check(save.learn)).toEqual([]);
  });

  it('К4: касса — `learn-coins` в реестре наград с вызовом из learn/finish.ts', () => {
    // Ловит: строка осталась в «запланированных» — страж С1 не сверяет вызов.
    expect(REWARD_SOURCES.find((r) => r.id === 'learn-coins')?.callers).toEqual(['src/engine/learn/finish.ts']);
  });

  it('К4: раздел learn сверяет id игр с learn.json; остаток 0…99', () => {
    // Ловит: чужой id игры в сохранении принят; остаток вне диапазона принят.
    expect(learnDef.check({ games: { ghost: { step: 1, plays: 1, best: null, last: null } }, recent: [] })).toEqual(['games']);
    expect(learnDef.check({ games: {}, recent: ['ghost'] })).toEqual(['recent']);
    expect(learnDef.check({ games: {}, recent: [], rest: 100 })).toEqual(['rest']);
    expect(learnDef.check({ games: {}, recent: [], rest: 99 })).toEqual([]);
  });
});

/** Сеанс-двойник: раздел в переменной, записи считаем. */
function deps(start: LearnSave) {
  const box = { save: start, writes: 0 };
  return {
    box,
    read: () => box.save,
    save: (patch: Record<string, unknown>) => {
      box.writes++;
      box.save = { ...box.save, learn: patch.learn as Learn, wallet: patch.wallet as LearnSave['wallet'] };
      return { ok: true };
    },
  };
}

describe('К4 (067 Т17): сеанс игры на экране — `app/learn/run.ts`', () => {  /** Игра «Tab»: до конца верными шагами (цель достижима Tab-ами), промахи — щелчком мыши. */
  function playTab(missClicks: number, at: number): LearnFlow {
    let flow = beginLearn(openLearn('tab', 'break', ctxOf({ now: 1000 }), 7)!, 1000);
    for (let i = 0; i < missClicks; i++) flow = inputLearn(flow, { game: 'tab', input: 'click' }, 1500);
    for (let guard = 0; guard < 400 && flow.step === 'play'; guard++) {
      const s = (flow.play as { s: { focus: number; target: number } }).s;
      flow = inputLearn(flow, { game: 'tab', input: s.focus === s.target ? 'enter' : 'tab' }, at);
    }
    return flow;
  }

  it('К4: итог пишется один раз — двойной Enter (второй commit) не меняет сохранение, ref = runId', () => {
    // Ловит: двойной Enter на итоге платит и пишет дважды; запись без ref запуска.
    const d = deps(saveOf());
    const end = playTab(1, 1000 + 40000);
    expect(end.step).toBe('end');
    const once = commitLearn(end, d);
    expect(once.view!.coins).toBeGreaterThan(0);
    expect(d.box.writes).toBe(1);
    expect(d.box.save.wallet.paid).toContain(end.run!.id);
    expect(commitLearn(end, d).view).toBeNull(); // тот же итог ещё раз, до перерисовки окна
    expect(d.box.writes).toBe(1);
    expect(commitLearn(once, d)).toBe(once);
    expect(d.box.save.learn.games.tab!.plays).toBe(1);
  });

  it('К4: игра, брошенная посреди (Esc, перезагрузка), ничего не пишет; commit не на итоге — холостой', () => {
    // Ловит: монеты или ступень начислены за недоигранную игру; запись на старте.
    const d = deps(saveOf());
    let flow = beginLearn(openLearn('arrows', 'break', ctxOf(), 3)!, 1000);
    flow = inputLearn(flow, { game: 'arrows', dir: 'right' }, 2000);
    expect(flow.step).toBe('play');
    expect(commitLearn(flow, d)).toBe(flow);
    expect(commitLearn(openLearn('mouse', 'base', ctxOf(), 3)!, d).view).toBeNull();
    expect(d.box.writes).toBe(0);
    expect(d.box.save.wallet.coins).toBe(0);
  });

  it('К4: «золото» — ступень 3 есть, монет 0 (У-З1); рекорд пишется', () => {
    // Ловит: монеты на «золоте» через сеанс экрана (ступень до игры берётся из сохранения, не из окна).
    const learn = emptyLearn();
    learn.games.tab = { step: 3, plays: 4, best: 60000, last: '2026-11-18' };
    const d = deps(saveOf(learn));
    const out = commitLearn(playTab(0, 1000 + 20000), d);
    expect(out.view!.stepAll).toBe(3); // лучшая ступень не падает от плохой игры (здесь Tab всегда вперёд — промахи возможны)
    expect(out.view!.coins).toBe(0);
    expect(d.box.save.wallet.coins).toBe(0);
    expect(d.box.save.learn.games.tab!.best).toBeLessThan(60000);
  });

  it('К4: игра не открыта, не собирается или чужая (Т18) — окно не открывается, экран не падает', () => {
    // Ловит: «Собери клавиатуру» без выученных букв падает на пустом лотке; тренажёр 5–8 открывается окном 1–4.
    expect(openLearn('keyboard', 'base', ctxOf({ learned: [] }), 1)).toBeNull();
    expect(openLearn('keyboard', 'base', ctxOf({ lesson: 5 }), 1)).toBeNull(); // игра с урока 6
    expect(openLearn('squad', 'break', ctxOf(), 1)).not.toBeNull(); // игры 5–8 открывает Т18 (раньше — null: окна не было)
    expect(openLearn('pairs', 'break', ctxOf({ learned: ['ф'] }), 1)).toBeNull(); // «Пары»: нечем собрать
    expect(openLearn('ghost', 'break', ctxOf(), 1)).toBeNull();
    expect(openLearn('keyboard', 'base', ctxOf(), 1)).not.toBeNull();
  });

  it('К4: ctx — скорости из журнала, без них — лучшие скорости уроков; тур — наибольший; буквы — только буквы', () => {
    // Ловит: ставка считается по выдумке; журнал пуст — ставка падает в «2 монеты» вместо лучших скоростей.
    const school = { tours: [{ n: 3, kind: 'x', medal: 1, first: 1, day: '2026-11-01' }, { n: 5, kind: 'y', medal: 1, first: 1, day: '2026-11-02' }] };
    const base = { lesson: 6, keys: 'фыва.1', school, now: 5, day: '2026-11-19' };
    const withJournal = learnCtxOf({ ...base, entries: [{ matchId: 'a', seed: 1, events: [], at: 1, cpm: 31 }], bests: [90] });
    expect(withJournal.speeds).toEqual([31]);
    expect(withJournal.tour).toBe(6); // Р211: до какого тура дошёл ребёнок (пройден 5 → 6)
    expect(withJournal.learned).toEqual(['ф', 'ы', 'в', 'а']);
    expect(learnCtxOf({ ...base, entries: [], bests: [0, 44, 52] }).speeds).toEqual([44, 52]);
  });
});

describe('К4: вид окна учебной игры (067 Т17)', () => {
  it('К4: безошибочный игрок доигрывает каждую из четырёх игр без промаха, итог пишется один раз', () => {
    // Ловит: правила игры и вид разошлись (ввод, который экран шлёт, игра считает промахом или не доводит до конца).
    for (const game of ['arrows', 'mouse', 'tab', 'keyboard']) {
      const d = deps(saveOf());
      const flow = playUntil(beginLearn(openLearn(game, 'break', ctxOf(), 5)!, 1000), 31000);
      expect(flow.step).toBe('end');
      expect(flow.run!.misses).toBe(0);
      expect(flow.run!.ms).toBe(30000);
      const once = commitLearn(flow, d);
      expect(once.view!.coins).toBeGreaterThan(0);
      expect(commitLearn(once, d)).toBe(once);
      expect(d.box.writes).toBe(1);
    }
  });

  it('К4: ступени в игре — одна «лучшая достижимая»; на итоге взятая зелёная, выше неё потеряны', () => {
    expect(playLadder(0)).toEqual(['', '', 'now']);
    expect(playLadder(1)).toEqual(['', 'now', 'lost']);
    expect(playLadder(2)).toEqual(['now', 'lost', 'lost']);
    expect(endLadder(2)).toEqual(['', 'got', 'lost']);
    expect(endLadder(3)).toEqual(['', '', 'got']);
  });

  it('К4: время «0:21», ставка с учётом копилки, ставка не ниже монеты', () => {
    expect(mmss(21999)).toBe('0:21');
    expect(mmss(125000)).toBe('2:05');
    const learn = emptyLearn();
    expect(stakeOf({ speeds: [] }, learn, 'arrows')).toBe(2); // матчей нет — «первая» ставка
    expect(stakeOf({ speeds: [1] }, learn, 'arrows')).toBe(1);
    expect(stakeOf({ speeds: [60, 60, 60] }, { ...learn, rest: 99 }, 'arrows')).toBe(Math.floor((99 + rateHundredths([60, 60, 60], 0.88)) / 100));
  });

  it('К4: промах назван по причине: упор в защитника и в край, шаг не к воротам; Tab — чужой, проскок, не туда, мышь', () => {
    // Ловит: одна общая строка «ошибка» вместо подсказки, что делать.
    const f = beginLearn(openLearn('arrows', 'break', ctxOf(), 9)!, 1000);
    const miss = missInput(f)!;
    const out = inputLearn(f, miss, 2000);
    expect(['arrowsWall', 'arrowsEdge', 'arrowsWorse']).toContain(missOf(f.play!, out.play!, miss)!.kind);
    expect(missOf(f.play!, f.play!, miss)).toBeNull();
    const t = beginLearn(openLearn('tab', 'break', ctxOf(), 9)!, 1000);
    const wrong = inputLearn(t, { game: 'tab', input: 'enter' }, 2000);
    expect(missOf(t.play!, wrong.play!, { game: 'tab', input: 'enter' })).toMatchObject({ kind: 'tabWrong', num: t.play!.game === 'tab' ? t.play!.s.numbers[0] : -1 });
    const click = inputLearn(t, { game: 'tab', input: 'click' }, 2000);
    expect(missOf(t.play!, click.play!, { game: 'tab', input: 'click' })!.kind).toBe('tabMouse');
  });

  it('К4: «Точный пас» — обманки не ближе двух радиусов к цели и мячу, номера партнёров без 7 и не повторяются', () => {
    // Ловит: щелчок по обманке засчитан в радиус цели; игрок № 7 (сам ребёнок) среди партнёров.
    const f = beginLearn(openLearn('mouse', 'break', ctxOf(), 4)!, 1000, 0.57);
    const s = f.play!.game === 'mouse' ? f.play!.s : (undefined as never);
    const seen = new Set<number>();
    for (let at = 0; at < s.steps.length; at++) {
      const v = mouseView(4, { ...s, at });
      expect(v.target.num).not.toBe(7);
      seen.add(v.target.num);
      for (const d of v.decoys) expect(Math.hypot(d.x - v.target.x, (d.y - v.target.y) * s.aspect)).toBeGreaterThan(12 - 1e-9);
      expect(v.decoys.length).toBeGreaterThan(0);
    }
    expect(seen.size).toBe(s.steps.length);
  });

  it('К4: итог — на золоте повтором монет нет и главное рекорд; до доделки итога нет', () => {
    const flow = playUntil(beginLearn(openLearn('tab', 'base', ctxOf(), 2)!, 1000), 1000 + 20000);
    expect(endOf(flow, { step: 3, best: 30000 })).toMatchObject({ goldRepeat: true, was: 30000, coins: 0, tier: 3 });
    expect(endOf(flow, { step: 1, best: null })!.goldRepeat).toBe(false);
    expect(endOf(beginLearn(openLearn('tab', 'base', ctxOf(), 2)!, 1000), { step: 0, best: null })).toBeNull();
  });

  it('К4: кадр стенда — настоящее состояние игры: промахи и время заданы, итог с готовым видом', () => {
    const play = frameFlow({ game: 'tab', place: 'break', step: 'play', misses: 1, elapsedMs: 17000 }, ctxOf(), 7, 50000, 0.57)!;
    expect(play.flow.step).toBe('play');
    expect(play.flow.play!.s.misses).toBe(1);
    expect(play.miss!.kind).toBe('tabWrong');
    expect(50000 - play.flow.run!.startedAt).toBe(17000);
    const end = frameFlow({ game: 'mouse', place: 'base', step: 'end', misses: 1, elapsedMs: 36000 }, ctxOf(), 7, 50000, 0.57)!;
    expect(end.flow.step).toBe('end');
    expect(end.flow.run!.misses).toBe(1);
    expect(end.flow.run!.ms).toBe(36000);
  });
});

describe('К4 (067 Т17, этап 6): вход в учебную игру из перерыва — `app/learn/entry.ts`', () => {
  const facts = (o: Partial<EntryFacts> = {}): EntryFacts => ({ lesson: 1, keys: 'ао', entries: [], now: 1000, day: '2026-11-19', ...o });
  const sections = (learn: Learn = emptyLearn()): Record<string, { data: unknown }> => ({ learn: { data: learn }, 'course:ru': { data: { current: 'ru.yard.ao', lessons: {} } } });
  const gamesOf = (lesson: number, learn: Learn = emptyLearn(), ok = true): string[] => breakGames(sections(learn), ok, facts({ lesson, keys: 'фываолдж' }));

  it('К4: игры перерыва — по текущему уроку (067-Р89): на уроке 1 — одна, дальше открываются по порядку; «золотая» уходит', () => {
    // Ловит: игры открываются по пройденному уроку (на уроке 1 перерыв пуст) или «золотая» игра снова предлагается первой.
    expect(gamesOf(1)).toEqual(['arrows']);
    expect(gamesOf(3)).toEqual(['arrows', 'mouse', 'tab']);
    expect(gamesOf(6)).toContain('keyboard');
    const gold: Learn = { ...emptyLearn(), games: { arrows: { step: 3, plays: 4, best: 20, last: '2026-11-18' } } };
    expect(gamesOf(3, gold)).toEqual(['mouse', 'tab']);
  });

  it('К4: сеанс не `ok` (другая вкладка, новее версия) — входа нет, ни списка, ни окна', () => {
    // Ловит: кнопка игры живёт при сеансе без записи — ребёнок играет, а монеты уходят в никуда.
    expect(gamesOf(3, emptyLearn(), false)).toEqual([]);
    expect(enterBreak(sections(), false, facts({ lesson: 3 }), 5)).toBeNull();
  });

  it('К4: окно — первая игра очереди или названная; чужая и закрытая — нет; «до игры» и ставка зафиксированы на старте', () => {
    // Ловит: «Ещё игра» открывает игру, которой нет в очереди; «золото на повторе» и ставка пересчитываются после записи итога.
    const learn: Learn = { ...emptyLearn(), games: { arrows: { step: 2, plays: 1, best: 41000, last: '2026-11-18' } } };
    const first = enterBreak(sections(learn), true, facts({ lesson: 3 }), 5)!;
    expect(first.flow).toMatchObject({ game: 'mouse', place: 'break', step: 'start' });
    expect(first.nextId).toBe('tab');
    const named = enterBreak(sections(learn), true, facts({ lesson: 3 }), 5, 'arrows')!;
    expect(named.before).toEqual({ step: 2, best: 41000 });
    expect(named.nextId).toBe('mouse');
    expect(enterBreak(sections(learn), true, facts({ lesson: 3 }), 5, 'keyboard')).toBeNull();
    expect(enterBreak(sections(learn), true, facts({ lesson: 3 }), 5, 'ghost')).toBeNull();
    expect(enterBreak(sections(), true, facts({ lesson: 1 }), 5)!.nextId).toBeNull();
  });

  it('К4: запись итога из перерыва — кошелёк и игры из разделов игрока, один раз; без раздела — пустые по описанию', () => {
    // Ловит: монеты игры пишутся в пустой кошелёк вместо кошелька игрока; повторный Enter на итоге платит дважды.
    const box = { save: learnRead({ learn: { data: emptyLearn() }, wallet: { data: { ...walletDef.empty(), coins: 7 } } }) };
    expect(box.save.wallet).toMatchObject({ coins: 7 });
    expect(learnRead(undefined).learn).toEqual(emptyLearn());
    const entry = enterBreak(sections(), true, facts({ lesson: 1 }), 5)!;
    let flow = playUntil(beginLearn(entry.flow, 1000), 20000);
    expect(flow.step).toBe('end');
    const writes: Record<string, unknown>[] = [];
    const deps = { read: () => box.save, save: (p: Record<string, unknown>) => (writes.push(p), { ok: true }) };
    flow = commitLearn(flow, deps);
    expect(commitLearn(flow, deps)).toBe(flow);
    expect(writes).toHaveLength(1);
  });
});
