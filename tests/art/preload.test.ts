/**
 * Вес и состав графики экранов (067 Т23, решение владельца 19.11: ≤ 1,5 МБ на первое открытие): списки файлов лежат на диске
 * и укладываются в предел на каждом уроке Дома.
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesOf, homeArtFiles, mapArtFiles, pathArtFiles, planOf } from '../../src/app/preload/art';
import { sceneOf } from '../../src/app/home/scene';
import { homeView } from '../../src/engine/home';
import { artFiles, screenArt } from '../../src/art/assets';

const publicDir = join(import.meta.dirname, '..', '..', 'public');
const MB = 1024 * 1024;
const inputAt = (cur: number) => ({ cur, day: 5, matchesToday: 1, played: 20, stars: {}, best: 0, coins: 0, fans: 0, bought: [], friendly: false, round: null, end: false, region: false, pause5: false, extras: {} });

describe('списки графики экранов', () => {
  const size = (f: string) => statSync(join(publicDir, f)).size;
  const heavy = (files: string[]) => files.reduce((sum, f) => sum + size(f), 0);

  it('файлы всех экранов лежат на диске', () => {
    for (const s of ['home', 'map', 'path', 'school', 'locker', 'museum', 'shop', 'pack', 'match', 'club', 'learn', 'base', 'keeper']) {
      const files = filesOf(s as never, { cur: 20, bought: ['banner', 'drum'] });
      expect(files.length, s).toBeGreaterThan(0);
      expect(files.filter((f) => !existsSync(join(publicDir, f))), s).toEqual([]);
    }
  });

  it('Дом на каждом уроке при первом открытии ≤ 1,5 МБ (в зависимости от ступени и покупок)', () => {
    const all = ['gate-sticker', 'center-circle', 'net-flags', 'graffiti', 'drum', 'garland', 'banner', 'boots-box'];
    for (let cur = 1; cur <= 33; cur++) {
      const files = homeArtFiles(cur, all);
      expect(files.filter((f) => !existsSync(join(publicDir, f))), `урок ${cur}`).toEqual([]);
      expect(heavy(files), `урок ${cur}`).toBeLessThanOrEqual(1.5 * MB);
    }
    expect(homeArtFiles(1, [])).not.toEqual(homeArtFiles(20, []));
  });

  it('Карта и Путь при первом открытии ≤ 1,5 МБ', () => {
    expect(heavy(mapArtFiles())).toBeLessThanOrEqual(1.5 * MB);
    expect(heavy(pathArtFiles())).toBeLessThanOrEqual(1.5 * MB);
  });

  it('К23-4 Раздевалка и Музей при первом открытии ≤ 1,5 МБ, слои формы Раздевалки — в списке', () => {
    expect(screenArt.locker).toEqual(expect.arrayContaining(['kitZones', 'kitShade', 'shortsZones', 'shortsShade', 'socksZones', 'socksShade']));
    for (const s of ['locker', 'museum'] as const) expect(heavy(filesOf(s, { cur: 20, bought: [] })), s).toBeLessThanOrEqual(1.5 * MB);
  });

  it('К23-1 Дом: основа — та, что рисует Дом (ступень builtOf, не stageOf), на уроках 1, 3, 10, 33', () => {
    // Ловит: ступень на 1 больше, чем у Дома (`stageOf` вместо числа построенных).
    for (const cur of [1, 3, 10, 33]) {
      const i = inputAt(cur);
      expect(homeArtFiles(cur, []), `урок ${cur}`).toContain(sceneOf(i, homeView(i), 1).base);
    }
  });

  it('К23-6 Музей: врезка Двора (основа ступени, как на Доме) — в списке экрана', () => {
    const i = inputAt(10);
    expect(filesOf('museum', { cur: 10, bought: [] })).toContain(sceneOf(i, homeView(i), 1).base);
    expect(filesOf('museum', { cur: 10, bought: [] })).toContain(artFiles.albumMuseumIn);
  });

  it('план: с Карты соседи — Дом по текущему уроку и матч; свой экран — в now; дальних нет', () => {
    const plan = planOf('map', { cur: 10, bought: [] });
    expect(plan.now).toEqual(mapArtFiles());
    expect(plan.near).toEqual(expect.arrayContaining(homeArtFiles(10, [])));
    expect(plan.near).toEqual(expect.arrayContaining(filesOf('match', { cur: 10, bought: [] })));
    expect(Object.keys(plan).sort()).toEqual(['near', 'now']);
  });
});
