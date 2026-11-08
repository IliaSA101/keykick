/**
 * Матч v2 (спека 017, design §6): монеты за верные нажатия, остаток кошелька, болельщики по лигам.
 * Чистые функции: состояние приходит параметром, новое возвращается. Касса и запись — 018 и 017-Т5б.
 * Ставка `per` — `coinPer` из `content/match.json`, не константа здесь (018-В3).
 */
import type { SectionTx } from '../save/section';
import { creditPresses } from '../wallet/wallet';

/** Кошелёк игрока: монеты и остаток верных нажатий до следующей монеты (целые, `0 ≤ carry < per`). */
export interface Wallet {
  coins: number;
  carry: number;
}

export const emptyWallet: Wallet = { coins: 0, carry: 0 };

/**
 * Урок оплачивается, если его лига — текущая или прошлая лига игрока (ТЗ-3.1); позапрошлая — 0.
 * `leagues` — порядок лиг (`leagues.json`), движок его не знает. Неизвестная лига — не оплачивается.
 */
export function isPaid(lessonLeague: string, playerLeague: string, leagues: readonly string[]): boolean {
  const lesson = leagues.indexOf(lessonLeague);
  const player = leagues.indexOf(playerLeague);
  return lesson >= 0 && player >= 0 && lesson >= player - 1;
}

/** `correct` верных нажатий + остаток → целые монеты и новый остаток. */
export function earn(carry: number, correct: number, per: number): Wallet {
  const total = carry + Math.max(0, Math.floor(correct));
  return { coins: Math.floor(total / per), carry: total % per };
}

/**
 * Оплата блока (разминка, атака, доп. время, строка тренера): монеты в кошелёк, остаток переходит.
 * Не оплачиваемый урок — кошелёк тот же объект, остаток не трогаем. Ошибки, пенальти и звёзды монет не дают.
 */
export function payBlock(wallet: Wallet, correct: number, paid: boolean, per: number): Wallet {
  if (!paid) return wallet;
  const e = earn(wallet.carry, correct, per);
  return { coins: wallet.coins + e.coins, carry: e.carry };
}

/** Сколько верных нужно до следующей монеты («до монеты ещё K»). */
export const untilCoin = (carry: number, per: number): number => per - (carry % per);

/** Верные нажатия по лигам урока (болельщики, ТЗ-3.13, 017-Р10): повтор урока прошлой лиги кладёт в неё. */
export type Fans = Readonly<Record<string, number>>;

export function addFans(fans: Fans, lessonLeague: string, correct: number): Fans {
  if (correct <= 0) return fans;
  return { ...fans, [lessonLeague]: (fans[lessonLeague] ?? 0) + Math.floor(correct) };
}

/**
 * Запись монет за блок в кассу (018 §4.2): единственный вход матча в `wallet/wallet.ts` (страж «награды через кассу»).
 * Передаём приращение — верные нажатия блока; не оплачиваемый урок — ничего. Возвращает зачисленные монеты.
 */
export function creditBlock(tx: SectionTx, correct: number, paid: boolean, per: number, matchId: string): number {
  if (!paid || correct <= 0) return 0;
  return creditPresses(tx, correct, per, 'match', matchId).coins;
}
