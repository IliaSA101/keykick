/**
 * Раздевалка на экране (067 Т13): какая форма на вешалке и как её звать. Чистые функции: хранилища и Vue нет.
 * Форма клуба — расцветка из `club.kit`; форма альбома и призовая — из `kits.json` и `prizes.json`; «Звёздные» (призовые без палитры) —
 * форма клуба с вехой на груди (рисунок вехи — отдельный шаг вида). Записать «Надеть» — `lockerWear` (`engine/album/locker`).
 */
import { kitOf, prizeOf } from '../../engine/album/kit';
import type { ArtKey } from '../../art/assets';
import type { BootId } from '../../engine/album/locker';
import type { KitDeco } from '../../engine/club/paint';
import type { ClubKit } from '../../engine/club/section';

export interface Look {
  /** Расцветка для `ShirtView`. */
  kit: ClubKit;
  /** Имя формы; `null` — форма клуба (имя показывает экран, оно из текстов). */
  name: string | null;
  /** «За …» у призовой; иначе `null`. */
  why: string | null;
  /** Табличка «На тебе»: короткое имя призовой; иначе `null` (имя формы). */
  plate: string | null;
  /** Отделка призовой («Звёздные»: кант, блик, звёзды); у прочих пусто. */
  deco: KitDeco;
}

/** Вид формы по id: `null` и неизвестный id — клубная (старое сохранение не ломает экран). */
export function lookOf(id: string | null, club: ClubKit): Look {
  if (id === null) return { kit: club, name: null, why: null, plate: null, deco: {} };
  const k = kitOf(id);
  if (k !== null) return { kit: k.kit, name: k.name, why: null, plate: null, deco: {} };
  const p = prizeOf(id);
  if (p !== null) return { kit: p.kit ?? club, name: p.name, why: p.why, plate: p.plate, deco: p.deco };
  return { kit: club, name: null, why: null, plate: null, deco: {} };
}

/** Картинка пары бутс (пара на прозрачном, 330×203): кеды — свои, «дворовые» и «коробка» — вырезки Лавки. */
export const BOOT_ART: Record<BootId, ArtKey> = { basic: 'bootsBasic', yard: 'shopBootsYard', box: 'shopBootsBox' };
