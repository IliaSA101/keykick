/**
 * Пак с формой: повторяем по зерну, без дублей, пока есть неполученные, редкие — реже.
 * Бутсы (спека 004): список в content, владение, покупка и «Надеть».
 */
import { describe, expect, it } from 'vitest';
import { boots } from '../src/app/boots';
import { kits } from '../src/app/kits';
import {
  BASIC_BOOTS_ID,
  bootsColors,
  buyBoots,
  canBuyBoots,
  ownedBoots,
  parseBoots,
  shopIds,
  wearBoots,
  wornBootsOf,
} from '../src/engine/boots';
import { LEAGUES, type League } from '../src/engine/cup';
import type { Kit, KitRarity } from '../src/engine/kit';
import { BOOTS_PRICES, openPack, rarityWeights } from '../src/engine/rewards';
import { emptySave, parseSave, type SaveData } from '../src/engine/save';

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
 * id лавки в сохранениях детей: убрать пару из content — купленное пропадёт (parseSave выбросит).
 * Новые пары — дописывать сюда; удалять отсюда нельзя.
 */
const SHOP_IDS = ['blue', 'red', 'green', 'orange', 'white', 'neon', 'violet'];

const won = (...leagues: League[]): SaveData['cups'] =>
  Object.fromEntries(leagues.map((l) => [l, { stage: 4, won: true }]));

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
    for (const id of SHOP_IDS) expect(shopIds(boots)).toContain(id);
    for (const b of boots.filter((x) => x.kind !== 'shop')) {
      expect(b.price).toBeUndefined();
      expect(canBuyBoots({ ...emptySave(), coins: 10_000 }, boots, b.id)).toBe(false);
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

describe('бутсы: владение, покупка, «Надеть»', () => {
  const rich: SaveData = { ...emptySave(), coins: 400 };

  it('владение: обычные ∪ купленные ∪ кубковые по трофеям, порядок — как в content', () => {
    expect(ownedBoots(emptySave(), boots)).toEqual([BASIC_BOOTS_ID]);
    const s = { ...emptySave(), boughtBoots: ['violet', 'blue'], cups: won('district') };
    expect(ownedBoots(s, boots)).toEqual([BASIC_BOOTS_ID, 'blue', 'violet', 'cup-district']);
    // Кубок идёт, трофея нет — пары нет; «Сыграть кубок снова» (раунд 0) трофей не снимает.
    expect(ownedBoots({ ...emptySave(), cups: { yard: { stage: 3, won: false } } }, boots)).toEqual([BASIC_BOOTS_ID]);
    expect(ownedBoots({ ...emptySave(), cups: { yard: { stage: 0, won: true } } }, boots)).toContain('cup-yard');
    // Мусор в купленных (разбор без контекста) пар не даёт.
    expect(ownedBoots({ ...emptySave(), boughtBoots: ['cup-city', 'gone'] }, boots)).toEqual([BASIC_BOOTS_ID]);
  });

  it('старое сохранение: обычные надеты, кубковые — по трофеям, взятым до выхода бутс', () => {
    const { boughtBoots, wornBoots, ...old } = { ...emptySave(), cups: won('yard', 'city') };
    expect([boughtBoots, wornBoots]).toEqual([[], null]);
    const s = parseSave(JSON.parse(JSON.stringify(old)), { bootIds: shopIds(boots) });
    expect(wornBootsOf(s, boots).id).toBe(BASIC_BOOTS_ID);
    expect(ownedBoots(s, boots)).toEqual([BASIC_BOOTS_ID, 'cup-yard', 'cup-city']);
  });

  it('покупка: минус цена, плюс пара — одной записью; повтор и нехватка — тот же объект', () => {
    const s = buyBoots(rich, boots, 'white');
    expect([s.coins, s.boughtBoots]).toEqual([100, ['white']]);
    expect(rich).toEqual({ ...emptySave(), coins: 400 });
    expect(buyBoots(s, boots, 'white')).toBe(s);
    const poor = { ...emptySave(), coins: 149 };
    expect(canBuyBoots(poor, boots, 'blue')).toBe(false);
    expect(buyBoots(poor, boots, 'blue')).toBe(poor);
    expect(buyBoots({ ...poor, coins: 150 }, boots, 'blue').coins).toBe(0);
    for (const id of [BASIC_BOOTS_ID, 'cup-yard', 'gone']) expect(buyBoots(rich, boots, id)).toBe(rich);
    expect(buyBoots(s, boots, 'neon')).toBe(s);
  });

  it('«Надеть»: только свою пару; обычные — null; чужую и уже надетую — тот же объект', () => {
    const s = buyBoots(rich, boots, 'blue');
    const worn = wearBoots(s, boots, 'blue');
    expect(worn.wornBoots).toBe('blue');
    expect(wornBootsOf(worn, boots).id).toBe('blue');
    expect(wearBoots(worn, boots, 'blue')).toBe(worn);
    for (const id of ['red', 'cup-yard', 'gone']) expect(wearBoots(worn, boots, id)).toBe(worn);
    expect(wearBoots(worn, boots, BASIC_BOOTS_ID).wornBoots).toBeNull();
    expect(wearBoots(s, boots, BASIC_BOOTS_ID)).toBe(s);
    const cup = { ...emptySave(), cups: won('yard') };
    expect(wearBoots(cup, boots, 'cup-yard').wornBoots).toBe('cup-yard');
  });

  it('надетые не во владении (пара убрана, трофея нет, мусор) — обычные', () => {
    for (const wornBoots of ['gone', 'red', 'cup-city', null]) {
      expect(wornBootsOf({ ...emptySave(), wornBoots }, boots).id).toBe(BASIC_BOOTS_ID);
    }
    expect(() => wornBootsOf(emptySave(), boots.filter((b) => b.kind !== 'basic'))).toThrow(/basic/);
  });
});
