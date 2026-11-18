/**
 * Модель навигации Двора (063 Т3): переходы туда и обратно, упор колёсика (054-Р16), очередь шагов, возврат в
 * пройденную лигу, адрес и двое игроков — сценарии 054 §«Сценарии» и «Состояния и края».
 * У каждого теста строка «Ловит:» — какую поломку он видит.
 */
import { describe, expect, it } from 'vitest';
import { NAV, advance, navigate, openAt, parseAddress, start, formatAddress } from '../../src/engine/nav';
import { CITY, DISTRICT, ctxOf, menu, play } from './helpers';

const T = 10_000;

describe('К5 Двор: Дом ↔ Карта ↔ Путь клуба (054-Р4, Р10, Р11)', () => {
  it('К5 Дом Двора: меню «Карта» и чип «Карта» ведут на Карту, Esc возвращает на Дом; повтор — холостой', () => {
    // Ловит: потерю одного из трёх путей (меню, чип, Esc), движение к уже открытому экрану, Esc на Доме.
    const ctx = ctxOf();
    const home = start(ctx);
    expect(home.view.screen).toBe('home');
    expect(home.view.chipMap).toBe(true);
    for (const input of [{ t: 'chipMap' } as const, menu('map')]) {
      const toMap = navigate(ctx, home.state, input, 0);
      expect(toMap.view.screen).toBe('map');
      expect(toMap.effects).toEqual([{ kind: 'go', from: 'home', to: 'map', via: 'camera', league: 'yard' }]);
      expect(toMap.view.league).toBe('yard');
      expect(toMap.view.here).toBe('yard');
      const back = navigate(ctx, toMap.state, { t: 'esc' }, T);
      expect(back.view.screen).toBe('home');
    }
    expect(navigate(ctx, home.state, menu('home'), 0).effects).toEqual([{ kind: 'none' }]);
    expect(navigate(ctx, home.state, { t: 'esc' }, 0).effects).toEqual([{ kind: 'none' }]);
    const onMap = navigate(ctx, home.state, menu('map'), 0).state;
    expect(navigate(ctx, onMap, menu('map'), T).effects).toEqual([{ kind: 'none' }]);
    expect(navigate(ctx, onMap, { t: 'chipMap' }, T).effects).toEqual([{ kind: 'none' }]);
  });

  it('К5 Путь клуба из Дома открывается на L, Esc ведёт на Дом; ← → меняют уровень, на краях шкалы — ничего', () => {
    // Ловит: уровень не L при входе (054-Р7); бегущий за край уровень; Esc не на Дом.
    const ctx = ctxOf();
    const { all } = play(ctx, start(ctx).state, [
      [menu('path'), 0],
      [{ t: 'arrow', dir: 'left' }, T], // у Двора «ближе» — ничего
      [{ t: 'arrow', dir: 'right' }, 2 * T],
      [{ t: 'wheel', dir: 'in' }, 3 * T],
      [{ t: 'esc' }, 4 * T],
    ]);
    expect(all[0]!.view.level).toBe('yard');
    expect(all[1]!.effects).toEqual([{ kind: 'none' }]);
    expect(all[2]!.view.level).toBe('district');
    expect(all[3]!.view.level).toBe('yard');
    expect(all[4]!.view.screen).toBe('home');
    // у Мира «дальше» — ничего
    const world = ctxOf({ league: 'world', homeSteps: 2 });
    const atWorld = navigate(world, start(world).state, menu('path'), 0).state;
    expect(navigate(world, atWorld, { t: 'arrow', dir: 'right' }, T).effects).toEqual([{ kind: 'none' }]);
  });

  it('К5 Двор пройден, переезда не было: L остаётся Двором, на Пути клуба — «Следующее»: Район', () => {
    // Ловит: текущая лига по первой непройденной (054-Р2): «здесь» уезжает в Район до переезда (Э7.184–185).
    const ctx = ctxOf({ leagueDone: true });
    const onPath = navigate(ctx, start(ctx).state, menu('path'), 0);
    expect(onPath.view.level).toBe('yard');
    expect(onPath.view.here).toBe('yard');
    expect(onPath.view.next).toBe('district');
    expect(start(ctx).view.league).toBe('yard');
    expect(navigate(ctxOf(), start(ctxOf()).state, menu('path'), 0).view.next).toBeNull();
  });

  it('К5 Кубок и Клуб — адреса вне модели лиг: меню ведёт на них и обратно, шкал и главной кнопки лиг нет', () => {
    // Ловит: Кубок или Клуб, втянутые в модель лиг (063-Р17); потерянный возврат в Дом.
    const ctx = ctxOf();
    for (const item of ['cup', 'club'] as const) {
      const r = navigate(ctx, start(ctx).state, menu(item), 0);
      expect(r.view.screen).toBe(item);
      expect(r.view.main).toBeNull();
      expect(r.view.scaleLevels).toEqual([]);
      expect(r.view.league).toBeNull();
      expect(r.effects).toEqual([{ kind: 'go', from: 'home', to: item, via: 'cut' }]);
      expect(navigate(ctx, r.state, menu('home'), T).view.screen).toBe('home');
      expect(navigate(ctx, r.state, { t: 'wheel', dir: 'out' }, T).effects).toEqual([{ kind: 'none' }]);
    }
  });
});

describe('К5 возврат в пройденную лигу (054-Р6, Р7, Р13)', () => {
  it('К5 Путь клуба C < L: Enter — «На карту <C>»; Esc с этой Карты — Путь клуба на уровне C; меню «Карта» — Карта L', () => {
    // Ловит: возврат в L вместо C при Esc (054-Р7 в); Карта прошлой лиги с «Ты здесь» (054-Р14).
    const ctx = CITY;
    const { all } = play(ctx, start(ctx).state, [
      [menu('path'), 0],
      [{ t: 'arrow', dir: 'left' }, T],
      [{ t: 'arrow', dir: 'left' }, 2 * T],
      [{ t: 'enter' }, 3 * T],
      [{ t: 'esc' }, 4 * T],
    ]);
    expect(all[2]!.view.level).toBe('yard');
    expect(all[3]!.view.screen).toBe('map');
    expect(all[3]!.view.league).toBe('yard');
    expect(all[3]!.view.here).toBeNull();
    expect(all[3]!.effects).toEqual([{ kind: 'go', from: 'path', to: 'map', via: 'layerOn', league: 'yard' }]);
    expect(all[4]!.view.screen).toBe('path');
    expect(all[4]!.view.level).toBe('yard');
    const viaMenu = navigate(ctx, all[3]!.state, menu('map'), 5 * T);
    expect(viaMenu.view.league).toBe('city');
    expect(viaMenu.view.here).toBe('city');
    expect(addressOfPast(ctx)).toBe('/map?league=yard');
  });

  it('К5 Esc с Карты текущей лиги — Дом, Путь клуба по перезагрузке — уровень L', () => {
    // Ловит: Esc с Карты L ведёт на Путь клуба (исключение 054-Р7 только для прошлой лиги); восстановление уровня камеры из адреса.
    const ctx = CITY;
    const onMap = openAt(ctx, parseAddress('/map'));
    expect(navigate(ctx, onMap, { t: 'esc' }, 0).view.screen).toBe('home');
    expect(openAt(ctx, parseAddress('/path')).pathLevel).toBe('city');
    expect(openAt(ctx, parseAddress('/home')).homeStep).toBe(1);
  });
});

function addressOfPast(ctx: typeof CITY): string {
  return formatAddress({ screen: 'map', league: openAt(ctx, parseAddress('/map?league=yard')).mapLeague });
}

describe('К5 упор колёсика (054-Р16 в)', () => {
  it('К5 Дом Района: прокрутка внутри шкалы — ступени; на верхней — упор; вторая после паузы — Карта; раньше паузы — ничего', () => {
    // Ловит: переход без упора («случайно тронули колёсико и улетели»); нечаянный хвост тачпада, считающийся второй прокруткой.
    const ctx = DISTRICT;
    const home = start(ctx).state; // ступень «Школа» = 1
    const down = navigate(ctx, home, { t: 'wheel', dir: 'in' }, 0);
    expect(down.view.homeStep).toBe(0);
    expect(down.effects).toEqual([{ kind: 'homeStep', from: 1, to: 0 }]);
    expect(navigate(ctx, down.state, { t: 'wheel', dir: 'in' }, T).effects).toEqual([{ kind: 'none' }]); // нижний край
    const up = navigate(ctx, down.state, { t: 'wheel', dir: 'out' }, T);
    expect(up.view.homeStep).toBe(1);
    const bump = navigate(ctx, up.state, { t: 'wheel', dir: 'out' }, 2 * T);
    expect(bump.effects).toEqual([{ kind: 'bump', to: 'map' }]);
    expect(bump.view.screen).toBe('home');
    expect(bump.view.bumped).toBe('map');
    const tail = navigate(ctx, bump.state, { t: 'wheel', dir: 'out' }, 2 * T + NAV.bumpPauseMs - 1);
    expect(tail.view.screen).toBe('home');
    expect(tail.view.bumped).toBe('map'); // упор держится, пока не пройдёт пауза
    const go = navigate(ctx, tail.state, { t: 'wheel', dir: 'out' }, 2 * T + NAV.bumpPauseMs);
    expect(go.view.screen).toBe('map');
    expect(go.effects).toEqual([{ kind: 'go', from: 'home', to: 'map', via: 'camera', league: 'district' }]);
    expect(go.view.bumped).toBeNull();
  });

  it('К5 Упор гаснет: поздняя вторая прокрутка — снова упор; любой другой ввод тоже сбрасывает упор', () => {
    // Ловит: упор, переводящий через минуту после касания; упор, пережившее Esc, стрелку или меню.
    const ctx = DISTRICT;
    const home = start(ctx).state;
    const bump = navigate(ctx, home, { t: 'wheel', dir: 'out' }, 0);
    const late = navigate(ctx, bump.state, { t: 'wheel', dir: 'out' }, NAV.bumpTtlMs + 1);
    expect(late.view.screen).toBe('home');
    expect(late.effects).toEqual([{ kind: 'bump', to: 'map' }]);
    const cleared = navigate(ctx, bump.state, { t: 'esc' }, 1000);
    expect(cleared.view.bumped).toBeNull();
    const again = navigate(ctx, cleared.state, { t: 'wheel', dir: 'out' }, 1000 + NAV.bumpPauseMs + 1);
    expect(again.view.screen).toBe('home'); // после сброса пауза не засчитывается
    // другая сторона: упор на Карте «ближе» ведёт к Дому, «дальше» — на Путь клуба
    const map = navigate(ctx, home, menu('map'), T).state;
    const inBump = navigate(ctx, map, { t: 'wheel', dir: 'in' }, 2 * T);
    const outBump = navigate(ctx, inBump.state, { t: 'wheel', dir: 'out' }, 2 * T + NAV.bumpPauseMs + 1);
    expect(outBump.effects).toEqual([{ kind: 'bump', to: 'path' }]); // смена стороны — новый упор, не переход
    const toPath = navigate(ctx, outBump.state, { t: 'wheel', dir: 'out' }, 2 * T + 2 * NAV.bumpPauseMs + 2);
    expect(toPath.view.screen).toBe('path');
    expect(toPath.view.level).toBe('district');
  });

  it('К5 Карта прошлой лиги: колёсико «дальше» ведёт на Путь клуба на уровне этой лиги, «ближе» — на Дом L', () => {
    // Ловит: возврат на уровень L вместо лиги Карты (как Esc, 054-Р13).
    const ctx = CITY;
    const past = openAt(ctx, parseAddress('/map?league=yard'));
    const out = play(ctx, past, [
      [{ t: 'wheel', dir: 'out' }, 0],
      [{ t: 'wheel', dir: 'out' }, NAV.bumpPauseMs],
    ]);
    expect(out.last.view.screen).toBe('path');
    expect(out.last.view.level).toBe('yard');
    const home = play(ctx, past, [
      [{ t: 'wheel', dir: 'in' }, 0],
      [{ t: 'wheel', dir: 'in' }, NAV.bumpPauseMs],
    ]);
    expect(home.last.view.league).toBe('city');
  });
});

describe('К5 очередь шагов (052-Р4: в очереди ≤ 1 шаг)', () => {
  it('К5 Быстрые повторы: во время перехода первый ввод ждёт, второй отброшен, по концу применяется один', () => {
    // Ловит: пропуск уровней при двойном клике (два шага за один), потерю ждущего ввода, неограниченную очередь.
    const ctx = ctxOf({ league: 'world', homeSteps: 2 });
    const onPath = navigate(ctx, start(ctx).state, menu('path'), 0);
    const left = { t: 'arrow', dir: 'left' } as const;
    const first = navigate(ctx, onPath.state, left, T);
    expect(first.view.level).toBe('europe');
    const second = navigate(ctx, first.state, left, T + 100);
    expect(second.effects).toEqual([{ kind: 'queued' }]);
    expect(second.view.level).toBe('europe');
    const third = navigate(ctx, second.state, left, T + 200);
    expect(third.effects).toEqual([{ kind: 'dropped' }]);
    const settled = advance(ctx, third.state, T + NAV.stepMs);
    expect(settled.view.level).toBe('country');
    expect(settled.effects).toEqual([{ kind: 'level', from: 'europe', to: 'country' }]);
    // ещё один шаг сам не появился
    expect(advance(ctx, settled.state, T + 5 * NAV.stepMs).effects).toEqual([]);
    expect(advance(ctx, settled.state, T + 5 * NAV.stepMs).view.level).toBe('country');
  });

  it('К5 Ждущий ввод применяется и при следующем вводе, hover очередь не занимает, «меньше движения» — шаг короче', () => {
    // Ловит: очередь, живущую только до таймера; hover, занявший место ввода; 0,6 с при «меньше движения» (N7).
    const ctx = ctxOf({ league: 'world', homeSteps: 2, reduced: true });
    const onPath = navigate(ctx, start(ctx).state, menu('path'), 0).state;
    const a = navigate(ctx, onPath, { t: 'arrow', dir: 'left' }, T);
    expect(a.state.busyUntil).toBe(T + NAV.reducedMs);
    const hov = navigate(ctx, a.state, { t: 'hover', league: 'yard' }, T + 10);
    expect(hov.effects).toEqual([{ kind: 'none' }]);
    const q = navigate(ctx, hov.state, { t: 'arrow', dir: 'left' }, T + 20);
    expect(q.effects).toEqual([{ kind: 'queued' }]);
    const next = navigate(ctx, q.state, { t: 'hover', league: 'yard' }, T + NAV.reducedMs + 5);
    expect(next.view.level).toBe('country');
  });
});

describe('К5 адрес и два игрока', () => {
  it('К5 Перезагрузка посреди: адрес даёт экран и лигу Карты, ступень Дома — вход, всё в рамках L', () => {
    // Ловит: ступень Дома из адреса (054-Р9 — по правилу входа); Карту лиги выше L из чужой ссылки.
    expect(formatAddress({ screen: 'map', league: 'district' })).toBe('/map?league=district');
    expect(formatAddress({ screen: 'path' })).toBe('/path');
    expect(parseAddress('#/map?league=world')).toEqual({ screen: 'map', league: 'world' });
    expect(openAt(CITY, parseAddress('#/map?league=world')).mapLeague).toBe('city');
    expect(openAt(ctxOf(), parseAddress('/home')).homeStep).toBe(0);
  });

  it('К5 Двое игроков: вид зависит только от сохранения игрока — у одного Двор, у другого Город', () => {
    // Ловит: общее состояние между игроками (лига одного влияет на Дом и Карту другого).
    const kid = ctxOf();
    const brother = CITY;
    const a = navigate(kid, start(kid).state, menu('path'), 0);
    const b = navigate(brother, start(brother).state, menu('path'), 0);
    expect(a.view.level).toBe('yard');
    expect(b.view.level).toBe('city');
    expect(start(kid).view.scaleHome).toBe(false);
    expect(start(brother).view.scaleHome).toBe(true);
    // сохранение игрока сменилось (переезд): старое состояние приводится к новой лиге
    const moved = { ...kid, league: 'district' as const, homeSteps: 2 };
    const r = navigate(moved, start(kid).state, menu('home'), 0);
    expect(r.view.league).toBe('district');
  });
});
