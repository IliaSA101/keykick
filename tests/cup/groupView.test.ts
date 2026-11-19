/**
 * Вид вкладки «Группа» экрана Кубка (068 Т5, Э5.01–.08): строка статуса, панель «Следующий матч», ячейки таблицы.
 * Модель — `cupView` (семя 1 из `ctx`); тексты сверяются с `ru`, числа чужих счетов — не проверяются (это модель).
 */
import { describe, expect, it } from 'vitest';
import { cupView } from '../../src/engine/cup/view';
import { emptyCup, recordKo, recordTour } from '../../src/engine/cup/section';
import type { Cup } from '../../src/engine/cup/types';
import { emblemKey, groupScreen } from '../../src/app/cup/groupView';
import { fill } from '../../src/app/home/texts';
import { ru } from '../../src/i18n/ru';
import { ctx, playGroup } from './model';

const s = ru.cup.screen;
const screen = (c: Cup, cur: number, dayN: number) => groupScreen(cupView(c, ctx({ cur, dayN })), { cur, dayN }, 'Прогресс');
const won = (n = 3): Cup => playGroup(Array<'W'>(n).fill('W'));
const lostR16 = (): Cup => recordKo(won(), 'r16', 0, 2, null, '2026-11-20');

describe('068-Т5: вкладка «Группа» — строка статуса', () => {
  it('068-Т5-К1 до матчей: «ещё без матчей», наша строка без очков и без заливки (idle)', () => {
    // Ловит: статус «1-е из 4 · 0 очков» до первого матча; заливка «победа» на пустой строке.
    const g = screen(emptyCup(), 10, 3);
    expect(g.status).toBe(s.noMatches);
    const our = g.rows.find((r) => r.our)!;
    expect(our.idle).toBe(true);
    expect(our.pts).toBe('—');
    expect(our.place).toBe('—');
  });

  it('068-Т5-К2 группа не доиграна: «N-е из 4 · очки» со склонением («4 очка»)', () => {
    // Ловит: «выход в 1/8» объявлен до третьего тура; потеряно склонение очков.
    expect(screen(playGroup(['W', 'D']), 19, 5).status).toBe('1-е из 4 · 4 очка');
  });

  it('068-Т5-К3 группа пройдена с победами — «N-е — выход в 1/8», без побед — «3 очка — 2-е место, выход в 1/8!»', () => {
    // Ловит: две формулировки выхода (с победами и «чистые ничьи») перепутаны, место не из таблицы.
    expect(screen(won(), 19, 5).status).toBe('1-е — выход в 1/8');
    const draws = screen(playGroup(['D', 'D', 'D']), 19, 5);
    expect(draws.status).toBe('3 очка — 2-е место, выход в 1/8!');
    expect(draws.rows.findIndex((r) => r.our)).toBe(1);
  });
});

describe('068-Т5: вкладка «Группа» — «Следующий матч» (nextOf)', () => {
  it('068-Т5-К4 open: «На матч», соперник тура и «где играем», без статуса', () => {
    // Ловит: панель без кнопки при открытом матче; соперник не по порядку туров.
    const n = screen(emptyCup(), 10, 3).next!;
    expect(n.action).toBe(ru.home.go);
    expect(n.status).toBeNull();
    expect(n.emblem).toBe(emblemKey('granit'));
    expect(n.withOpp).toBe('с «Гранитом»');
    expect(n.phase).toBe('1-й матч группы');
  });

  it('068-Т5-К5 lost: проигранный тур группы — «Переиграть: …», «вылета нет», в таблице ячейка «↻»', () => {
    // Ловит: поражение в группе подано как вылет или без переигровки.
    const g = screen(recordTour(emptyCup(), 1, 0, 2), 10, 3);
    expect(g.next!.action).toBe('Переиграть: 1-й матч группы');
    expect(g.next!.note).toBe(s.noElimination);
    expect(g.rows.find((r) => r.our)!.cells[0]).toMatchObject({ kind: 'lost', text: '↻', open: false });
  });

  it('068-Т5-К6 stack: проигранный 1/8 при пройденном якоре 1/4 — «1/4 — после победы в 1/8», иначе «тот же раунд снова»', () => {
    // Ловит: подсказка про очередь раундов (два флажка Карты на один матч) не зависит от урока.
    const a = screen(lostR16(), 25, 5).next!;
    expect(a.action).toBe(s.replayRound);
    expect(a.note).toBe('1/4 — после победы в 1/8');
    expect(screen(lostR16(), 22, 5).next!.note).toBe(s.sameRound);
    expect(screen(lostR16(), 24, 5).next!.note).toBe(s.sameRound); // якорь 1/4 (24) ещё не пройден: cur 24 — урок впереди
  });

  it('068-Т5-К7 day1: первый день, якорь не пройден — «игры — после урока 9»; пройден — «в следующий раз» (день 2), день 1 — тот же', () => {
    // Ловит: на 1-й день обещано «после урока N» вместо правила дня 3 (048-Р36).
    expect(screen(emptyCup(), 1, 1).next!.status).toBe(ru.home.cup.before);
    expect(screen(emptyCup(), 10, 1).next!.status).toBe(ru.cup.card.later);
    expect(screen(emptyCup(), 10, 2).next!.status).toBe(ru.cup.card.later);
    expect(screen(emptyCup(), 10, 2).next!.action).toBeNull();
  });

  it('068-Т5-К8 before g3: до третьего тура — «после урока 18 · хватит ничьей»', () => {
    // Ловит: подсказка «хватит ничьей» пропала у 3-го тура или протекла на 2-й.
    expect(screen(playGroup(['W', 'D']), 18, 5).next!.status).toBe(`${fill(s.afterLesson, { n: 18 })} · ${s.drawEnough}`);
    expect(screen(playGroup(['W']), 14, 5).next!.status).toBe(fill(s.afterLesson, { n: 14 }));
  });

  it('068-Т5-К9 Кубок взят: панели нет (кубок и «Сыграть снова» — на вкладке «Сетка»)', () => {
    // Ловит: после золотого финала панель предлагает матч, которого нет.
    expect(screen(recordKo(recordKo(recordKo(recordKo(won(), 'r16', 2, 1, null, 'd'), 'qf', 2, 1, null, 'd'), 'sf', 2, 1, null, 'd'), 'f', 2, 1, null, 'd'), 40, 9).next).toBeNull();
  });
});

describe('068-Т5: вкладка «Группа» — ячейки таблицы', () => {
  it('068-Т5-К10 наши победы и ничьи — w/d, чужие — oth, будущие — «—»; открыта только ближайшая наша', () => {
    // Ловит: ячейка следующего тура светится не у нашей строки или у чужого тура; ничья окрашена как победа.
    const g = screen(playGroup(['W', 'D']), 19, 5);
    const our = g.rows.find((r) => r.our)!;
    expect(our.cells.map((c) => c.kind)).toEqual(['w', 'd', 'no']);
    expect(our.cells.map((c) => c.open)).toEqual([false, false, true]);
    expect(our.cells.map((c) => c.text)).toEqual(['2:1', '1:1', '—']);
    const others = g.rows.filter((r) => !r.our);
    expect(others.every((r) => r.cells.every((c) => !c.open && (c.kind === 'oth' || c.kind === 'no')))).toBe(true);
  });

  it('068-Т5-К11 линия отсечки — под вторым местом, только когда матчи были; очки — по таблице', () => {
    // Ловит: линия «двое выходят» нарисована до матчей или под другой строкой.
    expect(screen(emptyCup(), 10, 3).rows.some((r) => r.cut)).toBe(false);
    const rows = screen(won(), 19, 5).rows;
    expect(rows.map((r) => r.cut)).toEqual([false, true, false, false]);
    expect(rows[0]!.pts).toBe('9');
  });

  it('068-Т5-К12 дорожка: зажжены пройденные раунды, отрезки — между зажжёнными', () => {
    // Ловит: узел «1/8» горит до конца группы; отрезок тянется к незажжённому узлу.
    expect(screen(playGroup(['W', 'W']), 19, 5).track.some((n) => n.lit)).toBe(false);
    const t = screen(won(), 19, 5).track;
    expect(t.map((n) => n.lit)).toEqual([true, false, false, false]);
    expect(t.some((n) => n.seg)).toBe(false);
    const t2 = screen(recordKo(won(), 'r16', 2, 1, null, 'd'), 25, 5).track;
    expect(t2.map((n) => [n.lit, n.seg])).toEqual([[true, true], [true, false], [false, false], [false, false]]);
  });
});
