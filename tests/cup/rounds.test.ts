/**
 * Раунды Кубка Двора (068-Т1, К1): якоря, день 3, «в следующий раз», «после победы в 1/8», флажок главной, разминка после паузы.
 */
import { describe, expect, it } from 'vitest';
import { anchorOf, cupRound, nextMatch, roundStates, cupStage } from '../../src/engine/cup/rounds';
import { cupView } from '../../src/engine/cup/view';
import { emptyCup, recordKo, recordTour } from '../../src/engine/cup/section';
import { ctx, playGroup, playKo } from './model';
import { cupHome } from '../../src/app/cup/input';

describe('068-Т1-К1: раунды Кубка', () => {
  it('К1 якоря: группа 9, 14, 18, плей-офф 21, 24, 28, 32 (ТЗ-8.3)', () => {
    // Ловит: сдвиг якоря раунда (флажок Карты и открытие матча разошлись с ТЗ-8.3).
    expect((['g1', 'g2', 'g3', 'r16', 'qf', 'sf', 'f'] as const).map(anchorOf)).toEqual([9, 14, 18, 21, 24, 28, 32]);
  });

  it('К1 день 3: урок 9 пройден — день 1 «на 3-й день», день 2 «в следующий раз», с дня 3 — открыто (048-Р36)', () => {
    // Ловит: матч Кубка открылся до 3-го игрового дня или «в следующий раз» перепутан с «на 3-й день».
    const c = emptyCup();
    expect(roundStates(c, ctx({ cur: 9, dayN: 5 }))[0]).toBe('before');
    expect(roundStates(c, ctx({ cur: 10, dayN: 1 }))[0]).toBe('day3');
    expect(roundStates(c, ctx({ cur: 10, dayN: 2 }))[0]).toBe('later');
    expect(roundStates(c, ctx({ cur: 10, dayN: 3 }))[0]).toBe('open');
    expect(cupRound(c, ctx({ cur: 10, dayN: 2 }))).toBeNull();
    expect(cupRound(c, ctx({ cur: 10, dayN: 3 }))).toBe(9);
  });

  it('К1 поражение — тур снова: состояние replay, флажок прежний, тур не засчитан', () => {
    // Ловит: проигранный тур засчитан или раунд сгорел.
    const c = recordTour(emptyCup(), 1, 0, 2);
    expect(c.tours[0]).toEqual({ me: null, opp: null, tries: 1 });
    expect(roundStates(c, ctx({ cur: 10 }))[0]).toBe('replay');
    expect(cupRound(c, ctx({ cur: 10 }))).toBe(9);
    expect(cupStage(c)).toBe('group1');
  });

  it('К1 «после победы в 1/8» (038-Р16): якорь 1/4 пройден, 1/8 не выиграна — qf ждёт', () => {
    // Ловит: следующий раунд открыт без победы в прошлом.
    const c = recordKo(playGroup(['W', 'W', 'W']), 'r16', 0, 1, null, '2026-11-20');
    expect(roundStates(c, ctx({ cur: 25 })).slice(3)).toEqual(['replay', 'wait', 'before', 'before']);
    expect(roundStates(c, ctx({ cur: 40 })).slice(3)).toEqual(['replay', 'wait', 'wait', 'wait']);
  });

  it('К1 пауза ≥ 5 дней: открытый раунд идёт с разминкой, закрытый — нет (Э5.15)', () => {
    // Ловит: разминка потеряна после паузы или показана при закрытом раунде.
    const c = emptyCup();
    const rival = (): string | null => null;
    expect(nextMatch(c, ctx({ cur: 10, pause5: true }), rival).warmup).toBe(true);
    expect(nextMatch(c, ctx({ cur: 10, pause5: false }), rival).warmup).toBe(false);
    expect(nextMatch(c, ctx({ cur: 5, pause5: true }), rival).warmup).toBe(false);
  });

  it('К1 день 1: сетка и таблицы есть до урока 9 (просмотр, 038-Р39); соперники туров — по порядку группы', () => {
    // Ловит: вид Кубка пуст без пройденных уроков или соперники туров перепутаны.
    const v = cupView(emptyCup(), ctx({ cur: 1, dayN: 1 }));
    expect(v.groups).toHaveLength(8);
    expect(v.bracket.r16).toHaveLength(8);
    expect(v.path.slice(0, 3).map((p) => p.rival)).toEqual(['granit', 'mayak', 'iskra']);
    expect(v.next.state).toBe('before');
    expect(v.stage).toBe('group1');
  });
});

describe('068-Т5: поставщик Кубка для Дома (cupHome)', () => {
  it('К1 день 3: урок 9 пройден — до дня 3 «игры — в следующий раз», с дня 3 флажок 9 на главной кнопке', () => {
    // Ловит: раунд на главной кнопке в день 2 или карточка «до урока 9» после урока 9.
    const c = emptyCup();
    expect(cupHome(c, ctx({ cur: 10, dayN: 2 }))).toMatchObject({ round: null, end: false, card: { key: 'игры — в следующий раз' } });
    expect(cupHome(c, ctx({ cur: 10, dayN: 3 }))).toEqual({ round: 9, end: false, silver: false, card: null });
    expect(cupHome(c, ctx({ cur: 5, dayN: 3 })).card).toBeNull();
  });

  it('К1 группа пройдена: карточка «группа пройдена · N-е место» и «1/8 с Заречной, после урока 21»', () => {
    // Ловит: пустая карточка между группой и 1/8 или соперник 1/8 не двор Карты (023-Р35а).
    const h = cupHome(playGroup(['W', 'W', 'W']), ctx({ cur: 19 }));
    expect(h.round).toBeNull();
    expect(h.card).toEqual({ key: 'группа пройдена · 1-е место', params: { sub: '1/8 с Заречной, после урока 21' } });
  });

  it('К1 переигровка плей-офф (068-Р26, Э2.16): 1/8 проиграна — флажка нет, карточка «ответный матч ждёт», а тур группы остаётся флажком', () => {
    // Ловит: кнопка «Кубок · 1/8» на Доме после поражения в плей-офф (макет — переигровка из сетки) или потеря флажка у проигранного тура группы.
    const lost = recordKo(playGroup(['W', 'W', 'W']), 'r16', 0, 1, null, '2026-11-20');
    expect(cupHome(lost, ctx({ cur: 22 }))).toEqual({ round: null, end: false, silver: false, card: { key: '1/8 финала: ответный матч ждёт', params: { sub: 'с Заречной — в сетке Кубка' } } });
    expect(cupHome(recordTour(emptyCup(), 1, 0, 2), ctx({ cur: 10 }))).toMatchObject({ round: 9, card: null });
  });

  it('К3 титул и серебро: золото — «Кубок наш» без раунда; серебро — карточка и без кнопки финала, Района нет', () => {
    // Ловит: после проигранного финала главная зовёт «В Район» или кнопка финала остаётся на Доме.
    const won = playKo(playGroup(['W', 'W', 'W']), 4);
    expect(cupHome({ ...won, title: 'gold' }, ctx({ cur: 33 }))).toEqual({ round: null, end: true, silver: false, card: null });
    expect(cupHome({ ...won, title: 'silver', ko: { ...won.ko, f: { ...won.ko.f, won: false, tries: 1 } } }, ctx({ cur: 33 }))).toEqual({
      round: null, end: false, silver: true, card: { key: 'Финал: серебро', params: { sub: 'за золотом — сыграть снова' } },
    });
  });
});
