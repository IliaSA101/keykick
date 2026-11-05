/**
 * Награды: что выпадает из пака. Случайность — по зерну (random.ts): одно зерно — та же форма.
 *
 * Сначала выдаются неполученные формы, поэтому коллекция собирается без дублей:
 * редкость решает лишь порядок. Среди неполученных сначала выбирается редкость по весам,
 * потом форма внутри неё — так эпическая выпадает с шансом около 5 % при любом их числе.
 */
import type { Kit, KitRarity } from './kit';
import { createRandom, pick } from './random';

export const rarityWeights: Readonly<Record<KitRarity, number>> = { common: 70, rare: 25, epic: 5 };

/**
 * Монеты за повтор формы из пака. Повторы бывают только у собранной коллекции:
 * пока есть неполученные, пак выдаёт новую (openPack ниже).
 */
export const DUP_COINS: Readonly<Record<KitRarity, number>> = { common: 10, rare: 25, epic: 50 };
/**
 * Монеты за игру: за звезду тайма и за забитый пенальти. Без них монеты шли бы только
 * от повторов, а повторы бывают лишь у собранной коллекции — пак за монеты был бы недостижим.
 */
export const STAR_COINS = 10;
export const PENALTY_COINS = 10;
/** Монеты за доделанное задание перерыва: мини-игры не обязательны, «Пропустить» — без монет. */
export const MINIGAME_COINS = 10;
/** Цена пака в шкафчике. */
export const PACK_PRICE = 100;
/**
 * Цены бутс в лавке шкафчика (спека 004): 150 — обычная рамка, 300 — серебряная.
 * Другой цены в content быть не может (parseBoots). Пересмотр — после недели игры.
 */
export const BOOTS_PRICES = [150, 300] as const;

/** id формы из пака. Все получены — повтор (дубль) из всей коллекции. */
export function openPack(kits: readonly Kit[], owned: readonly string[], seed: number): string {
  if (kits.length === 0) throw new Error('openPack: no kits');
  const fresh = kits.filter((k) => !owned.includes(k.id));
  const pool = fresh.length > 0 ? fresh : kits;
  const rnd = createRandom(seed);

  const present = (Object.keys(rarityWeights) as KitRarity[]).filter((r) => pool.some((k) => k.rarity === r));
  const total = present.reduce((s, r) => s + rarityWeights[r], 0);
  let roll = rnd() * total;
  let rarity = present[present.length - 1];
  for (const r of present) {
    roll -= rarityWeights[r];
    if (roll < 0) {
      rarity = r;
      break;
    }
  }
  return pick(
    rnd,
    pool.filter((k) => k.rarity === rarity),
  ).id;
}
