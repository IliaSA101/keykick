/**
 * Подключение планов копий и места в слое хранилища (спека 014-Т8, К3, design §4): снимки дня, порядок освобождения
 * места на канале `next`, потолок копий. Сами планы проверены на уровне движка; здесь — что слой их вызывает.
 * Хранилище в памяти (tests/saveStoreHelpers.ts). Ловит у каждого теста — строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { full } from './saveFixtures';
import { NEXT, TODAY, envText, make, memory, onProbe } from './saveStoreHelpers';

const main = envText(full, 3);
const MAIN_KEY = `${NEXT}save.p1`;
const snap = (day: string): string => `${NEXT}snap.p1.${day}`;
/** Журнал событий: массив записей, заведомо длиннее предела 16 КБ. */
const bigLog = JSON.stringify(Array.from({ length: 400 }, (_, i) => ({ t: i, v: '0.10.1', player: null, kind: 'storage', text: `e${i}`.padEnd(60, '.') })));

describe('снимки дня при первой загрузке', () => {
  // Ловит: снимок дня не пишется или пишется не сырым текстом; снимков копится больше трёх; повторная загрузка пишет заново.
  it('снимок = сырой текст основного ключа; остаются 3 новейших; повтор в тот же день не пишет', () => {
    const init: Record<string, string> = { [MAIN_KEY]: main };
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) init[snap(d)] = `старый ${d}`;
    const { io, data, state } = memory(init);
    make(io).load('p1');
    expect(data.get(snap(TODAY))).toBe(main);
    const snaps = [...data.keys()].filter((k) => k.startsWith(`${NEXT}snap.p1.`)).sort();
    expect(snaps).toEqual([snap('2026-11-03'), snap('2026-11-04'), snap(TODAY)]);
    // Вторая «вкладка» в тот же день: снимок уже есть, записей нет.
    const writes = state.writes;
    const before = Object.fromEntries(data);
    make(io).load('p1');
    expect([state.writes, Object.fromEntries(data)]).toEqual([writes, before]);
  });
});

describe('освобождение места на канале next', () => {
  /** Хранилище с квотой «впритык»: любой рост основного ключа требует освободить место. Сегодняшний снимок уже лежит. */
  function tight(extra: Record<string, string>) {
    const init = { [MAIN_KEY]: main, [snap(TODAY)]: main, ...extra };
    const mem = memory(init, { quota: memory(init).used() });
    const s = make(mem.io);
    s.load('p1');
    return { ...mem, s };
  }
  const grow = (n: number) =>
    onProbe((v) => ({ ...v, days: Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, 1000])) }));
  const q = (n: number): string => `${NEXT}quarantine.p1.${n}`;

  // Ловит: журнал не режется первым — вместо него страдают снимки; или режется не до предела.
  it('сначала режется журнал событий, снимки и карантин целы', () => {
    const { s, data } = tight({ [`${NEXT}events`]: bigLog, [snap('2026-11-01')]: 'старый снимок', [q(1)]: 'q'.repeat(100) });
    s.update('p1', grow(3));
    const log = JSON.parse(data.get(`${NEXT}events`) ?? '[]') as unknown[];
    expect(log.length).toBeLessThan(400);
    expect(JSON.stringify(log).length).toBeLessThanOrEqual(16 * 1024);
    expect(data.has(snap('2026-11-01'))).toBe(true);
    expect(data.has(q(1))).toBe(true);
    expect(s.status().storageFull).toBe(false);
  });

  // Ловит: шаг «снимки» ничего не удаляет (место берётся из карантина) или сносит сегодняшний снимок.
  it('журнала нет → удаляются несегодняшние снимки и repair, сегодняшний и карантин целы', () => {
    const { s, data } = tight({ [snap('2026-11-01')]: 'старый снимок', [`${NEXT}pre.p1.repair.2026-11-02`]: 'r'.repeat(80), [q(1)]: 'q'.repeat(100) });
    s.update('p1', grow(3));
    expect(data.has(snap('2026-11-01'))).toBe(false);
    expect(data.has(`${NEXT}pre.p1.repair.2026-11-02`)).toBe(false);
    expect(data.get(snap(TODAY))).toBe(main);
    expect(data.has(q(1))).toBe(true);
    expect(s.status().storageFull).toBe(false);
  });

  // Ловит: «старое» удаляется раньше снимков, оптом или не с самого старого.
  it('снимков мало → после них по одному старое, самое старое первым; сегодняшний снимок цел', () => {
    const { s, data } = tight({ [snap('2026-11-01')]: 'x', [q(1)]: 'a'.repeat(60), [q(2)]: 'b'.repeat(60), [q(3)]: 'c'.repeat(60) });
    s.update('p1', grow(8));
    expect(data.has(snap('2026-11-01'))).toBe(false);
    expect(data.get(snap(TODAY))).toBe(main);
    expect(data.has(q(1))).toBe(false);
    expect(data.has(q(3))).toBe(true);
    expect(s.status().storageFull).toBe(false);
  });
});

describe('потолок копий 512 КБ', () => {
  const big = (c: string): string => c.repeat(200_000);
  const q = (p: string, n: number): string => `${p}quarantine.p1.${n}`;
  const init = (p: string): Record<string, string> => ({
    [`${p}save.p1`]: main,
    [q(p, 1)]: big('a'),
    [q(p, 2)]: big('b'),
    [q(p, 3)]: big('c'),
  });
  type Store = ReturnType<typeof make>;
  const acts: Array<(s: Store) => unknown> = [(s) => s.reset('p1'), (s) => s.remove('p1')];

  // Ловит: потолок не применяется после копии-перед-основным (reset) и после удаления игрока на next.
  it('next: после reset и после remove копии сверх 512 КБ удаляются, старые раньше', () => {
    for (const act of acts) {
      const { io, data } = memory(init(NEXT));
      const s = make(io);
      s.load('p1');
      expect(data.has(q(NEXT, 1))).toBe(true);
      act(s);
      expect(data.has(q(NEXT, 1))).toBe(false);
      expect(data.has(q(NEXT, 2))).toBe(true);
      expect(data.has(q(NEXT, 3))).toBe(true);
    }
  });

  // Ловит: потолок действует и на release — там копии не режутся по размеру.
  it('release: те же копии остаются', () => {
    const P = 'keykick-v2.';
    for (const act of acts) {
      const { io, data } = memory(init(P));
      const s = make(io, P, 'release');
      s.load('p1');
      act(s);
      for (const n of [1, 2, 3]) expect(data.has(q(P, n))).toBe(true);
    }
  });
});
