/**
 * Раздел `wallet` (спека 018 design §3.3): монеты и остатки. Писать его можно только кассой
 * (`wallet.ts`, страж ТЗ-0.3): этот файл импортирует она и реестр (по маске, не импортом).
 */
import { defineSection, int, type SectionDef } from '../save/section';

export interface WalletSave {
  /** Монеты сейчас: `earned − spent`. */
  coins: number;
  /** Верных нажатий до следующей монеты: 0…`coinPer − 1` (017 §6). */
  pressRest: number;
  /** Сотые доли монеты ставки (026): 0–99. */
  stakeRest: number;
  /** Заработано за всё время, только растёт. */
  earned: number;
  /** Потрачено за всё время, только растёт. */
  spent: number;
}

/** Потолок монет и трат — защита от мусора. */
export const COIN_MAX = 1_000_000_000;
/** Потолок остатка нажатий, когда `coinPer` неизвестен. */
const REST_MAX = 1_000_000;

const rec = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/** Верхняя граница остатка нажатий: `coinPer − 1`; без годного `coinPer` — общий потолок. */
function pressMax(coinPer: number | undefined): number {
  return coinPer !== undefined && Number.isInteger(coinPer) && coinPer > 0 ? coinPer - 1 : REST_MAX;
}

export const section: SectionDef<WalletSave> = defineSection<WalletSave>({
  name: 'wallet',
  owner: '018',
  parse: (raw, ctx) => {
    const r = rec(raw);
    const coins = int(r.coins, 0, COIN_MAX);
    const spent = int(r.spent, 0, COIN_MAX);
    // Битое чинится в сторону «не чеканить»: остатки зажимаются, а расхождение чинит `earned` (монеты видит ребёнок).
    return {
      coins,
      pressRest: int(r.pressRest, 0, pressMax(ctx.coinPer)),
      stakeRest: int(r.stakeRest, 0, 99),
      earned: coins + spent,
      spent,
    };
  },
  empty: () => ({ coins: 0, pressRest: 0, stakeRest: 0, earned: 0, spent: 0 }),
  sample: () => ({ coins: 140, pressRest: 7, stakeRest: 40, earned: 200, spent: 60 }),
  maxSample: () => ({ coins: COIN_MAX, pressRest: REST_MAX, stakeRest: 99, earned: 2 * COIN_MAX, spent: COIN_MAX }),
  counters: (s) => ({ earned: s.earned, spent: s.spent }),
  check: (s) => (s.coins === s.earned - s.spent ? [] : [`wallet: coins ${s.coins} != earned ${s.earned} - spent ${s.spent}`]),
});
