/**
 * Напоминание родителю о выгрузке (063-Р9, Р63): ≥ 7 дней с последнего файла и был прогресс; файла нет — после 3-го матча. Часы — аргументом, без Date.now.
 * У каждого теста строка «Ловит:» — какую поломку он видит.
 */
import { describe, expect, it } from 'vitest';
import type { Device } from '../../src/engine/save/device';
import { createPlayer, writePlayer, type Envelope } from '../../src/engine/save/envelope';
import { REMIND_DAYS, REMIND_MATCHES, matchesPlayed, progressDays, remind } from '../../src/engine/save/remind';
import { dayDef } from '../../src/engine/day/section';
import type { SectionDef } from '../../src/engine/save/section';

const courseDef: SectionDef<unknown> = {
  name: 'course:ru',
  v: 1,
  empty: () => ({ current: 'a', lessons: {}, archive: {}, leaguesDone: {} }),
  up: {},
  check: () => [],
};
const mark = (done?: string) => (done === undefined ? { stars: 1, best: 50, tries: 1 } : { stars: 1, best: 50, tries: 1, done });

/** Игрок с отметками уроков по дням (`undefined` — отметка без дня) и счётчиком матчей `day.played` (по умолчанию — столько же, сколько отметок). */
function played(pid: string, days: (string | undefined)[], matches = days.length): Envelope {
  const lessons = Object.fromEntries(days.map((d, i) => [`ru.yard.l${i}`, mark(d)]));
  return writePlayer(createPlayer({ pid, name: pid }, [courseDef, dayDef]), {
    'course:ru': { current: 'a', lessons, archive: {}, leaguesDone: {} },
    day: { ...dayDef.empty(), played: matches },
  });
}
const fresh = (pid = 'p1'): Envelope => createPlayer({ pid, name: pid }, [courseDef, dayDef]);
const dev = (exported?: string): Pick<Device, 'parent'> => ({ parent: exported === undefined ? { gate: 'none' } : { gate: 'none', exported } });

describe('К4: remind — когда напомнить родителю', () => {
  it('К4: ровно 7 дней с выгрузки и прогресс после неё — да; 6 дней — нет', () => {
    // Ловит: граница сдвинута на день (напоминают рано или поздно), срок не 7 дней (Safari стирает через 7).
    const players = [played('p1', ['2026-11-12'])];
    expect(REMIND_DAYS).toBe(7);
    expect(remind(dev('2026-11-10'), players, '2026-11-17')).toBe(true);
    expect(remind(dev('2026-11-10'), players, '2026-11-16')).toBe(false);
    expect(remind(dev('2026-11-10'), players, '2026-11-30')).toBe(true);
  });

  it('К4: без прогресса после выгрузки — нет; прогресс в день выгрузки не считается', () => {
    // Ловит: напоминание про выгрузку, когда выгружать нечего; прогресс «до» выгрузки засчитывается за новый.
    expect(remind(dev('2026-11-01'), [fresh()], '2026-12-31')).toBe(false);
    expect(remind(dev('2026-11-01'), [played('p1', ['2026-10-30', '2026-11-01'])], '2026-12-31')).toBe(false);
    expect(remind(dev('2026-11-01'), [played('p1', ['2026-11-02'])], '2026-12-31')).toBe(true);
  });

  it('К63: файла не было — плашка после 3-го доигранного матча (day.played), срок не ждём; 2 матча — нет', () => {
    // Ловит: счёт «7 дней с первого урока» вместо «3 матча» (064-Р8): родитель без файла ждал бы неделю, а сыграв 3 матча — ничего не видел;
    // граница сдвинута (2 или 4 матча).
    expect(remind(dev(), [played('p1', [], 2)], '2026-11-12')).toBe(false);
    expect(remind(dev(), [played('p1', [], 3)], '2026-11-12')).toBe(true);
    expect(remind(dev(), [played('p1', [], 4)], '2026-11-13')).toBe(true);
  });

  it('К63: файла не было — матчи считаются по day.played всех игроков вместе, а не по пройденным урокам', () => {
    // Ловит: счёт по урокам (уроков 5, матчей 2 — плашка не нужна; уроков 0, матчей 3 — нужна: повторы уроков и пакеты без отметок);
    // счёт по одному игроку (двое детей по 2 матча — 4 вместе); пустые игроки дают плашку; нет раздела `day` ломает счёт.
    expect(REMIND_MATCHES).toBe(3);
    expect(remind(dev(), [played('p1', [], 2), played('p2', [], 1)], '2026-11-14')).toBe(true);
    expect(remind(dev(), [played('p1', ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'], 2)], '2026-11-16')).toBe(false);
    expect(remind(dev(), [played('p1', [], 3)], '2026-11-16')).toBe(true);
    expect(remind(dev(), [fresh()], '2027-01-01')).toBe(false);
    expect(remind(dev(), [], '2027-01-01')).toBe(false);
    expect(matchesPlayed([played('p1', [], 2), createPlayer({ pid: 'p2', name: 'p2' }, [courseDef])])).toBe(2);
  });

  it('К63: файл сегодня — плашки нет, сколько бы ни было матчей; файл был, 3 матча до него — нет без нового прогресса', () => {
    // Ловит: правило «3 матча» применяется и после файла (плашка висит сразу после «Сохранить файл»).
    const many = [played('p1', ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'], 4)];
    expect(remind(dev('2026-11-18'), many, '2026-11-18')).toBe(false);
    expect(remind(dev('2026-11-18'), many, '2026-11-24')).toBe(false);
    expect(remind(dev('2026-11-05'), many, '2026-11-18')).toBe(false);
  });

  it('К4: прогресс считают по всем игрокам; отметка без дня не прогресс', () => {
    // Ловит: напоминание только по одному игроку (второй ребёнок играл, а родителя не зовут); отметка без `done` даёт ложный прогресс.
    const kids = [played('p1', ['2026-11-01']), played('p2', ['2026-11-12'])];
    expect(remind(dev('2026-11-05'), kids, '2026-11-12')).toBe(true);
    expect(remind(dev('2026-11-05'), [played('p1', [undefined])], '2026-12-12')).toBe(false);
    expect(progressDays(kids)).toEqual(['2026-11-01', '2026-11-12']);
  });

  it('К4: кривые даты — не напоминаем и не бросаем: сегодня не день; exported не день считается «не выгружали»', () => {
    // Ловит: исключение или «NaN дней» на испорченной записи устройства или сломанных часах.
    const players = [played('p1', ['2026-11-01', '2026-11-01', '2026-11-01'], 3)];
    expect(remind(dev('2026-11-01'), players, '')).toBe(false);
    expect(remind(dev('2026-11-01'), players, '2026-13-40')).toBe(false);
    expect(remind(dev('вчера'), players, '2026-11-20')).toBe(true);
    expect(remind({ parent: { gate: 'none', exported: 5 as unknown as string } }, players, '2026-11-20')).toBe(true);
  });

  it('К4: граница месяцев и високосного года считается по календарю, а не по тридцатидневкам', () => {
    // Ловит: разница дней считается по номерам месяцев или фиксированной длине месяца — напоминание на день раньше или позже.
    expect(remind(dev('2028-02-23'), [played('p1', ['2028-02-24'])], '2028-03-01')).toBe(true); // 2028 високосный: 23.02 → 01.03 = 7 дней
    expect(remind(dev('2027-02-23'), [played('p1', ['2027-02-24'])], '2027-03-01')).toBe(false); // 2027: 6 дней
  });
});
