/**
 * Сетка Кубка Двора (068-Т1, К1): 16 ячеек → 1, улицы не повторяются, наш путь, финал против «Рассвета», счета открываются по раундам.
 */
import { describe, expect, it } from 'vitest';
import { OUR } from '../../src/engine/cup/group';
import { bracketOf, koRival } from '../../src/engine/cup/bracket';
import { KO_ROUNDS, ROUND_KEYS, anchorOf } from '../../src/engine/cup/rounds';
import { emptyCup, recordKo, recordTour } from '../../src/engine/cup/section';
import { TEAMS, rivalOf } from '../../src/engine/cup/teams';
import { cupMilestones, cupView } from '../../src/engine/cup/view';
import { ALL_RES, SEEDS, ctx, playGroup, playKo } from './model';

const streetOf = (id: string): string => (id === OUR ? 'наш' : TEAMS.find((t) => t.id === id)!.street);

describe('068-Т1-К1: сетка плей-офф', () => {
  it('К1 сетка 8+4+2+1; до конца группы команды неизвестны, после — 16 разных команд на 16 разных улицах (К7, ТЗ-8.9)', () => {
    // Ловит: повтор улицы или команды в сетке, пустая сетка после группы, неверная форма сетки.
    const before = bracketOf(emptyCup(), 3);
    expect(KO_ROUNDS.map((r) => before[r].length)).toEqual([8, 4, 2, 1]);
    expect(before.r16.every((c) => c.a === null && c.b === null)).toBe(true);
    expect(before.r16[1]).toMatchObject({ refA: '1C', refB: '2D' });
    for (const seed of SEEDS) {
      for (const res of ALL_RES) {
        const b = bracketOf(playGroup(res), seed);
        const ids = b.r16.flatMap((c) => [c.a, c.b]);
        expect(ids.every((x) => x !== null)).toBe(true);
        expect(new Set(ids).size).toBe(16);
        expect(new Set(ids.map((x) => streetOf(x!))).size).toBe(16);
      }
    }
  });

  it('К1 наш путь: 1-е место — M2 против 2D, 2-е — M6 против 1D; в плей-офф каждый раунд есть соперник, финал — «Рассвет» (038-Р6)', () => {
    // Ловит: путь ребёнка не по сетке, финал не против сквозного соперника, соперник раунда не определён.
    for (const seed of SEEDS) {
      for (const res of ALL_RES) {
        const c = playGroup(res);
        const first = res.filter((r) => r === 'W').length >= 2;
        const b = bracketOf(c, seed);
        expect(b.r16[first ? 1 : 5]!.a === OUR || b.r16[first ? 1 : 5]!.b === OUR).toBe(true);
        for (const r of KO_ROUNDS) expect(koRival(c, seed, r), `${r} ${seed}`).not.toBeNull();
        expect(koRival(c, seed, 'f')).toBe('rassvet');
      }
    }
  });

  it('К1 соперник плей-офф — двор Дома и Карты: koRival и путь вида совпадают с rivalOf(якорь) при любом семени и исходе группы (023-Р35а)', () => {
    // Ловит: сетка ведёт ребёнка к другому сопернику, чем Дом и Карта (21 Заречной, 24 Фонтанной, 28 Сосновой, 32 Яблоневой); сквозной «Рассвет» на пути не в финале.
    for (const seed of SEEDS) {
      for (const res of ALL_RES) {
        const c = playGroup(res);
        for (const r of KO_ROUNDS) expect(koRival(c, seed, r), `${r} ${res.join('')} ${seed}`).toBe(rivalOf(anchorOf(r)).id);
        const path = cupView(c, ctx({ seed, cur: 40 })).path;
        for (const [i, r] of ROUND_KEYS.entries()) expect(path[i]!.rival, `${r} ${seed}`).toBe(rivalOf(anchorOf(r)).id);
      }
    }
  });

  it('К1 прогноз не раскрыт до игр: пока раунд не выигран, команды следующего раунда в ячейках неизвестны; выиграли — известны', () => {
    // Ловит: сетка раскрывает команды 1/4, полуфинала и финала до победы в прошлом раунде (К6).
    const g = playGroup(['W', 'W', 'D']);
    const none = bracketOf(g, 9);
    for (const r of ['qf', 'sf', 'f'] as const) expect(none[r].every((c) => c.a === null && c.b === null), r).toBe(true);
    const one = bracketOf(playKo(g, 1), 9);
    expect(one.qf.every((c) => c.a !== null && c.b !== null)).toBe(true);
    expect(one.sf.every((c) => c.a === null && c.b === null)).toBe(true);
  });

  it('design-К6 чужие счета раунда открываются, когда мы выиграли этот раунд; победитель ячейки — тот, кто прошёл дальше', () => {
    // Ловит: счета чужих матчей видны раньше времени или сетка не сходится (победитель 1/8 не в 1/4).
    const g = playGroup(['W', 'W', 'D']);
    const hidden = bracketOf(g, 9);
    expect(hidden.r16.every((c) => c.win === null && c.score === null)).toBe(true);
    const c = playKo(g, 1);
    const b = bracketOf(c, 9);
    expect(b.r16.every((x) => x.win !== null && x.score !== null)).toBe(true);
    expect(b.qf.every((x) => x.a !== null && x.b !== null && x.win === null)).toBe(true);
    const winners = b.r16.map((x) => (x.win === 'a' ? x.a : x.b));
    expect(b.qf.flatMap((x) => [x.a, x.b])).toEqual(winners);
  });

  it('К1 счёт нашей ячейки — наш: серия отмечена; проигрыш раунда — «ответный», сетка не меняется', () => {
    // Ловит: счёт нашего матча чужой или проигрыш двигает сетку (К2).
    const g = playGroup(['W', 'W', 'W']);
    const lost = recordKo(g, 'r16', 0, 1, null, '2026-11-20');
    const bl = bracketOf(lost, 4);
    const mine = bl.r16.find((c) => c.a === OUR || c.b === OUR)!;
    expect(mine.lost).toBe(true);
    expect(mine.win).toBeNull();
    expect(JSON.stringify(bl.qf)).toBe(JSON.stringify(bracketOf(g, 4).qf));
    const won = bracketOf(recordKo(lost, 'r16', 1, 1, 'w', '2026-11-21'), 4).r16.find((c) => c.a === OUR || c.b === OUR)!;
    expect(won.score).toMatchObject({ pen: true });
    expect(won.win === 'a' ? won.a : won.b).toBe(OUR);
  });

  it('К1 первый матч проигран — веха «первый матч» есть и счёт 0:1 для заголовка газеты; выигранный ответный счёт не затирает', () => {
    // Ловит: выпуск 3 ждёт победы (проигранный первый матч — без вехи) или заголовок теряет счёт первого матча (story.md §1, «любой исход»).
    const lost = recordTour(emptyCup(), 1, 0, 1);
    expect(cupMilestones(lost)).toMatchObject({ first: true, firstScore: { me: 0, opp: 1 }, group: false });
    const again = recordTour(lost, 1, 3, 0);
    expect(cupMilestones(again).firstScore).toEqual({ me: 0, opp: 1 });
    expect(cupMilestones(recordTour(emptyCup(), 1, 2, 2)).firstScore).toEqual({ me: 2, opp: 2 });
  });

  it('К1 вехи Кубка и вид: первый матч, группа, полуфинал, итог финала', () => {
    // Ловит: вехи газеты и комиксов не совпадают с ходом Кубка.
    expect(cupMilestones(emptyCup())).toEqual({ first: false, firstScore: null, group: false, semi: false, final: null });
    const g = playGroup(['W', 'D', 'W']);
    expect(cupMilestones(g)).toEqual({ first: true, firstScore: { me: 2, opp: 1 }, group: true, semi: false, final: null });
    expect(cupMilestones(playKo(g, 3)).semi).toBe(true);
    expect(cupMilestones(playKo(g, 4)).final).toBe('gold');
    const silver = recordKo(playKo(g, 3), 'f', 0, 1, null, '2026-11-20');
    expect(cupMilestones(silver).final).toBe('silver');
    const v = cupView(silver, ctx({ cur: 40 }));
    expect(v.stage).toBe('f');
    expect(v.next.state).toBe('replay');
    expect(cupView(playKo(g, 4), ctx({ cur: 40 })).next.state).toBe('done');
  });
});
