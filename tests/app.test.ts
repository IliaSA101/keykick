/**
 * Каркас приложения: адрес на GitHub Pages, маршруты, адреса быстрых проверок, масштаб экрана от окна.
 * Сами экраны здесь не поднимаются — их проверяем глазами в браузере.
 */
import { describe, expect, it } from 'vitest';
import { lessons } from '../src/app/lessons';
import { checkQuery, jumpPlan, previewOf } from '../src/app/matchJump';
import { leagueRules, lessonPassed } from '../src/engine/match';
import { MAX_SCALE, PAGE_MAX, hasSideRoom, pageScale, uiScale } from '../src/engine/viewport';
import viteConfig from '../vite.config';

describe('публикация', () => {
  it('сборка знает свой подраздел на GitHub Pages', () => {
    // Без префикса игра на iliasa101.github.io/keykick/ грузит пустую страницу: файлы ищутся в корне.
    expect(viteConfig.base).toBe('/keykick/');
  });
});

describe('быстрые проверки матча', () => {
  it('адрес со страницы родителя разбирается матчем в то же место', () => {
    const lesson = lessons[3];
    expect(lesson).toBeDefined();
    if (!lesson) return;
    expect(previewOf(checkQuery({ at: 'decisive', lessonId: lesson.id }))).toEqual({
      at: 'decisive',
      stars: 2,
      lesson,
      cup: null,
      game: null,
    });
    expect(previewOf(checkQuery({ at: 'result', stars: 3, lessonId: lesson.id }))?.stars).toBe(3);
    expect(previewOf(checkQuery({ at: 'result', stars: 1 }))?.stars).toBe(1);
    // Пенальти по ходу матча (спека 005): слой с задачей посреди первого тайма.
    expect(previewOf(checkQuery({ at: 'penalty' }))?.at).toBe('penalty');
    expect(previewOf(checkQuery({ at: 'halftime', game: 'tab', lessonId: lesson.id }))).toMatchObject({
      at: 'halftime',
      game: 'tab',
      lesson,
    });
    // Раунд кубка — без места: матч кубка со вступления, урок — свой у раунда.
    expect(previewOf(checkQuery({ cup: { league: 'district', round: 2 } }))).toEqual({
      at: null,
      stars: 2,
      lesson: null,
      cup: { league: 'district', round: 2 },
      game: null,
    });
  });

  it('итог проверки (&stars=) по правилам лиги: двор — [0], [1], [3]; район — [0, 0], [1, 1], [2, 2]', () => {
    const decisive = (league: string) => ([3, 2, 1] as const).map((s) => jumpPlan(s, leagueRules(league)).decisive);
    expect(decisive('yard')).toEqual([[0], [1], [3]]);
    expect(decisive('district')).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    // ★ — серия не зачтена, ★★ и ★★★ — зачтена: план совпадает со звёздами, которые матч сам посчитает.
    for (const league of ['yard', 'district', 'city']) {
      const rules = leagueRules(league);
      const passed = ([3, 2, 1] as const).map((s) => {
        const sum = jumpPlan(s, rules).decisive.reduce((a, b) => a + b, 0);
        return lessonPassed(sum, rules);
      });
      expect(passed, league).toEqual([true, true, false]);
    }
  });

  it('обычный матч и обычный матч кубка — не проверка: они пишут в сохранение', () => {
    expect(previewOf({})).toBeNull();
    expect(previewOf({ cup: 'yard' })).toBeNull();
    expect(previewOf(checkQuery({}))).toBeNull();
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
