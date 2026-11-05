/**
 * Бутсы (спека 004, design.md §3): обычные — у всех, лавка — за монеты, кубковые — за трофей лиги.
 * В сохранении — только купленные (boughtBoots) и надетые (wornBoots). Обычные и кубковые
 * выводятся: кубок, взятый до выхода бутс, даёт пару сразу, а «Сыграть кубок снова» трофей
 * не снимает — и пара не пропадает.
 * Зоны слоёв бутс: R — верх (upper), G — задник и язычок (accent), B — шнурки (laces).
 */
import { LEAGUES, isLeague, trophies, type League } from './cup';
import { BOOTS_PRICES } from './rewards';
import type { SaveData } from './save';

export const bootsKinds = ['basic', 'shop', 'cup'] as const;
export type BootsKind = (typeof bootsKinds)[number];

export interface Boots {
  id: string;
  name: string;
  kind: BootsKind;
  /** Цена в лавке — только у kind = 'shop', из BOOTS_PRICES. */
  price?: number;
  /** Лига кубка — только у kind = 'cup': пара за трофей этой лиги. */
  league?: League;
  upper: string;
  accent: string;
  laces: string;
}

/** Обычные бутсы: есть у каждого, надеты, пока не надето другое. */
export const BASIC_BOOTS_ID = 'basic';

const HEX = /^#[0-9a-f]{6}$/i;

/** Разбор бутс из content: ошибка в данных должна падать в тесте, а не на экране ребёнка. */
export function parseBoots(raw: unknown): Boots[] {
  if (!Array.isArray(raw)) throw new Error('boots: expected array');
  const ids = new Set<string>();
  const out = raw.map((item: unknown, n): Boots => {
    const where = `boots[${n}]`;
    const r = (item ?? {}) as Record<string, unknown>;
    const str = (key: string): string => {
      const v = r[key];
      if (typeof v !== 'string' || v === '') throw new Error(`${where}.${key}: expected string`);
      return v;
    };
    const color = (key: string): string => {
      const v = str(key);
      if (!HEX.test(v)) throw new Error(`${where}.${key}: bad color ${v}`);
      return v;
    };
    const id = str('id');
    if (ids.has(id)) throw new Error(`${where}: duplicate id ${id}`);
    ids.add(id);
    const kind = str('kind');
    if (!(bootsKinds as readonly string[]).includes(kind)) throw new Error(`${where}: bad kind ${kind}`);
    const boots: Boots = {
      id,
      name: str('name'),
      kind: kind as BootsKind,
      upper: color('upper'),
      accent: color('accent'),
      laces: color('laces'),
    };
    // Цена — только в лавке: обычные и кубковые не продаются.
    if (kind === 'shop') {
      if (!(BOOTS_PRICES as readonly unknown[]).includes(r.price)) throw new Error(`${where}: bad price ${String(r.price)}`);
      boots.price = r.price as number;
    } else if (r.price !== undefined) throw new Error(`${where}: price only in shop`);
    if (kind === 'cup') {
      if (!isLeague(r.league)) throw new Error(`${where}: bad league ${String(r.league)}`);
      boots.league = r.league;
    } else if (r.league !== undefined) throw new Error(`${where}: league only for cup`);
    return boots;
  });
  const basic = out.filter((b) => b.kind === 'basic');
  if (basic.length !== 1 || basic[0]?.id !== BASIC_BOOTS_ID) throw new Error(`boots: need one basic "${BASIC_BOOTS_ID}"`);
  for (const league of LEAGUES) {
    if (out.filter((b) => b.league === league).length !== 1) throw new Error(`boots: need one cup pair for ${league}`);
  }
  return out;
}

/** id лавки — в SaveContext.bootIds: в boughtBoots может быть только купленное в лавке. */
export function shopIds(boots: readonly Boots[]): string[] {
  return boots.filter((b) => b.kind === 'shop').map((b) => b.id);
}

/** Пары во владении по порядку content: обычные ∪ купленные ∪ кубковые по трофеям. */
export function ownedBoots(save: SaveData, boots: readonly Boots[]): string[] {
  const won = trophies(save);
  return boots
    .filter(
      (b) =>
        b.kind === 'basic' ||
        (b.kind === 'shop' && save.boughtBoots.includes(b.id)) ||
        (b.kind === 'cup' && b.league !== undefined && won.includes(b.league)),
    )
    .map((b) => b.id);
}

/** Можно купить: пара из лавки, ещё не куплена, монет хватает. */
export function canBuyBoots(save: SaveData, boots: readonly Boots[], id: string): boolean {
  const b = boots.find((x) => x.id === id);
  if (b?.kind !== 'shop' || b.price === undefined) return false;
  return !save.boughtBoots.includes(id) && save.coins >= b.price;
}

/**
 * Покупка: пара и монеты — одной записью (перезагрузка не разделит их). Нельзя (мало монет,
 * повтор, не из лавки) — тот же объект: двойной щелчок «Да» не спишет дважды.
 */
export function buyBoots(save: SaveData, boots: readonly Boots[], id: string): SaveData {
  if (!canBuyBoots(save, boots, id)) return save;
  const price = boots.find((b) => b.id === id)?.price ?? 0;
  return { ...save, coins: save.coins - price, boughtBoots: [...save.boughtBoots, id] };
}

/**
 * «Надеть»: только пару во владении; обычные — null (как домашняя форма в wornKit).
 * Не во владении или уже надета — тот же объект.
 */
export function wearBoots(save: SaveData, boots: readonly Boots[], id: string): SaveData {
  if (!ownedBoots(save, boots).includes(id)) return save;
  const next = id === BASIC_BOOTS_ID ? null : id;
  return next === save.wornBoots ? save : { ...save, wornBoots: next };
}

/** Надетые бутсы: wornBoots во владении (трофей, контент могли измениться), иначе обычные. */
export function wornBootsOf(save: SaveData, boots: readonly Boots[]): Boots {
  const owned = ownedBoots(save, boots);
  const worn = boots.find((b) => b.id === save.wornBoots && owned.includes(b.id));
  const basic = boots.find((b) => b.id === BASIC_BOOTS_ID);
  if (!basic) throw new Error('boots: no basic');
  return worn ?? basic;
}

/** Цвета зон слоёв бутс для paintZones: R — верх, G — задник и язычок, B — шнурки. */
export function bootsColors(b: Boots): [string, string, string] {
  return [b.upper, b.accent, b.laces];
}
