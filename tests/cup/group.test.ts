/**
 * Группа Кубка Двора (068-Т1, К1): чужие матчи от семени, подгонка только чужих, 3 ничьи — 2-е место, поражение не в таблице.
 */
import { describe, expect, it } from 'vitest';
import { LETTERS, OUR, OUR_GROUP, groupMatches, groupTable, ourPlace, seedOf } from '../../src/engine/cup/group';
import { emptyCup, recordTour } from '../../src/engine/cup/section';
import { KO_RIVAL_GROUPS } from '../../src/engine/cup/teams';
import { cupView } from '../../src/engine/cup/view';
import { ALL_RES, SEEDS, ctx, playGroup } from './model';

describe('068-Т1-К1: группа Кубка', () => {
  it('К1 одно семя — одна таблица, другое семя — другие счета (ТЗ-8.12)', () => {
    // Ловит: чужие матчи берут случайность или время (таблица «прыгает» при перезагрузке), либо семя не влияет.
    const c = playGroup(['W', 'D', 'W']);
    const a = groupTable('B', 3, c.tours, 42);
    expect(groupTable('B', 3, c.tours, 42)).toEqual(a);
    const other = SEEDS.some((s) => JSON.stringify(groupTable('B', 3, c.tours, s)) !== JSON.stringify(a));
    expect(other).toBe(true);
    expect(seedOf('p1')).toBe(seedOf('p1'));
    expect(seedOf('p1')).not.toBe(seedOf('p2'));
  });

  it('К1 три ничьи — ребёнок 2-й; 2–3 победы — 1-й; 1 победа — 2-й, очки разведены строго (ТЗ-8.12, В-7 = А)', () => {
    // Ловит: подгонка чужих не сходится — ребёнок вылетает из двух первых, делит очки с соседом или попадает не на то место.
    for (const seed of SEEDS) {
      for (const res of ALL_RES) {
        const c = playGroup(res);
        const t = groupTable(OUR_GROUP, 3, c.tours, seed);
        const wins = res.filter((r) => r === 'W').length;
        const place = t.findIndex((r) => r.team === OUR) + 1;
        expect(place, `${res.join('')} seed ${seed}`).toBe(wins >= 2 ? 1 : 2);
        expect(ourPlace(c, seed)).toBe(place);
        const pts = t.map((r) => r.pts);
        // между 2-м и 3-м строго больше очков — выход из группы не зависит от разницы мячей
        expect(pts[1]! > pts[2]!, `${res.join('')} seed ${seed} ${pts.join()}`).toBe(true);
        expect(pts[0]! > pts[1]! || place === 2).toBe(true);
        expect(t.every((r) => r.p === 3)).toBe(true);
      }
    }
  });

  it('К1 чужие группы: порядок посева — 1-е и 2-е места; у групп соперников нашего плей-офф (A, B, D, H) при нашем 1-м месте они меняются', () => {
    // Ловит: чужая таблица не сходится (3-е место обгоняет 2-е, очки 1-го и 2-го равны), либо соперник нашего пути не на том месте в своей группе.
    for (const seed of SEEDS) {
      const win = playGroup(['W', 'W', 'W']);
      const draw = playGroup(['D', 'D', 'D']);
      for (const l of LETTERS.filter((x) => x !== OUR_GROUP)) {
        const t = groupTable(l, 3, draw.tours, seed);
        const base = t.map((r) => r.team);
        expect(t[0]!.pts > t[1]!.pts, `${l} ${seed}`).toBe(true);
        expect(t[1]!.pts > t[2]!.pts, `${l} ${seed}`).toBe(true);
        const tw = groupTable(l, 3, win.tours, seed);
        expect(tw[0]!.pts > tw[1]!.pts && tw[1]!.pts > tw[2]!.pts, `${l} ${seed} win`).toBe(true);
        const w = tw.map((r) => r.team);
        if (KO_RIVAL_GROUPS.has(l)) {
          expect(w.slice(0, 2)).toEqual([base[1], base[0]]);
        } else expect(w).toEqual(base);
      }
    }
  });

  it('design-К6 переигровка тура не меняет чужие матчи: счёт нашего матча и число проигранных попыток не влияют', () => {
    // Ловит: чужие результаты считаются от нашей переигровки (поражения, счёта).
    const others = (cup: ReturnType<typeof emptyCup>): string => {
      const ms = groupMatches(OUR_GROUP, 1, cup.tours, 5).filter((m) => m.a !== 0);
      return JSON.stringify([ms, groupMatches('D', 1, cup.tours, 5)]);
    };
    let lost = recordTour(emptyCup(), 1, 0, 3);
    lost = recordTour(lost, 1, 0, 1);
    const won = recordTour(recordTour(emptyCup(), 1, 5, 0), 2, 1, 1);
    expect(lost.tours[0].tries).toBe(2);
    expect(others(lost)).toBe(others(recordTour(emptyCup(), 1, 3, 0)));
    expect(others(won)).toBe(others(recordTour(emptyCup(), 1, 1, 1)));
  });

  it('К1 проигранный тур в таблицу не идёт (038-Р29): без записи тура нет очков ни у нас, ни у соперника', () => {
    // Ловит: поражение засчитано как матч — у соперника появились очки, у нас — игра.
    const c = recordTour(emptyCup(), 1, 0, 2);
    const v = cupView(c, ctx());
    const row = (id: string): { p: number; pts: number } => v.groups[v.ours]!.rows.find((r) => r.team === id)!;
    expect(v.groups[v.ours]!.lost).toBe(1);
    expect(row(OUR).p).toBe(0);
    expect(row('granit').pts).toBe(0);
  });

  it('К1 группа без вылета: после любых трёх засчитанных туров таблица из 4 команд, а проигрыш тур не сжигает', () => {
    // Ловит: вылет из Кубка (К2) — после поражения тур закрыт или не переигрывается.
    let c = emptyCup();
    for (let i = 0; i < 4; i++) c = recordTour(c, 1, 0, 1);
    expect(c.tours[0].tries).toBe(4);
    c = recordTour(c, 1, 1, 1);
    expect(c.tours[0]).toEqual({ me: 1, opp: 1, tries: 4 });
  });
});
