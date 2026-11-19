/**
 * Порядок паков Двора (067 Т8, ТЗ-5.2; 049-Р3 Б′, 067-Р9): форма каждые 3 пака, части по порядку — футболка, шорты, гетры.
 * Порядок форм — порядок `album-yard.json` (первая половина 1–7, затем 8–13 с фольгой); случайности нет, зерна в сохранении нет.
 * Чистые функции от числа паков.
 */
import cfg from '../../content/album-yard.json';

export type Part = 'shirt' | 'shorts' | 'socks';

export const PARTS: readonly Part[] = cfg.parts as Part[];
export const KIT_IDS: readonly string[] = cfg.kits;
export const PRIZE_IDS: readonly string[] = cfg.prizes;
/** Паков во Дворе: 13 × 3 = 39 (ТЗ-5.1: 32 + 7). */
export const PACKS_YARD: number = KIT_IDS.length * PARTS.length;

export interface PackItem {
  kit: string;
  part: Part;
}

/** Что даёт пак номер `k` (1…39); вне Двора — `null` (дальше паков во Дворе нет). */
export function packAt(k: number): PackItem | null {
  if (!Number.isSafeInteger(k) || k < 1 || k > PACKS_YARD) return null;
  return { kit: KIT_IDS[Math.floor((k - 1) / PARTS.length)]!, part: PARTS[(k - 1) % PARTS.length]! };
}

/** Форма во второй половине альбома — с фольгой на канте и номере (ТЗ-5.4). */
export const isFoil = (kit: string): boolean => KIT_IDS.indexOf(kit) + 1 >= cfg.foilFrom;

/** Собрана ли форма после `packs` паков: все три части выданы. */
export function isCollected(packs: number, kit: string): boolean {
  const i = KIT_IDS.indexOf(kit);
  return i >= 0 && packs >= (i + 1) * PARTS.length;
}

/** Форма или призовая известна альбому (id — навсегда). */
export const isKnownKit = (id: string): boolean => KIT_IDS.includes(id) || PRIZE_IDS.includes(id);
