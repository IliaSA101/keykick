/**
 * Транзакция разделов `updatePlayer` (спека 018-Т2, design §4.1): одна запись на разделы, две вкладки, отказы записи.
 * Подготовка — две вкладки на одном хранилище (`twoTabs`). У каждого теста — «Ловит:».
 */
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import type { JournalInput } from '../src/engine/journal/records';
import { section as club } from '../src/engine/club/save';
import { credit, creditPresses, spend, walletKey } from '../src/engine/wallet/wallet';
import { createSaveStore } from '../src/app/save/store';
import { registry } from '../src/app/save/registry';
import { saveContext } from '../src/app/save/instance';
import { matchRules } from '../src/app/match/load';
import { twoTabs } from './saveFixtures';
import { NEXT, TODAY, V1, memory } from './saveStoreHelpers';

type Tabs = ReturnType<typeof twoTabs>;
const lying = (t: Tabs, name: string): unknown => (JSON.parse(t.data.get(t.key) ?? 'null') as { sections: Record<string, unknown> }).sections[name];
const lyingCoins = (t: Tabs): number => (lying(t, 'wallet') as { coins: number }).coins;
const sinkOf = (t: Tabs): Array<{ recs: JournalInput[]; player: string }> => {
  const got: Array<{ recs: JournalInput[]; player: string }> = [];
  t.a.setJournalSink((recs, player) => void got.push({ recs, player }));
  return got;
};

describe('updatePlayer: одна запись и две вкладки', () => {
  // Ловит: покупка двумя записями (монеты ушли, товара нет) и лишние записи при нескольких разделах (Р3).
  it('несколько разделов — одна запись; чтение внутри видит свои записи', () => {
    const t = twoTabs();
    t.a.updatePlayer((tx) => credit(tx, 10, 'prize'));
    const before = t.state.writes;
    const ok = t.a.updatePlayer((tx) => {
      const paid = spend(tx, 4, 'kit');
      tx.set(club, club.sample());
      return paid && tx.get(walletKey).coins === 6;
    });
    expect(ok).toBe(true);
    expect(t.state.writes - before).toBe(1);
    expect(lyingCoins(t)).toBe(6);
    expect(lying(t, 'club')).toEqual(club.sample());
  });

  // Ловит: запись по памяти — касса второй вкладки между чтением и записью первой затёрта (design §8 п. 7).
  it('вторая вкладка зачислила между двумя записями первой — в лежащем оба изменения', () => {
    const t = twoTabs();
    t.a.updatePlayer((tx) => creditPresses(tx, 10, 5, 'match', 'm1'));
    t.b.store.load('p1');
    t.a.updatePlayer((tx) => tx.set(club, club.sample()));
    t.b.updatePlayer((tx) => credit(tx, 7, 'prize'));
    const spent = t.a.updatePlayer((tx) => spend(tx, 3, 'boots'));
    expect(spent).toBe(true);
    expect(lyingCoins(t)).toBe(2 + 7 - 3);
    expect(lying(t, 'club')).toEqual(club.sample());
    expect(t.a.readSection(walletKey).coins).toBe(6);
  });

  // Ловит: трата второй вкладки пропала, потому что первая записала «итог по памяти».
  it('вторая вкладка потратила — зачисление первой ложится сверху лежащего', () => {
    const t = twoTabs();
    t.a.updatePlayer((tx) => credit(tx, 20, 'prize'));
    t.b.store.load('p1');
    t.b.updatePlayer((tx) => spend(tx, 15, 'kit'));
    t.a.updatePlayer((tx) => credit(tx, 5, 'game'));
    expect(lyingCoins(t)).toBe(10);
    expect(lying(t, 'wallet')).toMatchObject({ earned: 25, spent: 15 });
  });

  // Ловит: `tx.get` отдаёт живой объект — правка копии мимо `tx.set` меняет память (К9).
  it('tx.get — копия: в dev заморожена, без заморозки правка копии не доходит до памяти', () => {
    const t = twoTabs();
    t.a.updatePlayer((tx) => credit(tx, 5, 'prize'));
    expect(() =>
      t.a.updatePlayer((tx) => {
        (tx.get(walletKey) as { coins: number }).coins += 100;
      }),
    ).toThrow(TypeError);
    expect(() => {
      (t.a.readSection(walletKey) as { coins: number }).coins += 100;
    }).toThrow(TypeError);
    const loose = twoTabs({ freeze: false });
    loose.a.updatePlayer((tx) => credit(tx, 5, 'prize'));
    loose.a.updatePlayer((tx) => {
      (tx.get(walletKey) as { coins: number }).coins += 100;
    });
    expect(loose.a.readSection(walletKey).coins).toBe(5);
    expect(lyingCoins(loose)).toBe(5);
  });

  // Ловит: запись на каждый вызов, даже если `fn` ничего не изменила, и журнал по пустой записи.
  it('fn ничего не изменила — записи и журнала нет', () => {
    const t = twoTabs();
    const got = sinkOf(t);
    const w = t.state.writes;
    t.a.updatePlayer((tx) => {
      spend(tx, 5, 'kit'); // не хватает — ничего не пишет
      credit(tx, 0, 'prize');
    });
    expect(t.state.writes).toBe(w);
    expect(got).toEqual([]);
  });

  // Ловит: игрок берётся в момент записи, а не при старте матча (018-Р17, «смена игрока посреди матча»).
  it('{ player } — запись в закреплённого игрока, даже если текущий сменился', () => {
    const t = twoTabs();
    t.a.store.create('p2');
    t.cur.value = 'p2';
    t.a.updatePlayer((tx) => credit(tx, 9, 'match'), { player: 'p1' });
    expect(lyingCoins(t)).toBe(9);
    expect(t.a.store.memory('p2')?.wallet).toMatchObject({ coins: 0 });
    expect(t.a.readSection(walletKey).coins).toBe(0);
  });
});

describe('updatePlayer: журнал, ошибки, отказы записи', () => {
  // Ловит: журнал до записи или дважды — монета в журнале без монеты в кошельке.
  it('tx.log уходит после записи, одной пачкой', () => {
    const t = twoTabs();
    const got = sinkOf(t);
    t.a.updatePlayer((tx) => {
      credit(tx, 3, 'prize', 'r1');
      spend(tx, 1, 'kit');
      expect(got).toEqual([]);
    });
    expect(got).toHaveLength(1);
    expect(got[0]?.player).toBe('p1');
    expect(got[0]?.recs.map((r) => r.kind)).toEqual(['coin', 'spend']);
  });

  // Ловит: исключение внутри транзакции оставляет полузапись или журнал о несбывшемся.
  it('fn бросила — ни записи, ни журнала, память прежняя', () => {
    const t = twoTabs();
    t.a.updatePlayer((tx) => credit(tx, 4, 'prize'));
    const got = sinkOf(t);
    const w = t.state.writes;
    expect(() =>
      t.a.updatePlayer((tx) => {
        credit(tx, 100, 'prize');
        throw new Error('сбой');
      }),
    ).toThrow('сбой');
    expect(t.state.writes).toBe(w);
    expect(got).toEqual([]);
    expect(t.a.readSection(walletKey).coins).toBe(4);
    expect(lyingCoins(t)).toBe(4);
  });

  // Ловит: сохранение новее программы переписано (readOnly), журнал о несохранённом.
  it('readOnly (newer): ничего не пишется, журнал отброшен, результат считается вхолостую', () => {
    const t = twoTabs();
    t.a.updatePlayer((tx) => credit(tx, 4, 'prize'));
    const newer = { ...(JSON.parse(t.data.get(t.key) ?? '') as object), format: 999 };
    t.data.set(t.key, JSON.stringify(newer));
    const text = t.data.get(t.key);
    const got = sinkOf(t);
    const ok = t.a.updatePlayer((tx) => spend(tx, 1, 'kit'));
    expect(ok).toBe(true);
    expect(t.data.get(t.key)).toBe(text);
    expect(got).toEqual([]);
    expect(t.a.readSection(walletKey).coins).toBe(4);
  });

  // Ловит: хранилище полное — память «впереди» лежащего, а `rev` памяти уходит вперёд: вторая запись теряется (014 §5).
  it('storageFull: две записи подряд обе в памяти; журнал пишется; место появилось — оба в лежащем', () => {
    const t = twoTabs();
    t.state.quota = 0;
    const got = sinkOf(t);
    t.a.updatePlayer((tx) => credit(tx, 3, 'prize'));
    t.a.updatePlayer((tx) => credit(tx, 4, 'prize'));
    expect(t.a.readSection(walletKey).coins).toBe(7);
    expect(t.a.store.status().storageFull).toBe(true);
    expect(lyingCoins(t)).toBe(0);
    expect(got).toHaveLength(2);
    t.state.quota = undefined;
    t.a.updatePlayer((tx) => credit(tx, 1, 'prize'));
    expect(lyingCoins(t)).toBe(8);
    expect(t.a.readSection(walletKey).coins).toBe(8);
  });

  // Ловит: хранилище не читается — запись пошла бы вслепую поверх лежащего; память при этом должна жить.
  it('хранилище не читается — ход в памяти, лежащее не тронуто', () => {
    const t = twoTabs();
    t.a.updatePlayer((tx) => credit(tx, 2, 'prize'));
    t.state.unreadable = true;
    const w = t.state.writes;
    t.a.updatePlayer((tx) => credit(tx, 5, 'prize'));
    expect(t.state.writes).toBe(w);
    expect(t.a.readSection(walletKey).coins).toBe(7);
    t.state.unreadable = false;
    expect(lyingCoins(t)).toBe(2);
  });

  // Ловит: режим v1 (`keykick.`, сын; только чтение, Р34) получает новые ключи или разделы v2 в файле сына; журнал в нём не пишется.
  it('v1: ни одного нового ключа, ключи сына не тронуты, журнала нет, ход не копится', () => {
    const t = twoTabs({ prefix: V1, channel: 'release' });
    const keys = [...t.data.keys()].sort();
    const text = t.data.get(t.key);
    const got = sinkOf(t);
    t.a.updatePlayer((tx) => credit(tx, 6, 'prize'));
    expect([...t.data.keys()].sort()).toEqual(keys);
    expect(t.data.get(t.key)).toBe(text);
    expect(got).toEqual([]);
    // Только чтение (Р34): ход не пишется и не копится — как при `newer`.
    expect(t.a.readSection(walletKey).coins).toBe(0);
  });
});

describe('sectionRef и canWrite', () => {
  // Ловит: экран держит старые монеты после своей же записи (нет refreshRefs в updatePlayer).
  it('sectionRef после updatePlayer показывает новые монеты', () => {
    const t = twoTabs();
    const coins = t.a.sectionRef(walletKey);
    expect(coins.value.coins).toBe(0);
    t.a.updatePlayer((tx) => credit(tx, 5, 'prize'));
    expect(coins.value.coins).toBe(5);
  });

  // Ловит: sectionRef привязан к игроку на момент создания и не следит за сменой текущего.
  it('смена cur.id переключает значение sectionRef', async () => {
    const t = twoTabs();
    t.a.updatePlayer((tx) => credit(tx, 5, 'prize'));
    const coins = t.a.sectionRef(walletKey);
    t.a.store.create('p2');
    t.cur.value = 'p2';
    await nextTick();
    expect(coins.value.coins).toBe(0);
    t.cur.value = 'p1';
    await nextTick();
    expect(coins.value.coins).toBe(5);
  });

  // Ловит: чужая вкладка записала, а sectionRef показывает старое (подписка follow → refreshRefs).
  it('другая вкладка записала — после follow значение новое', () => {
    const t = twoTabs();
    const coins = t.a.sectionRef(walletKey);
    t.b.updatePlayer((tx) => credit(tx, 8, 'prize'));
    t.notify(t.key);
    expect(coins.value.coins).toBe(8);
  });

  // Ловит: запись и журнал по игроку, удалённому в другой вкладке (слой 014 отдаёт null, `fn` не зовётся).
  it('игрок удалён (setHasPlayer) — нет записи и журнала', () => {
    const t = twoTabs();
    t.a.store.create('p2');
    t.a.store.setHasPlayer((id) => id !== 'p2');
    t.data.delete(`${t.key.replace('p1', 'p2')}`);
    const got = sinkOf(t);
    const w = t.state.writes;
    t.a.updatePlayer((tx) => credit(tx, 3, 'prize'), { player: 'p2' });
    expect(t.state.writes).toBe(w);
    expect(got).toEqual([]);
  });

  // Ловит (014-Р19, п. 1): расчёт вхолостую по удалённому игроку идёт через `load` — тот пишет снимок дня или карантин в хранилище.
  it.each([
    ['ключ лежит', (t: Tabs): string => t.data.get(t.key) ?? ''],
    ['ключ битый', (): string => '{не json'],
  ])('игрок удалён и не в памяти вкладки, %s — расчёт вхолостую, хранилище побайтно прежнее', (_name, text) => {
    const t = twoTabs();
    const key2 = t.key.replace('p1', 'p2');
    t.data.set(key2, text(t));
    t.a.store.setHasPlayer((id) => id !== 'p2');
    expect(t.a.store.memory('p2')).toBeUndefined();
    const before = new Map(t.data);
    const w = t.state.writes;
    const coins = t.a.updatePlayer((tx) => (credit(tx, 3, 'prize'), tx.get(walletKey).coins), { player: 'p2' });
    expect(coins).toBe(3);
    expect(t.state.writes).toBe(w);
    expect([...t.data]).toEqual([...before]);
  });

  // Ловит: canWrite разрешает запись при readOnly или без игрока.
  it('canWrite: false при readOnly и без игрока', () => {
    const t = twoTabs();
    expect(t.a.canWrite()).toBe(true);
    t.cur.value = null;
    expect(t.a.canWrite()).toBe(false);
    t.cur.value = 'p1';
    const newer = { ...(JSON.parse(t.data.get(t.key) ?? '') as object), format: 999 };
    t.data.set(t.key, JSON.stringify(newer));
    t.a.updatePlayer((tx) => credit(tx, 1, 'prize'));
    expect(t.a.canWrite()).toBe(false);
  });
});

describe('кошелёк: coinPer из правил матча в контексте сохранения (018-Р20)', () => {
  // Ловит: контекст приложения без coinPer — зажим остатка нажатий молчит, остаток выше «монеты» остаётся в сохранении
  // после уменьшения ставки; или чинится без копии repair.
  it('лежащий остаток выше coinPer − 1 → при загрузке зажим до coinPer − 1 и repair', () => {
    const per = matchRules.coinPer;
    expect(saveContext.coinPer).toBe(per);
    const key = `${NEXT}save.p1`;
    const mk = (init: Record<string, string> = {}) => {
      const m = memory(init);
      const store = createSaveStore({ prefix: NEXT, channel: 'next', storage: m.io, sections: registry, now: () => 1_800_000_000_000, today: () => TODAY, app: '0.10.1', ctx: saveContext });
      return { ...m, store };
    };
    const first = mk();
    first.store.create('p1');
    const env = JSON.parse(first.data.get(key) ?? '') as { sections: { wallet: { pressRest: number } } };
    env.sections.wallet.pressRest = per + 3;
    const text = JSON.stringify(env);
    const second = mk({ [key]: text });
    const loaded = second.store.load('p1') as { wallet: { pressRest: number; coins: number } } | null;
    expect(loaded?.wallet.pressRest).toBe(per - 1);
    expect(second.data.get(`${NEXT}pre.p1.repair.${TODAY}`)).toBe(text);
    expect(second.store.events().some((e) => e.text.startsWith('repair p1'))).toBe(true);
    // Остаток внутри предела не трогается.
    env.sections.wallet.pressRest = per - 1;
    const third = mk({ [key]: JSON.stringify(env) });
    expect((third.store.load('p1') as { wallet: { pressRest: number } } | null)?.wallet.pressRest).toBe(per - 1);
    expect(third.data.has(`${NEXT}pre.p1.repair.${TODAY}`)).toBe(false);
  });
});
