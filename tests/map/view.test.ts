/**
 * Карта Двора (065 Т8, спека 054 «Управление», design §4 «Карта Двора»): вид узлов, туман, «Ты здесь», выбор стрелками, переезд.
 * Метки К1–К3 — запреты Карты: выбор за туманом, «Ты здесь» не у `cur`, автобус и матч без Enter.
 * На фикстурах стенда (`tests/fixtures/accepted/map.*.json`) вид совпадает с входом макета (`fx.home`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clampSel, defaultSel, enterLesson, mapView, navigate, pickYard, type MapInput, type MapKey, type MapSel } from '../../src/engine/map';
import { busFacing, leagueSheet, SHEET_LEFT_FROM, travelKey, travelOf, type SheetInput } from '../../src/engine/map';
import { alongPath } from '../../src/screens/map/geometry';
import { isAway, lessonsOf, ROUNDS, stageOf } from '../../src/engine/home';
import mapYard from '../../src/content/map-yard.json';

const input = (cur: number, over: Partial<MapInput> = {}): MapInput => ({ cur, stars: {}, friendly: new Set(), end: false, ...over });
const KEYS: MapKey[] = ['left', 'right', 'up', 'down'];

describe('К1 · выбор за туманом', () => {
  it('туман — за следующим двором: дворы после stageOf(cur)+1 — fog, следующий — near', () => {
    for (let cur = 1; cur <= 32; cur++) {
      const st = stageOf(cur);
      const v = mapView(input(cur));
      for (const n of v.nodes) {
        const want = n.stage < st ? 'done' : n.stage === st ? 'cur' : n.stage === st + 1 ? 'near' : 'fog';
        expect(n.state, `cur ${cur}, двор ${n.stage}`).toBe(want);
      }
    }
  });

  it('К1 · стрелки и клик не уводят выбор дальше двора текущего урока и дальше текущего урока', () => {
    for (let cur = 1; cur <= 33; cur++) {
      const i = input(cur);
      const last = Math.min(cur, 32);
      let sel: MapSel = defaultSel(i);
      for (let k = 0; k < 40; k++) {
        sel = navigate(i, sel, KEYS[k % 3 === 0 ? 1 : k % 4]!);
        expect(sel.stage).toBeLessThanOrEqual(stageOf(last));
        expect(sel.lesson).toBeLessThanOrEqual(last);
        expect(stageOf(sel.lesson)).toBe(sel.stage);
      }
      const before = defaultSel(i);
      for (let stage = stageOf(last) + 1; stage <= 12; stage++) expect(pickYard(i, before, stage)).toBe(before);
    }
  });

  it('К1 · Enter на недопустимом выборе (за туманом, впереди текущего урока) — холостой', () => {
    const i = input(3);
    expect(enterLesson(i, { stage: 5, lesson: 12 })).toBeNull();
    expect(enterLesson(i, { stage: 2, lesson: 4 })).toBeNull();
    expect(enterLesson(i, { stage: 99, lesson: 99 })).toBeNull();
    expect(enterLesson(i, defaultSel(i))).toBe(3);
  });

  it('К1 · устаревший выбор (после смены урока) приводится к текущему, а не остаётся за туманом', () => {
    const i = input(2);
    expect(clampSel(i, { stage: 7, lesson: 22 })).toEqual(defaultSel(i));
    expect(mapView(i, { stage: 7, lesson: 22 }).sel).toEqual({ stage: 1, lesson: 2 });
  });
});

describe('К2 · «Ты здесь» только у cur', () => {
  it('ровно один узел `here` — двор текущего урока; `here` в виде — номер cur', () => {
    for (let cur = 1; cur <= 32; cur++) {
      const v = mapView(input(cur));
      expect(v.here).toBe(cur);
      expect(v.nodes.filter((n) => n.here).map((n) => n.stage)).toEqual([stageOf(cur)]);
    }
  });

  it('К2 · Двор пройден (cur 33) или титул — «Ты здесь» нигде, все дворы пройдены', () => {
    for (const i of [input(33), input(33, { end: true })]) {
      const v = mapView(i);
      expect(v.here).toBeNull();
      expect(v.nodes.some((n) => n.here)).toBe(false);
      expect(v.nodes.every((n) => n.state === 'done' && n.passed)).toBe(true);
    }
  });

  it('выбор другого двора не переносит «Ты здесь»', () => {
    const i = input(17);
    const v = mapView(i, pickYard(i, defaultSel(i), 2));
    expect(v.sel.stage).toBe(2);
    expect(v.nodes.find((n) => n.here)?.stage).toBe(5);
  });
});

describe('К3 · автобус и матч только по Enter', () => {
  it('К3 · переезд (Э2.08): Enter показывает автобус и плашку, второй Enter — в матч, Esc из переезда — на Дом', () => {
    // Ловит: матч сразу с первого Enter (автобус пропущен), автобус без Enter (Esc/другая клавиша), Esc из переезда мимо Дома
    expect(travelKey('idle', 'enter')).toEqual({ phase: 'travel', go: null });
    expect(travelKey('travel', 'enter')).toEqual({ phase: 'travel', go: 'match' });
    expect(travelKey('travel', 'escape')).toEqual({ phase: 'travel', go: 'home' });
  });

  it('К3 · холостое: другая клавиша — ничего; Esc вне переезда не уходит с Карты сам (окно и пузырь разбирает экран)', () => {
    // Ловит: переезд или уход по любой клавише, Esc на обычной Карте — сразу на Дом
    for (const phase of ['idle', 'travel'] as const) expect(travelKey(phase, 'other')).toEqual({ phase, go: null });
    expect(travelKey('idle', 'escape')).toEqual({ phase: 'idle', go: null });
  });

  it('автобус на пути: точка по доле длины ломаной, направление — знак dx (flip), конец отрезка — его последняя точка', () => {
    // Ловит: доля считается по числу точек, а не по длине; автобус не разворачивается на обратном ходе; выход за конец
    const pts: [number, number][] = [[0, 0], [10, 0], [10, 30]];
    expect(alongPath(pts, 0.25)).toEqual({ x: 10, y: 0, dx: 10 });
    expect(alongPath(pts, 0.5)).toEqual({ x: 10, y: 10, dx: 0 });
    expect(alongPath([...pts].reverse(), 0.1)).toEqual({ x: 10, y: 26, dx: 0 });
    expect(alongPath([[5, 5], [0, 5]], 0.5)).toEqual({ x: 2.5, y: 5, dx: -5 });
    expect(alongPath(pts, 1)).toEqual({ x: 10, y: 30, dx: 0 });
  });

  it('стрелки возвращают только выбор {stage, lesson}; урок на матч даёт один enterLesson', () => {
    const i = input(17);
    for (const key of KEYS) expect(Object.keys(navigate(i, defaultSel(i), key)).sort()).toEqual(['lesson', 'stage']);
  });

  it('переезд: первый матч двора — в гостях (автобус едет к ним), следующий — дома (к нам едет автобус соперника)', () => {
    for (let stage = 1; stage <= 10; stage++) {
      const ls = lessonsOf(stage);
      expect(travelOf(ls[0]!)).toMatchObject({ away: true, bus: 'away', stage });
      if (ls[1] !== undefined) expect(travelOf(ls[1])).toMatchObject({ away: false, bus: 'incoming', stage });
      for (const n of ls) expect(travelOf(n).away).toBe(isAway(n));
    }
    expect(travelOf(17).street).toBe('Полевой');
  });
});

describe('навигация ← → ↑ ↓', () => {
  const i = input(17, { stars: { 1: 3, 2: 3, 3: 2, 4: 1, 5: 2, 6: 1, 7: 2, 8: 1, 9: 1, 10: 3, 12: 1 } });
  it('← → двигают двор, на дворе стоит текущий или первый «за звёздами» урок', () => {
    const cur = defaultSel(i);
    expect(cur).toEqual({ stage: 5, lesson: 17 });
    expect(navigate(i, cur, 'right')).toEqual(cur); // дальше текущего двора нельзя
    const left = navigate(i, cur, 'left');
    expect(left.stage).toBe(4);
    expect(left.lesson).toBe(lessonsOf(4).find((n) => i.stars[n] === 1));
    expect(navigate(i, { stage: 1, lesson: 1 }, 'left')).toEqual({ stage: 1, lesson: 1 });
  });

  it('↑ ↓ двигают урок внутри двора и останавливаются на краях и на текущем уроке', () => {
    const s0: MapSel = { stage: 4, lesson: 10 };
    expect(navigate(i, s0, 'up')).toEqual(s0);
    expect(navigate(i, s0, 'down')).toEqual({ stage: 4, lesson: 11 });
    const ls = lessonsOf(5).filter((n) => n <= 17);
    const sel5 = { stage: 5, lesson: ls[0]! };
    expect(navigate(i, sel5, 'down').lesson).toBe(ls[1]);
    expect(navigate(i, { stage: 5, lesson: 17 }, 'down')).toEqual({ stage: 5, lesson: 17 });
  });

  it('состояния уроков: ★ — done, одна ★ — ring, текущий — cur, дальше — near; флажок — у двора ближайшего раунда Кубка', () => {
    const v = mapView(i);
    const l = (n: number) => v.nodes[stageOf(n) - 1]!.lessons.find((x) => x.n === n)!;
    expect(l(2).state).toBe('done');
    expect(l(4).state).toBe('ring');
    expect(l(17).state).toBe('cur');
    expect(l(18).state).toBe('near');
    expect(l(18).reach).toBe(false);
    const next = ROUNDS.find((r) => r >= 17)!;
    expect(v.nodes.filter((n) => n.flag === 'next').map((n) => n.stage)).toEqual([stageOf(next)]);
    expect(mapView({ ...i, end: true }).nodes.some((n) => n.flag === 'next')).toBe(false);
  });
});

describe('карточка «На матч»: Кубок после урока N', () => {
  it('cupAfter — ближайший раунд Кубка не раньше текущего урока; после титула и раундов — null', () => {
    const first = ROUNDS[0]!;
    expect(mapView(input(1)).cupAfter).toBe(first);
    expect(mapView(input(first)).cupAfter).toBe(first);
    expect(mapView(input(first + 1)).cupAfter).toBe(ROUNDS.find((r) => r > first));
    expect(mapView(input(ROUNDS.at(-1)! + 1)).cupAfter).toBeNull();
    expect(mapView(input(10, { end: true })).cupAfter).toBeNull();
  });
});

describe('ракурс автобуса', () => {
  it('8 направлений: 5 ракурсов и зеркало, нулевой вектор — спереди', () => {
    expect(busFacing(1, 0)).toEqual({ view: 'side', flip: false });
    expect(busFacing(-1, 0)).toEqual({ view: 'side', flip: true });
    expect(busFacing(0, 1)).toEqual({ view: 'front', flip: false });
    expect(busFacing(0, -1)).toEqual({ view: 'back', flip: false });
    expect(busFacing(1, 1)).toEqual({ view: 'front34', flip: false });
    expect(busFacing(-1, 1)).toEqual({ view: 'front34', flip: true });
    expect(busFacing(1, -1)).toEqual({ view: 'back34', flip: false });
    expect(busFacing(-1, -1)).toEqual({ view: 'back34', flip: true });
    expect(busFacing(0, 0)).toEqual({ view: 'front', flip: false });
  });
});

describe('содержимое карты и фикстуры стенда', () => {
  it('10 дворов в map-yard.json по порядку ступеней, у каждого по отрезку пути', () => {
    expect(mapYard.yards.map((y) => y.stage)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mapYard.route).toHaveLength(11);
    mapYard.yards.forEach((y, k) => expect(mapYard.route[k]!.at(-1)).toEqual(y.at));
  });

  const dir = new URL('../fixtures/accepted/', import.meta.url);
  const fixtures = readdirSync(dir).filter((f) => f.startsWith('map.')).map((f) => [f, JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { home: { cur: number; end: boolean; stars: Record<string, number> } }] as const);
  it.each(fixtures)('%s: «Ты здесь» у cur, туман за следующим двором', (_f, fx) => {
    const { cur, end } = fx.home;
    const v = mapView(input(cur, { end, stars: Object.fromEntries(Object.entries(fx.home.stars).map(([k, s]) => [Number(k), s])) }));
    if (cur > 32) expect(v.here).toBeNull();
    else {
      expect(v.here).toBe(cur);
      expect(v.nodes.filter((n) => n.state === 'fog').length).toBe(Math.max(0, 10 - stageOf(cur) - 1));
    }
  });
});

const SHEET: SheetInput['parts'] = { stars: { have: 23, total: 96 }, album: { have: 17, total: 39 }, emblem: { have: 5, total: 10 }, rights: { have: 6, total: 8 } };
const sheetAt = (cur: number, parts: SheetInput['parts'] = SHEET) => leagueSheet({ cur, parts });

describe('К30 · «Лист лиги» (068-Р17): сделано до урока 17, осталось с него', () => {
  it('К30 · режим «осталось» начинается ровно с урока 17', () => {
    expect(sheetAt(SHEET_LEFT_FROM - 1).left).toBe(false);
    expect(sheetAt(SHEET_LEFT_FROM).left).toBe(true);
    expect(SHEET_LEFT_FROM).toBe(17);
  });
  it('К30 · строки по порядку: звёзды, альбом, эмблема, права; «осталось» = всего − сделано (Э2.30: ещё 73 ★)', () => {
    const rows = sheetAt(17).rows;
    expect(rows.map((r) => r.key)).toEqual(['stars', 'album', 'emblem', 'rights']);
    expect(rows.map((r) => r.left)).toEqual([73, 22, 5, 2]);
    expect(rows[0]!.pct).toBeCloseTo((23 / 96) * 100);
  });
  it('К30 · край: сделано больше всего (битые данные) и отрицательное — не выходят за 0…всего', () => {
    const over = sheetAt(20, { ...SHEET, album: { have: 50, total: 39 }, rights: { have: -1, total: 8 } });
    expect(over.rows[1]).toMatchObject({ have: 39, left: 0, pct: 100 });
    expect(over.rows[3]).toMatchObject({ have: 0, left: 8, pct: 0 });
  });
});
