/**
 * Экран карты Двора (спека 019-Т7): реестр поставщиков, вход модели из сохранения, клавиатура, сиды кадров.
 * Отдельный файл от `map.test.ts` (движок): здесь другая подготовка — реестр `import.meta.glob`, слой сохранения
 * и подмена `localStorage` для сидов. Шапка и окна — `mapChrome.test.ts`, «Путь клуба» — `pathScreen.test.ts`.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { courseLessons, leagues } from '../src/app/course/load';
import { cardAction } from '../src/components/map/labels';
import { MATCH_PATH, matchTo } from '../src/app/map/go';
import { keyAction, type KeyContext } from '../src/app/map/keys';
import { layouts } from '../src/app/map/load';
import { coachGreets, collectProvided, focusFromQuery, mapInputOf, pickLeague, providerModules } from '../src/app/map/state';
import { saveContext } from '../src/app/save/instance';
import { registry } from '../src/app/save/registry';
import { applyV2Seed, V2_SEEDS } from '../src/dev/seed2';
import { buildMapModel, isPlayablePoint, type MapPoint } from '../src/engine/map/model';
import { classify, lostPaths } from '../src/engine/save/format';
import { mapInput, yardIds } from './mapHelpers';

// --- экран карты (Т7): реестр поставщиков, вход из сохранения, клавиатура, сиды -----------------------------

describe('карта: реестр поставщиков (design §5.2, 019-Р10)', () => {
  it('все поставщики в реестре: src/app/*/mapProvide.ts с диска = ключи сборки', () => {
    // Ловит: поставщик (021, 022, 024…) лежит в app/<подсистема>/mapProvide.ts, а сборка его не видит — «Скоро» у открытой системы.
    const root = join(__dirname, '..', 'src', 'app');
    const onDisk = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => readdirSync(join(root, d.name)).includes('mapProvide.ts'))
      .map((d) => d.name)
      .sort();
    const inRegistry = Object.keys(providerModules).map((k) => /^\.\.\/([^/]+)\/mapProvide\.ts$/.exec(k)?.[1] ?? k).sort();
    expect(inRegistry).toEqual(onDisk);
  });

  it('сборщик: кубок и здания разных поставщиков сводятся; пустой реестр — без замков', () => {
    // Ловит: второй поставщик затирает первого; пустой реестр бросает.
    const lock = { lock: { soon: true } as const, mark: null };
    const got = collectProvided({
      '../a/mapProvide.ts': { provide: { cup: () => ({ lock: null, hint: 'сетка' }) } },
      '../b/mapProvide.ts': { provide: { buildings: { school: () => lock } } },
      '../c/mapProvide.ts': { provide: { buildings: { museum: () => lock } } },
    });
    expect(got.cup?.(9)).toEqual({ lock: null, hint: 'сетка' });
    expect(Object.keys(got.buildings ?? {}).sort()).toEqual(['museum', 'school']);
    expect(collectProvided({})).toEqual({ buildings: {} });
  });

  it('два поставщика одного места и файл без provide — ошибка сборки', () => {
    // Ловит: тихая подмена замка здания вторым поставщиком; модуль без `provide` молча пропущен.
    const school = { provide: { buildings: { school: () => ({ lock: null, mark: null }) } } };
    expect(() => collectProvided({ '../a/mapProvide.ts': school, '../b/mapProvide.ts': school })).toThrow(/school/);
    const cup = { provide: { cup: () => ({ lock: null, hint: null }) } };
    expect(() => collectProvided({ '../a/mapProvide.ts': cup, '../b/mapProvide.ts': cup })).toThrow(/cup/);
    expect(() => collectProvided({ '../a/mapProvide.ts': {} })).toThrow(/no provide/);
  });

  it('модель с поставщиком: замок здания приходит из реестра, не из умолчания', () => {
    // Ловит: модель игнорирует собранный реестр (замок «Скоро» остаётся у открытой системы).
    const provided = collectProvided({ '../b/mapProvide.ts': { provide: { buildings: { school: () => ({ lock: { matches: 3 }, mark: 'new' as const }) } } } });
    const m = buildMapModel(mapInput(yardIds([1]), { provided }));
    expect(m.buildings.find((b) => b.id === 'school')).toMatchObject({ lock: { matches: 3 }, mark: 'new' });
  });
});

describe('карта: вход из сохранения (app/map/state)', () => {
  const course = (passed: string[], lesson = '', lessons: Record<string, { stars: number; back: boolean }> = {}) => ({ lesson, passed, lessons });

  it('passed {1–5, 7}, lesson yard-08 → модель с c = 6; звёзды и кольцо из course.lessons', () => {
    // Ловит: course.lesson выбирает текущий (стал бы 8) — непройденная 6 ушла бы в туман; потерю звёзд и кольца.
    const input = mapInputOf(course(yardIds([1, 2, 3, 4, 5, 7]), 'yard-08', { 'yard-03': { stars: 3, back: false }, 'yard-05': { stars: 1, back: true } }), { half2: null }, {});
    const m = buildMapModel(input!);
    expect(m.focus).toBe('yard-06');
    expect(m.points[2]).toMatchObject({ stars: 3, back: false });
    expect(m.points[4]).toMatchObject({ stars: 1, back: true });
  });

  it('ожидающий 2-й тайм: счёт попадает в точку урока', () => {
    // Ловит: «Продолжить 2-й тайм» без счёта или не у той точки.
    const input = mapInputOf(course(yardIds([1, 2, 3])), { half2: { lessonId: 'yard-04', score: [2, 1] } }, {});
    expect(buildMapModel(input!).points[3]!.resume).toEqual([2, 1]);
  });

  it('pickLeague: лига урока; пустой и чужой id — первая лига с раскладкой; без раскладок — нет', () => {
    // Ловит: карта лиги без раскладки (Район `frame`) или пустая карта у нового игрока.
    expect(pickLeague(leagues, courseLessons, layouts, 'yard-10')?.id).toBe('yard');
    expect(pickLeague(leagues, courseLessons, layouts, '')?.id).toBe('yard');
    expect(pickLeague(leagues, courseLessons, layouts, 'nope-1')?.id).toBe('yard');
    expect(pickLeague(leagues, courseLessons, [], 'yard-10')).toBeNull();
    expect(mapInputOf(course([]), { half2: null }, {})?.nextLeague?.id).toBe(leagues[1]!.id);
  });

  it('тренер здоровается, пока не доигран ни один матч', () => {
    // Ловит: пузырь пропал до первого матча или остался навсегда (F5 на карте).
    expect(coachGreets({ lastFinishedAt: 0 })).toBe(true);
    expect(coachGreets({ lastFinishedAt: 1_800_000_000_000 })).toBe(false);
  });

  it('?focus= : только в dev, только то, что можно сфокусировать', () => {
    // Ловит: адрес в выпуске двигает фокус; фокус на точке «впереди» или в тумане (ни один элемент не получит его).
    const m = buildMapModel(mapInput(yardIds([1, 2, 3, 4, 5])));
    expect(focusFromQuery('yard-02', m, true)).toBe('yard-02');
    expect(focusFromQuery('yard-02', m, false)).toBe('yard-06');
    expect(focusFromQuery('flag-9', m, true)).toBe('flag:9');
    expect(focusFromQuery('building-stadium', m, true)).toBe('building:stadium');
    expect(focusFromQuery('yard-07', m, true)).toBe('yard-06');
    expect(focusFromQuery('gate', m, true)).toBe('yard-06');
    expect(focusFromQuery(undefined, m, true)).toBe('yard-06');
  });

  it('«Играть» ведёт на матч урока; адрес — одна константа', () => {
    // Ловит: переход по имени маршрута, которого нет в выпуске (бросок вместо возврата на главную).
    expect(matchTo('yard-05')).toEqual({ path: MATCH_PATH, query: { lesson: 'yard-05' } });
  });
});

describe('карта: клавиатура (design §5.3, ТЗ-0.16, К13, 019-Р18)', () => {
  const m = buildMapModel(mapInput(yardIds([1, 2, 3])));
  const ctx = (over: Partial<KeyContext> = {}): KeyContext => ({
    from: 'yard-04', active: 'yard-04', shift: false, repeat: false, cardOpen: true, exists: () => true, ...over,
  });

  it('стрелки: соседняя играемая точка; край — клавиша забрана, фокус на месте', () => {
    // Ловит: стрелка уходит на «впереди»; на краю страница получает клавишу.
    expect(keyAction(m, 'ArrowLeft', ctx())).toEqual({ do: 'focus', id: 'yard-03' });
    expect(keyAction(m, 'ArrowRight', ctx())).toEqual({ do: 'stay' });
    expect(keyAction(m, 'ArrowRight', ctx({ from: null, active: 'yard-02' }))).toEqual({ do: 'focus', id: 'yard-03' });
    expect(keyAction(m, 'ArrowLeft', ctx({ from: 'header' }))).toEqual({ do: 'native' });
  });

  it('Tab: по группам; с первой точки назад и с шапки вперёд — не забирается (Tab уходит из карты)', () => {
    // Ловит: ловушка фокуса — preventDefault на краю, Tab не покидает карту.
    expect(keyAction(m, 'Tab', ctx())).toEqual({ do: 'focus', id: 'flag:9' });
    expect(keyAction(m, 'Tab', ctx({ shift: true }))).toEqual({ do: 'native' });
    expect(keyAction(m, 'Tab', ctx({ from: 'header' }))).toEqual({ do: 'native' });
    expect(keyAction(m, 'Tab', ctx({ from: 'header', shift: true }))).toEqual({ do: 'focus', id: 'building:museum' });
    expect(keyAction(m, 'Tab', ctx({ from: null }))).toEqual({ do: 'native' });
  });

  it('Tab на шапку без шапки на экране (Т7): не забирается', () => {
    // Ловит: фокус «уходит» в несуществующий элемент, Tab мёртв на последнем здании.
    expect(keyAction(m, 'Tab', ctx({ from: 'building:museum', exists: (id) => id !== 'header' }))).toEqual({ do: 'native' });
  });

  it('Enter: карточка закрыта — открыть; открыта — «Играть» по точке; удержание — одна игра; не точка — ничего', () => {
    // Ловит: двойной Enter запускает матч дважды; Enter на флажке играет урок; Enter не открывает закрытую карточку.
    expect(keyAction(m, 'Enter', ctx({ cardOpen: false }))).toEqual({ do: 'open' });
    expect(keyAction(m, 'Enter', ctx())).toEqual({ do: 'play', id: 'yard-04' });
    expect(keyAction(m, 'Enter', ctx({ repeat: true }))).toEqual({ do: 'stay' });
    expect(keyAction(m, 'Enter', ctx({ from: 'flag:9' }))).toEqual({ do: 'stay' });
    expect(keyAction(m, 'Enter', ctx({ from: null }))).toEqual({ do: 'native' });
  });

  it('Esc: закрывает открытую карточку; при закрытой — не забирается; прочие клавиши — браузеру', () => {
    // Ловит: Esc проглочен при закрытой карточке (выход из окна не работает); буквы перехвачены.
    expect(keyAction(m, 'Escape', ctx())).toEqual({ do: 'close' });
    expect(keyAction(m, 'Escape', ctx({ cardOpen: false }))).toEqual({ do: 'native' });
    expect(keyAction(m, 'a', ctx())).toEqual({ do: 'native' });
  });
});

describe('сиды v2 для кадров (design §9)', () => {
  const stubStorage = () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      key: (i: number) => [...data.keys()][i] ?? null,
      get length() { return data.size; },
    });
    return data;
  };
  const saved = (data: Map<string, string>) => {
    const text = [...data.entries()].find(([k]) => k.endsWith('save.p1'))?.[1] ?? null;
    const d = classify(text);
    if (d.kind !== 'ok') throw new Error(`seed envelope: ${d.kind}`);
    return d.envelope;
  };

  it('v2-day1 / mid / end: конверт читается, разделы разбираются без потерь', () => {
    // Ловит: сид, который приложение при загрузке чинит или бракует (кадр карты снимется «пустым»).
    for (const name of ['v2-day1', 'v2-mid', 'v2-end'] as const) {
      const data = stubStorage();
      applyV2Seed(name);
      const env = saved(data);
      for (const def of registry.filter((d) => ['club', 'course', 'match', 'wallet'].includes(d.name))) {
        const raw = env.sections[def.name];
        expect(lostPaths(raw, def.parse(raw, saveContext)), `${name}.${def.name}`).toEqual([]);
      }
      vi.unstubAllGlobals();
    }
    expect(V2_SEEDS).toEqual(['v2-fresh', 'v2-day1', 'v2-mid', 'v2-end']);
  });

  it('что в сидах: день 1 — пусто и тренер; середина — 1–16, кольцо у 5 и 11, 2-й тайм на 17; конец — 32', () => {
    // Ловит: кадр «середина» без кольца/продолжения, «конец» без ворот, «день 1» без пузыря тренера.
    type Secs = { course: { lesson: string; passed: string[]; lessons: Record<string, { stars: number; back: boolean }> }; match: { half2: { lessonId: string; score: number[] } | null; lastFinishedAt: number }; wallet: { coins: number } };
    const read = (name: 'v2-day1' | 'v2-mid' | 'v2-end') => {
      const data = stubStorage();
      applyV2Seed(name);
      const sec = saved(data).sections as unknown as Secs;
      vi.unstubAllGlobals();
      return sec;
    };
    const day1 = read('v2-day1');
    expect(day1.course.passed).toEqual([]);
    expect(coachGreets(day1.match)).toBe(true);
    const mid = read('v2-mid');
    expect(mid.course.passed).toEqual(yardIds(Array.from({ length: 16 }, (_, i) => i + 1)));
    expect(Object.entries(mid.course.lessons).filter(([, r]) => r.back).map(([id]) => id)).toEqual(['yard-05', 'yard-11']);
    expect(mid.match.half2).toMatchObject({ lessonId: 'yard-17' });
    expect(mid.wallet.coins).toBe(230);
    const end = read('v2-end');
    expect(buildMapModel(mapInputOf(end.course, end.match, {})!).gate.state).toBe('building');
  });
});

describe('карточка урока: кнопка и кольцо (011-Р6)', () => {
  const pt = (over: Partial<MapPoint>): MapPoint => ({ id: 'yard-05', n: 5, stage: 2, at: [0, 0], state: 'passed', stars: 3, badge: null, back: false, resume: null, ...over });

  it('кольцо — «Ещё раз за звёздами», даже при трёх; три звезды без кольца — «Сыграть ещё раз»; 2-й тайм — «Продолжить»', () => {
    // Ловит: кольцо без кнопки «за звёздами» (testing.md обещает её); «Продолжить» затёрто «Играть».
    expect(cardAction(pt({ stars: 3, back: false }))).toBe('repeat');
    expect(cardAction(pt({ stars: 3, back: true }))).toBe('again');
    expect(cardAction(pt({ stars: 1 }))).toBe('again');
    expect(cardAction(pt({ state: 'current', stars: 0 }))).toBe('play');
    expect(cardAction(pt({ resume: [1, 0] }))).toBe('resume');
  });

  it('сид «середина»: у урока с кольцом звёзд меньше трёх и помощь «запас»; играемость точки — один помощник', () => {
    // Ловит: кадр с невозможным сочетанием «кольцо + ★★★»; расхождение условий «точка играется».
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), key: (i: number) => [...data.keys()][i] ?? null, get length() { return data.size; } });
    applyV2Seed('v2-mid');
    vi.unstubAllGlobals();
    const env = classify([...data.entries()].find(([k]) => k.endsWith('save.p1'))?.[1] ?? null);
    if (env.kind !== 'ok') throw new Error('seed');
    const lessons = (env.envelope.sections.course as { lessons: Record<string, { stars: number; help: string; back: boolean }> }).lessons;
    const rings = Object.values(lessons).filter((r) => r.back);
    expect(rings).toHaveLength(2);
    for (const r of rings) {
      expect(r.help).toBe('reserve');
      expect(r.stars).toBeLessThan(3);
    }
    const m = buildMapModel(mapInput(yardIds([1, 2, 3])));
    expect(m.points.filter(isPlayablePoint).map((p) => p.state).sort()).toEqual(['current', 'passed', 'passed', 'passed']);
  });
});
