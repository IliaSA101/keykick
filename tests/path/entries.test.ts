/**
 * Путь клуба во Дворе (067 Т10): счёт входов и вид входа (П-З4, П-З5, М8), упор колёсика (М7), вид шкалы и подсказки.
 * Модель навигации (`engine/nav`) — как есть: тест ведёт её настоящими вводами и сверяет счёт со входом.
 */
import { describe, expect, it } from 'vitest';
import { NAV, navigate, start, type NavCtx, type NavEffect, type NavState } from '../../src/engine/nav';
import { countEntry, enterFrame, enterPlan, entriesOf, entryVia, FULL_MS, LAYER_MS, pastYard, pathInput, pathTip, pathView, stopStep } from '../../src/engine/path';
import type { Path } from '../../src/engine/path';

const T = 10_000;
const ctxOf = (entries: number): NavCtx => ({ league: 'yard', leagueDone: false, homeSteps: 0, entries, reduced: false });
const empty = (): Path => ({ entries: {} });
const go = (ctx: NavCtx, st: NavState, input: Parameters<typeof navigate>[2], now = T): NavEffect => navigate(ctx, st, input, now).effects.at(-1)!;

describe('К1 счёт входов в Путь клуба (054-Р11, Р17)', () => {
  it('К1 первые fullEntries входов из Дома — полные, дальше — короткие; счёт растёт только на входе из Дома', () => {
    // Ловит: полный отъезд при каждом входе (ребёнку надоедает); счёт, растущий с Карты или выше fullEntries.
    let path = empty();
    const vias: (string | null)[] = [];
    for (let k = 0; k < NAV.fullEntries + 2; k++) {
      const ctx = ctxOf(entriesOf(path, 'yard'));
      const effect = go(ctx, start(ctx).state, { t: 'menu', item: 'path' });
      vias.push(entryVia(effect));
      path = countEntry(path, 'yard', effect);
    }
    expect(vias).toEqual(['full', 'full', 'full', 'short', 'short']);
    expect(entriesOf(path, 'yard')).toBe(NAV.fullEntries);
  });

  it('К1 вход с Карты: слой гаснет (layerOff), полного нет, счёт не растёт (П-З4)', () => {
    // Ловит: полный отъезд с Карты, в котором нет Дома; счёт входов от Карты.
    const ctx = ctxOf(0);
    const map = navigate(ctx, start(ctx).state, { t: 'chipMap' }, T).state;
    const effect = go(ctx, map, { t: 'menu', item: 'path' }, 2 * T);
    expect(entryVia(effect)).toBe('layerOff');
    expect(countEntry(empty(), 'yard', effect)).toEqual(empty());
  });

  it('К1 не вход в Путь (Esc из Пути, переход на Карту) — вида входа нет, счёт тот же объект', () => {
    // Ловит: счёт и движение на любом переходе.
    const ctx = ctxOf(0);
    const path = navigate(ctx, start(ctx).state, { t: 'menu', item: 'path' }, T).state;
    const back = go(ctx, path, { t: 'esc' }, 2 * T);
    const p = empty();
    expect(entryVia(back)).toBeNull();
    expect(countEntry(p, 'yard', back)).toBe(p);
  });
});

describe('К2 упор колёсика (М7, 054-Р16)', () => {
  it('К2 «дальше» — упор; ещё прокрутки до bumpTtlMs — ничего; поздняя — снова упор', () => {
    // Ловит: колёсико, уводящее в несуществующий Район; бесконечные упоры от хвоста тачпада.
    const first = stopStep(null, 1000);
    expect(first.effect).toBe('bump');
    const second = stopStep(first.stop, 1000 + NAV.bumpPauseMs + 1);
    expect(second.effect).toBe('none');
    expect(second.stop).toBe(first.stop);
    const late = stopStep(first.stop, 1000 + NAV.bumpTtlMs + 1);
    expect(late.effect).toBe('bump');
    expect(late.stop).toEqual({ at: 1000 + NAV.bumpTtlMs + 1 });
  });

  it('К2 перехватывается только «дальше» и → на Пути клуба; «ближе», ←, Дом и Карта — нет', () => {
    // Ловит: упор на Доме и Карте (там колёсика Двора нет); перехват «ближе».
    const path = { screen: 'path' } as const;
    expect(pastYard(path, { t: 'wheel', dir: 'out' })).toBe(true);
    expect(pastYard(path, { t: 'arrow', dir: 'right' })).toBe(true);
    expect(pastYard(path, { t: 'wheel', dir: 'in' })).toBe(false);
    expect(pastYard(path, { t: 'arrow', dir: 'left' })).toBe(false);
    expect(pastYard({ screen: 'home' }, { t: 'wheel', dir: 'out' })).toBe(false);
    expect(pastYard({ screen: 'map' }, { t: 'arrow', dir: 'right' })).toBe(false);
  });
});

describe('К3 вид Пути во Дворе (Э7.183, 174, 184, 186)', () => {
  it('К3 уровень — всегда Двор, Район «строится», кубок мира на конце шкалы', () => {
    // Ловит: выбранное ≠ камера (П-З1); Район открыт в этапе Э1 (П-З3).
    const v = pathView({ cur: 17, regionOpen: false });
    expect(v.level).toBe('yard');
    expect(v.done).toBe(false);
    expect(v.gate).toBe('building');
    expect(v.scale.map((d) => d.kind)).toEqual(['here', 'next', 'far', 'far', 'far', 'world']);
    expect(v.scale.some((d) => d.done)).toBe(false);
    expect(pathView({ cur: 17, regionOpen: true }).gate).toBe('building'); // открыт — только после Двора
  });

  it('К3 Двор пройден (урок 33): галочка на Дворе, урок 32 из 32, Район открыт, если ворота открыты', () => {
    const v = pathView({ cur: 33, regionOpen: true });
    expect(v.done).toBe(true);
    expect(v.lesson).toBe(32);
    expect(v.scale[0]).toMatchObject({ league: 'yard', done: true });
    expect(v.gate).toBe('open');
    expect(pathView({ cur: 33, regionOpen: false }).gate).toBe('building');
  });

  it('К3 подсказки у делений: Район — «через N уроков», дальше — «после предыдущей», Двор — нет', () => {
    // Э7.186: «Район · через 16 уроков» на уроке 17.
    const v = pathView({ cur: 17, regionOpen: false });
    expect(pathTip(v, 'district')).toEqual({ kind: 'lessons', n: 16 });
    expect(pathTip(v, 'city')).toEqual({ kind: 'after', prev: 'district' });
    expect(pathTip(v, 'world')).toEqual({ kind: 'after', prev: 'europe' });
    expect(pathTip(v, 'yard')).toBeNull();
    expect(pathTip(pathView({ cur: 33, regionOpen: false }), 'district')).toEqual({ kind: 'gate', open: false });
  });
});

describe('К4 отъезд от Дома (М8, Э7.192–196)', () => {
  it('К4 концы: t = 0 — Дом на месте и Двор ×3, t = 1 — Двор ×1 и Дома нет (концы равны покою)', () => {
    // Ловит: прыжок картинки в первом и последнем кадре; Дом, оставшийся над Путём.
    const a = enterFrame(0);
    expect(a.k).toBeCloseTo(3);
    expect(a.home).toMatchObject({ scale: 1, opacity: 1 });
    expect(a.home.dx).toBeCloseTo(0);
    expect(a.home.dy).toBeCloseTo(0);
    expect(a.gateOpacity).toBe(0);
    const z = enterFrame(1);
    expect(z.k).toBeCloseTo(1);
    expect(z.home.opacity).toBe(0);
    expect(z.gateOpacity).toBe(1);
    expect(z.hereOpacity).toBeCloseTo(1);
  });

  it('К4 «Ты здесь» стоит с t = 0 и возвращается в конце; флаг идёт от стадиона Дома к месту линейно (054-Р10, Э7.192–196)', () => {
    // Ловит: плашка, входящая только в конце отъезда (на t = 0 её нет — обвязка пропадает); флаг, не стоящий на t = 0 у стадиона Дома.
    expect(enterFrame(0).hereOpacity).toBe(1);
    expect(enterFrame(0.5).hereOpacity).toBe(0);
    expect(enterFrame(1).hereOpacity).toBe(1);
    expect(enterFrame(0).hereDx).toBeGreaterThan(0);
    expect(enterFrame(0).hereDy).toBeLessThan(0);
    expect(enterFrame(1).hereDx).toBe(0);
    expect(enterFrame(0.5).hereDx).toBeCloseTo(enterFrame(0).hereDx / 2);
  });

  it('К4 Дом тает на долях 0,5…0,75; ворота входят в конце; масштаб Двора убывает', () => {
    // Ловит: Дом, тающий с самого начала (двойная картинка); ярлык ворот, вылезающий на увеличенном слое.
    expect(enterFrame(0.5).home.opacity).toBe(1);
    expect(enterFrame(0.75).home.opacity).toBe(0);
    expect(enterFrame(0.25).k).toBeCloseTo(3 ** 0.75);
    expect(enterFrame(0.5).gateOpacity).toBe(0);
    expect(enterFrame(0.75).gateOpacity).toBe(0);
    const ks = [0, 0.25, 0.5, 0.75, 1].map((t) => enterFrame(t).k);
    expect([...ks].sort((x, y) => y - x)).toEqual(ks);
    expect(enterFrame(-1).k).toBeCloseTo(3);
    expect(enterFrame(2).k).toBeCloseTo(1);
  });

  it('К4 план входа: полный 0,9 с, короткий 0,6 с, «меньше движения» — 0,2 с без движения, не вход — нет', () => {
    // Ловит: полный отъезд при «меньше движения»; отъезд при открытии адресом.
    expect(enterPlan('full', false)).toEqual({ ms: FULL_MS, move: true, home: true });
    expect(enterPlan('short', false)).toEqual({ ms: NAV.stepMs, move: true, home: true });
    expect(enterPlan('full', true)).toEqual({ ms: NAV.reducedMs, move: false, home: true });
    expect(enterPlan('short', true)).toEqual({ ms: NAV.reducedMs, move: false, home: true });
    for (const via of ['layerOn', 'camera', 'cut', null] as const) expect(enterPlan(via, false), String(via)).toBeNull();
  });

  it('К4 вход с Карты (layerOff): слой гаснет ≈ 0,3 с без движения и без слоя Дома; «меньше движения» — 0,2 с (054, Р11)', () => {
    // Ловит: мгновенный вход (ярлыки Пути выскакивают без проявления); отъезд или слой Дома на входе с Карты.
    expect(LAYER_MS).toBe(300);
    expect(enterPlan('layerOff', false)).toEqual({ ms: LAYER_MS, move: false, home: false });
    expect(enterPlan('layerOff', true)).toEqual({ ms: NAV.reducedMs, move: false, home: false });
  });
});

describe('К1 шаг ввода Пути клуба — pathInput (067 К-З: счёт, вид входа, упор)', () => {
  const env = { reduced: false, busy: false };
  const menuPath = { t: 'menu', item: 'path' } as const;

  it('К1 вход из Дома: счёт +1 в разделе, вид входа full, упор погашен; четвёртый вход — short и счёт тот же', () => {
    // Ловит: счёт входов, не доходящий до сохранения (раздел остался прежним); потерянный вид входа; счёт выше fullEntries.
    const first = pathInput(empty(), { at: 1 }, 'home', menuPath, T, env);
    expect(first.effect).toMatchObject({ kind: 'go', from: 'home', to: 'path' });
    expect(first.path).toEqual({ entries: { yard: 1 } });
    expect(first.via).toBe('full');
    expect(first.stop).toBeNull();
    const full: Path = { entries: { yard: NAV.fullEntries } };
    const late = pathInput(full, null, 'home', menuPath, T, env);
    expect(late.via).toBe('short');
    expect(late.path).toBe(full);
  });

  it('К1 вход с Карты: вид layerOff, раздел тот же объект; Esc из Пути — не вход, вида нет', () => {
    // Ловит: счёт от Карты; вид входа, оставшийся от прошлого перехода.
    const p = empty();
    const fromMap = pathInput(p, null, 'map', menuPath, T, env);
    expect(fromMap.via).toBe('layerOff');
    expect(fromMap.path).toBe(p);
    const back = pathInput(p, null, 'path', { t: 'esc' }, T, env);
    expect(back.effect).toMatchObject({ kind: 'go', to: 'home' });
    expect(back.via).toBeNull();
    expect(back.path).toBe(p);
  });

  it('К1 экран ещё грузится (busy): второй клик по «Путь клуба» не считается, раздел и упор те же', () => {
    // Ловит: двойной клик, засчитанный за два входа (ребёнок увидел бы 2 полных отъезда вместо 3).
    const p = empty();
    const stop = { at: 5 };
    const dup = pathInput(p, stop, 'home', menuPath, T, { reduced: false, busy: true });
    expect(dup).toEqual({ effect: { kind: 'dropped' }, path: p, stop, via: null });
  });

  it('К2 колёсико «дальше» на Пути: упор, потом холостое; любой переход гасит упор; на Доме упора нет', () => {
    // Ловит: упор, не доходящий до экрана; упор, переживший переход (вторая прокрутка на новом заходе молчит); перехват на Доме.
    const out = { t: 'wheel', dir: 'out' } as const;
    const a = pathInput(empty(), null, 'path', out, T, env);
    expect(a.effect).toEqual({ kind: 'bump', to: 'path' });
    expect(a.stop).toEqual({ at: T });
    const b = pathInput(empty(), a.stop, 'path', out, T + NAV.bumpPauseMs + 1, env);
    expect(b.effect.kind).toBe('none');
    expect(b.stop).toBe(a.stop);
    const leave = pathInput(empty(), a.stop, 'path', { t: 'esc' }, T + 1, env);
    expect(leave.stop).toBeNull();
    expect(pathInput(empty(), null, 'home', out, T, env).effect.kind).not.toBe('bump');
  });
});
