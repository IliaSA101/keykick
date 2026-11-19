/**
 * Фоновая догрузка графики (067 Т23): граф переходов и очередь с лимитом и слабой сетью.
 * Окружение очереди — подделка без DOM: простой запускается вручную, загрузка завершается по команде.
 */
import { describe, expect, it } from 'vitest';
import { MENU, neighbours, reach, screenOfRoute } from '../../src/app/preload/graph';
import { createPreloader, type PreloadEnv } from '../../src/app/preload/queue';
import { isWeak } from '../../src/app/preload/browser';

/** Подделка окружения: `started` — что начато, `finish(url)` — загрузка завершилась, `tick()` — наступил простой. */
function fake(weak = false) {
  const started: string[] = [];
  const waiting = new Map<string, () => void>();
  const idles: (() => void)[] = [];
  const state = { weak };
  const env: PreloadEnv = {
    load: (url) => new Promise<void>((res) => { started.push(url); waiting.set(url, res); }),
    idle: (run) => void idles.push(run),
    weak: () => state.weak,
  };
  return {
    env, started, state,
    tick: () => idles.splice(0).forEach((f) => f()),
    finish: async (url: string) => { waiting.get(url)?.(); await Promise.resolve(); await Promise.resolve(); },
  };
}

describe('граф переходов', () => {
  it('меню шапки — у каждого экрана с шапкой, у матча, входа и выбора игрока его нет', () => {
    for (const s of ['home', 'map', 'school', 'base', 'locker', 'keepy']) {
      expect(MENU.filter((m) => m !== s).every((m) => neighbours(s as never).includes(m)), s).toBe(true);
    }
    expect(neighbours('match')).not.toContain('club');
    expect(neighbours('start')).not.toContain('club');
    expect(neighbours('home')).not.toContain('home');
  });

  it('К23-Р248 Дом: Карта первой, матч сразу за ней, потом Лавка, Музей, Кубок; Школа и База — в конце', () => {
    const r = reach('home');
    expect(r.slice(0, 5)).toEqual(['map', 'match', 'shop', 'museum', 'cup']);
    expect(r.slice(-2)).toEqual(['school', 'base']);
    expect(new Set(r).size).toBe(r.length);
  });

  it('К23-Р248 глубина 1: соседи соседей не берутся (с Дома нет игр Базы)', () => {
    expect(reach('home')).not.toContain('keepy');
    expect(reach('home')).not.toContain('result');
    expect(reach('base').slice(0, 6)).toEqual(['keepy', 'keeper', 'memo', 'mini', 'learn', 'free']);
    expect(reach('mini')[0]).toBe('base');
  });

  it('К23-Р248 переходы в Дом: матч, итог (и в Школу), вход и выбор игрока', () => {
    expect(reach('match')).toContain('home');
    expect(reach('result')).toEqual(expect.arrayContaining(['home', 'school']));
    expect(reach('start')).toEqual(['home']);
    expect(reach('who')).toEqual(['home']);
  });

  it('экран по имени маршрута: тур — Школа, игра Базы — своя (Мини-футбол и Штрафной тоже); неизвестная игра — База; стенд кадров — никто', () => {
    expect(screenOfRoute('school-tour')).toBe('school');
    expect(screenOfRoute('base-game', { game: 'memo' })).toBe('memo');
    expect(screenOfRoute('base-game', { game: 'mini' })).toBe('mini');
    expect(screenOfRoute('base-game', { game: 'free' })).toBe('free');
    expect(screenOfRoute('base-game', { game: 'nope' })).toBe('base');
    expect(screenOfRoute('base-game', {})).toBe('base');
    expect(screenOfRoute('dev-frame')).toBeNull();
    expect(screenOfRoute('start')).toBe('start');
  });
});

describe('очередь догрузки', () => {
  it('К23-1 порядок: текущий экран не грузится (только помечен), соседи — по порядку плана', async () => {
    const f = fake();
    const q = createPreloader(f.env, 1);
    q.enter({ now: ['cur.webp'], near: ['n1.webp', 'n2.webp', 'cur.webp'] });
    expect(f.started).toEqual([]);
    expect(q.pending()).toEqual(['n1.webp', 'n2.webp']);
    f.tick();
    await f.finish('n1.webp'); f.tick();
    await f.finish('n2.webp'); f.tick();
    expect(f.started).toEqual(['n1.webp', 'n2.webp']);
  });

  it('К23-2 перестройка: не начатое от прошлого экрана выбрасывается, новые соседи — вместо него', () => {
    const f = fake();
    const q = createPreloader(f.env, 2);
    q.enter({ now: ['a.webp'], near: ['b.webp', 'c.webp', 'd.webp'] });
    f.tick(); // b, c начаты; d ждёт
    q.enter({ now: ['c.webp'], near: ['e.webp', 'd.webp'] });
    expect(q.pending()).toEqual(['e.webp', 'd.webp']);
    expect(f.started).toEqual(['b.webp', 'c.webp']);
  });

  it('К23-3 повторной загрузки нет: загруженное и общее между экранами файлы не уходят второй раз', async () => {
    const f = fake();
    const q = createPreloader(f.env, 2);
    q.enter({ now: [], near: ['shared.webp', 'x.webp'] });
    f.tick();
    await f.finish('shared.webp'); await f.finish('x.webp');
    q.enter({ now: ['shared.webp'], near: ['shared.webp', 'x.webp', 'y.webp'] });
    f.tick();
    expect(f.started).toEqual(['shared.webp', 'x.webp', 'y.webp']);
  });

  it('К23-4 лимит: не больше двух фоновых загрузок разом; следующая — после завершения и простоя', async () => {
    const f = fake();
    const q = createPreloader(f.env);
    q.enter({ now: [], near: ['1', '2', '3', '4'] });
    f.tick();
    expect(f.started).toEqual(['1', '2']);
    expect(q.active()).toBe(2);
    await f.finish('1');
    expect(f.started).toEqual(['1', '2']); // без простоя — не начинает
    f.tick();
    expect(f.started).toEqual(['1', '2', '3']);
    expect(q.active()).toBe(2);
  });

  it('К23-5 слабая сеть (saveData, 2g): ничего не грузится, ни сразу, ни по простою; очередь пуста', () => {
    const f = fake(true);
    const q = createPreloader(f.env);
    q.enter({ now: ['a'], near: ['b'] });
    f.tick();
    expect(f.started).toEqual([]);
    expect(q.pending()).toEqual([]);
    expect([isWeak({ saveData: true }), isWeak({ effectiveType: '2g' }), isWeak({ effectiveType: '4g' }), isWeak(undefined)]).toEqual([true, true, false, false]);
  });

  it('К23-5 сеть стала слабой посреди очереди — остаток выбрасывается', () => {
    const f = fake();
    const q = createPreloader(f.env);
    q.enter({ now: [], near: ['1', '2', '3'] });
    f.state.weak = true;
    f.tick();
    expect(f.started).toEqual([]);
    expect(q.pending()).toEqual([]);
  });
});
