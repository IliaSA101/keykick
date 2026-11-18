/**
 * Раздел `stadium` (065-Р9, Р26): болельщики и голы клуба (ТЗ-1.13, 3.13). Болельщиков растит только касса
 * (`engine/rewards/cash.ts`, награда `match-fans`, страж С1); счётчики не убывают. Чистые функции: часов и хранилища нет.
 */
import { badCounters, isRecord, type SectionDef } from '../save/section';

export interface Stadium {
  /** Болельщики за все матчи лиги: 1 болельщик = 1 верное нажатие (ТЗ-3.13). */
  fans: number;
  /** Голы клуба за все доигранные матчи (с пенальти). */
  goals: number;
}

export const emptyStadium = (): Stadium => ({ fans: 0, goals: 0 });

/** Голы матча: `n` забитых; отрицательное и дробное не считаем. */
export const addGoals = (s: Stadium, n: number): Stadium => ({ ...s, goals: s.goals + Math.max(0, Math.floor(n)) });

export const stadiumDef: SectionDef<Stadium> = {
  name: 'stadium',
  v: 1,
  empty: emptyStadium,
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    return badCounters(d, ['fans', 'goals']);
  },
};
