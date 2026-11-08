/**
 * Раздел `school` и битовая строка «разобрано» (спека 018-Т9, design §3.2, К13).
 * Ловит у каждого теста — строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { courseLessons, leagues } from '../src/app/course/load';
import { keymap } from '../src/app/keymap';
import type { Catalog } from '../src/engine/save/section';
import { section as schoolSection } from '../src/engine/school/save';
import { addSolved, hasSolved, parseSolved, solvedCount } from '../src/engine/school/solved';
import { TASK_NO_MAX } from '../src/engine/tasks';

/** Каталог из настоящего контента (как в `saveSections.test.ts`). */
const cat: Catalog = {
  lessonIds: courseLessons.map((l) => l.id),
  leagueIds: leagues.map((l) => l.id),
  keyCodes: [...keymap.byCode.keys()],
  taskNoMax: TASK_NO_MAX,
};

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('school: «разобрано» битами (К13)', () => {
  // Ловит: смена порядка битов или алфавита — старое сохранение «забудет» разобранные задачи (младший бит первым, base64url).
  it('формат: бит no−1, 6 на знак, младший первым', () => {
    expect(addSolved('', 1)).toBe('B');
    expect(addSolved('', 2)).toBe('C');
    expect(addSolved('', 7)).toBe('AB');
    expect(addSolved('', 6)).toBe('g');
    expect(addSolved(addSolved('', 1), 7)).toBe('BB');
    expect(addSolved('', 61)).toBe('AAAAAAAAAAB');
    expect(addSolved('', 6000).length).toBe(1000);
  });

  // Ловит: добавление бита затирает соседний бит того же знака (присваивание вместо `old |`).
  it('addSolved: соседние номера в одном знаке не затирают друг друга', () => {
    expect(addSolved(addSolved('', 1), 2)).toBe('D');
    expect(addSolved(addSolved('', 2), 1)).toBe('D');
    const bits = addSolved(addSolved('', 7), 12);
    expect(hasSolved(bits, 7)).toBe(true);
    expect(hasSolved(bits, 12)).toBe(true);
    expect(solvedCount(bits)).toBe(2);
  });

  // Ловит: has/add/count расходятся (повтор считается дважды, соседний бит затирается), хвостовые нули пишутся.
  it('hasSolved, addSolved, solvedCount', () => {
    let bits = '';
    for (const no of [1, 7, 13, 7, 6000, 64]) bits = addSolved(bits, no);
    expect(solvedCount(bits)).toBe(5);
    for (const no of [1, 7, 13, 64, 6000]) expect(hasSolved(bits, no), `no ${no}`).toBe(true);
    for (const no of [2, 6, 8, 63, 65, 5999]) expect(hasSolved(bits, no), `no ${no}`).toBe(false);
    expect(addSolved(bits, 7)).toBe(bits);
    expect(parseSolved('BAAA')).toBe('B');
  });

  // Ловит: «Знаток» открывается за чужой номер (0, дробь, выше потолка) или битая строка роняет разбор / считается разобранной.
  it('негодные номера и строки: ничего не разобрано, не бросает', () => {
    for (const no of [0, -1, 1.5, NaN, 6001]) {
      expect(addSolved('B', no)).toBe('B');
      expect(hasSolved('B', no)).toBe(false);
    }
    for (const bad of ['B+/=', 'ы', 'B'.repeat(1001), 5, null]) {
      expect(parseSolved(bad)).toBe('');
      expect(schoolSection.parse({ solved: bad, expert: 2 }, {})).toEqual({ solved: '', expert: 2 });
    }
    expect(hasSolved('!!', 1)).toBe(false);
    expect(solvedCount('!!')).toBe(0);
    expect(addSolved('!!', 2)).toBe('C');
  });

  // Ловит: потолок обрезает игру (ТЗ-0.2): все 6000 номеров обязаны уместиться, а раздел — остаться крошечным.
  it('все 6000 номеров держатся, раздел на потолке < 1,2 КБ', () => {
    const max = schoolSection.maxSample(cat);
    expect(solvedCount(max.solved)).toBe(TASK_NO_MAX);
    expect(JSON.stringify(max).length).toBeLessThan(1200);
    expect(schoolSection.parse(json(max), {}).solved).toBe(max.solved);
  });

  // Ловит: «Знаток» не зажимается до целого ≥ 0; check пропускает неканоничную строку.
  it('expert: целое 0…потолок; check видит неканоничную строку', () => {
    expect(schoolSection.parse({ solved: '', expert: -4 }, {}).expert).toBe(0);
    expect(schoolSection.parse({ solved: '', expert: 7.9 }, {}).expert).toBe(7);
    expect(schoolSection.counters({ solved: 'B', expert: 9 })).toEqual({ expert: 9 });
    expect(schoolSection.check({ solved: 'B', expert: 1 }, cat)).toEqual([]);
    expect(schoolSection.check({ solved: 'BA', expert: 1 }, cat)).toHaveLength(1);
  });
});
