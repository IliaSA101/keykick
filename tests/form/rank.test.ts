/**
 * Форма клавиш (К1, ТЗ-2.10): пороги рангов, подтверждение высоких рангов итогами подряд, «не падает», раздел `form`.
 */
import { describe, expect, it } from 'vitest';
import { applyPresses, emptyForm, fingerOf, rank, type FormState } from '../../src/engine/form/rank';
import { formDef } from '../../src/engine/form/section';
import type { Press } from '../../src/engine/match/types';

/** `n` нажатий клавиши «ф» (палец lp), из них `bad` неверных — неверные в конце. */
const presses = (n: number, bad: number, ch = 'ф'): Press[] => Array.from({ length: n }, (_, i) => ({ ch, ok: i < n - bad }));

describe('К1: форма клавиш', () => {
  it('К1: палец — по основной клавише; чужая клавиша и неизвестный палец — без падения, ранг 0', () => {
    expect(fingerOf('Ф')).toBe('lp');
    expect(fingerOf('а')).toBe('li');
    expect(fingerOf('й')).toBeNull();
    expect(rank(emptyForm(), 'lp')).toBe(0);
    expect(rank(emptyForm(), 'нет')).toBe(0);
  });

  it('К1: до 50 нажатий ранга нет; 50 при 90 % — «запас» (1), 95 % — «основа» (2)', () => {
    // Ловит: ранг по малому окну выше «основы», порог 90/95 сдвинут.
    expect(rank(applyPresses(emptyForm(), presses(49, 0)).form, 'lp')).toBe(0);
    expect(rank(applyPresses(emptyForm(), presses(50, 5)).form, 'lp')).toBe(1);
    expect(rank(applyPresses(emptyForm(), presses(50, 4)).form, 'lp')).toBe(1);
    expect(rank(applyPresses(emptyForm(), presses(100, 5)).form, 'lp')).toBe(2);
    expect(rank(applyPresses(emptyForm(), presses(50, 6)).form, 'lp')).toBe(0);
  });

  it('К1: «сборная» и «звезда» — только полное окно 300 и два итога подряд; растёт и дальше не падает', () => {
    // Ловит: «звезду» с первого итога или по неполному окну (замер критика 017 §8), падение ранга.
    let f: FormState = applyPresses(emptyForm(), presses(300, 0)).form;
    expect(rank(f, 'lp')).toBe(2);
    f = applyPresses(f, presses(10, 0)).form;
    expect(rank(f, 'lp')).toBe(4);
    const half = applyPresses(emptyForm(), presses(150, 0)).form;
    expect(rank(half, 'lp')).toBe(2);
    const dropped = applyPresses(f, presses(300, 150)).form;
    expect(rank(dropped, 'lp')).toBe(4);
  });

  it('К1: рост сообщается строкой {палец, было, стало}; чужая клавиша окно не трогает', () => {
    const out = applyPresses(emptyForm(), [...presses(60, 0), ...presses(5, 5, 'й')]);
    expect(out.grew).toEqual([{ finger: 'lp', from: 0, to: 2 }]);
    expect(Object.keys(out.form.fingers)).toEqual(['lp']);
  });

  it('К1: раздел form — пустое годно, битые окно и ранг отвергаются', () => {
    expect(formDef.check(formDef.empty())).toEqual([]);
    expect(formDef.check({ fingers: { lp: { w: '10x', max: 0, cand: { rank: 0, n: 0 } } } })).toEqual(['finger:w']);
    expect(formDef.check({ fingers: { lp: { w: '1', max: 5, cand: { rank: 0, n: 0 } } } })).toEqual(['finger:max']);
    expect(formDef.check(applyPresses(emptyForm(), presses(80, 2)).form)).toEqual([]);
  });
});
