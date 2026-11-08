/**
 * Бутсы (спека 004, design.md §3): обычные — у всех, лавка — за монеты, кубковые — за трофей лиги.
 * Остаток v1 до пересмотра в 022: модель, разбор контента и цвета зон. Владение и «надетые» жили в сохранении v1
 * (`legacy`, ушёл в 018-Т6б) и придут заново разделом коллекции.
 * Зоны слоёв бутс: R — верх (upper), G — задник и язычок (accent), B — шнурки (laces).
 */
import { BOOTS_PRICES } from './rewards';

/** Лиги кубка v1: к ним привязаны кубковые бутсы. */
export const LEAGUES = ['yard', 'district', 'city'] as const;
export type League = (typeof LEAGUES)[number];

export function isLeague(v: unknown): v is League {
  return typeof v === 'string' && (LEAGUES as readonly string[]).includes(v);
}

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

/** Цвета зон слоёв бутс для paintZones: R — верх, G — задник и язычок, B — шнурки. */
export function bootsColors(b: Boots): [string, string, string] {
  return [b.upper, b.accent, b.laces];
}
