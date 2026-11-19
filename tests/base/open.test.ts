/** К5 (067 Т6): открытие игр на интерес, лимит дня, раздел `base` (ТЗ-7.10, 7.12, 10.1). */
import { describe, expect, it } from 'vitest';
import cfg from '../../src/content/base.json';
import { finishFun } from '../../src/engine/base/finish';
import { baseView, FUN_IDS, type BaseCtx } from '../../src/engine/base/open';
import { baseDef, type Base } from '../../src/engine/base/section';
import { funName } from '../../src/app/base/run';
import { memoFound } from '../../src/app/base/memo';
import type { MemoState } from '../../src/engine/base/games/memo';

const learn = { games: {}, recent: [] };
const ctx = (p: Partial<BaseCtx> = {}): BaseCtx => ({ day: '2026-11-19', cur: 1, open: true, matchesToday: 1, cupPlayed: false, ...p });
const empty = (): Base => baseDef.empty();
const openIds = (b: Base, c: BaseCtx): string[] => baseView(b, learn, c).fun.filter((f) => f.open).map((f) => f.id);

describe('К5 · открытие игр (ТЗ-7.12)', () => {
  it('Ловит: id игр навсегда — пять, из контента', () => {
    expect(FUN_IDS).toEqual(['keepy', 'mini', 'free', 'memo', 'keeper']);
    expect(cfg.perDay).toBe(2);
  });

  it('Ловит: веха — урок пройден: Мемори после 14, Вратарь после 21, Штрафной — только с матчем Кубка', () => {
    expect(openIds(empty(), ctx({ cur: 1 }))).toEqual(['keepy']);
    expect(openIds(empty(), ctx({ cur: 4 }))).toEqual(['keepy', 'mini']);
    expect(openIds(empty(), ctx({ cur: 15 }))).toEqual(['keepy', 'mini', 'memo']);
    expect(openIds(empty(), ctx({ cur: 15, cupPlayed: true }))).toEqual(['keepy', 'mini', 'free', 'memo']);
    expect(openIds(empty(), ctx({ cur: 22, cupPlayed: true }))).toEqual(FUN_IDS);
  });

  it('Ловит: граница вехи строгая — cur 3: Мини закрыт, 14: Мемори закрыт, 21: Вратарь закрыт (мутант > → >=)', () => {
    expect(openIds(empty(), ctx({ cur: 3 }))).not.toContain('mini');
    expect(openIds(empty(), ctx({ cur: 14, cupPlayed: true }))).not.toContain('memo');
    expect(openIds(empty(), ctx({ cur: 21, cupPlayed: true }))).not.toContain('keeper');
    expect(openIds(empty(), ctx({ cur: 21, cupPlayed: true }))).toContain('memo');
  });

  it('Ловит: База закрыта по замку или нет матча дня — все игры закрыты с причиной', () => {
    expect(openIds(empty(), ctx({ open: false }))).toEqual([]);
    const v = baseView(empty(), learn, ctx({ matchesToday: 0 }));
    expect(v.fun.every((f) => !f.open)).toBe(true);
    expect(v.fun[0]?.wait).toBe('afterMatch');
    expect(baseView(empty(), learn, ctx({ cur: 1 })).fun[1]?.wait).toBe('later');
  });

  it('Ловит: «новая» — веха есть, игру ещё не видели; рекорд виден', () => {
    const b: Base = { ...empty(), seen: ['keepy'], records: { keepy: { n: 7, day: '2026-11-18' } } };
    const v = baseView(b, learn, ctx({ cur: 4 }));
    expect(v.fun.map((f) => f.newMark)).toEqual([false, true, false, false, false]);
    expect(v.fun[0]?.record?.n).toBe(7);
    expect(v.fun[1]?.record).toBeNull();
  });
});

describe('К5 · лимит дня (ТЗ-7.10)', () => {
  let n = 0;
  const play = (b: Base, id: string, day = '2026-11-19'): Base => finishFun({ base: b }, { id, score: 5, run: `r${n++}` }, { day }).save.base;

  it('Ловит: 3-я игра на интерес за день закрыта, остальные — «завтра», на другой день снова 2 (краснел на откате: да)', () => {
    let b = empty();
    b = play(b, 'keepy');
    expect(baseView(b, learn, ctx({ cur: 4 })).left).toBe(1);
    b = play(b, 'keepy');
    const v = baseView(b, learn, ctx({ cur: 4 }));
    expect(v.left).toBe(0);
    expect(v.spent).toBe(2);
    expect(v.fun.filter((f) => f.open)).toEqual([]);
    expect(v.fun[0]?.wait).toBe('tomorrow');
    const third = finishFun({ base: b }, { id: 'keepy', score: 99, run: 'r99' }, { day: '2026-11-19' });
    expect(third.view).toBe('closed');
    expect(third.save.base).toEqual(b);
    expect(baseView(b, learn, ctx({ cur: 4, day: '2026-11-20' })).left).toBe(2);
    expect(play(b, 'keepy', '2026-11-20').today).toBe(1);
  });
});

describe('К5 · контент base.json (ТЗ-7.12)', () => {
  it('Ловит: kind ∈ {base, lesson, cup}, better ∈ {high, low}, id без повторов (К5)', () => {
    for (const g of cfg.games) {
      expect(['base', 'lesson', 'cup']).toContain(g.open.kind);
      expect(['high', 'low']).toContain(g.better);
    }
    expect(new Set(cfg.games.map((g) => g.id)).size).toBe(cfg.games.length);
  });
});

describe('К5 · раздел base принимает только id из контента', () => {
  it('Ловит: чужой id игры в рекордах и «видел» — ошибка', () => {
    expect(baseDef.check({ day: null, today: 0, records: { keepy: { n: 3, day: '2026-11-19' } }, lastN: {}, played: [], last: null, seen: ['memo'] })).toEqual([]);
    expect(baseDef.check({ day: null, today: 0, records: { nope: { n: 3, day: '2026-11-19' } }, lastN: {}, played: [], last: null, seen: [] })).toEqual(['records']);
    expect(baseDef.check({ day: null, today: 0, records: {}, lastN: {}, played: [], last: null, seen: ['nope'] })).toEqual(['seen']);
  });
  const ok = (): Record<string, unknown> => ({ ...empty() });
  it('Ловит: границы полей — played с чужим id, last с run не строкой или пустым, дата 30 февраля в рекорде и в lastN, чужой id и нецелое в lastN (К5)', () => {
    expect(baseDef.check({ ...ok(), played: ['nope'] })).toEqual(['played']);
    expect(baseDef.check({ ...ok(), last: { run: 5, id: 'keepy' } })).toEqual(['last']);
    expect(baseDef.check({ ...ok(), last: { run: '', id: 'keepy' } })).toEqual(['last']);
    expect(baseDef.check({ ...ok(), last: { run: 'a', id: 'nope' } })).toEqual(['last']);
    expect(baseDef.check({ ...ok(), records: { keepy: { n: 1, day: '2026-02-30' } } })).toEqual(['records']);
    expect(baseDef.check({ ...ok(), lastN: { nope: { n: 1 } } })).toEqual(['lastN']);
    expect(baseDef.check({ ...ok(), lastN: { free: { n: 1, t: 47.3 } } })).toEqual(['lastN']);
    expect(baseDef.check({ ...ok(), lastN: { free: { n: -1 } } })).toEqual(['lastN']);
    expect(baseDef.check({ ...ok(), lastN: { free: { n: 2, t: 47 } } })).toEqual([]);
  });
});

describe('К5 · вид игры: сыграна сегодня, последний счёт', () => {
  it('Ловит: сыграна вчера — сегодня не «сыграна»; сыграна сегодня — «сыграна» (К5)', () => {
    const b = finishFun({ base: empty() }, { id: 'keepy', score: 4, run: 'p1' }, { day: '2026-11-18' }).save.base;
    expect(baseView(b, learn, ctx({ cur: 4 })).fun[0]?.played).toBe(false);
    expect(baseView(b, learn, ctx({ cur: 4, day: '2026-11-18' })).fun[0]?.played).toBe(true);
  });

  it('Ловит: «в прошлый раз» хранится по каждой игре, не одна на все; «последняя — рекорд» считается (Э4.08)', () => {
    let b = finishFun({ base: empty() }, { id: 'keepy', score: 9, run: 'q1' }, { day: '2026-11-19' }).save.base;
    b = finishFun({ base: b }, { id: 'mini', score: 3, run: 'q2' }, { day: '2026-11-19' }).save.base;
    const v = baseView(b, learn, ctx({ cur: 4 })).fun;
    expect(v[0]?.last).toEqual({ n: 9 });
    expect(v[0]?.lastRecord).toBe(true);
    expect(v[4]?.last).toBeNull();
    b = finishFun({ base: { ...b, today: 0 } }, { id: 'keepy', score: 5, run: 'q3' }, { day: '2026-11-19' }).save.base;
    const w = baseView(b, learn, ctx({ cur: 4 })).fun;
    expect(w[0]?.last).toEqual({ n: 5 });
    expect(w[0]?.record?.n).toBe(9);
    expect(w[0]?.lastRecord).toBe(false);
    expect(w[1]?.last).toEqual({ n: 3 });
  });
});

describe('К22 · имя закрытой игры', () => {
  it('К22 закрытая игра — название без клавиш («Вратарь»), открытая — полное; у игр без клавиш в названии разницы нет', () => {
    expect(funName('keeper', true)).toBe('Вратарь');
    expect(funName('keeper', false)).toBe('Вратарь ФЫВА ОЛДЖ');
    expect(funName('free', true)).toBe(funName('free', false));
  });
});

describe('К33 · порядок форм в итоге Мемори (067 Т22, Р228)', () => {
  it('К33 форма, которой нет в наборе сохранения, встаёт по порядку альбома (после набора), клуб — последним', () => {
    const card = (key: string, kit: string) => ({ key, kit, face: 'done' as const });
    const kits = ['sand', 'strawberry', 'club', 'scarlet', 'tangerine'];
    const s = { cards: kits.flatMap((k, i) => [card(`a${i}`, k), card(`b${i}`, k)]), up: [], shownAt: 0, moves: 5, done: true } as unknown as MemoState;
    expect(memoFound(s, ['club', 'scarlet', 'tangerine'])).toEqual(['scarlet', 'tangerine', 'strawberry', 'sand', 'club']);
  });
});
