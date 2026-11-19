/**
 * Урок матча Кубка (068-Т2, К-Б; ТЗ-8.3, 8.4): всё пройденное к якорю, +21–24 % печати, строгость якоря, слабые клавиши, id (068-Р24), доп. время.
 */
import { describe, expect, it } from 'vitest';
import { courseLessons } from '../course/yard';
import { ID_RE } from '../../src/content/schema/ids';
import { cupLesson, CUP_BOOST, extraTime } from '../../src/engine/cup/lesson';
import { ROUNDS } from '../../src/engine/home/yard';
import { emptyForm, type FormState } from '../../src/engine/form/rank';
import type { CourseLesson } from '../../src/engine/plan/lesson';

const lesson = (n: number): CourseLesson => courseLessons.find((l) => l.n === n)!;
const cupOf = (n: number, form: FormState = emptyForm()): CourseLesson => cupLesson(n, courseLessons, form)!;

describe('068-К2: урок матча Кубка', () => {
  it('068-К2 урок Кубка — все буквы пройденных уроков, печати на 21–24 % больше якоря, строгость якоря', () => {
    // Ловит: пропавшие пройденные буквы (ТЗ-8.4); вилка печати вне +21–24 % (ТЗ-8.3); g/c строже якоря; звёздный/дружеский урок.
    for (const n of ROUNDS) {
      const base = lesson(n);
      const cup = cupOf(n);
      const all = courseLessons.filter((l) => l.n <= n).map((l) => l.keys).join('');
      expect([...all].every((c) => cup.keys.includes(c))).toBe(true);
      const ratio = cup.attacks.reduce((a, b) => a + b, 0) / base.attacks.reduce((a, b) => a + b, 0);
      expect(ratio).toBeGreaterThanOrEqual(1.21);
      expect(ratio).toBeLessThanOrEqual(1.24);
      expect(cup.attacks.every((a, i) => a > base.attacks[i]!)).toBe(true);
      expect(cup.rows * cup.rowWidth).toBeGreaterThanOrEqual(Math.max(...cup.attacks));
      expect({ g: cup.g, c: cup.c }).toEqual({ g: base.g, c: base.c });
      expect({ friendly: cup.friendly, newKeys: cup.newKeys }).toEqual({ friendly: false, newKeys: '' });
    }
    expect(CUP_BOOST).toBeGreaterThan(1.21);
    expect(ROUNDS.every((n) => ID_RE.test(cupOf(n).id))).toBe(true);
    expect(cupOf(ROUNDS[0]!).id).toBe(`ru.yard.cup-${ROUNDS[0]}`);
    expect(cupLesson(99, courseLessons, emptyForm())).toBeNull();
  });

  it('068-К2 слабые клавиши чаще: слабый палец формы попадает в фокус; форма без различий — фокус якоря', () => {
    // Ловит: фокус не зависит от формы; слабые пальцы не учитываются (ТЗ-8.4 «слабые клавиши чаще»).
    const n = ROUNDS[2]!;
    const form: FormState = { fingers: { lp: { w: '', max: 4, cand: { rank: 0, n: 0 } }, lr: { w: '', max: 4, cand: { rank: 0, n: 0 } }, lm: { w: '', max: 4, cand: { rank: 0, n: 0 } }, li: { w: '', max: 4, cand: { rank: 0, n: 0 } }, ri: { w: '', max: 4, cand: { rank: 0, n: 0 } }, rm: { w: '', max: 0, cand: { rank: 0, n: 0 } } } };
    const cup = cupOf(n, form);
    expect(cup.focus).toContain('л');
    expect(cupOf(n, emptyForm()).focus).toBe(lesson(n).focus);
    expect(cupOf(n, emptyForm()).focus.length).toBeLessThanOrEqual(cup.focus.length);
  });
});

describe('068-К2: доп. время только в плей-офф', () => {
  it('068-К2 группа без доп. времени, плей-офф — с ним', () => {
    // Ловит: доп. время в матче группы (ТЗ-8.5, 068-Р3) или его отсутствие в плей-офф.
    for (const r of ['g1', 'g2', 'g3'] as const) expect(extraTime(r), r).toBe(false);
    for (const r of ['r16', 'qf', 'sf', 'f'] as const) expect(extraTime(r), r).toBe(true);
  });
});
