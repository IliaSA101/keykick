/**
 * Время игры и перерыв: активное время по действиям, сеанс прерывается после 4 минут тишины,
 * перерыв назначается и начинается на переходе экрана, разбор не падает на мусоре.
 */
import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  IDLE_MS,
  KEEP_DAYS,
  MINUTE_MS,
  applyBreakSettings,
  breakLeft,
  dayNumber,
  defaultBreakSettings,
  emptySession,
  finishBreakIfOver,
  parseBreakSettings,
  parseSession,
  playedDays,
  recordAction,
  startBreakIfDue,
  type BreakSettings,
  type SessionData,
} from '../src/engine/session';

const T0 = 1_800_000_000_000;
const DAY = '2026-11-04';
const on: BreakSettings = defaultBreakSettings();

/** Действия каждые step мс в течение total мс, начиная с start. */
function play(s: SessionData, start: number, total: number, step = 10_000, day = DAY, settings = on): SessionData {
  let out = s;
  for (let t = 0; t <= total; t += step) out = recordAction(out, start + t, day, settings);
  return out;
}

describe('активное время', () => {
  it('по умолчанию: перерыв включён, 15 минут игры, 5 минут отдыха', () => {
    expect(on).toEqual({ enabled: true, playMinutes: 15, breakMinutes: 5 });
  });

  it('промежутки между действиями складываются в время дня', () => {
    const s = play(emptySession(), T0, 5 * MINUTE_MS);
    expect(s.days[DAY]).toBe(5 * MINUTE_MS);
    expect(s.sinceBreak).toBe(5 * MINUTE_MS);
    expect(s.lastAction).toBe(T0 + 5 * MINUTE_MS);
  });

  it('первое действие времени не даёт: считать не от чего', () => {
    expect(recordAction(emptySession(), T0, DAY, on).days).toEqual({});
  });

  it('тишина дольше 4 минут — сеанс прерван, время не растёт', () => {
    const a = play(emptySession(), T0, MINUTE_MS);
    const b = recordAction(a, T0 + MINUTE_MS + IDLE_MS + 1, DAY, on);
    expect(b.days[DAY]).toBe(MINUTE_MS);
    const c = recordAction(a, T0 + MINUTE_MS + IDLE_MS, DAY, on);
    expect(c.days[DAY]).toBe(MINUTE_MS + IDLE_MS);
  });

  it('пауза не короче перерыва — уже отдых: счёт до перерыва заново', () => {
    const a = play(emptySession(), T0, 14 * MINUTE_MS);
    const b = recordAction(a, a.lastAction! + 5 * MINUTE_MS, DAY, on);
    expect(b.sinceBreak).toBe(0);
    expect(b.days[DAY]).toBe(14 * MINUTE_MS);
    // Между 4 и 5 минутами — прерван, но не отдохнул.
    const c = recordAction(a, a.lastAction! + 4.5 * MINUTE_MS, DAY, on);
    expect(c.sinceBreak).toBe(14 * MINUTE_MS);
  });

  it('часы назад — новый сеанс без времени', () => {
    const a = play(emptySession(), T0, MINUTE_MS);
    const b = recordAction(a, T0 - 1000, DAY, on);
    expect(b.days[DAY]).toBe(MINUTE_MS);
    expect(b.lastAction).toBe(T0 - 1000);
  });

  it('сутки — по дате, которую дал app-слой; неделя — 7 дней по сегодня включительно', () => {
    let s = play(emptySession(), T0, 2 * MINUTE_MS, 10_000, '2026-10-28');
    s = play(s, T0 + DAY_MS, 3 * MINUTE_MS, 10_000, '2026-10-29');
    s = play(s, T0 + 7 * DAY_MS, 4 * MINUTE_MS, 10_000, '2026-11-04');
    expect(playedDays(s, '2026-11-04', 1)).toBe(4 * MINUTE_MS);
    expect(playedDays(s, '2026-11-04', 7)).toBe(7 * MINUTE_MS);
    expect(playedDays(s, '2026-11-05', 1)).toBe(0);
    expect(playedDays(s, 'вчера', 7)).toBe(0);
  });

  it('старые дни выкидываются: хранится не больше двух недель', () => {
    let s = emptySession();
    for (let d = 1; d <= 30; d++) {
      const day = `2026-10-${String(d).padStart(2, '0')}`;
      s = play(s, T0 + d * DAY_MS, MINUTE_MS, 10_000, day);
    }
    expect(Object.keys(s.days)).toHaveLength(KEEP_DAYS);
    expect(s.days['2026-10-30']).toBe(MINUTE_MS);
    expect(s.days['2026-10-01']).toBeUndefined();
  });

  it('дата: «ГГГГ-ММ-ДД», несуществующий день — не дата', () => {
    expect(dayNumber('2026-11-05')! - dayNumber('2026-11-04')!).toBe(1);
    expect(dayNumber('2026-03-01')! - dayNumber('2026-02-28')!).toBe(1);
    for (const bad of ['2026-02-30', '2026-13-01', '2026-1-4', '', 'сегодня']) expect(dayNumber(bad)).toBeNull();
    expect(recordAction(emptySession(), T0, 'сегодня', on)).toEqual(emptySession());
  });
});

describe('перерыв', () => {
  const due = play(emptySession(), T0, 15 * MINUTE_MS);
  const end = T0 + 15 * MINUTE_MS;

  it('15 минут игры — перерыв назначен, но сам не начинается (тайм не обрывается)', () => {
    expect(play(emptySession(), T0, 14 * MINUTE_MS).breakDue).toBe(false);
    expect(due.breakDue).toBe(true);
    expect(due.breakUntil).toBeNull();
    expect(breakLeft(due, end, on)).toBe(0);
  });

  it('переход экрана начинает перерыв на 5 минут; отсчёт идёт и кончается', () => {
    const s = startBreakIfDue(due, end, on);
    expect([s.breakDue, s.sinceBreak, s.breakUntil]).toEqual([false, 0, end + 5 * MINUTE_MS]);
    expect(breakLeft(s, end + MINUTE_MS, on)).toBe(4 * MINUTE_MS);
    expect(breakLeft(s, end + 5 * MINUTE_MS, on)).toBe(0);
    expect(startBreakIfDue(s, end + MINUTE_MS, on)).toBe(s);
    expect(startBreakIfDue(play(emptySession(), T0, MINUTE_MS), end, on).breakUntil).toBeNull();
  });

  it('во время перерыва действия не считаются; после — новый сеанс без времени перерыва', () => {
    const s = startBreakIfDue(due, end, on);
    expect(recordAction(s, end + MINUTE_MS, DAY, on)).toBe(s);
    const after = recordAction(s, end + 5 * MINUTE_MS + 1000, DAY, on);
    expect(after.days[DAY]).toBe(15 * MINUTE_MS);
    expect(after.breakUntil).toBeNull();
    // Короткий перерыв (3 мин < 4 мин тишины) тоже не засчитывается игрой.
    const short = { ...on, breakMinutes: 3 as const };
    const s3 = startBreakIfDue(due, end, short);
    expect(recordAction(s3, end + 3 * MINUTE_MS + 1000, DAY, short).days[DAY]).toBe(15 * MINUTE_MS);
  });

  it('кончившийся перерыв снимается; идущий — нет', () => {
    const s = startBreakIfDue(due, end, on);
    expect(finishBreakIfOver(s, end + MINUTE_MS, on)).toBe(s);
    const done = finishBreakIfOver(s, end + 5 * MINUTE_MS, on);
    expect([done.breakUntil, done.lastAction]).toEqual([null, null]);
  });

  it('часы назад не растягивают перерыв дольше его длины', () => {
    const s = startBreakIfDue(due, end, on);
    expect(breakLeft(s, end - DAY_MS, on)).toBe(5 * MINUTE_MS);
  });

  it('выключен — не назначается и не идёт; включили короче — назначается сразу', () => {
    const off = { ...on, enabled: false };
    expect(play(emptySession(), T0, 30 * MINUTE_MS, 10_000, DAY, off).breakDue).toBe(false);
    const running = startBreakIfDue(due, end, on);
    expect(breakLeft(running, end + 1000, off)).toBe(0);
    const cleared = applyBreakSettings(running, off);
    expect([cleared.breakDue, cleared.breakUntil]).toEqual([false, null]);
    const twelve = play(emptySession(), T0, 12 * MINUTE_MS);
    expect(twelve.breakDue).toBe(false);
    expect(applyBreakSettings(twelve, { ...on, playMinutes: 10 }).breakDue).toBe(true);
    expect(applyBreakSettings(twelve, on)).toBe(twelve);
  });

  it('длина игры до перерыва — из настроек', () => {
    const ten = { ...on, playMinutes: 10 as const };
    expect(play(emptySession(), T0, 10 * MINUTE_MS, 10_000, DAY, ten).breakDue).toBe(true);
    const s = startBreakIfDue(play(emptySession(), T0, 10 * MINUTE_MS, 10_000, DAY, ten), end, { ...ten, breakMinutes: 10 });
    expect(s.breakUntil).toBe(end + 10 * MINUTE_MS);
  });
});

describe('разбор сеанса и настроек', () => {
  it('круг «JSON → разбор» без потерь', () => {
    const s = startBreakIfDue(play(emptySession(), T0, 15 * MINUTE_MS), T0 + 15 * MINUTE_MS, on);
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const settings: BreakSettings = { enabled: false, playMinutes: 25, breakMinutes: 3 };
    expect(parseBreakSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  });

  it('мусор — пусто; битое поле — пустое, остальные живут', () => {
    for (const raw of [null, undefined, 'x', 5, [], true]) expect(parseSession(raw)).toEqual(emptySession());
    const s = parseSession({
      days: { '2026-11-04': 60_000, '2026-02-30': 5, bad: 7, '2026-11-03': -1, '2026-11-02': 'x', '2026-11-01': 1e15 },
      lastAction: 'вчера',
      sinceBreak: 120_000,
      breakDue: 'да',
      breakUntil: Number.NaN,
    });
    expect(s).toEqual({
      days: { '2026-11-04': 60_000, '2026-11-01': DAY_MS },
      lastAction: null,
      sinceBreak: 120_000,
      breakDue: false,
      breakUntil: null,
    });
    expect(parseSession({ days: [1, 2] }).days).toEqual({});
  });

  it('настройки: только разрешённые значения, иначе — по умолчанию', () => {
    for (const raw of [null, 'off', [], 3]) expect(parseBreakSettings(raw)).toEqual(on);
    expect(parseBreakSettings({ enabled: 'нет', playMinutes: 17, breakMinutes: 0 })).toEqual(on);
    expect(parseBreakSettings({ enabled: false, playMinutes: 20 })).toEqual({ ...on, enabled: false, playMinutes: 20 });
  });
});
