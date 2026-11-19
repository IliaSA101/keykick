/**
 * Карточка клуба из разделов сеанса (ТЗ-1.13): одна сборка для окна «Клуб» (`screens/club`) и карточки поверх Карты
 * (`screens/map`, 068-Р17). Числа считает `engine/club/card.ts`; здесь только чтение разделов.
 */
import type { useHomeInput } from '../home/useHomeInput';
import { clubCard, type ClubCard } from '../../engine/club/card';
import type { CoachKeys } from '../../engine/coach/section';
import { emptyDay, type Day } from '../../engine/day/section';
import type { Stadium } from '../../engine/home/section';
import type { School } from '../../engine/school/section';
import { providedHardKeys } from './provide';

/** `hardKeys` — клавиши стенда кадра; нет (в игре) — из раздела `coach`. */
export function clubCardOf(data: ReturnType<typeof useHomeInput>['data'], hardKeys?: readonly string[]): ClubCard {
  return clubCard({
    played: data<Day>('day', emptyDay()).played,
    goals: data<Stadium>('stadium', { fans: 0, goals: 0 }).goals,
    solved: data<School | null>('school', null)?.solved.length ?? 0,
    course: data('course:ru', { lessons: {}, archive: {} }),
    hardKeys: hardKeys ?? providedHardKeys({ coach: data<CoachKeys | null>('coach', null) }),
  });
}
