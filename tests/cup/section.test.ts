/**
 * Раздел сохранения `cup` (068-Т1, К1): пусто для старого сохранения, `check`, записи результатов, размер.
 */
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../../src/app/save/sections';
import { claimPack, cupDef, emptyCup, recordKo, recordTour } from '../../src/engine/cup/section';
import type { Cup } from '../../src/engine/cup/types';
import { playGroup, playKo } from './model';

describe('068-Т1-К1: раздел cup', () => {
  it('К1 раздел зарегистрирован; пустой — годен; версия 1, миграций нет', () => {
    // Ловит: раздел не попал в реестр сборки (сохранение его не пишет) или пустое значение не проходит check.
    expect(SECTIONS.map((s) => s.name)).toContain('cup');
    expect(cupDef.check(emptyCup())).toEqual([]);
    expect(cupDef.v).toBe(1);
    expect(cupDef.empty()).toEqual(emptyCup());
  });

  it('К1 check отвергает порчу: не объект, тур вне очереди, раунд без группы, титул без победы, лишний пак, дубль пака', () => {
    // Ловит: испорченный файл сохранения проходит как годный.
    const bad = (mut: (c: Cup) => void): string[] => {
      const c: Cup = JSON.parse(JSON.stringify(playKo(playGroup(['W', 'W', 'W']), 1))) as Cup;
      mut(c);
      return cupDef.check(c);
    };
    expect(cupDef.check(null)).toEqual(['shape']);
    expect(bad(() => undefined)).toEqual([]);
    expect(bad((c) => { c.tours[1].me = null; c.tours[1].opp = null; })).toContain('tours-order');
    expect(bad((c) => { c.tours[0].me = -1; })).toContain('tours');
    expect(bad((c) => { c.tours[0].me = null; c.tours[1].me = null; c.tours[2].me = null; c.tours.forEach((t) => { t.opp = null; }); })).toContain('ko-before-group');
    expect(bad((c) => { c.ko.qf = { tries: 0, won: true, me: 1, opp: 0, series: null }; c.ko.r16.won = false; })).toContain('ko-order');
    expect(bad((c) => { c.title = 'gold'; })).toContain('title-gold');
    expect(bad((c) => { (c as unknown as { title: string }).title = 'bronze'; })).toContain('title');
    expect(bad((c) => { (c as unknown as { packs: string[] }).packs = ['x']; })).toContain('packs');
    expect(bad((c) => { c.packs = ['g1', 'g1']; })).toContain('packs');
    expect(bad((c) => { c.titleDay = '2026-13-40'; })).toContain('titleDay');
    expect(bad((c) => { c.replays = 1.5; })).toContain('replays');
  });

  it('К1 запись: тур вне очереди и повтор засчитанного тура — без изменений; раунд плей-офф до группы — без изменений', () => {
    // Ловит: повтор того же результата (F5) удваивает записи, матч плей-офф идёт мимо группы.
    const e = emptyCup();
    expect(recordTour(e, 2, 1, 0)).toBe(e);
    const one = recordTour(e, 1, 1, 0);
    expect(recordTour(one, 1, 3, 0)).toBe(one);
    expect(recordKo(one, 'r16', 1, 0, null, '2026-11-20')).toBe(one);
    const g = playGroup(['W', 'W', 'W']);
    expect(recordKo(g, 'qf', 1, 0, null, '2026-11-20')).toBe(g);
  });

  it('design-К3 титул: серебро после проигранного финала, золото после победы, повтор после золота — только счётчик (ТЗ-8.13)', () => {
    // Ловит: второй титул, потеря серебра, повтор меняет итог Кубка.
    const semi = playKo(playGroup(['W', 'W', 'W']), 3);
    const silver = recordKo(semi, 'f', 0, 1, null, '2026-11-20');
    expect(silver).toMatchObject({ title: 'silver', titleDay: null });
    expect(recordKo(silver, 'f', 0, 2, null, '2026-11-21').title).toBe('silver');
    const gold = recordKo(silver, 'f', 1, 1, 'w', '2026-11-22');
    expect(gold).toMatchObject({ title: 'gold', titleDay: '2026-11-22', replays: 0 });
    expect(gold.ko.f).toMatchObject({ won: true, tries: 1, series: 'w' });
    const again = recordKo(gold, 'f', 3, 0, null, '2026-11-30');
    expect(again).toEqual({ ...gold, replays: 1 });
    expect(cupDef.check(gold)).toEqual([]);
  });

  it('К1 серия пишется только при ничьей: победа 2:1 с серией «w» — без серии; ничья — с серией', () => {
    // Ловит: серия при недраве попала в сохранение и объявила матч «по пенальти» в сетке.
    const g = playGroup(['W', 'W', 'W']);
    expect(recordKo(g, 'r16', 2, 1, 'w', '2026-11-20').ko.r16.series).toBeNull();
    expect(recordKo(g, 'r16', 1, 1, 'w', '2026-11-20').ko.r16.series).toBe('w');
  });

  it('К1 check: титул и итог финала согласованы, тур и раунд с попытками — только после прошлого, первый матч есть, когда он сыгран', () => {
    // Ловит: порча, при которой золото без победы в финале, победа в финале без золота, серебро без проигранного финала, день титула без золота,
    // проигранный тур 2 при несыгранном туре 1, попытки раунда без прошлого раунда, веха «первый матч» без счёта или счёт без матча.
    const base = (): Cup => JSON.parse(JSON.stringify(playKo(playGroup(['W', 'W', 'W']), 3))) as Cup;
    const gold = recordKo(base(), 'f', 1, 0, null, '2026-11-20');
    const silver = recordKo(base(), 'f', 0, 1, null, '2026-11-20');
    expect(cupDef.check(gold)).toEqual([]);
    expect(cupDef.check(silver)).toEqual([]);
    expect(cupDef.check({ ...gold, title: 'silver', titleDay: null })).toContain('title-gold');
    expect(cupDef.check({ ...gold, title: null, titleDay: null })).toContain('title-gold');
    expect(cupDef.check({ ...silver, ko: { ...silver.ko, f: { ...silver.ko.f, tries: 0 } } })).toContain('title-silver');
    expect(cupDef.check({ ...silver, titleDay: '2026-11-20' })).toContain('title-day');
    expect(cupDef.check({ ...gold, titleDay: null })).toContain('title-day');
    const t = playGroup(['W', 'W', 'W']);
    const hole = { ...t, tours: [{ me: null, opp: null, tries: 0 }, { me: null, opp: null, tries: 2 }, t.tours[2]] } as unknown as Cup;
    expect(cupDef.check(hole)).toContain('tours-order');
    const early = { ...t, ko: { ...t.ko, qf: { tries: 1, won: false, me: 0, opp: 1, series: null } } };
    expect(cupDef.check(early)).toContain('ko-order');
    expect(cupDef.check({ ...t, first: null })).toContain('first');
    expect(cupDef.check({ ...emptyCup(), first: { me: 1, opp: 0 } })).toContain('first');
    expect(cupDef.check({ ...t, first: { me: -1, opp: 0 } })).toContain('first');
  });

  it('К1 пак за первую победу в раунде — один раз', () => {
    // Ловит: второй пак за тот же раунд (ТЗ-5.1, К3).
    const a = claimPack(emptyCup(), 'r16');
    expect(a.first).toBe(true);
    const b = claimPack(a.cup, 'r16');
    expect(b.first).toBe(false);
    expect(b.cup).toBe(a.cup);
  });

  it('К1 размер раздела: пустой и полный Кубок — сотни байт, не килобайты', () => {
    // Ловит: раздел раздулся (чужие матчи попали в сохранение).
    const empty = JSON.stringify(emptyCup()).length;
    const full = recordKo(playKo(playGroup(['W', 'W', 'W']), 3), 'f', 1, 1, 'w', '2026-11-22');
    const size = JSON.stringify({ ...full, packs: ['g1', 'g2', 'g3', 'r16', 'qf', 'sf', 'f'] }).length;
    expect(empty).toBeLessThan(500);
    expect(size).toBeLessThan(600);
  });
});
