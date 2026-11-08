/**
 * Касса (спека 018 design §4.2, Р4, Б2): единственное место, где меняются монеты. Работает над `SectionTx`:
 * читает `tx.get`, пишет `tx.set` и логирует после записи. Покупка (`spend` + выдача товара) — одна `updatePlayer`.
 * Чистые функции, без Vue и DOM; не бросает: негодные числа считаются нулём.
 */
import type { CoinSource } from '../journal/records';
import type { SectionTx } from '../save/section';
import { COIN_MAX, section, type WalletSave } from './save';

export type { WalletSave } from './save';
/** Ключ раздела — из файла показа (`view.ts`): экранам касса для показа не нужна. */
export { walletKey } from './view';

/** Целое ≥ 0, иначе 0. */
const whole = (n: number): number => (Number.isSafeInteger(n) && n > 0 ? n : 0);

/** Запись `coin` в журнал — только при `coins > 0`; `ref` — без ключа, если не задан. */
function logCoin(tx: SectionTx, source: CoinSource, coins: number, ref: string | undefined): void {
  if (coins <= 0) return;
  tx.log({ kind: 'coin', data: ref === undefined ? { source, coins } : { source, coins, ref } });
}

/** Зачислить `coins` в кошелёк `w`; выше потолка не растёт. Возвращает, сколько зачислено на самом деле. */
function addCoins(w: WalletSave, coins: number): number {
  const added = Math.min(coins, COIN_MAX - w.coins);
  w.coins += added;
  w.earned += added;
  return added;
}

/**
 * Монеты за верные нажатия: `per` нажатий — монета, остаток копится в `pressRest`. `per` — не константа:
 * у матча это `coinPer` правил 017. Негодный `per` (не целое > 0) — ничего не пишет.
 */
export function creditPresses(
  tx: SectionTx,
  n: number,
  per: number,
  source: CoinSource,
  ref?: string,
): { coins: number; rest: number } {
  const w = { ...tx.get(section) };
  if (!Number.isSafeInteger(per) || per <= 0) return { coins: 0, rest: w.pressRest };
  // Прежний остаток — не больше per − 1: битый остаток не должен чеканить монеты (К2).
  const total = Math.min(w.pressRest, per - 1) + whole(n);
  const added = addCoins(w, Math.floor(total / per));
  w.pressRest = total % per;
  if (whole(n) > 0) tx.set(section, w);
  logCoin(tx, source, added, ref);
  return { coins: added, rest: w.pressRest };
}

/** Монеты целиком (призовые 022, игры 026). */
export function credit(tx: SectionTx, coins: number, source: CoinSource, ref?: string): void {
  if (whole(coins) === 0) return;
  const w = { ...tx.get(section) };
  const added = addCoins(w, whole(coins));
  tx.set(section, w);
  logCoin(tx, source, added, ref);
}

/** Ставка в сотых долях монеты (026): сотня — монета, остаток копится в `stakeRest`. Возвращает зачисленные монеты. */
export function creditStake(tx: SectionTx, hundredths: number, source: CoinSource, ref?: string): number {
  if (whole(hundredths) === 0) return 0;
  const w = { ...tx.get(section) };
  const total = w.stakeRest + whole(hundredths);
  const added = addCoins(w, Math.floor(total / 100));
  w.stakeRest = total % 100;
  tx.set(section, w);
  logCoin(tx, source, added, ref);
  return added;
}

/**
 * Потратить `cost`: не хватает или цена негодная (не целое ≥ 0) — `false`, ничего не пишет (ошибка контента
 * не отдаёт товар даром, 018-Р20). Ноль тратить нечего — `true` без записи.
 */
export function spend(tx: SectionTx, cost: number, what: string): boolean {
  if (!Number.isSafeInteger(cost) || cost < 0) return false;
  const c = cost;
  const w = { ...tx.get(section) };
  if (c > w.coins) return false;
  if (c === 0) return true;
  w.coins -= c;
  w.spent += c;
  tx.set(section, w);
  tx.log({ kind: 'spend', data: { cost: c, what } });
  return true;
}
