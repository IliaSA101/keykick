/**
 * Касса наград (ТЗ-0.3, 3.1, 3.4; страж С1): единственное место, где растут монеты (`wallet`) и «Знаток» (`school.knower`).
 * Чистая функция: хранилища и часов нет. Звать её может только файл из `callers` награды (`sources.ts`).
 */
import cfg from '../../content/match.json';
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

/**
 * Начисление за `n` единиц события. Болельщики (`match-fans`): `n` — верные нажатия матча, по болельщику за нажатие, остатка нет. Монеты (`match-coins`, `minute-coins`): `n` — верные нажатия, 1 монета за `coinPer`,
 * остаток копится; `ref` — идентификатор матча или минуты, его запоминает кошелёк. `penalty-knower`: `n` — верные задачи.
 * Возвращает новый кошелёк и сколько целых единиц получено сейчас.
 */
export function credit(purse: Purse, id: RewardId, n: number, ref = ''): { purse: Purse; gain: number } {
  const count = Math.max(0, Math.floor(n));
  if (id === 'match-fans') return { purse: { ...purse, stadium: { ...purse.stadium, fans: purse.stadium.fans + count } }, gain: count };
  if (id === 'penalty-knower') return { purse: { ...purse, school: { ...purse.school, knower: purse.school.knower + count } }, gain: count };
  const total = purse.wallet.rest + count;
  const gain = Math.floor(total / cfg.coinPer);
  const paid = ref === '' ? purse.wallet.paid : [...purse.wallet.paid.filter((p) => p !== ref), ref].slice(-PAID_KEEP);
  return { purse: { ...purse, wallet: { coins: purse.wallet.coins + gain, rest: total % cfg.coinPer, paid } }, gain };
}

/** Этот идентификатор уже оплачен (двойной Enter, F5 на итоге). */
export const isPaid = (wallet: Wallet, ref: string): boolean => wallet.paid.includes(ref);
