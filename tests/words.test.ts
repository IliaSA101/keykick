/**
 * Словарь и пулы слов уроков: урокам со словами хватает слов, и с буквами фокуса тоже;
 * пополнение словаря не меняет уроки двора. Блок вынесен из lessons.test.ts (600 строк), кейсы те же.
 */
import { describe, expect, it } from 'vitest';
import { lessons, wordsRu } from '../src/app/lessons';
import { MIN_POOL, materials, wordsFor, type Lesson } from '../src/engine/lessons';

const lesson = (id: string): Lesson => {
  const l = lessons.find((x) => x.id === id);
  if (!l) throw new Error(`no lesson ${id}`);
  return l;
};

/** Урокам со словами — не меньше стольких слов, чтобы строки не повторялись. */
const ENOUGH_WORDS = 40;
/** Закреплению — не меньше стольких слов с буквами фокуса. */
const ENOUGH_FOCUS_WORDS = 10;

const sorted = (s: string): string => [...new Set(s)].sort().join('');
const atLeast = (l: Lesson, m: (typeof materials)[number]): boolean =>
  materials.indexOf(l.material) >= materials.indexOf(m);

describe('словарь', () => {
  it('урокам со словами хватает настоящих слов из словаря, и с буквами фокуса тоже', () => {
    for (const l of lessons.filter((x) => atLeast(x, 'words'))) {
      const pool = wordsFor(l, wordsRu);
      expect(pool.length, l.id).toBeGreaterThanOrEqual(Math.max(MIN_POOL, ENOUGH_WORDS));
      const focused = pool.filter((w) => [...w].some((ch) => l.focus.includes(ch)));
      if (l.focus) expect(focused.length, l.id).toBeGreaterThanOrEqual(ENOUGH_FOCUS_WORDS);
    }
  });

  it('в словаре нет Ё: её урока ещё нет', () => {
    for (const w of wordsRu) expect(w, w).not.toContain('ё');
  });

  it('закрепления города 007: слова, совет, слов фокуса хватает; у «Мизинцев» соперник', () => {
    for (const id of ['city-words-b', 'city-pinky']) {
      const l = lesson(id);
      expect(l.newKeys, id).toBe('');
      expect(l.material, id).toBe('words');
      expect(l.tips.length, id).toBeGreaterThan(0);
      const focused = wordsFor(l, wordsRu).filter((w) => [...w].some((ch) => l.focus.includes(ch)));
      expect(focused.length, id).toBeGreaterThanOrEqual(ENOUGH_FOCUS_WORDS);
    }
    expect(sorted(lesson('city-words-b').focus)).toBe(sorted('сбчю'));
    expect(sorted(lesson('city-pinky').focus)).toBe(sorted('йфязжэх'));
    expect(lesson('city-pinky').rival).toBeTruthy();
  });

  it('словарь 007: «с», «и» и «э» не редкость; уроки двора те же — пулы не меняются', () => {
    const letters = wordsRu.join('');
    const part = (ch: string): number => [...letters].filter((c) => c === ch).length / letters.length;
    // До 007: «с» 2,4 %, «и» 2,8 % (норма языка 5,5 % и 7,4 %), слово с «э» — одно.
    expect(part('с')).toBeGreaterThanOrEqual(0.035);
    expect(part('и')).toBeGreaterThanOrEqual(0.033);
    expect(wordsRu.filter((w) => w.includes('э')).length).toBeGreaterThanOrEqual(15);
    // Двор — уроки ребёнка: словарь пополняют словами с буквами района или города, пулы двора те же.
    const pools = Object.fromEntries(
      ['yard-5', 'yard-6', 'yard-7', 'yard-12'].map((id) => [id, wordsFor(lesson(id), wordsRu).length]),
    );
    expect(pools).toEqual({ 'yard-5': 29, 'yard-6': 87, 'yard-7': 88, 'yard-12': 88 });
  });
});
