/**
 * Вид вкладки «Сетка» экрана Кубка (068 Т5, Э5.09–.22): наша половина слева, «пока» до конца группы, счёт с победителя, панель шага, М3.
 * Модель — `cupView` (семя 1); числа чужих счетов не проверяются (это модель).
 */
import { describe, expect, it } from 'vitest';
import { cupView } from '../../src/engine/cup/view';
import { emptyCup, recordKo } from '../../src/engine/cup/section';
import type { Cup } from '../../src/engine/cup/types';
import { bracketScreen, flightOf, hoverPop, motionRound, wonKoCount } from '../../src/app/cup/bracketView';
import { cupGeo } from '../../src/components/cup/cupGeo';
import { ru } from '../../src/i18n/ru';
import { ctx, playGroup } from './model';

const geo = cupGeo(1137.7778);
const screen = (c: Cup, cur: number, dayN = 5, seed = 1) => {
  const view = cupView(c, ctx({ cur, dayN, seed }));
  return { view, bs: bracketScreen(view, c, { cur, dayN }, 'Прогресс', geo, false) };
};
const won = (): Cup => playGroup(['W', 'W', 'W']);
const win = (c: Cup, n: number): Cup => (['r16', 'qf', 'sf', 'f'] as const).slice(0, n).reduce((a, r) => recordKo(a, r, 2, 1, null, 'd'), c);

describe('068-Т5: вкладка «Сетка» — вид', () => {
  it('068-Т5-К20 наша пара — всегда в левой половине, при любом семени', () => {
    // Ловит: наша пара 1/8 осталась справа — путь к кубку пошёл справа налево (038-Р1).
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
      const { bs } = screen(won(), 19, 5, seed);
      const ours = bs.pairs.find((p) => p.round === 'r16' && p.ours)!;
      expect(ours.dir).toBe(1);
      expect(ours.x).toBe(0);
    }
  });

  it('068-Т5-К21 до конца группы пары 1/8 «пока» (рамка tent) из текущей таблицы, дальше раунды — «?»', () => {
    // Ловит: 1/8 пустая до конца группы (038-Р2) или «пока» не помечено пунктиром.
    const { bs } = screen(emptyCup(), 10, 3);
    const r16 = bs.pairs.filter((p) => p.round === 'r16');
    expect(r16.every((p) => p.cls.includes('tent') && p.slots[0] !== null && p.slots[1] !== null)).toBe(true);
    expect(bs.pairs.filter((p) => p.round === 'qf').every((p) => p.slots[0] === null && p.slots[1] === null)).toBe(true);
    expect(screen(won(), 19).bs.pairs.some((p) => p.cls.includes('tent'))).toBe(false);
  });

  it('068-Т5-К22 счёт пишется с победителя, проигравший тускнеет, наш путь — линия our; проигранный 1/8 — warn и «ждёт ответа»', () => {
    // Ловит: счёт «1:2» вместо «2:1»; проигравший не тускнеет; проигрыш подан как победа.
    const a = screen(win(won(), 1), 25);
    const ourPill = a.bs.pills.find((p) => p.pair === a.bs.pairs.find((x) => x.round === 'r16' && x.ours)!.key)!;
    expect(ourPill.text).toBe('2:1');
    const our = a.bs.pairs.find((p) => p.round === 'r16' && p.ours)!;
    expect(our.slots.filter((s) => s?.lose)).toHaveLength(1);
    expect(a.bs.lines.some((l) => l.cls === 'our')).toBe(true);
    const lost = screen(recordKo(won(), 'r16', 0, 2, null, 'd'), 22);
    const lp = lost.bs.pairs.find((p) => p.round === 'r16' && p.ours)!;
    expect(lp.cls).toContain('warn');
    expect(lost.bs.pills.find((p) => p.pair === lp.key)).toMatchObject({ text: '2:0', warn: true });
    expect(lp.slots.some((s) => s?.lose)).toBe(false);
  });

  it('068-Т5-К23 панель шага: «На матч» при открытом, «Кубок наш!»/«Сыграть снова» после титула, серебро — «Сыграть финал снова»', () => {
    // Ловит: после титула панель предлагает матч; серебро без «сыграть финал снова» (068-Р29).
    expect(screen(won(), 19).bs.step).toMatchObject({ kind: 'plain', action: null });
    expect(screen(win(won(), 1), 25).bs.step).toMatchObject({ action: ru.home.go });
    const title = screen(win(won(), 4), 40, 9);
    expect(title.bs.step).toMatchObject({ kind: 'title', lead: ru.cup.screen.titleLead, action: ru.cup.screen.playAgain, quiet: true });
    expect(title.bs.cup.lit).toBe(true);
    expect(title.bs.heads.some((h) => h.round === 'f')).toBe(false);
    const silver = recordKo(win(won(), 3), 'f', 1, 2, null, 'd');
    expect(screen(silver, 40, 9).bs.step).toMatchObject({ kind: 'silver', action: ru.cup.screen.playFinalAgain, emblem: 'cupMedal' });
    expect(screen(emptyCup(), 1, 1).bs.step).toMatchObject({ kind: 'wait', lead: ru.home.cup.before });
  });

  it('068-Т5-К24 подсказка команды: группа, место и очки; «может стать соперником» — только пока группа не доиграна', () => {
    // Ловит: подсказка без группы команды или с обещанием соперника после конца группы.
    const early = screen(playGroup(['W']), 10);
    const name = early.bs.pairs[0]!.slots[1]!.name;
    const pop = hoverPop(early.view, name, early.bs, geo)!;
    expect(pop.where).toMatch(/^группа [A-H]: \d-е · \d /);
    expect(pop.maybe).toBe(ru.cup.screen.popMaybe);
    const late = screen(won(), 19);
    expect(hoverPop(late.view, late.bs.pairs[0]!.slots[1]!.name, late.bs, geo)!.maybe).toBe('');
    expect(hoverPop(late.view, 'Нет такой', late.bs, geo)).toBeNull();
  });

  it('068-Т5-К25 М3: движение — только если с прошлого показа выигран ровно один раунд до финала; полёт — из 1/8 в 1/4', () => {
    // Ловит: движение на первом показе, после титула или при пропуске раундов; карточка летит не в свою ячейку.
    expect(motionRound(null, 1)).toBeNull();
    expect(motionRound(0, 0)).toBeNull();
    expect(motionRound(0, 2)).toBeNull();
    expect(motionRound(0, 1)).toBe('r16');
    expect(motionRound(2, 3)).toBe('sf');
    expect(motionRound(3, 4)).toBeNull();
    expect(wonKoCount(win(won(), 2))).toBe(2);
    const { bs } = screen(win(won(), 1), 25);
    const f = flightOf(bs, 'r16')!;
    const dst = bs.pairs.find((p) => p.round === 'qf' && p.ours)!;
    expect(f.toX).toBe(dst.x);
    expect(f.w).toBe(dst.w);
    expect(flightOf(bs, 'f')).toBeNull();
  });
});
