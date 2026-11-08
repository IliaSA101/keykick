// Журнал игры, движок (018-Т3): формат, обрезка, слияние, метрики. К4 (чистая часть) и К5.
import { describe, expect, it } from 'vitest';
import leagues from '../src/content/leagues.json';
import { mergeJournal } from '../src/engine/journal/merge';
import { METRIC_IDS, metrics, type MetricRow } from '../src/engine/journal/metrics';
import {
  clampDt,
  DT_MAX,
  keysOk,
  recordId,
  type JournalKind,
  type JournalRecord,
  type KeysLog,
} from '../src/engine/journal/records';
import { KEYS_KEEP, planTrim } from '../src/engine/journal/trim';

const DAY = 86_400_000;
let seq = 0;
function rec(kind: JournalKind, data: unknown, t = 1000 + seq, id = `p1.${seq++}`): JournalRecord {
  return { id, player: 'p1', t, app: 'test', jv: 1, kind, data };
}
function match(over: Record<string, unknown> = {}, t?: number, id?: string): JournalRecord {
  return rec('match', { lesson: 'a1', league: 'L1', n: 1, attempt: 1, outcome: 'win', at: 3, signs: 100, errors: 5, ms: 60_000, ...over }, t, id);
}
const keysLog = (m: string, typed: string): KeysLog => ({ match: m, player: 'p1', t: 1, typed, expected: 'abcdef', dt: [] });
const val = (rows: MetricRow[], id: string) => rows.find((r) => r.id === id)!;
const course = { leagues: [{ id: 'L1' }, { id: 'L2', shiftFrom: 17 }] };

describe('журнал: формат', () => {
  it('id = игрок.время в 36-ричной.вкладка+номер', () => {
    expect(recordId('p1', 36 * 36, 'ab12', 7)).toBe('p1.100.ab127');
  });
  it('ok выводится сравнением typed и expected', () => {
    expect(keysOk({ typed: 'abxd', expected: 'abcd' })).toEqual([true, true, false, true]);
    expect(keysOk({ typed: 'abcdef', expected: 'ab' })).toEqual([true, true, false, false, false, false]);
  });
  it('dt: целое 0–60 000, мусор → 0', () => {
    expect(clampDt([-5, 12.6, 99_999, NaN, Infinity])).toEqual([0, 13, DT_MAX, 0, 0]);
  });
});

describe('журнал: обрезка', () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `m${i}`, t: i * 10 }));
  it('300 и меньше — нечего удалять', () => {
    expect(planTrim(list(KEYS_KEEP))).toEqual([]);
  });
  it('удаляет самые старые по t, а не по порядку списка', () => {
    const shuffled = list(305).reverse();
    expect(planTrim(shuffled)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
  });
  it('keep задаёт предел (квота: 100)', () => {
    expect(planTrim(list(103), 100)).toEqual(['m0', 'm1', 'm2']);
    expect(planTrim(list(3), 0)).toEqual(['m0', 'm1', 'm2']);
  });
  it('равные t: удаляется тот, что раньше в списке', () => {
    expect(planTrim([{ key: 'a', t: 5 }, { key: 'b', t: 5 }, { key: 'c', t: 5 }], 2)).toEqual(['a']);
  });
});

describe('журнал: слияние', () => {
  const open = (at: number) => match({ outcome: 'open', at }, 5, 'p1.m');
  const done = (at: number) => match({ outcome: 'win', at }, 5, 'p1.m');
  const merge = (have: JournalRecord[], file: JournalRecord[]) =>
    mergeJournal({ records: have, keys: [] }, { records: file, keys: [] }).records;

  it('новые записи добавляются, одинаковые — нет', () => {
    const a = rec('coin', { source: 'match', coins: 3 });
    const b = rec('coin', { source: 'game', coins: 1 });
    expect(merge([a], [a, b])).toEqual([b]);
  });
  it('итог побеждает open, open не затирает итог', () => {
    expect(merge([open(5)], [done(1)])).toEqual([done(1)]);
    expect(merge([done(1)], [open(9)])).toEqual([]);
  });
  it('open против open: больший at', () => {
    expect(merge([open(2)], [open(4)])).toEqual([open(4)]);
    expect(merge([open(4)], [open(2)])).toEqual([]);
  });
  it('в файле две версии одного id — берётся полнее', () => {
    expect(merge([], [open(1), open(3), open(2)])).toEqual([open(3)]);
  });
  it('keys: длиннее typed побеждает; новые добавляются', () => {
    const plan = mergeJournal(
      { records: [], keys: [keysLog('m1', 'abc'), keysLog('m2', 'abcdef')] },
      { records: [], keys: [keysLog('m1', 'abcde'), keysLog('m2', 'ab'), keysLog('m3', 'a')] },
    );
    expect(plan.keys.map((k) => `${k.match}:${k.typed}`).sort()).toEqual(['m1:abcde', 'm3:a']);
  });
  it('слияние ничего не удаляет и не меняет исходные массивы', () => {
    const have = [done(1)];
    const copy = JSON.stringify(have);
    merge(have, [open(3)]);
    expect(JSON.stringify(have)).toBe(copy);
  });
});

describe('журнал: метрики (К5)', () => {
  it('пустой журнал: все 13 метрик на месте, значение null, тревоги нет', () => {
    const rows = metrics([], [], course);
    expect(rows.map((r) => r.id)).toEqual([...METRIC_IDS]);
    expect(rows).toHaveLength(13);
    for (const r of rows) {
      expect(r.value).toBeNull();
      expect(r.alarm).toBe(false);
    }
  });

  it('никогда не отдаёт NaN, даже на мусорных data', () => {
    const junk = [
      rec('coin', null), rec('match', 5), rec('session', { minutes: 'x' }), rec('game', {}), rec('school', []),
      match({ signs: 0, ms: 0 }),
    ];
    for (const r of metrics(junk, [], course)) expect(Number.isNaN(r.value)).toBe(false);
  });

  it('монеты по источнику, доля игр и тревога > 20 %', () => {
    const rows = metrics(
      [rec('coin', { source: 'match', coins: 60 }), rec('coin', { source: 'game', coins: 25 }), rec('coin', { source: 'game', coins: 15 })],
      [],
      course,
    );
    expect(val(rows, 'coinSources')).toMatchObject({ value: 100, detail: { match: 60, game: 40 } });
    expect(val(rows, 'gameCoinShare')).toMatchObject({ value: 0.4, alarm: true });
    const low = metrics([rec('coin', { source: 'match', coins: 90 }), rec('coin', { source: 'game', coins: 10 })], [], course);
    expect(val(low, 'gameCoinShare')).toMatchObject({ value: 0.1, alarm: false });
  });

  it('вехи по датам и перерыв после финала до следующего сеанса', () => {
    const rows = metrics(
      [
        rec('milestone', { name: 'first-win', value: 1 }, 100),
        rec('milestone', { name: 'league-final', value: 1 }, 10 * DAY),
        rec('session', { start: 11 * DAY, end: 12 * DAY, minutes: {} }, 11 * DAY),
        rec('session', { start: 14 * DAY, end: 15 * DAY, minutes: {} }, 14 * DAY),
      ],
      [],
      course,
    );
    expect(val(rows, 'milestones')).toMatchObject({ value: 2, detail: { 'first-win': 100, 'league-final': 10 * DAY } });
    expect(val(rows, 'restAfterFinal').value).toBe(1);
    expect(val(metrics([rec('milestone', { name: 'league-final', value: 1 }, 5)], [], course), 'restAfterFinal').value).toBeNull();
  });

  it('точность первых 5 уроков лиги и первых 5 уроков Shift; открытые не считаются', () => {
    const rows = metrics(
      [
        match({ n: 1, errors: 0 }), // 1.0
        match({ n: 5, errors: 10 }), // 0.9
        match({ n: 6, errors: 100 }), // не первые 5
        match({ league: 'L2', n: 17, errors: 20 }), // 0.8, Shift
        match({ league: 'L2', n: 21, errors: 20 }), // 0.8, пятый Shift
        match({ league: 'L2', n: 22, errors: 90 }), // шестой Shift — мимо
        match({ n: 2, errors: 90, outcome: 'open' }), // open — мимо
      ],
      [],
      course,
    );
    expect(val(rows, 'firstLessonsAcc').value).toBeCloseTo((1 + 0.9 + 0.8 + 0.8) / 4, 10);
  });

  it('первые 5 уроков настоящего leagues.json: у лиги с shiftFrom метрика его видит', () => {
    const withShift = (leagues as { leagues: { id: string; shiftFrom?: number }[] }).leagues.find((l) => l.shiftFrom);
    expect(withShift).toBeDefined();
    const rows = metrics([match({ league: withShift!.id, n: withShift!.shiftFrom!, errors: 0 }), match({ n: 30, league: 'zz' })], [], {
      leagues: (leagues as { leagues: { id: string; shiftFrom?: number }[] }).leagues,
    });
    expect(val(rows, 'firstLessonsAcc').value).toBe(1);
  });

  it('доля «Школы» во времени, тревога > 20 %', () => {
    const s = (school: number, match: number) => rec('session', { start: 0, end: 1, minutes: { school, match, game: 0, base: 0, rest: 0 } });
    expect(val(metrics([s(30, 70)], [], course), 'schoolShare')).toMatchObject({ value: 0.3, alarm: true });
    expect(val(metrics([s(10, 90)], [], course), 'schoolShare')).toMatchObject({ value: 0.1, alarm: false });
    expect(val(metrics([s(0, 0)], [], course), 'schoolShare').value).toBeNull();
  });

  it('игры: на базе, до золота; пропуски перерыва и «Школы»', () => {
    const g = (gold: number, base: boolean, t: number) => rec('game', { game: 'x', gold, base, stake: 0 }, t);
    const rows = metrics(
      [g(0, true, 1), g(0, false, 2), g(2, true, 3), g(3, false, 4), rec('skip', { what: 'break' }), rec('skip', { what: 'school' }), rec('skip', { what: 'break' })],
      [],
      course,
    );
    expect(val(rows, 'baseGames').value).toBe(2);
    expect(val(rows, 'gamesToGold').value).toBe(3);
    expect(val(rows, 'breakSkips').value).toBe(2);
    expect(val(metrics([g(0, false, 1)], [], course), 'gamesToGold').value).toBeNull();
  });

  it('«Школа»: пропуски и доля медалей с первой попытки', () => {
    const sc = (attempt: number, medal: number, skipped: boolean) => rec('school', { tour: 1, attempt, medal, skipped });
    const rows = metrics([sc(1, 3, false), sc(2, 1, false), sc(1, 0, true), sc(3, 2, false)], [], course);
    expect(val(rows, 'schoolSkips').value).toBe(1);
    expect(val(rows, 'firstTryMedals').value).toBeCloseTo(1 / 3, 10);
  });

  it('проход с 1-й попытки: по первой попытке урока, брошенный open — не проход', () => {
    const rows = metrics(
      [
        match({ lesson: 'a', attempt: 1, outcome: 'loss' }),
        match({ lesson: 'a', attempt: 2, outcome: 'win' }),
        match({ lesson: 'b', attempt: 1, outcome: 'win' }),
        match({ lesson: 'c', attempt: 1, outcome: 'open' }),
        match({ lesson: 'd', attempt: 1, outcome: 'win' }),
      ],
      [],
      course,
    );
    expect(val(rows, 'firstTryPass').value).toBe(0.5);
  });

  it('медиана печати: знаков в минуту по завершённым матчам', () => {
    const m = (signs: number, ms: number, outcome = 'win') => match({ signs, ms, outcome });
    const rows = metrics([m(100, 60_000), m(300, 60_000), m(200, 60_000), m(9999, 1000, 'open')], [], course);
    expect(val(rows, 'medianCpm').value).toBe(200);
    expect(val(metrics([m(100, 60_000), m(300, 60_000)], [], course), 'medianCpm').value).toBe(200);
  });
});
