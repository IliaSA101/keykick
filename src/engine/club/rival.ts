/**
 * Соперник Двора (спека 019, design §2.2, Р17): «Двор на <улица>» — улица из `clubs.json` `streets`,
 * город — клуба ребёнка, форма — как у соперников v1 (`rivalKit`). Чистая функция: зерно снаружи.
 */
import type { ClubData } from './names';
import { rivalKit } from './kit';
import type { Kit, KitColors } from '../kit';
import { createRandom, pick } from '../random';

/** Улицы хранятся в форме после «на» («Садовой»). */
export function parseStreets(raw: unknown): string[] {
  const list = (raw as { streets?: unknown } | null)?.streets;
  if (!Array.isArray(list) || list.length === 0) throw new Error('clubs.streets: expected non-empty array');
  const out = list.map((s: unknown, n) => {
    if (typeof s !== 'string' || s.trim() !== s || s === '' || s.length > 20) {
      throw new Error(`clubs.streets[${n}]: bad street`);
    }
    return s;
  });
  if (new Set(out).size !== out.length) throw new Error('clubs.streets: duplicate street');
  return out;
}

export interface YardRival {
  /** Название целиком: `nameOf(улица)`. */
  name: string;
  street: string;
  /** Город клуба ребёнка; у клуба без города — ''. */
  city: string;
  kit: Kit;
}

/**
 * @param nameOf шаблон названия из i18n («Двор на {улица}»): в движке русских слов нет.
 * Одно зерно — тот же соперник.
 */
export function yardRival(
  data: ClubData,
  streets: readonly string[],
  club: { city: string; kit: KitColors },
  seed: number,
  nameOf: (street: string) => string,
): YardRival {
  const street = pick(createRandom(seed), streets);
  const name = nameOf(street);
  return { name, street, city: club.city, kit: rivalKit(data, name, club.kit, seed) };
}
