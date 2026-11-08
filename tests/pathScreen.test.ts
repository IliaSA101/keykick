/**
 * «Путь клуба»: экран (спека 019-Т9) — места, кнопка, подписи, клавиша «назад». Подготовка — `mapHelpers.ts`.
 */
import { describe, expect, it } from 'vitest';
import { courseLessons, leagues } from '../src/app/course/load';
import { isBackKey, pathItems } from '../src/app/map/pathState';
import { mainActionLabel, openLabel, placeLabel } from '../src/components/map/pathLabels';
import { pathModel } from '../src/engine/map/path';
import { ru } from '../src/i18n/ru';
import { yardIds } from './mapHelpers';

describe('«Путь клуба»: экран (019-Т9, design §6, ТЗ-1.3)', () => {
  const items = (n: number) => pathItems(pathModel(leagues, courseLessons, yardIds(Array.from({ length: n }, (_, i) => i + 1))), leagues);
  const states = (n: number) => items(n).map((i) => i.place.state);
  const labelOf = (n: number, league: string) => placeLabel(items(n).find((i) => i.league.id === league)!);

  it('шесть мест в порядке лиг; кнопка одна — у текущего места', () => {
    // Ловит: не шесть мест; кнопка на следующем/в тумане или сразу на нескольких местах (Tab-ловушка).
    for (const n of [0, 16, 32]) {
      expect(items(n).map((i) => i.league.id)).toEqual(leagues.map((l) => l.id));
      expect(items(n).filter((i) => i.actionable)).toHaveLength(1);
    }
    expect(items(0).find((i) => i.actionable)?.place.state).toBe('current');
    expect(states(0)).toEqual(['current', 'next', 'fog', 'fog', 'fog', 'fog']);
    expect(states(16)).toEqual(['current', 'next', 'fog', 'fog', 'fog', 'fog']);
  });

  it('все 32 урока пройдены: Двор пройден, Район «строится» и он же — кнопка', () => {
    // Ловит: «Район открыт» без контента (019-Р8); кнопка на Дворе после его прохождения.
    // 019-Р37: следующее место после Двора — Район (строится); Город — не «следующее», а в тумане.
    expect(states(32)).toEqual(['done', 'building', 'fog', 'fog', 'fog', 'fog']);
    expect(items(32).find((i) => i.actionable)?.league.id).toBe('district');
  });

  it('подписи: следующее — «12 новых клавиш, стадион «школьный»»; туман без названия; кубок мира виден всегда', () => {
    // Ловит: в тумане видно имя лиги; кубок мира пропал; число клавиш без склонения; ярлык состояния не из блока.
    const next = labelOf(0, 'district');
    expect(next.name).toBe('Район');
    expect(next.state).toBe(ru.clubPath.state.next);
    expect(next.lines).toEqual(['12 новых клавиш, стадион «школьный»']);
    expect(labelOf(0, 'city')).toMatchObject({ name: '', state: ru.clubPath.state.fog, lines: [] });
    const world = labelOf(0, 'world');
    expect(world.name).toBe('Мир');
    expect(world.lines).toEqual(['Главный кубок — Чемпионат мира']);
    expect(labelOf(32, 'district').lines).toEqual(['12 новых клавиш, стадион «школьный»']);
    expect(labelOf(32, 'district').state).toBe(ru.clubPath.state.building);
  });

  it('склонение клавиш: 1, 2, 5, 11, 21; нулевой набор — только стадион', () => {
    // Ловит: «2 новых клавиш», «21 новые клавиши»; «0 новых клавиш» у Мира.
    const league = leagues[1]!;
    const word = (keys: number) => placeLabel({ league, actionable: false, place: { league: league.id, state: 'next', keys, progress: null, lessonN: null, alwaysVisible: false } }).lines[0];
    expect(word(1)).toBe('1 новая клавиша, стадион «школьный»');
    expect(word(2)).toBe('2 новые клавиши, стадион «школьный»');
    expect(word(5)).toBe('5 новых клавиш, стадион «школьный»');
    expect(word(11)).toBe('11 новых клавиш, стадион «школьный»');
    expect(word(21)).toBe('21 новая клавиша, стадион «школьный»');
    expect(word(0)).toBe('стадион «школьный»');
  });

  it('кнопка для диктора читает всё, что скрыто в карточке, и действие', () => {
    // Ловит: кнопка с одним «Открыть карту» (диктор не знает, где он), пустые куски в подписи.
    const cur = items(0).find((i) => i.actionable)!;
    expect(openLabel(cur)).toBe(`Двор. ${ru.clubPath.state.current}. 0 из 32 уроков. ${ru.clubPath.open}`);
  });

  it('ход Двора виден на пути: «16 из 32 уроков» отличается от «0 из 32» (019-Р37)', () => {
    // Ловит: «Путь клуба» на 16-м уроке выглядит как в первый день (ребёнок-критик, path-mid = path-day1).
    expect(labelOf(0, 'yard').lines).toContain('0 из 32 уроков');
    expect(labelOf(16, 'yard').lines).toContain('16 из 32 уроков');
    expect(labelOf(32, 'yard').lines.join()).not.toContain('из 32');
  });

  it('главная кнопка: «К уроку N» до конца Двора, потом «Повторить уроки за звёздами»', () => {
    // Ловит: кнопка с одним «На карту» без цели; «К уроку 33» после последнего урока; не тот номер при «дыре» в прохождении.
    expect(mainActionLabel(items(0))).toBe('К уроку 1');
    expect(mainActionLabel(items(16))).toBe('К уроку 17');
    expect(mainActionLabel(items(31))).toBe('К уроку 32');
    expect(mainActionLabel(items(32))).toBe('Повторить уроки за звёздами');
  });

  it('Esc — «назад»; удержание, модификаторы и уже забранная клавиша — нет', () => {
    // Ловит: Esc с Ctrl/Alt уводит с экрана; удержание Esc — пачка переходов; Enter и другие клавиши — «назад».
    const key = (over: Partial<Parameters<typeof isBackKey>[0]> = {}) => ({ key: 'Escape', repeat: false, ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, ...over });
    expect(isBackKey(key())).toBe(true);
    expect(isBackKey(key({ repeat: true }))).toBe(false);
    expect(isBackKey(key({ ctrlKey: true }))).toBe(false);
    expect(isBackKey(key({ altKey: true }))).toBe(false);
    expect(isBackKey(key({ metaKey: true }))).toBe(false);
    expect(isBackKey(key({ defaultPrevented: true }))).toBe(false);
    expect(isBackKey(key({ key: 'Enter' }))).toBe(false);
  });
});

