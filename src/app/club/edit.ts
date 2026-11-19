/**
 * Правка клуба из окна «Твой клуб» (067 Т11, Т13): черновик из текущего клуба и запись через сеанс. Один код на «Клуб» и на «Имя и номер ›» в Раздевалке.
 * Запись легла в память — `ok`, а при `quota`/`conflict` (диск не принял) тоже: игра идёт из памяти, как на первом запуске.
 */
import { reactive, type Ref } from 'vue';
import type { SaveResult } from '../save/session';
import type { Club } from '../../engine/club/section';
import { DEFAULT_COACH, DEFAULT_PALETTE, clubFromDraft, draftOfClub, type Draft } from '../../engine/club/start';

export const stored = (r: SaveResult): boolean => r.ok || r.status === 'quota' || r.status === 'conflict';

export function useClubEdit(session: { save(patch: Record<string, unknown>): SaveResult }, club: Ref<Club>, coach: Ref<string>) {
  const draft = reactive<Draft>({ name: '', city: '', backName: '', backNumber: 0, palette: DEFAULT_PALETTE, coach: DEFAULT_COACH });
  /** Черновик — текущий клуб, как после «Изменить». */
  const open = (): void => void Object.assign(draft, draftOfClub(club.value, coach.value));
  /** Записать клуб из черновика; `false` — отказ записи (чужая вкладка): окно остаётся. */
  const save = (): boolean => stored(session.save({ club: clubFromDraft(draft) }));
  return { draft, open, save };
}
