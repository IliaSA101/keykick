/**
 * Раздел `seen` (063-Р6, 059 А-47, К8): версия «Что нового» и первые входы. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../../src/engine/save/envelope';
import { FIRSTS_MAX, seenDef } from '../../src/engine/seen/section';

describe('раздел seen (К8)', () => {
  it('К8: новичку — версия при создании (010-Р4: чужих новостей нет), первых входов нет, раздел годен', () => {
    // Ловит: у нового игрока `news` пуст или старая версия — после выпуска ему покажут «Что нового» про то, чего он не видел.
    const e = seenDef.empty();
    expect(e).toEqual({ news: APP_VERSION, firsts: {} });
    expect(seenDef.check(e)).toEqual([]);
  });

  it('К8: версия — три числа через точку; всё прочее — `news`', () => {
    // Ловит: в `news` попадает мусор, который сравнение версий превратит в NaN (карточка показывается каждый раз).
    for (const v of ['0.10.1', '2.0.0', '10.20.30']) expect(seenDef.check({ news: v, firsts: {} })).toEqual([]);
    for (const v of ['', '2.0', '2.0.0-rc', 'v2.0.0', 2, null, undefined]) expect(seenDef.check({ news: v, firsts: {} })).toEqual(['news']);
  });

  it('К8: первый вход — id латиницей и существующий день ГГГГ-ММ-ДД', () => {
    // Ловит: день не строкой/не датой (А-20) или произвольный ключ попали в запись.
    expect(seenDef.check({ news: '2.0.0', firsts: { home: '2026-11-18', 'map-yard': '2026-02-28' } })).toEqual([]);
    expect(seenDef.check({ news: '2.0.0', firsts: { home: '2026-02-30' } })).toEqual(['firsts:entry']);
    expect(seenDef.check({ news: '2.0.0', firsts: { home: 1763424000000 } })).toEqual(['firsts:entry']);
    expect(seenDef.check({ news: '2.0.0', firsts: { 'Дом': '2026-11-18' } })).toEqual(['firsts:entry']);
  });

  it('К8: первых входов не больше предела; чужая форма — коды без падения', () => {
    // Ловит: список растёт без предела (раздутый конверт); `check` бросает на мусоре.
    const many = Object.fromEntries(Array.from({ length: FIRSTS_MAX + 1 }, (_, i) => [`s${i}`, '2026-11-18']));
    expect(seenDef.check({ news: '2.0.0', firsts: many })).toEqual(['firsts:count']);
    expect(seenDef.check({ news: '2.0.0', firsts: [] })).toEqual(['firsts']);
    for (const bad of [null, 5, 'x', []]) expect(seenDef.check(bad)).toEqual(['shape']);
  });
});
