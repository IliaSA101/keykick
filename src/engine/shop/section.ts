/**
 * Раздел `shop` (067 design §7): купленные вещи каталога Двора. Монеты списывает только касса (`debit`);
 * здесь — что куплено. Id — из `yard.json` (навсегда, 059).
 */
import yard from '../../content/yard.json';
import { isRecord, type SectionDef } from '../save/section';

export interface Shop {
  bought: string[];
}

export const IDS: readonly string[] = yard.catalog.map((c) => c.id);

export const shopDef: SectionDef<Shop> = {
  name: 'shop',
  v: 1,
  empty: () => ({ bought: [] }),
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const b = d.bought;
    if (!Array.isArray(b)) return ['bought'];
    return b.every((id) => typeof id === 'string' && IDS.includes(id)) && new Set(b).size === b.length ? [] : ['bought'];
  },
};
