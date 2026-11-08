/**
 * Пак с формой: повторяем по зерну, без дублей, пока есть неполученные, редкие — реже.
 * Бутсы (спека 004): список в content и его разбор. Владение жило в сохранении v1 (ушло в 018-Т6б).
 */
import { describe, expect, it } from 'vitest';
import { boots } from '../src/app/boots';
import { kits } from '../src/app/kits';
import { BASIC_BOOTS_ID, LEAGUES, bootsColors, parseBoots } from '../src/engine/boots';
import type { Kit, KitRarity } from '../src/engine/kit';
import { BOOTS_PRICES, openPack, rarityWeights } from '../src/engine/rewards';

const kit = (id: string, rarity: KitRarity): Kit => ({
  id,
  name: id,
  rarity,
  pattern: 'plain',
  body: '#000000',
  sleeves: '#000000',
  trim: '#000000',
});

const SEEDS = Array.from({ length: 2000 }, (_, i) => i);

describe('пак', () => {
  it('одно зерно — та же форма', () => {
    for (const seed of [0, 1, 42, 99_999]) expect(openPack(kits, [], seed)).toBe(openPack(kits, [], seed));
    const many = new Set(SEEDS.slice(0, 200).map((s) => openPack(kits, [], s)));
    expect(many.size).toBeGreaterThan(5);
  });

  it('не выдаёт полученную, пока есть неполученные', () => {
    const owned = kits.slice(0, -2).map((k) => k.id);
    const left = kits.slice(-2).map((k) => k.id);
    for (const seed of SEEDS.slice(0, 300)) expect(left).toContain(openPack(kits, owned, seed));
  });

  it('коллекция собирается за столько паков, сколько в ней форм', () => {
    const owned: string[] = [];
    for (let i = 0; i < kits.length; i++) {
      const id = openPack(kits, owned, i * 1000 + owned.length);
      expect(owned).not.toContain(id);
      owned.push(id);
    }
    expect(new Set(owned).size).toBe(kits.length);
  });

  it('всё собрано — повтор из коллекции', () => {
    const all = kits.map((k) => k.id);
    expect(all).toContain(openPack(kits, all, 7));
  });

  it('редкие реже: доли редкостей близки к весам', () => {
    const pool = [kit('c1', 'common'), kit('c2', 'common'), kit('r1', 'rare'), kit('r2', 'rare'), kit('e1', 'epic')];
    const byId = new Map(pool.map((k) => [k.id, k.rarity]));
    const counts: Record<KitRarity, number> = { common: 0, rare: 0, epic: 0 };
    for (const seed of SEEDS) counts[byId.get(openPack(pool, [], seed)) ?? 'common'] += 1;
    expect(counts.common).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(counts.epic);
    const total = rarityWeights.common + rarityWeights.rare + rarityWeights.epic;
    for (const r of ['common', 'rare', 'epic'] as const) {
      expect(Math.abs(counts[r] / SEEDS.length - rarityWeights[r] / total)).toBeLessThan(0.03);
    }
  });

  it('в настоящей коллекции эпическая выпадает реже обычной', () => {
    const rarity = new Map(kits.map((k) => [k.id, k.rarity]));
    const counts: Record<KitRarity, number> = { common: 0, rare: 0, epic: 0 };
    for (const seed of SEEDS) counts[rarity.get(openPack(kits, [], seed)) ?? 'common'] += 1;
    expect(counts.epic).toBeGreaterThan(0);
    expect(counts.epic * 5).toBeLessThan(counts.common);
  });

  it('остались одни редкие — выпадает редкая', () => {
    expect(openPack([kit('c', 'common'), kit('e', 'epic')], ['c'], 3)).toBe('e');
  });

  it('пустая коллекция — ошибка, а не тихий undefined', () => {
    expect(() => openPack([], [], 1)).toThrow();
  });
});

/**
 * id лавки: убрать пару из content нельзя — у детей она уже куплена (раздел коллекции 022 будет хранить id).
 * Новые пары — дописывать сюда; удалять отсюда нельзя.
 */
const SHOP_IDS = ['blue', 'red', 'green', 'orange', 'white', 'neon', 'violet'];

describe('бутсы: content', () => {
  it('обычные одни, лавка — 4 × 150 и 3 × 300, кубковые — по паре на лигу', () => {
    expect(boots.filter((b) => b.kind === 'basic').map((b) => b.id)).toEqual([BASIC_BOOTS_ID]);
    const prices = boots.filter((b) => b.kind === 'shop').map((b) => b.price);
    expect(prices.filter((p) => p === 150)).toHaveLength(4);
    expect(prices.filter((p) => p === 300)).toHaveLength(3);
    for (const p of prices) expect(BOOTS_PRICES).toContain(p);
    expect(boots.filter((b) => b.kind === 'cup').map((b) => b.league)).toEqual([...LEAGUES]);
    expect(boots).toHaveLength(11);
  });

  it('id не повторяются и не пропадают; обычные и кубковые не продаются', () => {
    expect(new Set(boots.map((b) => b.id)).size).toBe(boots.length);
    for (const id of SHOP_IDS) expect(boots.filter((b) => b.kind === 'shop').map((b) => b.id)).toContain(id);
    for (const b of boots.filter((x) => x.kind !== 'shop')) {
      expect(b.price).toBeUndefined();
    }
    expect(new Set(boots.map((b) => b.name)).size).toBe(boots.length);
  });

  it('цвета зон: верх, задник, шнурки', () => {
    const blue = boots.find((b) => b.id === 'blue');
    expect(blue && bootsColors(blue)).toEqual([blue?.upper, blue?.accent, blue?.laces]);
  });

  it('ошибки в данных ловятся', () => {
    const basic = { id: 'basic', name: 'О', kind: 'basic', upper: '#000000', accent: '#000000', laces: '#ffffff' };
    const cups = LEAGUES.map((league) => ({ ...basic, id: `cup-${league}`, kind: 'cup', league }));
    const shop = { ...basic, id: 's', kind: 'shop', price: 150 };
    expect(parseBoots([basic, ...cups, shop])).toHaveLength(5);
    expect(() => parseBoots({})).toThrow(/array/);
    expect(() => parseBoots([basic, ...cups, shop, shop])).toThrow(/duplicate/);
    expect(() => parseBoots([...cups, shop])).toThrow(/basic/);
    expect(() => parseBoots([basic, { ...basic, id: 'b2' }, ...cups])).toThrow(/basic/);
    expect(() => parseBoots([{ ...basic, id: 'plain' }, ...cups])).toThrow(/basic/);
    expect(() => parseBoots([basic, ...cups.slice(1)])).toThrow(/yard/);
    expect(() => parseBoots([basic, ...cups, { ...cups[0], id: 'cup-2' }])).toThrow(/yard/);
    expect(() => parseBoots([basic, ...cups, { ...shop, price: 200 }])).toThrow(/price/);
    expect(() => parseBoots([basic, ...cups, { ...shop, price: undefined }])).toThrow(/price/);
    expect(() => parseBoots([{ ...basic, price: 150 }, ...cups])).toThrow(/price/);
    expect(() => parseBoots([basic, ...cups, { ...shop, league: 'yard' }])).toThrow(/league/);
    expect(() => parseBoots([basic, ...cups, { ...cups[0], id: 'c', league: 'moon' }])).toThrow(/league/);
    expect(() => parseBoots([basic, ...cups, { ...shop, kind: 'gold' }])).toThrow(/kind/);
    expect(() => parseBoots([basic, ...cups, { ...shop, upper: 'red' }])).toThrow(/upper/);
    expect(() => parseBoots([basic, ...cups, { ...shop, name: '' }])).toThrow(/name/);
  });
});
