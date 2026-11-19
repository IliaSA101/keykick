/**
 * «Надеть» форму (ТЗ-5.2): только собранная — все три части; части разных форм не смешиваются. Призовая форма — та,
 * что есть в `album.prize`. `null` — снять, остаётся клубная.
 */
import { isCollected, isKnownKit } from './order';
import type { Album } from './section';

export type WearResult = { ok: true; album: Album } | { ok: false; album: Album; why: 'unknown' | 'locked' };

/** Форма может быть надета: собрана в альбоме или получена призом. */
export const isWearable = (album: Album, kitId: string): boolean => isCollected(album.packs, kitId) || album.prize.includes(kitId);

export function wear(album: Album, kitId: string | null): WearResult {
  if (kitId === null) return { ok: true, album: { ...album, worn: null } };
  if (isWearable(album, kitId)) return { ok: true, album: { ...album, worn: kitId } };
  return { ok: false, album, why: isKnownKit(kitId) ? 'locked' : 'unknown' };
}
