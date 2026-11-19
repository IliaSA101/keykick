/**
 * Покупка в Лавке (067 Т8, ТЗ-3.6, 3.9): единственный вызывающий `debit` (067-Р24, `DEBIT_CALLERS`). Знает только позиции
 * каталога Двора (`yard.json`); вещь не покупается до своего урока; повтор ничего не списывает; в минус не уходит.
 * Чистая функция: подтверждение («Да») — в экране, здесь уже решённая покупка.
 */
import yard from '../../content/yard.json';
import { debit, type Wallet } from '../rewards/cash';
import type { Shop } from './section';

/** Разделы игрока, которые затрагивает покупка. */
export interface BuySave {
  wallet: Wallet;
  shop: Shop;
}

export interface BuyCtx {
  /** Текущий урок игрока (как `cur` Дома): вещь открыта с урока `from` каталога. */
  cur: number;
}

/** `ok` — куплено; `early` — рано («после урока N»); `coins` — не хватает; `owned` — уже куплено; `unknown` — нет в каталоге (ТЗ-3.6). */
export type BuyResult = 'ok' | 'early' | 'coins' | 'owned' | 'unknown';

export function buy(save: BuySave, itemId: string, ctx: BuyCtx): { save: BuySave; ok: BuyResult } {
  const item = yard.catalog.find((c) => c.id === itemId);
  if (item === undefined) return { save, ok: 'unknown' };
  if (save.shop.bought.includes(itemId)) return { save, ok: 'owned' };
  if (ctx.cur < item.from) return { save, ok: 'early' };
  const paid = debit({ wallet: save.wallet }, 'shop-buy', item.price, `buy-${itemId}`);
  if (paid.result === 'coins') return { save, ok: 'coins' };
  if (paid.result === 'bad') return { save, ok: 'unknown' };
  // `again`: этот `ref` уже оплачен (монеты ушли), а вещи в `bought` нет — дописываем без второго списания.
  return { save: { ...save, wallet: paid.purse.wallet, shop: { ...save.shop, bought: [...save.shop.bought, itemId] } }, ok: 'ok' };
}
