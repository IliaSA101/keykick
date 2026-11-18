/**
 * Раздел `wallet` (065-Р9): монеты и «нажатий до монеты». Пишет только касса (`cash.ts`, страж С1); другие файлы
 * этот модуль не импортируют, кроме реестра разделов сборки.
 */
import cfg from '../../content/match.json';
import { badCounters, isInt, isRecord, type SectionDef } from '../save/section';

export interface Wallet {
  coins: number;
  /** Остаток «нажатий до монеты», 0…coinPer−1 (ТЗ-3.1): переходит в следующий матч. */
  rest: number;
  /** Последние оплаченные идентификаторы матчей и минут (повтор того же — без второй награды). */
  paid: string[];
}

/** Сколько идентификаторов помним. */
export const PAID_KEEP = 4;

export const walletDef: SectionDef<Wallet> = {
  name: 'wallet',
  v: 1,
  empty: () => ({ coins: 0, rest: 0, paid: [] }),
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const w = d;
    const why = badCounters(w, ['coins']);
    if (!isInt(w.rest) || w.rest < 0 || w.rest >= cfg.coinPer) why.push('rest');
    if (!Array.isArray(w.paid) || w.paid.length > PAID_KEEP || w.paid.some((p) => typeof p !== 'string' || p.length > 80)) why.push('paid');
    return why;
  },
};
