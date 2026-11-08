/**
 * Касса и раздел `wallet` (спека 018-Т9, design §4.2, К2, К16): разбор остатков, зачисление, трата, цепочка.
 * Ловит у каждого теста — строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { courseLessons, leagues } from '../src/app/course/load';
import { keymap } from '../src/app/keymap';
import type { JournalInput } from '../src/engine/journal/records';
import { createRandom } from '../src/engine/random';
import type { Catalog, SectionTx } from '../src/engine/save/section';
import { TASK_NO_MAX } from '../src/engine/tasks';
import { section as walletSection } from '../src/engine/wallet/save';
import { credit, creditPresses, creditStake, spend } from '../src/engine/wallet/wallet';

/** Каталог из настоящего контента (как в `saveSections.test.ts`). */
const cat: Catalog = {
  lessonIds: courseLessons.map((l) => l.id),
  leagueIds: leagues.map((l) => l.id),
  keyCodes: [...keymap.byCode.keys()],
  taskNoMax: TASK_NO_MAX,
};

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Глубокая заморозка: запись в копию `tx.get` бросает в тесте (018-Р16). */
function freeze<T>(v: T): T {
  if (v !== null && typeof v === 'object') Object.values(v).forEach(freeze);
  return Object.freeze(v);
}

/** Транзакция на памяти: один раздел кошелька, `get` — замороженная копия, `set` и `log` записываются для проверки. */
function memTx(start = walletSection.empty({})) {
  const state = { wallet: start, sets: 0, logs: [] as JournalInput[] };
  const tx: SectionTx = {
    get: <T>() => freeze(JSON.parse(JSON.stringify(state.wallet)) as T) as never,
    set: (_def, value) => {
      state.wallet = JSON.parse(JSON.stringify(value)) as typeof state.wallet;
      state.sets++;
    },
    log: (rec) => state.logs.push(rec),
  };
  return { tx, state };
}

describe('wallet: разбор (К2)', () => {
  const parseW = (raw: unknown, coinPer?: number) => walletSection.parse(raw, coinPer === undefined ? {} : { coinPer });
  const w = { coins: 140, pressRest: 7, stakeRest: 40, earned: 200, spent: 60 };

  // Ловит: битый остаток (вне 0…coinPer−1, дробный, отрицательный, не число) чеканит монету или проходит как есть.
  it('остаток зажимается, монеты не растут', () => {
    expect(parseW({ ...w, pressRest: 25 }, 20)).toEqual({ ...w, pressRest: 19 });
    expect(parseW({ ...w, pressRest: 3.7 }, 20).pressRest).toBe(3);
    expect(parseW({ ...w, pressRest: -1 }, 20).pressRest).toBe(0);
    expect(parseW({ ...w, pressRest: 'x', stakeRest: NaN }, 20)).toMatchObject({ pressRest: 0, stakeRest: 0, coins: 140 });
    expect(parseW({ ...w, stakeRest: 150 }).stakeRest).toBe(99);
    expect(parseW({ ...w, pressRest: 5e9 }).pressRest).toBe(1_000_000);
  });

  // Ловит: смена coinPer (25 → 20) оставляет остаток 22 выше предела или переводит его в монеты.
  it('coinPer уменьшили: остаток 22 → 19 без монет', () => {
    const before = parseW({ ...w, pressRest: 22 }, 25);
    expect(before.pressRest).toBe(22);
    const after = parseW(before, 20);
    expect(after).toEqual({ ...w, pressRest: 19 });
    expect(after.coins).toBe(before.coins);
  });

  // Ловит: coins ≠ earned − spent остаётся в сохранении; чинит именно earned, а не монеты ребёнка.
  it('coins = earned − spent: расхождение чинит earned', () => {
    expect(parseW({ ...w, earned: 5 })).toEqual(w);
    expect(parseW({ ...w, coins: -4, earned: 9, spent: 2 })).toMatchObject({ coins: 0, spent: 2, earned: 2 });
  });

  // Ловит: check не видит расхождение монет (цепочки ТЗ-13.8 не поймают чужую запись), счётчики не те.
  it('check краснеет на coins ≠ earned − spent', () => {
    expect(walletSection.check(w, cat)).toEqual([]);
    expect(walletSection.check({ ...w, coins: 141 }, cat)).toHaveLength(1);
    expect(walletSection.counters(w)).toEqual({ earned: 200, spent: 60 });
  });
});

describe('касса: зачисление и трата (К2, К16)', () => {
  // Ловит: остаток нажатий теряется между матчами или монета чеканится не за `per` нажатий; журнал без `coin`.
  it('creditPresses: 45 нажатий по 20 — 2 монеты и остаток 5; остаток копится', () => {
    const { tx, state } = memTx();
    expect(creditPresses(tx, 45, 20, 'match', 'm1')).toEqual({ coins: 2, rest: 5 });
    expect(state.wallet).toEqual({ coins: 2, pressRest: 5, stakeRest: 0, earned: 2, spent: 0 });
    expect(state.logs).toEqual([{ kind: 'coin', data: { source: 'match', coins: 2, ref: 'm1' } }]);
    expect(creditPresses(tx, 15, 20, 'match')).toEqual({ coins: 1, rest: 0 });
    expect(state.logs[1]).toEqual({ kind: 'coin', data: { source: 'match', coins: 1 } });
  });

  // Ловит: при нуле монет в журнал идёт `coin` с нулём (метрики источников засорены); остаток не записывается.
  it('creditPresses: монеты нет — остаток записан, журнала нет', () => {
    const { tx, state } = memTx();
    expect(creditPresses(tx, 7, 20, 'match')).toEqual({ coins: 0, rest: 7 });
    expect(state.wallet.pressRest).toBe(7);
    expect(state.logs).toEqual([]);
  });

  // Ловит: мусор (отрицательное, дробь, NaN, per = 0) роняет кассу или чеканит монеты.
  it('мусорные n, per, cost — ноль, без броска и записи', () => {
    const { tx, state } = memTx({ coins: 10, pressRest: 3, stakeRest: 0, earned: 10, spent: 0 });
    for (const n of [-5, NaN, Infinity]) expect(creditPresses(tx, n, 20, 'match').coins).toBe(0);
    expect(creditPresses(tx, 50, 0, 'match')).toEqual({ coins: 0, rest: 3 });
    expect(creditPresses(tx, 50, 2.5, 'match').coins).toBe(0);
    credit(tx, -3, 'prize');
    credit(tx, NaN, 'prize');
    expect(creditStake(tx, -1, 'game')).toBe(0);
    expect(state.sets).toBe(0);
    expect(state.logs).toEqual([]);
    expect(state.wallet.coins).toBe(10);
  });

  // Ловит: призовые или ставка не попадают в `earned` и журнал; остаток сотых теряется.
  it('credit и creditStake: earned растёт, ставка копит сотые', () => {
    const { tx, state } = memTx();
    credit(tx, 30, 'prize', 'milestone-1');
    expect(state.wallet).toMatchObject({ coins: 30, earned: 30 });
    expect(creditStake(tx, 80, 'game')).toBe(0);
    expect(creditStake(tx, 70, 'game')).toBe(1);
    expect(state.wallet).toMatchObject({ coins: 31, stakeRest: 50, earned: 31 });
    expect(state.logs.map((l) => l.kind)).toEqual(['coin', 'coin']);
  });

  // Ловит: зачисление выше потолка кошелька — при следующей загрузке разбор зажмёт монеты, а касса вела бы учёт сверх них.
  it('credit у потолка: зачисляется только до COIN_MAX, журнал — по факту', () => {
    const top = 1_000_000_000;
    const { tx, state } = memTx({ coins: top - 5, pressRest: 0, stakeRest: 0, earned: top - 5, spent: 0 });
    credit(tx, 100, 'prize');
    expect(state.wallet).toMatchObject({ coins: top, earned: top });
    expect(state.logs).toEqual([{ kind: 'coin', data: { source: 'prize', coins: 5 } }]);
    expect(walletSection.parse(json(state.wallet), {})).toEqual(state.wallet);
  });

  // Ловит: остаток нажатий выше per − 1 (битый pressRest, не прошедший разбор) чеканит монеты сверх честных (К2, 018-Р20).
  it('creditPresses: остаток ≥ per не чеканит — зажимается до per − 1', () => {
    const { tx, state } = memTx({ coins: 0, pressRest: 5e9, stakeRest: 0, earned: 0, spent: 0 });
    // Честно за 1 нажатие при остатке per − 1 = 19 выходит ровно одна монета, а не миллионы.
    expect(creditPresses(tx, 1, 20, 'match')).toEqual({ coins: 1, rest: 0 });
    expect(state.wallet).toMatchObject({ coins: 1, earned: 1, pressRest: 0 });
    const again = memTx({ coins: 0, pressRest: 20, stakeRest: 0, earned: 0, spent: 0 });
    expect(creditPresses(again.tx, 1, 20, 'match').coins).toBe(1);
    expect(again.state.wallet.pressRest).toBe(0);
    const low = memTx({ coins: 0, pressRest: 5e9, stakeRest: 0, earned: 0, spent: 0 });
    expect(creditPresses(low.tx, 0, 20, 'match').coins).toBe(0);
  });

  // Ловит: негодная цена (NaN, минус, дробь, бесконечность) отдаёт товар даром или пишет; ноль перестал быть «можно» (018-Р20).
  it('spend: негодная цена — false без записи; spend(0) — true без записи', () => {
    const { tx, state } = memTx({ coins: 10, pressRest: 0, stakeRest: 0, earned: 10, spent: 0 });
    for (const bad of [NaN, -5, 2.5, Infinity, -Infinity]) expect(spend(tx, bad, 'x'), String(bad)).toBe(false);
    expect(spend(tx, 0, 'x')).toBe(true);
    expect(state.sets).toBe(0);
    expect(state.logs).toEqual([]);
    expect(state.wallet.coins).toBe(10);
  });

  // Ловит: трата уходит в минус или пишет при нехватке; в журнале нет списания.
  it('spend: не хватает — false и ничего не пишет; хватает — coins вниз, spent вверх, журнал', () => {
    const { tx, state } = memTx({ coins: 50, pressRest: 0, stakeRest: 0, earned: 80, spent: 30 });
    expect(spend(tx, 51, 'pack')).toBe(false);
    expect(state.sets).toBe(0);
    expect(state.logs).toEqual([]);
    expect(spend(tx, 50, 'pack')).toBe(true);
    expect(state.wallet).toEqual({ coins: 0, pressRest: 0, stakeRest: 0, earned: 80, spent: 80 });
    expect(state.logs).toEqual([{ kind: 'spend', data: { cost: 50, what: 'pack' } }]);
    expect(walletSection.check(state.wallet, cat)).toEqual([]);
  });

  // Ловит: касса пишет в `tx.get` (копия заморожена — запись бросит) или нарушает `coins = earned − spent` на цепочке.
  it('случайная цепочка: инвариант держится, tx.get не мутируется', () => {
    const rnd = createRandom(18009);
    const { tx, state } = memTx();
    for (let i = 0; i < 300; i++) {
      const r = rnd();
      if (r < 0.4) creditPresses(tx, Math.floor(rnd() * 60), 20, 'match');
      else if (r < 0.6) credit(tx, Math.floor(rnd() * 40), 'prize');
      else if (r < 0.8) creditStake(tx, Math.floor(rnd() * 150), 'game');
      else spend(tx, Math.floor(rnd() * 80), 'x');
      expect(walletSection.check(state.wallet, cat), `шаг ${i}`).toEqual([]);
      expect(state.wallet.pressRest).toBeLessThan(20);
      expect(state.wallet.stakeRest).toBeLessThan(100);
    }
  });
});
