/** Действия цепочек над кассой (`wallet`): только через `engine/wallet/wallet.ts` (ТЗ-0.3). */
import { credit, creditPresses, creditStake, spend } from '../../src/engine/wallet/wallet';
import { upTo, type ChainAction } from './types';

export const actions: ChainAction[] = [
  { name: 'wallet.credit', rewards: ['coins'], run: (tx, rnd) => credit(tx, 1 + upTo(rnd, 30), 'prize', 'p') },
  { name: 'wallet.creditStake', rewards: ['coins'], run: (tx, rnd) => void creditStake(tx, 1 + upTo(rnd, 250), 'game', 'g') },
  { name: 'wallet.creditPresses', rewards: ['coins'], run: (tx, rnd) => void creditPresses(tx, upTo(rnd, 120), 1 + upTo(rnd, 12), 'match') },
  // Трата: не награда; `spent` и `earned` только растут, `coins` убывает законно (не счётчик).
  { name: 'wallet.spend', rewards: [], run: (tx, rnd) => void spend(tx, upTo(rnd, 40), 'kit') },
];
