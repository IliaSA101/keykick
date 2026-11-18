/**
 * Раздел `school` (065-Р9): пока только счёт «Знатока» — «+1 к Знатоку» за верную задачу пенальти (ТЗ-2.7).
 * Растёт только через кассу (`engine/rewards/cash.ts`); волна 4 расширит раздел шагом `up`.
 */
import { isInt, type SectionDef } from '../save/section';

export interface School {
  knower: number;
}

export const schoolDef: SectionDef<School> = {
  name: 'school',
  v: 1,
  empty: () => ({ knower: 0 }),
  up: {},
  check: (d) => (d !== null && typeof d === 'object' && isInt((d as Partial<School>).knower) && (d as School).knower >= 0 ? [] : ['knower']),
};
