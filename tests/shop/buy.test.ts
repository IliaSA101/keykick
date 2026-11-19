/**
 * К6: покупка в Лавке (067 Т8, ТЗ-3.6, 3.9). У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import yard from '../../src/content/yard.json';
import { walletDef } from '../../src/engine/rewards/section';
import { buy, type BuySave } from '../../src/engine/shop/buy';
import { shopDef } from '../../src/engine/shop/section';
import { buyPatch, shopView } from '../../src/app/shop/input';

const save = (coins: number, bought: string[] = []): BuySave => ({ wallet: { ...walletDef.empty(), coins }, shop: { bought } });
const sticker = yard.catalog[0]!;

describe('К6: покупка', () => {
  it('К6: куплено — монеты списаны ровно на цену, вещь в `bought`', () => {
    // Ловит: списание не той суммы, вещь не записана.
    const r = buy(save(100), sticker.id, { cur: sticker.from });
    expect(r.ok).toBe('ok');
    expect(r.save.wallet.coins).toBe(100 - sticker.price);
    expect(r.save.shop.bought).toEqual([sticker.id]);
  });

  it('К6: двойной вызов — списано один раз, второй — «owned»', () => {
    // Ловит: двойное списание на двойном щелчке (ТЗ-3.9).
    const a = buy(save(100), sticker.id, { cur: 30 });
    const b = buy(a.save, sticker.id, { cur: 30 });
    expect(b.ok).toBe('owned');
    expect(b.save).toBe(a.save);
    expect(b.save.wallet.coins).toBe(100 - sticker.price);
  });

  it('К6: мало монет — «coins», списания нет, в минус не уходит', () => {
    // Ловит: уход монет в минус, покупка без денег.
    const s = save(sticker.price - 1);
    expect(buy(s, sticker.id, { cur: 30 })).toEqual({ save: s, ok: 'coins' });
  });

  it('К6: рано (урок раньше `from`) — «early», списания нет; чужой id — «unknown»', () => {
    // Ловит: покупка до своей ступени; покупка вне каталога (ТЗ-3.6: путь, звёзды, паки не продаются).
    const s = save(1000);
    expect(buy(s, sticker.id, { cur: sticker.from - 1 })).toEqual({ save: s, ok: 'early' });
    expect(buy(s, 'pack', { cur: 30 })).toEqual({ save: s, ok: 'unknown' });
  });

  it('К6: вещь уже в `bought`, `paid` пуст — «owned», монеты не тронуты', () => {
    // Ловит: повторное списание за уже купленную вещь после потери списка `paid`.
    const s = save(100, [sticker.id]);
    const r = buy(s, sticker.id, { cur: 30 });
    expect(r.ok).toBe('owned');
    expect(r.save.wallet.coins).toBe(100);
  });

  it('К6: `ref` уже оплачен, вещи нет в `bought` — вещь дописана, второго списания нет', () => {
    // Ловит: монеты ушли, а вещи нет (сбой между списанием и записью `bought`, `again` отдавал «owned»).
    const s: BuySave = { wallet: { ...walletDef.empty(), coins: 50, paid: [`buy-${sticker.id}`] }, shop: { bought: [] } };
    const r = buy(s, sticker.id, { cur: 30 });
    expect(r.ok).toBe('ok');
    expect(r.save.shop.bought).toEqual([sticker.id]);
    expect(r.save.wallet.coins).toBe(50);
  });

  it('К6: плохая цена в каталоге (`bad`) — «unknown», сохранение не тронуто', () => {
    // Ловит: `bad` из кассы выдан за «owned» — вещь пропадала молча.
    const s = save(100);
    const bad = { ...sticker, price: 0 };
    const spy = yard.catalog.indexOf(sticker);
    yard.catalog[spy] = bad;
    try {
      expect(buy(s, sticker.id, { cur: 30 })).toEqual({ save: s, ok: 'unknown' });
    } finally {
      yard.catalog[spy] = sticker;
    }
  });

  it('К6: `shop.check` пускает результат покупки', () => {
    // Ловит: покупка пишет в раздел то, что его check отвергает.
    const r = buy(save(1000), sticker.id, { cur: 30 });
    expect(shopDef.check(r.save.shop)).toEqual([]);
  });
});

describe('К6: экран Лавки (067 Т12)', () => {
  const at = (cur: number, coins: number, bought: string[] = []) => shopView({ cur, day: 5, coins, bought } as Parameters<typeof shopView>[0]);
  it('К6 состояния: куплено · хватает · «ещё N» · «с урока N»', () => {
    // Ловит: путаницу состояний (кнопка «Купить» у недоступной вещи, «рано» принято за «мало монет»).
    const v = at(9, 45, ['gate-sticker']);
    const st = (id: string) => v.items.find((x) => x.id === id)!;
    expect(st('gate-sticker').state).toBe('bought');
    expect(st('center-circle').state).toBe('can');
    expect(st('boots-yard')).toMatchObject({ state: 'save', left: 75 });
    expect(st('drum')).toMatchObject({ state: 'later', from: 18 });
    expect(at(9, 999).items.find((x) => x.id === 'drum')).toMatchObject({ state: 'later', from: 18 }); // рано при любых монетах
  });

  it('К6 всё куплено: мечты нет, «всё» истинно', () => {
    // Ловит: пустую мечту при полной витрине (кадр Э2К.04).
    const v = at(33, 500, yard.catalog.map((c) => c.id));
    expect(v.all).toBe(true);
    expect(v.dream).toBeNull();
    expect(at(17, 0).all).toBe(false);
  });

  it('К6 двойной Enter: вторая покупка той же вещи не пишет ничего', () => {
    // Ловит: двойное списание на повторном «Купить» (запись только при ok).
    const have = save(100);
    const first = buyPatch(have, sticker.id, 30);
    expect(first.ok).toBe('ok');
    const again = buyPatch({ ...have, ...first.patch! }, sticker.id, 30);
    expect(again).toEqual({ ok: 'owned', patch: null });
    expect(buyPatch(save(1), sticker.id, 30).patch).toBeNull();
  });
});
