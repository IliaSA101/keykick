/**
 * Точка (спека 009): урок `city-dot` — точка хвостом куска; дальше — конец фраз и части строк слов;
 * ошибки на точке — точек в тайме больше. Вынесено из lessons.test.ts (там кончилось место).
 */
import { describe, expect, it } from 'vitest';
import { keymap } from '../src/app/keymap';
import { lessons, wordsRu } from '../src/app/lessons';
import { HALF_LINES, attackPlan, letterWeights, makeHalf, makeWarmup, type Lesson } from '../src/engine/lessons';
import { ru } from '../src/i18n/ru';
import { emptyStats, type TypingStats } from '../src/engine/typing';

const lesson = (id: string): Lesson => {
  const l = lessons.find((x) => x.id === id);
  if (!l) throw new Error(`no lesson ${id}`);
  return l;
};

describe('точка (009)', () => {
  /** Таймы урока на зёрнах 1…50. */
  const halves = (id: string): string[][] => Array.from({ length: 50 }, (_, i) => makeHalf(lesson(id), wordsRu, keymap, i + 1));
  /** То же со статистикой ошибок. */
  const halvesWith = (id: string, stats?: TypingStats): string[][] =>
    Array.from({ length: 50 }, (_, i) => makeHalf(lesson(id), wordsRu, keymap, i + 1, stats));
  const AFTER = ['city-pinky', 'city-7', 'city-8', 'city-9', 'city-10'];

  it('city-dot после city-6: «.» новая, фокус «.жю», слова, совет и соперник; «.» в конце keys у city-dot и дальше', () => {
    const at = lessons.findIndex((l) => l.id === 'city-dot');
    expect(lessons[at - 1]?.id).toBe('city-6');
    expect(lesson('city-dot')).toMatchObject({ newKeys: '.', focus: '.жю', material: 'words', rival: 'Жюль' });
    expect(lesson('city-dot').tips.length).toBeGreaterThan(0);
    for (const [i, l] of lessons.entries()) expect([l.keys.includes('.'), l.keys.at(-1) === '.'], l.id).toEqual([i >= at, i >= at]);
    // Урок без фокуса (city-10) разминается первыми 8 знаками keys — это буквы, точки нет.
    for (let seed = 1; seed <= 10; seed++) expect(makeWarmup(lesson('city-10'), seed).flat().join('')).not.toContain('.');
  });

  it('точка — хвост куска на city-dot, доля 0,25–0,45', () => {
    let pieces = 0;
    const byAttack = Array<number>(HALF_LINES).fill(0);
    for (const half of halves('city-dot')) {
      for (const [i, line] of half.entries()) {
        const parts = line.split(' ');
        pieces += parts.length;
        byAttack[i] = (byAttack[i] ?? 0) + parts.filter((t) => t.endsWith('.')).length;
      }
    }
    const dots = byAttack.reduce((a, b) => a + b, 0);
    expect(dots / pieces).toBeGreaterThanOrEqual(0.25);
    expect(dots / pieces).toBeLessThanOrEqual(0.45);
    // Во всех ступенях: буквы, пары, сочетания, слова.
    for (const [i, n] of byAttack.entries()) expect(n, `атака ${i + 1}`).toBeGreaterThan(0);
  });

  it('с city-pinky — фразы кончаются точкой, у слов — часть строк', () => {
    for (const id of AFTER) {
      const plan = attackPlan(lesson(id));
      let words = 0;
      let ended = 0;
      for (const half of halves(id)) {
        for (const [i, line] of half.entries()) {
          const material = plan[i]?.material;
          const dot = line.endsWith('.');
          expect(line.slice(0, -1), line).not.toContain('.');
          if (material === 'phrases') expect(dot, line).toBe(true);
          else if (material !== 'words') expect(dot, `${id} ${line}`).toBe(false);
          else {
            words++;
            if (dot) ended++;
          }
        }
      }
      expect(ended / words, id).toBeGreaterThanOrEqual(0.2);
      expect(ended / words, id).toBeLessThanOrEqual(0.8);
    }
  });

  it('ошибки на точке не ставят её в конец строк букв, пар и сочетаний — только слов и фраз (009-Р21)', () => {
    const hard = { ...emptyStats, keyErrors: { Slash: 3 } };
    for (const id of AFTER) {
      const plan = attackPlan(lesson(id));
      for (const half of halvesWith(id, hard)) {
        for (const [i, line] of half.entries()) {
          const material = plan[i]?.material;
          if (material !== 'words' && material !== 'phrases') expect(line.endsWith('.'), `${id} ${line}`).toBe(false);
        }
      }
    }
  });

  it('точки нет в сочетаниях и пробежке по ряду', () => {
    const stats: TypingStats = { ...emptyStats, keyErrors: { Slash: 3 } };
    for (const id of ['city-dot', ...AFTER]) {
      // В весах точки нет и с ошибками на ней: буквы, пары и сочетания — из букв.
      expect([...letterWeights(lesson(id), keymap, stats).keys()], id).not.toContain('.');
      const plan = attackPlan(lesson(id));
      for (const half of halves(id)) {
        for (const [i, line] of half.entries()) {
          if (plan[i]?.material !== 'combos') continue;
          // На city-dot точка — только хвост куска («бю.»), не внутри пробежки («.юб», «ю.б»).
          for (const t of line.split(' ')) expect(id === 'city-dot' ? t.replace(/\.$/, '') : t, t).toMatch(/^\p{L}+$/u);
        }
      }
    }
  });

  it('нет «..», « .», точки внутри слова, повторов «вода вода.»', () => {
    for (const id of ['city-dot', ...AFTER]) {
      const plan = attackPlan(lesson(id));
      for (const half of halves(id)) {
        for (const [i, line] of half.entries()) {
          expect(line, line).not.toMatch(/\.\S|(^|\s)\./);
          if (plan[i]?.material !== 'words' && plan[i]?.material !== 'phrases') continue;
          const words = line.split(' ').map((t) => t.replace(/\.$/, ''));
          for (let k = 1; k < words.length; k++) expect(words[k], line).not.toBe(words[k - 1]);
        }
      }
    }
  });

  it('ошибки на точке — точек за тайм заметно больше: хвостов на city-dot, строк слов дальше (009-Р21)', () => {
    /** Среднее число точек за тайм на зёрнах 1…50. */
    const dots = (id: string, stats?: TypingStats): number =>
      halvesWith(id, stats).reduce((sum, half) => sum + half.join('').split('.').length - 1, 0) / 50;
    const hard: TypingStats = { ...emptyStats, keyErrors: { Slash: 20 } };
    // Замер: city-dot 9,9 → 17,3; city-7 — 0,9 → 1,6 за тайм.
    expect(dots('city-dot', hard)).toBeGreaterThan(1.5 * dots('city-dot'));
    expect(dots('city-7', hard)).toBeGreaterThan(1.3 * dots('city-7'));
    // Прибавка с потолком: 3 ошибки и 20 — одно и то же.
    expect(dots('city-dot', { ...emptyStats, keyErrors: { Slash: 3 } })).toBe(dots('city-dot', hard));
  });

  it('до city-dot ошибки на клавише точки строк не меняют — снимок прежний (009-Р21)', () => {
    const hard: TypingStats = { ...emptyStats, keyErrors: { Slash: 20 } };
    expect(halvesWith('city-6', hard)).toEqual(halves('city-6'));
    // Ошибки на клавише вне урока точку не подтягивают.
    expect(halvesWith('city-dot', { ...emptyStats, keyErrors: { Digit5: 20 } })).toEqual(halves('city-dot'));
  });

  it('у каждого знака в newKeys уроков есть имя для вступления и статистики (009-Р22)', () => {
    const marks = [...new Set(lessons.flatMap((l) => [...l.newKeys]).filter((ch) => ch.toLowerCase() === ch.toUpperCase()))];
    expect(marks).toContain('.');
    for (const ch of marks) expect(ru.keyboard.marks[ch], ch).toBeTruthy();
    expect(ru.keyboard.marks['.']).toBe('точка');
  });
});
