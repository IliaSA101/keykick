/**
 * План урока на данных пакета (060-Т9а, К25): голден атак 32 уроков Двора при фиксированных семенах, контракт
 * `planLesson`, раскладка урока — id из курса. Свойства текста и разбор уроков — в `course-attack.test.ts` и `course-content.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import golden from '../golden/plan/ru.yard.json';
import { makeCourseHalf, makeExtraAttack, wrapRows } from '../../src/engine/plan/attack';
import { parseDictionary } from '../../src/engine/plan/dictionary';
import { planLesson } from '../../src/engine/plan';
import { parseLessons } from '../../src/engine/plan/parseLessons';
import { makeCourseWarmup } from '../../src/engine/plan/warmup';
import { courseLessons, dictionary, keymap, LAYOUT, yardContext, yardPack } from './yard';
import type { Pack } from '../../src/content/schema/pack';
import type { TypingStats } from '../../src/engine/typing/typing';

interface Plan {
  warmup: string[][];
  half1: string[];
  half2: string[];
  extra: string;
}
interface Golden {
  seeds: number[];
  stats: Record<string, number>;
  lessons: Record<string, { seeds: Record<string, Plan>; withStats: Record<string, Plan> }>;
}
const g = golden as unknown as Golden;
const stats: TypingStats = { correct: 0, errors: 0, keyErrors: g.stats, fingerErrors: {}, startedAt: null, lastAt: null, intervals: [] };

describe('голден плана урока Двора (К25)', () => {
  it('К25: строки разминки, таймов и доп. атаки всех 32 уроков при семенах голдена — как до переезда на пакет', () => {
    // Ловит: любую правку генератора, меняющую текст атак при том же семени (принятый лист уроков Двора собран этим кодом, 060-Р4);
    // и потерю урока из голдена или появление лишнего.
    expect(Object.keys(g.lessons)).toEqual(courseLessons.map((l) => l.id));
    const bad: string[] = [];
    for (const l of courseLessons) {
      const at = (seed: number, s?: TypingStats): Plan => ({
        warmup: makeCourseWarmup(l, dictionary, keymap, seed, s),
        half1: makeCourseHalf(l, dictionary, keymap, seed, s, false),
        half2: makeCourseHalf(l, dictionary, keymap, seed, s, true),
        extra: makeExtraAttack(l, dictionary, keymap, seed, s),
      });
      for (const seed of g.seeds) if (JSON.stringify(at(seed)) !== JSON.stringify(g.lessons[l.id]!.seeds[String(seed)])) bad.push(`${l.id} семя ${seed}`);
      const withErrors = g.seeds[2]!;
      if (JSON.stringify(at(withErrors, stats)) !== JSON.stringify(g.lessons[l.id]!.withStats[String(withErrors)])) bad.push(`${l.id} семя ${withErrors} с ошибками игрока`);
    }
    expect(bad).toEqual([]);
  });

  it('К25: planLesson отдаёт те же строки по порядку матча — разминка, тайм 1, тайм 2, доп. атака', () => {
    // Ловит: перепутанный порядок фаз, потерянную или лишнюю атаку, перенос строк не по rowWidth урока, статистику, не дошедшую до генератора.
    for (const l of courseLessons) {
      const seed = g.seeds[2]!;
      for (const s of [undefined, stats]) {
        const want = s ? g.lessons[l.id]!.withStats[String(seed)]! : g.lessons[l.id]!.seeds[String(seed)]!;
        const plan = planLesson(l, dictionary, keymap, seed, s);
        expect(plan.map((a) => a.phase), l.id).toEqual([
          ...want.warmup.map(() => 'warmup'),
          ...want.half1.map(() => 'half1'),
          ...want.half2.map(() => 'half2'),
          'extra',
        ]);
        expect(plan.filter((a) => a.phase === 'warmup').map((a) => a.rows), l.id).toEqual(want.warmup);
        expect(plan.filter((a) => a.phase === 'half1').map((a) => a.rows.join(' ')), l.id).toEqual(want.half1);
        expect(plan.filter((a) => a.phase === 'half2').map((a) => a.rows.join(' ')), l.id).toEqual(want.half2);
        expect(plan.at(-1)!.rows.join(' '), l.id).toBe(want.extra);
        for (const a of plan.filter((x) => x.phase !== 'warmup')) expect(a.rows, l.id).toEqual(wrapRows(a.rows.join(' '), l.rowWidth));
        expect(plan.map((a) => a.index), l.id).toEqual([
          ...want.warmup.map((_, i) => i),
          ...want.half1.map((_, i) => i),
          ...want.half2.map((_, i) => i),
          0,
        ]);
      }
    }
  });
});

describe('раскладка урока — id из курса (долг Т8)', () => {
  it('К25: уроки Двора написаны на раскладке курса ru (jcuken-win), карта знает её и qwerty-win', () => {
    // Ловит: раскладку урока, зашитую именем «ru» мимо course.json, и карту без раскладок из content/layouts.
    expect(LAYOUT).toBe('jcuken-win');
    expect(courseLessons.every((l) => l.layout === LAYOUT)).toBe(true);
    expect(keymap.layouts).toEqual(['jcuken-win', 'qwerty-win']);
    expect(() => parseLessons(yardPack, { ...yardContext, layout: 'ru' })).toThrow(/bad layout/);
  });

  it('К25: тот же генератор ведёт урок на qwerty-win — буквы и словарь берутся с раскладки курса', () => {
    // Ловит: генератор, привязанный к русским буквам или к имени «ru»: курс en (А-32) получил бы пустые или чужие строки.
    const en = structuredClone(yardPack) as unknown as { lessons: Pack['lessons']; text: Pack['text'] };
    const ids = ['ru.yard.ao', 'ru.yard.ao-pairs'];
    en.lessons = { ...en.lessons, order: ids, stages: [{ n: 1, newKeys: 'fj' }], lessons: Object.fromEntries(ids.map((id) => [id, yardPack.lessons.lessons[id]])) as Pack['lessons']['lessons'] };
    const pack: Pack = { ...yardPack, lessons: en.lessons };
    const lessons = parseLessons(pack, { ...yardContext, layout: 'qwerty-win', lessons: 2 });
    const dict = parseDictionary({ en: { words: ['ff', 'fj', 'jf', 'jj'], phrases: [], chants: [] } }, keymap, 'qwerty-win', 'en');
    for (const l of lessons) {
      expect(l.layout).toBe('qwerty-win');
      const plan = planLesson(l, dict, keymap, 7);
      expect(plan.length).toBeGreaterThan(l.attacks.length * 2);
      for (const a of plan) for (const row of a.rows) expect([...row].every((ch) => ch === ' ' || 'fj'.includes(ch)), row).toBe(true);
    }
  });
});
