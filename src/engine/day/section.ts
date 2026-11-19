/**
 * Раздел `day` (065-Р9): игровые дни и доигранные матчи (ТЗ-10.2, 10.9). Игровой день — календарный день с ≥ 1 доигранным
 * матчем; пропуски ничего не сжигают. Чистые функции: день и часы приходят снаружи.
 * v2 (068 Т3): время печати (ТЗ-10.3, 10.5, 10.7), точности матчей по ступеням и серия матчей одного урока за день для
 * «пальцы устали» (ТЗ-10.4, 068-Р6, 068-Р18).
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
  // Поля v2 необязательны на чтении: фикстуры стенда кадров (`tools/accepted/states.mjs`) пишут разделы сырыми, без `up`;
  // новые сохранения `empty()` и `up` дают их всегда. Станут обязательными, когда генератор фикстур их допишет.
  /** Время ввода за всё время, мс (матчи и уроки; одно поле на ритм и страницу родителя). */
  typedMs?: number;
  /** Время ввода в день `msDay`, мс. */
  todayMs?: number;
  /** День `ГГГГ-ММ-ДД`, к которому относится `todayMs`; `null` — печати ещё не было. */
  msDay?: string | null;
  /** Значение `typedMs` на последней разминке (или в начале дня): с него считаем ≈ 20 мин до следующей (ТЗ-10.5). */
  warmFrom?: number;
  /** Точности последних доигранных матчей по ступени (ключ — номер ступени строкой), ‰, старые слева, не больше `ACC_KEEP` (ТЗ-10.4). */
  acc?: Record<string, number[]>;
  /** Серия последних доигранных матчей одного урока в один игровой день (068-Р18): `n` — сколько подряд; `null` — матчей не было. */
  series?: Series | null;
  /** День `ГГГГ-ММ-ДД`, в который итог дня уже пора было показать, а карточка его не показала («Застрял», 068-Р70): следующий матч этого дня покажет. Нет или другой день — долга нет. */
  summaryMissed?: string | null;
}

/** Серия: урок, игровой день `ГГГГ-ММ-ДД` и число его доигранных матчей подряд в этот день. */
export interface Series {
  lessonId: string;
  day: string;
  n: number;
}

/** Сколько последних точностей ступени хранить: норма — медиана пяти матчей (ТЗ-10.4). */
export const ACC_KEEP = 5;

export const emptyDay = (): Day => ({ played: 0, days: 0, today: null, todayN: 0, last: null, typedMs: 0, todayMs: 0, msDay: null, warmFrom: 0, acc: {}, series: null });

/** Финальный свисток матча в день `day` в момент `now`: матч засчитан, день — при первом матче дня. */
export function playedMatch(d: Day, day: string, now: number): Day {
  const same = d.today === day;
  return { ...d, played: d.played + 1, days: same ? d.days : d.days + 1, today: day, todayN: same ? d.todayN + 1 : 1, last: now };
}

/** Время ввода `ms` в день `day`: в новый день счёт дня и разминки начинается заново (story.md §4а). Дробное и отрицательное — к целому ≥ 0. */
export function addTyped(d: Day, day: string, ms: number): Day {
  const add = Number.isFinite(ms) ? Math.round(Math.max(0, ms)) : 0;
  const fresh = d.msDay !== day;
  const typed = d.typedMs ?? 0;
  return { ...d, typedMs: typed + add, todayMs: (fresh ? 0 : (d.todayMs ?? 0)) + add, msDay: day, warmFrom: fresh ? typed : (d.warmFrom ?? 0) };
}

/**
 * Доигранный матч урока `lessonId` ступени `stage` в игровой день `day` с точностью `permille`: точность — в окно пяти последних
 * матчей ступени (округлена и зажата в 0…1000), серия растёт, если прошлый матч — того же урока в тот же день, иначе — заново с 1.
 */
export function addAcc(d: Day, day: string, lessonId: string, stage: number, permille: number): Day {
  const p = Number.isFinite(permille) ? Math.round(Math.min(1000, Math.max(0, permille))) : 0;
  const key = String(stage);
  const was = d.acc?.[key] ?? [];
  const s = d.series;
  const n = s !== null && s !== undefined && s.lessonId === lessonId && s.day === day ? s.n + 1 : 1;
  return { ...d, acc: { ...d.acc, [key]: [...was, p].slice(-ACC_KEEP) }, series: { lessonId, day, n } };
}

export const dayDef: SectionDef<Day> = {
  name: 'day',
  v: 2,
  empty: emptyDay,
  // v1 → v2: счётчики те же, печати и точностей нет — считаем с нуля (формат свободен до выпуска, 060-Р7)
  up: { 2: (d) => (isRecord(d) ? { ...emptyDay(), ...d } : d) },
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const x = d;
    const why = badCounters(x, ['played', 'days', 'todayN']);
    if (x.today !== null && !isDay(x.today)) why.push('today');
    if (x.last !== null && (!isInt(x.last) || x.last < 0)) why.push('last');
    why.push(...badCounters(x, ['typedMs', 'todayMs', 'warmFrom'].filter((k) => x[k] !== undefined)));
    if (x.msDay !== undefined && x.msDay !== null && !isDay(x.msDay)) why.push('msDay');
    if (x.summaryMissed !== undefined && x.summaryMissed !== null && !isDay(x.summaryMissed)) why.push('summaryMissed');
    if (x.series !== undefined && x.series !== null && !(isRecord(x.series) && typeof x.series.lessonId === 'string' && isDay(x.series.day) && isInt(x.series.n) && x.series.n >= 1)) why.push('series');
    if (x.acc === undefined) return why;
    if (!isRecord(x.acc)) why.push('acc');
    else if (!Object.values(x.acc).every((a) => Array.isArray(a) && a.length <= ACC_KEEP && a.every((p) => isInt(p) && p >= 0 && p <= 1000))) why.push('acc:v');
    return why;
  },
};
