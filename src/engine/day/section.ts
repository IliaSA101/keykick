/**
 * Раздел `day` (065-Р9): игровые дни и доигранные матчи (ТЗ-10.2, 10.9). Игровой день — календарный день с ≥ 1 доигранным
 * матчем; пропуски ничего не сжигают. Чистые функции: день и часы приходят снаружи.
 */
import { badCounters, isDay, isInt, isRecord, type SectionDef } from '../save/section';

export interface Day {
  /** Доигранных матчей всего. */
  played: number;
  /** Игровых дней всего. */
  days: number;
  /** Последний игровой день `ГГГГ-ММ-ДД`; `null` — матчей ещё не было. */
  today: string | null;
  /** Доигранных матчей в день `today`. */
  todayN: number;
  /** Время последнего доигранного матча, мс (для «Капитан вернулся!», ТЗ-2.11); `null` — не было. */
  last: number | null;
}

export const emptyDay = (): Day => ({ played: 0, days: 0, today: null, todayN: 0, last: null });

/** Финальный свисток матча в день `day` в момент `now`: матч засчитан, день — при первом матче дня. */
export function playedMatch(d: Day, day: string, now: number): Day {
  const same = d.today === day;
  return { played: d.played + 1, days: same ? d.days : d.days + 1, today: day, todayN: same ? d.todayN + 1 : 1, last: now };
}

export const dayDef: SectionDef<Day> = {
  name: 'day',
  v: 1,
  empty: emptyDay,
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const x = d;
    const why = badCounters(x, ['played', 'days', 'todayN']);
    if (x.today !== null && !isDay(x.today)) why.push('today');
    if (x.last !== null && (!isInt(x.last) || x.last < 0)) why.push('last');
    return why;
  },
};
