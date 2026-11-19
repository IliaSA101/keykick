/**
 * Вход экрана Лавки (067 Т12, ТЗ-3.6–3.10, 3.15; кадры Э2К.01–04): вещи каталога Двора в четырёх состояниях и мечта. Чистые функции
 * от входа Дома (`HomeInput`: урок, монеты, купленное — одно место, `app/home/input.ts`); покупка — `engine/shop/buy` (единственное
 * списание, `ref` покупки не даёт второго списания при двойном Enter). Ни хранилища, ни часов, ни Vue.
 */
import yard from '../../content/yard.json';
import { dreamOf, type HomeInput } from '../../engine/home';
import type { Wallet } from '../../engine/rewards/section';
import { ru } from '../../i18n/ru';
import { buy, type BuyResult } from '../../engine/shop/buy';
import type { Shop } from '../../engine/shop/section';

/** `bought` — куплено · `can` — хватает монет · `save` — не хватает («ещё N») · `later` — ещё рано («с урока N»). */
export type ItemState = 'bought' | 'can' | 'save' | 'later';

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  from: number;
  state: ItemState;
  /** Сколько монет не хватает (0, если хватает). */
  left: number;
}

export interface ShopView {
  items: ShopItem[];
  /** Мечта (ТЗ-3.7); нет — всё куплено. */
  dream: ShopItem | null;
  /** Всё для двора куплено. */
  all: boolean;
}

export function shopView(i: HomeInput): ShopView {
  const items = yard.catalog.map((c): ShopItem => {
    const state: ItemState = i.bought.includes(c.id) ? 'bought' : i.cur < c.from ? 'later' : i.coins >= c.price ? 'can' : 'save';
    return { id: c.id, name: c.name, price: c.price, from: c.from, state, left: Math.max(0, c.price - i.coins) };
  });
  const d = dreamOf(i);
  const dream = d.kind === 'done' ? null : (items.find((x) => x.id === d.item) ?? null);
  return { items, dream, all: items.every((x) => x.state === 'bought') };
}

/** Что записать после «Купить»: разделы `wallet` и `shop`; не куплено (рано, мало монет, уже куплено) — записывать нечего. */
export function buyPatch(have: { wallet: Wallet; shop: Shop }, id: string, cur: number): { ok: BuyResult; patch: { wallet: Wallet; shop: Shop } | null } {
  const r = buy(have, id, { cur });
  return { ok: r.ok, patch: r.ok === 'ok' ? { wallet: r.save.wallet, shop: r.save.shop } : null };
}

/** Сумма в монетах с неразрывным пробелом: «30 монет» не рвётся на две строки. */
export const coin = (n: number): string => `${n}${String.fromCharCode(160)}${ru.shop.coin}`;
