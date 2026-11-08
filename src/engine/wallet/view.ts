/**
 * Показ монет без кассы (спека 018 design §4.2, 019-Т8 «шапка карты»): ключ раздела для `sectionRef(walletKey)`
 * и чтение баланса. Ни зачислений, ни трат здесь нет — их делает только `wallet.ts` (страж ТЗ-0.3 в `guards.test`:
 * этот файл импортировать можно всем, а `set(walletKey…)` вне подсистемы `wallet` — нарушение).
 */
import type { SectionKey } from '../save/section';
import { section, type WalletSave } from './save';

export type { WalletSave } from './save';

/** Ключ раздела для показа: `sectionRef(walletKey)`. */
export const walletKey: SectionKey<WalletSave> = section;

/** Монеты сейчас; мусор — 0. */
export const coinsOf = (w: WalletSave | null | undefined): number =>
  w !== null && w !== undefined && Number.isSafeInteger(w.coins) && w.coins > 0 ? w.coins : 0;
