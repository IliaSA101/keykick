/**
 * Карантин (060 design §3, 063-Р4): битое сырое — строкой, не больше `QUARANTINE_MAX` на владельца (игрок или `device`).
 * Сырое не теряется: основной ключ остаётся как был, а копия лежит здесь, пока корзина не очистится.
 */
import type { Copies } from './copies';
import type { KeyValue } from './storage';

/** Сколько сырых версий одного владельца держит карантин. */
export const QUARANTINE_MAX = 3;

export interface Quarantine {
  key(owner: string, n: number): string;
  /** Сырое в карантин; одинаковое второй раз не пишется. `pid` — чьи копии уступают место (`null` — ничьи). */
  put(owner: string, raw: string, pid: string | null): boolean;
  /** Сырые версии владельца, свежая первой. Нет доступа или ничего нет — пусто. */
  list(owner: string): string[];
  drop(owner: string): void;
}

export function createQuarantine(kv: KeyValue, p: string, copies: Copies): Quarantine {
  const key = (owner: string, n: number) => `${p}quarantine.${owner}.${n}`;
  return {
    key,
    put(owner, raw, pid) {
      for (let n = 1; n <= QUARANTINE_MAX; n++) {
        const got = kv.read(key(owner, n));
        if (got.ok && got.value === raw) return true;
      }
      if (!copies.shiftRing((n) => key(owner, n), QUARANTINE_MAX).ok) return false;
      return copies.writeRelieved(key(owner, 1), raw, pid).ok;
    },
    list(owner) {
      const out: string[] = [];
      for (let n = 1; n <= QUARANTINE_MAX; n++) {
        const got = kv.read(key(owner, n));
        if (got.ok) out.push(got.value);
      }
      return out;
    },
    drop(owner) {
      for (let n = 1; n <= QUARANTINE_MAX; n++) kv.remove(key(owner, n));
    },
  };
}
