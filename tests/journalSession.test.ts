// Журнал игры: сеанс (018-Т4, 018-Р24): области маршрутов, минуты, скрытая вкладка. Часы и окно — поддельные.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ROUTE_AREA, areaOf, createSessionTracker, startSession } from '../src/app/journal/session';

describe('журнал: сеанс', () => {
  it('маршруты → область', () => {
    expect(['match', 'cup', 'school-1', 'home', 'club', undefined].map(areaOf)).toEqual(['match', 'match', 'school', 'base', 'base', 'base']);
  });

  it('минуты по областям; скрытая вкладка не считается; смена игрока закрывает сеанс', () => {
    // Ловит: минуты фона (вкладка в углу) в «время игры».
    let t = 0;
    const tr = createSessionTracker(() => t, 'aaaa');
    tr.go('base', 'p1');
    t = 2 * 60_000;
    tr.go('match', 'p1');
    t = 5 * 60_000;
    tr.pause();
    t = 65 * 60_000; // час в фоне
    tr.resume();
    t = 66 * 60_000;
    const s = tr.snapshot()!;
    expect(s.data.minutes).toEqual({ match: 4, school: 0, game: 0, base: 2, rest: 0 });
    const { closed } = tr.go('base', 'p2');
    expect(closed?.player).toBe('p1');
    expect(tr.snapshot()).toBeNull(); // у нового сеанса ещё нет минут
  });

  it('каждое имя маршрута из router.ts классифицировано в session.ts явно', () => {
    // Ловит: новый экран без строки в таблице областей молча попадает в `base` — минуты матча/игры/школы теряются.
    const src = readFileSync(new URL('../src/app/router.ts', import.meta.url), 'utf8');
    const names = [...src.matchAll(/\bname: '([\w-]+)'/g)].map((m) => m[1] ?? '');
    expect(names.length).toBeGreaterThanOrEqual(7);
    expect(names.filter((n) => !(n in ROUTE_AREA))).toEqual([]);
    // Таблица без лишнего: имени, которого нет в роутере, там быть не должно.
    expect(Object.keys(ROUTE_AREA).filter((n) => !names.includes(n))).toEqual([]);
  });

  it('вкладка открыта в фоне: минуты идут только с первого «видна»', () => {
    // Ловит: вкладка, открытая в фоне (ссылка из чата), копит «время игры» до первого показа.
    let t = 0;
    const log = vi.fn();
    const cbs: Record<string, () => void> = {};
    startSession({
      journal: { log, flush: () => Promise.resolve() },
      now: () => t,
      tab: 'aaaa',
      player: () => 'p1',
      route: () => 'home',
      hidden: () => true,
      onRoute: () => () => undefined,
      onHidden: () => () => undefined,
      onVisible: (cb) => ((cbs.visible = cb), () => undefined),
      onPageHide: (cb) => ((cbs.pagehide = cb), () => undefined),
    });
    t = 10 * 60_000;
    cbs.pagehide?.();
    expect(log).not.toHaveBeenCalled(); // десять минут в фоне — пустая запись не пишется
    cbs.visible?.();
    t = 12 * 60_000;
    cbs.pagehide?.();
    const data = (log.mock.calls.at(-1)?.[0] as Array<{ data: { minutes: { base: number } } }>)[0]?.data;
    expect(data?.minutes.base).toBe(2);
  });
});
