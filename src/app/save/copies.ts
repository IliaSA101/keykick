/**
 * Кольцо копий игрока c1…c3 (060 design §3, 063-Р4): сырое до миграции и проигравший при импорте.
 * Копии — не данные, а страховка: при нехватке места они уступают, основной ключ игрока не трогается никогда.
 * Хранилище внедряется; всё, что может отказать, возвращается результатом.
 */
import type { Done, KeyValue } from './storage';

/** Потолок всех копий c1…c3 устройства, знаков (060 design §3: 512 КБ — оценка). */
export const COPIES_LIMIT = 512 * 1024;
export const RING = 3;
/** Ключ копии без префикса сборки: pid не содержит точки (`validPid`). */
const COPY_KEY = /^player\.[^.]+\.c([1-3])$/;

export type CopyErr = 'quota' | 'denied';

export interface Copies {
  key(pid: string, n: number): string;
  /** Запись; при нехватке места — удалить свои c3 и c2 и повторить один раз (пострадавшие — копии, не данные). `pid: null` — копий нет. */
  writeRelieved(key: string, value: string, pid: string | null): Done;
  /** Сдвиг кольца ключей `slot(1…size)`: slot(n-1)→slot(n); slot(1) освобождается для записи. */
  shiftRing(slot: (n: number) => string, size: number): Done;
  /**
   * Сырое — в c1 со сдвигом кольца; уже лежит в c1 — ничего не делает (`ok`). Сдвиг упёрся в квоту — сырое прямо в c1
   * ценой старших копий: запись идёт, а не `quota` на каждую попытку (063, долг 060).
   */
  put(pid: string, raw: string): Done<CopyErr>;
  /** Стирает все копии игрока (хвосты корзины). */
  drop(pid: string): void;
}

export function createCopies(kv: KeyValue, p: string): Copies {
  const key = (pid: string, n: number) => `${p}player.${pid}.c${n}`;

  function writeRelieved(k: string, value: string, pid: string | null): Done {
    const first = kv.write(k, value);
    if (first.ok || first.err !== 'quota' || pid === null) return first;
    kv.remove(key(pid, 3));
    kv.remove(key(pid, 2));
    return kv.write(k, value);
  }

  function shiftRing(slot: (n: number) => string, size: number): Done {
    for (let n = size; n >= 2; n--) {
      const from = kv.read(slot(n - 1));
      if (!from.ok) {
        if (from.err === 'absent') continue;
        return from;
      }
      const put = kv.write(slot(n), from.value);
      if (!put.ok) return put;
    }
    return { ok: true };
  }

  /** Копии всего устройства не больше потолка: сначала уходят c3, потом c2, потом c1 других игроков; своя c1 — никогда. */
  function trim(pid: string): void {
    const listed = kv.keys(`${p}player.`);
    if (!listed.ok) return;
    const items: { key: string; size: number; rank: number }[] = [];
    let total = 0;
    for (const k of listed.value) {
      // Только форма ключа копии `player.<pid>.c<n>`: основной ключ игрока с pid `c1`…`c3` (`player.c3`) — не копия.
      const m = COPY_KEY.exec(k.slice(p.length));
      if (!m) continue;
      const got = kv.read(k);
      if (!got.ok) continue;
      total += got.value.length;
      if (k !== key(pid, 1)) items.push({ key: k, size: got.value.length, rank: 4 - Number(m[1]) });
    }
    items.sort((a, b) => a.rank - b.rank);
    for (const it of items) {
      if (total <= COPIES_LIMIT) return;
      if (kv.remove(it.key).ok) total -= it.size;
    }
  }

  return {
    key,
    writeRelieved,
    shiftRing,
    put(pid, raw) {
      const c1 = kv.read(key(pid, 1));
      if (c1.ok && c1.value === raw) return { ok: true };
      if (raw.length > COPIES_LIMIT) return { ok: false, err: 'quota' };
      let shifted = shiftRing((n) => key(pid, n), RING);
      // Сдвиг встал посередине (c3←c2 лёг, c2←c1 нет): c1 ещё цела. Жертвуем старшими копиями по одной (c3, затем c2)
      // и сдвигаем заново — иначе запись в c1 затёрла бы самую свежую прежнюю копию.
      for (let n = RING; n >= 2 && !shifted.ok && shifted.err === 'quota'; n--) {
        kv.remove(key(pid, n));
        shifted = shiftRing((m) => key(pid, m), RING);
      }
      // Не квота (чтение отказало) — поверх c1 не пишем вслепую.
      if (!shifted.ok && shifted.err !== 'quota') return { ok: false, err: 'denied' };
      const done = writeRelieved(key(pid, 1), raw, pid);
      if (!done.ok) return { ok: false, err: done.err === 'quota' ? 'quota' : 'denied' };
      trim(pid);
      return { ok: true };
    },
    drop(pid) {
      for (let n = 1; n <= RING; n++) kv.remove(key(pid, n));
    },
  };
}
