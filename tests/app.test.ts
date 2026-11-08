/**
 * Каркас приложения: адрес на GitHub Pages, маршруты, масштаб экрана от окна.
 * Сами экраны здесь не поднимаются — их проверяем глазами в браузере.
 */
import { describe, expect, it } from 'vitest';
import { MAX_SCALE, PAGE_MAX, hasSideRoom, pageScale, uiScale } from '../src/engine/viewport';
import { sitePlan } from '../tools/site-plan.mjs';

describe('публикация', () => {
  const site = { root: 'v1', versions: { v1: 'v0.10.1' } };

  it('план сборки: три адреса со своим base', () => {
    // Без префикса игра на iliasa101.github.io/keykick/ грузит пустую страницу: файлы ищутся в корне.
    const plan = sitePlan(site);
    expect(plan.map((s) => [s.name, s.base, s.dir])).toEqual([
      ['next', '/keykick/next/', 'next'],
      ['v1', '/keykick/v1/', 'v1'],
      ['root', '/keykick/', ''],
    ]);
  });

  it('корень и vN собираются из одной метки с одним каналом', () => {
    const plan = sitePlan(site);
    const root = plan.find((s) => s.name === 'root');
    const v1 = plan.find((s) => s.name === 'v1');
    expect(root?.ref).toBe('v0.10.1');
    expect(root?.ref).toBe(v1?.ref);
    expect(root?.channel).toBe(v1?.channel);
    // Голова — канал next, метка линии v1 — без переменной.
    expect(plan.find((s) => s.name === 'next')).toMatchObject({ ref: null, channel: 'next' });
    expect(v1?.channel).toBeNull();
  });

  it('метки v2+ собираются каналом release', () => {
    const plan = sitePlan({ root: 'v2', versions: { v1: 'v0.10.1', v2: 'v2.0.1' } });
    expect(plan.filter((s) => s.channel === 'release').map((s) => s.name)).toEqual(['v2', 'root']);
    expect(plan.find((s) => s.name === 'root')?.ref).toBe('v2.0.1');
  });

  it('неверный указатель — ошибка', () => {
    expect(() => sitePlan({ root: 'v3', versions: { v1: 'v0.10.1' } })).toThrow();
    expect(() => sitePlan({ root: 'v1', versions: { v1: 'v0.10.2' } })).toThrow();
    expect(() => sitePlan({ root: 'v1', versions: { one: 'v0.10.1' } })).toThrow();
    expect(() => sitePlan({ root: 'v1', versions: { v1: 'main' } })).toThrow();
    expect(() => sitePlan({ root: 'v2', versions: { v2: 'v1.0.0' } })).toThrow();
  });
});

describe('масштаб от окна', () => {
  it('эталон 1024×640 — 1; дальше — по тесной стороне окна, с потолком', () => {
    expect(uiScale(1024, 640)).toBe(1);
    // Окно меньше эталона не ужимается: там свои правила узких окон.
    expect(uiScale(800, 600)).toBe(1);
    expect(uiScale(1280, 800)).toBe(1.25);
    // Широкое окно растёт по высоте, высокое — по ширине: вёрстка всегда целиком в окне.
    expect(uiScale(1680, 983)).toBe(1.53);
    expect(uiScale(1920, 1080)).toBe(1.68);
    expect(uiScale(1100, 1400)).toBe(1.07);
    expect(uiScale(2560, 1440)).toBe(MAX_SCALE);
    expect(uiScale(3840, 2160)).toBe(MAX_SCALE);
  });

  it('страницы растут вдвое медленнее матча, в целых сотых вниз, с потолком 1,5', () => {
    // Окно ребёнка 1536×730 (матч 1,14) — 1,07: формула в дробях дала бы 1,06.
    expect([1, 1.14, 1.25, 1.53, 1.68, 2].map(pageScale)).toEqual([1, 1.07, 1.12, 1.26, 1.34, 1.5]);
    expect(pageScale(uiScale(1680, 983))).toBe(1.26);
    expect(pageScale(uiScale(3840, 2160))).toBe(PAGE_MAX);
    // Множители с хвостом в дробях — те же сотые, что у uiScale.
    expect(pageScale(1.07)).toBe(1.03);
    expect(pageScale(1.29)).toBe(1.14);
  });

  it('формы по бокам поля — только когда окно шире колонки матча', () => {
    const room = (w: number, h: number) => hasSideRoom(w / uiScale(w, h));
    expect([room(1024, 640), room(1280, 800), room(1680, 983), room(1920, 1080), room(2560, 1440)]).toEqual([
      false,
      false,
      true,
      true,
      true,
    ]);
  });
});
