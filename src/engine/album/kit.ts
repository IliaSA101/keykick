/**
 * Форма альбома Двора по id (067 Т12): имя и расцветка из `kits.json`. Рисует экран (`ShirtView`), здесь — только данные.
 * Призовые формы (`PRIZE_IDS`) — `prizes.json` (Т13): за что получена и расцветка; «Звёздные» (`club`) — форма клуба с вехой на груди.
 */
import kits from '../../content/kits.json';
import prizes from '../../content/prizes.json';
import type { KitDeco } from '../club/paint';
import type { ClubKit } from '../club/section';
import { KIT_IDS } from './order';

export interface AlbumKit {
  id: string;
  name: string;
  kit: ClubKit;
}

/** Цвета формы по id из `kits.json` (без фильтра по порядку паков Двора: в задачах «Отбора» есть и другие формы); нет такой — `null`. */
export function kitColors(id: string): ClubKit | null {
  const k = (kits as Array<ClubKit & { id: string; name: string }>).find((x) => x.id === id);
  if (k === undefined) return null;
  const { pattern, body, sleeves, trim } = k;
  return { pattern, body, sleeves, trim, ...(k.alt === undefined ? {} : { alt: k.alt }) };
}

/** Форма альбома по id; не из альбома или нет в `kits.json` — `null`. */
export function kitOf(id: string): AlbumKit | null {
  if (!KIT_IDS.includes(id)) return null;
  const kit = kitColors(id);
  const name = (kits as Array<{ id: string; name: string }>).find((x) => x.id === id)?.name;
  return kit === null || name === undefined ? null : { id, name, kit };
}

export interface PrizeKit {
  id: string;
  name: string;
  /** Подпись «За …» (ТЗ-5.5: у призовой всегда есть причина). */
  why: string;
  /** Своя расцветка; `null` — форма клуба (у «Звёздных» веха рисуется поверх, не палитрой). */
  kit: ClubKit | null;
  /** Короткое имя для таблички «На тебе» (длинное в две строки не лезет); нет — `name`. */
  plate: string;
  /** Отделка вех у «Звёздных» (кант, блик, звёзды); у остальных — пусто. */
  deco: KitDeco;
}

interface PrizeRow {
  id: string;
  name: string;
  why: string;
  club?: boolean;
  plate?: string;
  deco?: KitDeco;
  pattern?: string;
  body?: string;
  alt?: string;
  sleeves?: string;
  trim?: string;
}

/** Призовая форма по id; не призовая — `null`. */
export function prizeOf(id: string): PrizeKit | null {
  const p = (prizes as PrizeRow[]).find((x) => x.id === id);
  if (p === undefined) return null;
  const kit: ClubKit | null = p.club === true ? null : { pattern: p.pattern ?? 'plain', body: p.body ?? '#ffffff', sleeves: p.sleeves ?? '#ffffff', trim: p.trim ?? '#ffffff', ...(p.alt === undefined ? {} : { alt: p.alt }) };
  return { id, name: p.name, why: p.why, kit, plate: p.plate ?? p.name, deco: p.deco ?? {} };
}
