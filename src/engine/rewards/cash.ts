/**
 * Касса наград (ТЗ-0.3, 3.1, 3.4; страж С1): единственное место, где растут монеты (`wallet`) и «Знаток» (`school.knower`).
 * Чистая функция: хранилища и часов нет. Звать её может только файл из `callers` награды (`sources.ts`).
 */
import cfg from '../../content/match.json';
import type { Album } from '../album/section';
import type { Stadium } from '../home/section';
import type { School } from '../school/section';
import { PAID_KEEP, type Wallet } from './section';
import type { RewardId } from './sources';

/** Тип кошелька для читающих: сам раздел (section.ts) импортирует только касса (страж С1). */
export type { Wallet } from './section';

export interface Purse {
  wallet: Wallet;
  school: School;
  stadium: Stadium;
}

/** Кошелёк с альбомом: нужен только наградам `lesson-pack` и `cup-pack` (`packs`), остальным источникам альбом не нужен. */
export type AlbumPurse = Purse & { album: Album };

/** Идентификатор в список оплаченных (последние `PAID_KEEP`); пустой — не запоминаем. */
const remember = (w: Wallet, ref: string): string[] => (ref === '' ? w.paid : [...w.paid.filter((p) => p !== ref), ref].slice(-PAID_KEEP));

/**
 * Начисление за `n` единиц события. Болельщики (`match-fans`): `n` — верные нажатия матча, по болельщику за нажатие, остатка нет. Монеты (`match-coins`, `minute-coins`): `n` — верные нажатия, 1 монета за `coinPer`,
 * остаток копится; `ref` — идентификатор матча или минуты, его запоминает кошелёк. `penalty-knower`, `tour-knower`: `n` — верные задачи. `kicks-knower`: то же, `ref` — тур «штрафных», его запоминает кошелёк (повтор не платит). `learn-coins`: `n` — готовые монеты (ставку считает игра, ТЗ-3.3). `lesson-pack`, `cup-pack`: `n` — паки (урок и раунд Кубка).
 * Возвращает новый кошелёк и сколько целых единиц получено сейчас.
 */
export function credit<P extends AlbumPurse>(purse: P, id: 'lesson-pack' | 'cup-pack', n: number, ref?: string): { purse: P; gain: number };
export function credit<P extends Purse>(purse: P, id: Exclude<RewardId, 'lesson-pack' | 'cup-pack'>, n: number, ref?: string): { purse: P; gain: number };
export function credit(purse: Purse & { album?: Album }, id: RewardId, n: number, ref = ''): { purse: Purse & { album?: Album }; gain: number } {
  const count = Math.max(0, Math.floor(n));
  if (id === 'match-fans') return { purse: { ...purse, stadium: { ...purse.stadium, fans: purse.stadium.fans + count } }, gain: count };
  if (id === 'penalty-knower') return { purse: { ...purse, school: { ...purse.school, knower: purse.school.knower + count } }, gain: count };
  if (id === 'kicks-knower') return { purse: { ...purse, wallet: { ...purse.wallet, paid: remember(purse.wallet, ref) }, school: { ...purse.school, knower: purse.school.knower + count } }, gain: count };
  if (id === 'tour-knower') return { purse: { ...purse, school: { ...purse.school, knower: purse.school.knower + count } }, gain: count };
  if (id === 'lesson-pack' || id === 'cup-pack') {
    if (purse.album === undefined) throw new Error(`${id} needs album`);
    return { purse: { ...purse, album: { ...purse.album, packs: purse.album.packs + count } }, gain: count };
  }
  if (id === 'learn-coins') return { purse: { ...purse, wallet: { ...purse.wallet, coins: purse.wallet.coins + count, paid: remember(purse.wallet, ref) } }, gain: count };
  const total = purse.wallet.rest + count;
  const gain = Math.floor(total / cfg.coinPer);
  const paid = remember(purse.wallet, ref);
  return { purse: { ...purse, wallet: { coins: purse.wallet.coins + gain, rest: total % cfg.coinPer, paid } }, gain };
}

/** Этот идентификатор уже оплачен (двойной Enter, F5 на итоге). */
export const isPaid = (wallet: Wallet, ref: string): boolean => wallet.paid.includes(ref);

/** Что вышло из списания. `again` — этот `ref` уже оплачен (двойной Enter), `coins` — не хватает, `bad` — цена не целая или ≤ 0. */
export type DebitResult = 'paid' | 'again' | 'coins' | 'bad';

/**
 * Единственное списание монет (ТЗ-3.9): покупка в Лавке. В минус не уходит; повтор того же `ref` не списывает второй раз.
 * Остаток `rest` не трогается. `ref` обязателен: пустой — `bad`.
 */
export function debit<P extends { wallet: Wallet }>(purse: P, id: 'shop-buy', price: number, ref: string): { purse: P; result: DebitResult } {
  if (id !== 'shop-buy' || ref === '' || !Number.isSafeInteger(price) || price <= 0) return { purse, result: 'bad' };
  if (isPaid(purse.wallet, ref)) return { purse, result: 'again' };
  if (purse.wallet.coins < price) return { purse, result: 'coins' };
  return { purse: { ...purse, wallet: { ...purse.wallet, coins: purse.wallet.coins - price, paid: remember(purse.wallet, ref) } }, result: 'paid' };
}
