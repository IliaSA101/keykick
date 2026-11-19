/**
 * Поставщик «трудных клавиш» для окна «Клуб» (067 Т11, ТЗ-1.13; Т24б). Источник — раздел `coach` (окна нажатий по буквам):
 * до `HARD_SHOWN` букв с худшей точностью при `form.minPresses` нажатий и более (067-Р274). Раздела нет или нажатий мало —
 * пусто, окно показывает «пока нет» (067-Р277). Сам счёт — `engine/coach/keys.ts`; окно и карточка клавиш не пересчитывают.
 */
import { HARD_SHOWN } from '../../engine/club/card';
import { hardKeys } from '../../engine/coach/keys';
import type { CoachKeys } from '../../engine/coach/section';

export const providedHardKeys = (sections: { coach?: CoachKeys | null }): readonly string[] =>
  sections.coach ? hardKeys(sections.coach, HARD_SHOWN).map((k) => k.ch) : [];
