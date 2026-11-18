/**
 * Модель навигации Двора (063 Т3, К5): по одному тесту на каждый запрет Z1–Z11 из `054-nav-model/design.md` §2.
 * У каждого теста строка «Ловит:» — какую поломку он видит. Часы — числами, случайность — `createRandom(seed)`.
 */
import { describe, expect, it } from 'vitest';
import { createRandom, pick, randomInt } from '../../src/engine/random';
import {
  LEAGUES,
  NAV,
  addressOf,
  leagueIndex,
  navigate,
  openAt,
  parseAddress,
  settle,
  start,
  type NavCtx,
  type NavInput,
  type NavResult,
  type NavState,
} from '../../src/engine/nav';
import { CITY, DISTRICT, ctxOf, menu } from './helpers';

const T = 10_000; // шаг между вводами больше любого перехода и паузы упора

/** Вводы для обхода: всё, что может прийти от ребёнка. */
function randomInput(rnd: () => number): NavInput {
  const kind = randomInt(rnd, 8);
  if (kind === 0) return { t: 'menu', item: pick(rnd, ['home', 'map', 'cup', 'path', 'club'] as const) };
  if (kind === 1) return { t: 'chipMap' };
  if (kind === 2) return { t: 'esc' };
  if (kind === 3) return { t: 'enter' };
  if (kind === 4) return { t: 'wheel', dir: pick(rnd, ['in', 'out'] as const) };
  if (kind === 5) return { t: 'arrow', dir: pick(rnd, ['left', 'right'] as const) };
  if (kind === 6) return { t: 'hover', league: pick(rnd, LEAGUES) };
  return { t: 'wheel', dir: 'out' };
}

/**
 * Обход: все лиги L, ступени Дома 0/2/3, «пройдена» да/нет; случайные вводы со случайными паузами (в том числе
 * короче перехода — очередь); после каждого ввода проверка инварианта `check(ctx, result, input)`.
 */
function sweep(check: (ctx: NavCtx, r: NavResult, input: NavInput) => void): number {
  const rnd = createRandom(20261118);
  let checked = 0;
  for (const league of LEAGUES) {
    for (const homeSteps of [0, 2, 3]) {
      for (const leagueDone of [false, true]) {
        const ctx = ctxOf({ league, homeSteps, leagueDone, entries: randomInt(rnd, 6) });
        let st = start(ctx).state;
        let now = 0;
        for (let i = 0; i < 400; i++) {
          now += pick(rnd, [0, 50, 200, 500, 700, 1500, 3000]);
          const input = randomInput(rnd);
          const r = navigate(ctx, st, input, now);
          check(ctx, r, input);
          st = r.state;
          checked++;
        }
      }
    }
  }
  return checked;
}

describe('К5 запреты модели навигации (054 §2)', () => {
  it('К5 Z1: выбор на шкале — всегда камера; наведение мыши — подсказка, не выбор', () => {
    // Ловит: фокус или выбор на делении ≠ картинка (Э7.186–188, 191); hover, двигающий камеру (052-Р41 в).
    const ctx = DISTRICT;
    const onPath = navigate(ctx, start(ctx).state, menu('path'), 0).state;
    const hovered = navigate(ctx, onPath, { t: 'hover', league: 'world' }, T);
    expect(hovered.view.level).toBe('district');
    expect(hovered.view.selected).toBe('district');
    expect(hovered.effects).toEqual([{ kind: 'none' }]);
    const moved = navigate(ctx, hovered.state, { t: 'arrow', dir: 'right' }, 2 * T);
    expect(moved.view.level).toBe('city');
    expect(moved.view.selected).toBe('city');
    const n = sweep((_c, r) => expect(r.view.selected).toBe(r.view.level));
    expect(n).toBeGreaterThan(5000);
  });

  it('К5 Z2: пункт меню «Карта» — без шкалы лиг; шкала лиг — только при активном «Путь клуба»', () => {
    // Ловит: меню «Карта» активно, а на экране шкала лиг и ярлыки Пути (Э5.45, Э2Г.07), и наоборот.
    const ctx = DISTRICT;
    const onPath = navigate(ctx, start(ctx).state, menu('path'), 0);
    expect(onPath.view.menuActive).toBe('path');
    expect(onPath.view.scaleLevels).toEqual(LEAGUES);
    const toMap = navigate(ctx, onPath.state, menu('map'), T);
    expect(toMap.view.menuActive).toBe('map');
    expect(toMap.view.scaleLevels).toEqual([]);
    sweep((_c, r) => {
      expect(r.view.menuActive).toBe(r.view.screen);
      expect(r.view.scaleLevels.length > 0).toBe(r.view.menuActive === 'path');
    });
  });

  it('К5 Z3: Карта и Дом лиги, в которую не переехали, не открываются (ни вводом, ни адресом, ни старым состоянием)', () => {
    // Ловит: «Карта Района» при «Ты здесь · Двор» (Э5.45); Карта Страны на уроке 17 Двора (Э2Г.07).
    const yard = ctxOf();
    // адрес с лигой выше L — Карта лиги L
    expect(openAt(yard, parseAddress('#/map?league=district')).mapLeague).toBe('yard');
    // адрес прошлой лиги при L = Район — открывается
    expect(openAt(DISTRICT, parseAddress('#/map?league=yard')).mapLeague).toBe('yard');
    // Enter на Пути клуба на уровне выше L — не «На карту <C>»
    const onPath = navigate(yard, start(yard).state, menu('path'), 0).state;
    const ahead = navigate(yard, onPath, { t: 'arrow', dir: 'right' }, T);
    expect(ahead.view.level).toBe('district');
    const enter = navigate(yard, ahead.state, { t: 'enter' }, 2 * T);
    expect(enter.view.screen).toBe('path');
    expect(enter.effects).toEqual([{ kind: 'main' }]);
    // состояние, записанное при L = Район, у игрока с L = Двор приводится к Карте Двора
    const stale: NavState = { ...start(DISTRICT).state, screen: 'map', mapLeague: 'district' };
    expect(settle(yard, stale).mapLeague).toBe('yard');
    sweep((c, r) => {
      if (r.view.league) expect(leagueIndex(r.view.league)).toBeLessThanOrEqual(leagueIndex(c.league));
    });
  });

  it('К5 Z4: «Ты здесь» — только про L; на Карте прошлой лиги его нет, есть плашка «ты в L»', () => {
    // Ловит: «Ты здесь» не про L; «Ты здесь» на Карте прошлой лиги (З4 модели Э7).
    const ctx = CITY;
    const past = openAt(ctx, parseAddress('/map?league=district'));
    const r = navigate(ctx, past, { t: 'hover', league: 'city' }, 0);
    expect(r.view.league).toBe('district');
    expect(r.view.here).toBeNull();
    expect(r.view.pastPlaque).toBe('city');
    const current = navigate(ctx, openAt(ctx, parseAddress('/map')), { t: 'hover', league: 'city' }, 0);
    expect(current.view.here).toBe('city');
    expect(current.view.pastPlaque).toBeNull();
    sweep((c, r2) => {
      expect(r2.view.here === null || r2.view.here === c.league).toBe(true);
      if (r2.view.screen === 'map' && r2.view.league !== c.league) expect(r2.view.here).toBeNull();
    });
  });

  it('К5 Z5: транспорт, дуги и линии маршрутов — только на Карте, не на Пути клуба', () => {
    // Ловит: самолёт и дуги в рамке Пути клуба (Э2Г.07–08).
    const ctx = DISTRICT;
    const onPath = navigate(ctx, start(ctx).state, menu('path'), 0);
    expect(onPath.view.transport).toBe(false);
    const onMap = navigate(ctx, onPath.state, menu('map'), T);
    expect(onMap.view.transport).toBe(true);
    sweep((_c, r) => expect(r.view.transport).toBe(r.view.screen === 'map'));
  });

  it('К5 Z6: на шкале лиг ровно шесть лиг, «Дом» и «Квартал» — не деления', () => {
    // Ловит: лишнее деление «Дом» или «Квартал» на шкале (052-Р21 а; Э7.112, история).
    expect([...LEAGUES]).toEqual(['yard', 'district', 'city', 'country', 'europe', 'world']);
    const onPath = navigate(DISTRICT, start(DISTRICT).state, menu('path'), 0);
    expect(onPath.view.scaleLevels).toHaveLength(6);
    expect(onPath.view.scaleLevels).not.toContain('home');
    expect(onPath.view.scaleLevels).not.toContain('quarter');
    expect(parseAddress('/path?league=home')).toEqual({ screen: 'path' });
  });

  it('К5 Z7: шкала Дома — не на Пути клуба и не во Дворе; шкала лиг — не на Доме и не на Карте', () => {
    // Ловит: шкала Дома на Пути клуба (Э5.45, Э2Г.07); шкала Дома во Дворе (054-Р4); шкала лиг на Доме или Карте.
    const yardHome = start(ctxOf({ homeSteps: 3 }));
    expect(yardHome.view.scaleHome).toBe(false);
    expect(yardHome.view.chipMap).toBe(true);
    expect(yardHome.view.homeStep).toBeNull();
    const districtHome = start(DISTRICT);
    expect(districtHome.view.scaleHome).toBe(true);
    expect(districtHome.view.chipMap).toBe(false);
    expect(districtHome.view.scaleLevels).toEqual([]);
    const onPath = navigate(DISTRICT, districtHome.state, menu('path'), 0);
    expect(onPath.view.scaleHome).toBe(false);
    sweep((c, r) => {
      if (r.view.screen === 'path') expect(r.view.scaleHome).toBe(false);
      else expect(r.view.scaleLevels).toEqual([]);
      if (c.league === 'yard') expect(r.view.scaleHome).toBe(false);
    });
  });

  it('К5 Z8: Дом всегда лиги L — «в гостях» не бывает, откуда бы ни пришли', () => {
    // Ловит: Дом прошлой лиги после возврата на Карту прошлой лиги и меню «Дом».
    const ctx = CITY;
    const past = openAt(ctx, parseAddress('/map?league=yard'));
    const home = navigate(ctx, past, menu('home'), 0);
    expect(home.view.league).toBe('city');
    expect(home.view.homeStep).toBe(1);
    // уровень Пути клуба прошлой лиги, затем Esc — тоже Дом L
    const path = navigate(ctx, past, { t: 'esc' }, 0);
    expect(path.view.screen).toBe('path');
    expect(path.view.level).toBe('yard');
    const back = navigate(ctx, path.state, { t: 'esc' }, T);
    expect(back.view.league).toBe('city');
    sweep((c, r) => {
      if (r.view.screen === 'home') expect(r.view.league).toBe(c.league);
    });
  });

  it('К5 Z9: вход в Путь клуба — полный только из Дома на первых входах и только на уровень L; с Карты — снятие слоя', () => {
    // Ловит: вход Дом → Двор при L ≠ Двор; полный вход вне первых входов; анимация Дома при входе с Карты (054-Р11, Р17).
    for (const league of LEAGUES) {
      const ctx = ctxOf({ league, homeSteps: 2 });
      const r = navigate(ctx, start(ctx).state, menu('path'), 0);
      expect(r.view.level).toBe(league);
      expect(r.effects).toEqual([{ kind: 'go', from: 'home', to: 'path', via: 'full', league }]);
    }
    const later = ctxOf({ entries: NAV.fullEntries });
    const repeat = navigate(later, start(later).state, menu('path'), 0);
    expect(repeat.effects).toEqual([{ kind: 'go', from: 'home', to: 'path', via: 'short', league: 'yard' }]);
    const onMap = navigate(ctxOf(), start(ctxOf()).state, menu('map'), 0).state;
    const fromMap = navigate(ctxOf(), onMap, menu('path'), T);
    expect(fromMap.effects).toEqual([{ kind: 'go', from: 'map', to: 'path', via: 'layerOff', league: 'yard' }]);
    sweep((c, r, input) => {
      for (const e of r.effects) {
        if (e.kind !== 'go') continue;
        if (e.via === 'full') {
          expect(e.from).toBe('home');
          expect(e.league).toBe(c.league);
          expect(c.entries).toBeLessThan(NAV.fullEntries);
        }
        if (e.via === 'short') expect(e.from).toBe('home');
        if (e.from === 'map' && e.to === 'path') expect(e.via).toBe('layerOff');
        if (input.t === 'menu' && input.item === 'path' && e.to === 'path') expect(e.league).toBe(c.league);
      }
    });
  });

  it('К5 Z10: главная кнопка Дома, Карты лиги L и Пути при C ≥ L — функция ТЗ-1.5; на Пути при C < L — «На карту <C>»', () => {
    // Ловит: своя подстановка вместо ТЗ-1.5 (054-Р12); «На карту <C>» без возврата в L (054-Р6).
    const ctx = CITY;
    expect(start(ctx).view.main).toEqual({ kind: 'tz15' });
    expect(openAt(ctx, parseAddress('/map')).mapLeague).toBe('city');
    expect(navigate(ctx, openAt(ctx, parseAddress('/map')), { t: 'hover', league: 'city' }, 0).view.main).toEqual({ kind: 'tz15' });
    const onPath = navigate(ctx, start(ctx).state, menu('path'), 0);
    expect(onPath.view.main).toEqual({ kind: 'tz15' });
    const behind = navigate(ctx, onPath.state, { t: 'arrow', dir: 'left' }, T);
    expect(behind.view.level).toBe('district');
    expect(behind.view.main).toEqual({ kind: 'toMap', league: 'district', back: 'city' });
    const ahead = navigate(ctx, onPath.state, { t: 'arrow', dir: 'right' }, T);
    expect(ahead.view.main).toEqual({ kind: 'tz15' });
    sweep((c, r) => {
      const v = r.view;
      if (v.screen === 'home' || (v.screen === 'map' && v.league === c.league)) expect(v.main).toEqual({ kind: 'tz15' });
      if (v.screen === 'path' && v.level && leagueIndex(v.level) >= leagueIndex(c.league)) expect(v.main).toEqual({ kind: 'tz15' });
      if (v.screen === 'path' && v.level && leagueIndex(v.level) < leagueIndex(c.league)) expect(v.main?.kind).toBe('toMap');
    });
  });

  it('К5 Z11: колёсико на Доме и Карте Двора не меняет экран — ни первая прокрутка, ни вторая после паузы', () => {
    // Ловит: переключение Дом ↔ Карта Двора колёсиком (054-Р4; слово владельца 13.11) и упор там, где шкалы нет.
    const ctx = ctxOf();
    const home = start(ctx).state;
    for (const dir of ['in', 'out'] as const) {
      const a = navigate(ctx, home, { t: 'wheel', dir }, 0);
      const b = navigate(ctx, a.state, { t: 'wheel', dir }, NAV.bumpPauseMs + 50);
      expect(b.view.screen).toBe('home');
      expect(b.view.bumped).toBeNull();
      expect(b.effects).toEqual([{ kind: 'none' }]);
    }
    const onMap = navigate(ctx, home, menu('map'), T).state;
    for (const dir of ['in', 'out'] as const) {
      const a = navigate(ctx, onMap, { t: 'wheel', dir }, 2 * T);
      const b = navigate(ctx, a.state, { t: 'wheel', dir }, 2 * T + NAV.bumpPauseMs + 50);
      expect(b.view.screen).toBe('map');
      expect(b.view.bumped).toBeNull();
    }
    // на Районе та же прокрутка уже ведёт на Карту (упор, пауза, переход): запрет — именно про Двор
    const d = start(DISTRICT).state;
    const first = navigate(DISTRICT, d, { t: 'wheel', dir: 'out' }, 0);
    expect(first.effects).toEqual([{ kind: 'bump', to: 'map' }]);
  });
});

describe('К5 адрес и состояние', () => {
  it('К5 Z3 (адрес): состояние в адресе — экран и лига Карты; обратимо, незнакомое — Дом', () => {
    // Ловит: потерю лиги Карты при перезагрузке (054-Р9); падение на мусорном адресе.
    const ctx = CITY;
    const past = openAt(ctx, parseAddress('#/map?league=district'));
    expect(addressOf(ctx, past)).toEqual({ screen: 'map', league: 'district' });
    expect(addressOf(ctx, openAt(ctx, parseAddress('/map')))).toEqual({ screen: 'map' });
    expect(parseAddress('#/zzz')).toBeNull();
    expect(start(ctx, parseAddress('#/zzz')).view.screen).toBe('home');
  });
});
