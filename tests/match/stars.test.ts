/**
 * Звёзды, рекорд, лестница помощи (К1, ТЗ-4.1, 2.6, 2.9, 2.17): чистые функции без матча.
 */
import { describe, expect, it } from 'vitest';
import { assistOf, assistRules, backAfter, failsAfter, helpOf, isComeback, newStars, permille, recordOf, restOffered, soften, starsOf } from '../../src/engine/match';
import type { Help } from '../../src/engine/match';
import { courseLessons } from '../course/yard';

const play = (correct: number, errors: number) => ({ correct, errors, keyErrors: {}, fingerErrors: {}, startedAt: 0, lastAt: 0, intervals: [] });
const res = (me: number, opp: number, correct = 1000, errors = 0) => ({ score: { me, opp }, play: play(correct, errors) });

describe('К1: звёзды (ТЗ-4.1, 2.6)', () => {
  it('К1: победа ★, всухую ★★, всухую и точность ≥ 97 % — ★★★; граница 970‰ включена, 969‰ — нет', () => {
    // Ловит: сдвиг порога ★★★, звезду за ничью или поражение печатью, округление вверх (96,9 → 97).
    expect(starsOf(res(1, 1))).toBe(0);
    expect(starsOf(res(1, 2))).toBe(0);
    expect(starsOf(res(3, 1))).toBe(1);
    expect(starsOf(res(3, 0, 1000, 31))).toBe(2);
    expect(starsOf(res(3, 0, 970, 30))).toBe(3);
    expect(starsOf(res(3, 0, 969, 31))).toBe(2);
    expect(permille({ correct: 969, errors: 31 })).toBe(969);
  });

  it('К1: гол пенальти звёзд не меняет — их считают по печати: 3:1 печатью (с пенальти 4:1) — ★, 1:1 + пенальти — 0', () => {
    expect(starsOf(res(3, 1))).toBe(1);
    expect(starsOf(res(1, 1))).toBe(0);
  });

  it('К1: потолок помощи: «с запасом» и смягчение — ★★, «с тренером» — ★; чемпионат звёзд не даёт; новые — сверх лучшего', () => {
    expect(starsOf(res(3, 0), { assist: 'reserve' })).toBe(2);
    expect(starsOf(res(3, 0), { assist: 'coach' })).toBe(1);
    expect(starsOf(res(3, 0), { softened: true })).toBe(2);
    expect(starsOf(res(3, 0), { championship: true })).toBe(0);
    expect(newStars(3, 1)).toBe(2);
    expect(newStars(1, 3)).toBe(0);
  });
});

describe('К1: лестница помощи (ТЗ-2.9)', () => {
  it('К1: 1 — ничего; 2 — минута тренера; 3–4 — «с запасом»; 5+ — «с тренером»', () => {
    // Ловит: сдвиг ступеней (match.json: 2, 3, 5), помощь после 1-го провала.
    expect([0, 1, 2, 3, 4, 5, 9].map((n) => helpOf(n))).toEqual(['none', 'none', 'minute', 'reserve', 'reserve', 'coach', 'coach']);
    const helps: Help[] = ['none', 'minute', 'reserve', 'coach'];
    expect(helps.map(assistOf)).toEqual(['none', 'none', 'reserve', 'coach']);
    expect([2, 3].map((n) => restOffered(n))).toEqual([false, true]);
  });

  it('К1: правила при помощи: запас — c+1, тренер — g+1 и c+1; счётчик сбрасывается проходом, «вернуться» ставит и снимает помощь', () => {
    expect(assistRules({ g: 0, c: 3 }, 'none')).toEqual({ g: 0, c: 3 });
    expect(assistRules({ g: 0, c: 3 }, 'reserve')).toEqual({ g: 0, c: 4 });
    expect(assistRules({ g: 0, c: 3 }, 'coach')).toEqual({ g: 1, c: 4 });
    expect([failsAfter(2, false), failsAfter(4, true)]).toEqual([3, 0]);
    expect([backAfter(false, 'coach', true), backAfter(true, 'none', true), backAfter(true, 'coach', false)]).toEqual([true, false, true]);
  });

  it('К1: смягчение следующего урока — длины и пороги не слабее пройденного', () => {
    const a = courseLessons[0]!;
    const b = courseLessons[1]!;
    const out = soften({ ...b, g: 0, c: 2 }, { ...a, g: 1, c: 4 });
    expect(out).toMatchObject({ g: 1, c: 4, attacks: a.attacks, rows: a.rows, id: b.id });
  });

  it('К1: «Капитан вернулся!» — от 5 суток; без одной мс — нет; первого матча нет — нет', () => {
    const day = 86_400_000;
    expect([isComeback(0, 5 * day), isComeback(0, 5 * day - 1), isComeback(null, 9 * day)]).toEqual([true, false, false]);
  });
});

describe('К1: рекорд урока (ТЗ-2.17)', () => {
  it('К1: первый матч, побит, точнее при той же скорости, не побит, не засчитан', () => {
    // Ловит: путаницу «точнее прошлого» и «быстрее», рекорд от незасчитанного матча.
    const prev = { cpm: 100, permille: 900 };
    expect(recordOf(null, { cpm: 80, permille: 800 }, true)).toMatchObject({ kind: 'first', delta: 0 });
    expect(recordOf(prev, { cpm: 112, permille: 800 }, true)).toMatchObject({ kind: 'beaten', delta: 12 });
    expect(recordOf(prev, { cpm: 100, permille: 950 }, true)).toMatchObject({ kind: 'same', delta: 50 });
    expect(recordOf(prev, { cpm: 100, permille: 900 }, true)).toMatchObject({ kind: 'kept', best: prev });
    expect(recordOf(prev, { cpm: 90, permille: 990 }, true)).toMatchObject({ kind: 'kept', best: prev });
    expect(recordOf(prev, { cpm: 200, permille: 990 }, false)).toMatchObject({ kind: 'kept', best: prev });
    expect(recordOf(null, { cpm: 200, permille: 990 }, false)).toMatchObject({ kind: 'none', best: null });
  });
});
