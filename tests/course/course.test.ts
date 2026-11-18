/**
 * Курс v2 (спека 016): лестница по настоящим файлам, модель победы и цепочка профилей по лестнице Двора.
 * Разбор схем контента и словарь — в `course-content.test.ts`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ruIds from '../../src/content/courses/ru/ids.json';
import ruFrames from '../../src/content/courses/ru/leagues.json';
import yardPack from '../../src/content/packs/ru.yard/lessons.json';
import { checkIds } from '../../src/content/schema';
import type { Registry } from '../../src/content/schema';
import { bestMark, reconcile } from '../../src/engine/course/reconcile';
import type { CourseProgress, LessonMark } from '../../src/engine/course/reconcile';
import { createRandom, pick, randomInt } from '../../src/engine/random';
import { checkGolden, checkLiveIds, checkPackSize, checkRegistry, releaseIds, resolveHeir } from '../../src/engine/course/registry';
import { courseLessons, keymap } from './yard';
import { accuracyFor, winChance } from '../../src/engine/plan/odds';
import type { CourseLesson } from '../../src/engine/plan/lesson';

describe('лестница', () => {
  const yard = courseLessons.filter((x) => x.league === 'yard');
  const scoring = yard.filter((x) => !x.friendly);
  const a80 = (x: CourseLesson) => accuracyFor(x, 0.8);

  it('каркас: 6 лиг, 200 уроков, у готовой лиги (Двор) 32 урока из пакета, у строящихся уроков в игре нет', () => {
    // Ловит: лига без пакета, строящаяся лига с уроками, сумму уроков не 200, пакет Двора не на 32 урока.
    expect(ruFrames.map((x) => x.id)).toEqual(['yard', 'district', 'city', 'country', 'europe', 'world']);
    expect(ruFrames.reduce((s, x) => s + x.lessons, 0)).toBe(200);
    expect(ruFrames.map((x) => x.lessons)).toEqual([32, 36, 30, 32, 40, 30]);
    expect(ruFrames.map((x) => x.status)).toEqual(['ready', 'building', 'building', 'building', 'building', 'building']);
    for (const x of ruFrames.filter((l) => l.pack === null)) {
      expect(courseLessons.filter((l) => l.league === x.id).length, x.id).toBe(0);
    }
    expect(yard).toHaveLength(32);
  });

  it('буквы Двора — основной ряд и Э', () => {
    // Ловит: буква Двора не из основного ряда (ступени пакета и накопленные keys уроков).
    const home = 'фывапролджэ';
    expect([...yard.at(-1)!.keys].sort().join('')).toBe([...home].sort().join(''));
    expect([...yardPack.stages.flatMap((st) => [...st.newKeys])].sort().join('')).toBe([...home].sort().join(''));
    expect(keymap.layouts).toContain(yard[0]!.layout);
  });

  it('уроки: id по порядку, товарищеские 1/3/6/10/15/19/27, контрольные 14 и 21, фокус и особое', () => {
    // Ловит: сбитый порядок или подмену id (id хранит сохранение; порядок и id — по пакету ru.yard), потерянные флаги, фокус 12 и noWords 30 (ТЗ-2.1).
    expect(yard.map((x) => x.id)).toEqual(yardPack.order);
    expect(yard.filter((x) => x.friendly).map((x) => x.n)).toEqual([1, 3, 6, 10, 15, 19, 27]);
    expect(yard.filter((x) => x.control).map((x) => x.n)).toEqual([14, 21]);
    expect(yard[11]!.focus).toBe('фж');
    expect(yard[29]).toMatchObject({ noWords: true, focusWeak: 3 });
    expect(yard[0]!.trap).toBe(true);
    expect(yard.filter((x) => x.chants).map((x) => x.n)).toEqual([31, 32]);
    expect(yard.every((x) => x.tips.length >= 1)).toBe(true);
    expect(yard.every((x) => x.rowWidth === 29 && x.ladder.length === x.attacks.length && x.ladder.length > 0)).toBe(true);
  });

  it('матч каждого урока — в полосе своей ступени (ТЗ-2.14); итог 13 302 знака', () => {
    // Ловит: разминку или атаки, выведенные из полосы длины; разъезд с таблицей design §2.
    const total = yard.reduce((s, x) => s + x.warmup + 2 * x.attacks.reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(13302);
    const band = (stage: number) => (stage <= 4 ? [270, 345] : stage <= 8 ? [420, 534] : [570, 620]);
    for (const x of yard) {
      const m = x.warmup + 2 * x.attacks.reduce((a, b) => a + b, 0);
      expect(m, x.id).toBeGreaterThanOrEqual(band(x.stage)[0]!);
      expect(m, x.id).toBeLessThanOrEqual(band(x.stage)[1]!);
    }
  });

  it('A80 не убывает: урок 1 — 89,1 ± 0,2, урок 16 — 92,9 ± 0,2, урок 32 — 95,8 ± 0,2', () => {
    // Ловит: ступеньку вниз по строгости и сдвиг краёв лестницы (числа ТЗ-2.1).
    const a = yard.map((x) => a80(x) * 100);
    for (let i = 1; i < a.length; i++) expect(a[i]!, yard[i]!.id).toBeGreaterThanOrEqual(a[i - 1]! - 1e-9);
    expect(Math.abs(a[0]! - 89.1)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(a[15]! - 92.9)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(a[31]! - 95.8)).toBeLessThanOrEqual(0.2);
  });

  it('товарищеский — ровно у урока с новыми буквами или строкой больше; следующий за ним — та же строгость', () => {
    // Ловит: товарищеский, не готовящий следующий урок, лишний или пропущенный товарищеский (ТЗ-2.1, ТЗ-2.2).
    yard.forEach((x, i) => {
      if (x.friendly) {
        const next = yard[i + 1]!;
        expect([next.attacks, next.g, next.c], x.id).toEqual([x.attacks, x.g, x.c]);
      }
      const prev = yard[i - 1];
      expect(x.friendly, x.id).toBe(x.newKeys !== '' || (prev !== undefined && x.rows > prev.rows));
    });
  });

  it('атака растёт не больше чем на 3 знака на строку от урока к уроку', () => {
    // Ловит: резкий скачок длины, который ребёнок почувствует как стену.
    for (let i = 1; i < yard.length; i++) {
      const [a, b] = [yard[i - 1]!, yard[i]!];
      b.attacks.forEach((len, k) => expect(len / b.rows - a.attacks[k]! / a.rows, `${b.id} #${k}`).toBeLessThanOrEqual(3));
    }
  });

  it('три профиля на файле: средний (A80 прошлого) ≥ 0,70 и 0,70–0,85 на 2–9; точный 98 % ≥ 0,99; слабый (A50) ≥ 0,35', () => {
    // Ловит: скачок строгости, стену для слабого и уроки, где проигрывает даже аккуратный ребёнок (design §6).
    scoring.slice(1).forEach((x, i) => {
      const prev = scoring[i]!;
      const mid = winChance(x, accuracyFor(prev, 0.8));
      expect(mid, x.id).toBeGreaterThanOrEqual(0.7);
      if (x.n >= 2 && x.n <= 9) expect(mid, x.id).toBeLessThanOrEqual(0.85);
      expect(winChance(x, accuracyFor(prev, 0.5)), x.id).toBeGreaterThanOrEqual(0.35);
    });
    for (const x of scoring) expect(winChance(x, 0.98), x.id).toBeGreaterThanOrEqual(0.99);
  });
});

// --- фикстуры ---------------------------------------------------------------------------------------------

describe('модель победы: winChance и accuracyFor', () => {
  const lessons = courseLessons.filter((x) => x.league === 'yard');
  const a80 = (x: CourseLesson) => accuracyFor(x, 0.8);

  it('A80 на уроках 1, 16, 31 совпадает с таблицей design §2 с точностью 0,1 п. п.', () => {
    // Ловит: расхождение с моделью 011 — не тот знак, g/c или хвост распределения (A80 = 89,1 / 92,9 / 95,8).
    expect(a80(lessons[0]!) * 100).toBeCloseTo(89.1, 0);
    expect(Math.abs(a80(lessons[0]!) * 100 - 89.1)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(a80(lessons[15]!) * 100 - 92.9)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(a80(lessons[30]!) * 100 - 95.8)).toBeLessThanOrEqual(0.1);
  });

  it('winChance и accuracyFor взаимно обратны; точность растёт — победа не убывает', () => {
    // Ловит: нарушенную монотонность (бисекция уйдёт не туда) и подмену accuracy на p.
    const x = lessons[15]!;
    expect(winChance(x, accuracyFor(x, 0.8))).toBeCloseTo(0.8, 4);
    expect(winChance(x, accuracyFor(x, 0.5))).toBeCloseTo(0.5, 4);
    let prev = 0;
    for (const acc of [0.8, 0.85, 0.9, 0.95, 0.99, 1]) {
      const w = winChance(x, acc);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
    expect(winChance(x, 1)).toBeCloseTo(1, 10);
  });

  it('безошибочный матч — победа; почти без попаданий — почти ноль; одна атака в тайме сходится с ручной формулой', () => {
    // Ловит: поломку краёв — гол при 0 ошибок не засчитывается или вероятности не сходятся в 1.
    const tiny = { attacks: [10], g: 1, c: 3 };
    expect(winChance(tiny, 1)).toBe(1);
    expect(winChance(tiny, 0.2)).toBeLessThan(0.05);
    const p = 0.1;
    const goal = Math.pow(1 - p, 10) + 10 * p * Math.pow(1 - p, 10); // ≤ 1 ошибки на 10 знаков
    // Две атаки в одном матче (по одной в тайме): победа = (гол, гол) или (гол, сейв) или (сейв, гол).
    const pc = 1 - (Math.pow(0.9, 10) + 10 * 0.1 * Math.pow(0.9, 10) + 55 * 0.01 * Math.pow(0.9, 10));
    const save = 1 - goal - pc;
    expect(winChance(tiny, 1 - p)).toBeCloseTo(goal * goal + 2 * goal * save, 10);
  });
});

// --- цепочка трёх профилей --------------------------------------------------------------------------------

describe('цепочка A80 / 98 % / A50 по лестнице Двора (design §6): настоящие уроки', () => {
  const lessons = courseLessons.filter((x) => x.league === 'yard');
  const scoring = lessons.filter((x) => !x.friendly);
  const a80 = (x: CourseLesson) => accuracyFor(x, 0.8);

  // Точность предыдущего зачётного урока в цепочке; у первого предка нет.
  const withPrev = (chance: number) =>
    scoring.slice(1).map((x) => ({ x, prev: scoring[scoring.indexOf(x) - 1]!, ref: accuracyFor(scoring[scoring.indexOf(x) - 1]!, chance) }));

  it('средний (A80 прошлого): победа с первой ≥ 0,70 на каждом зачётном; на уроках 2–9 ещё и ≤ 0,85', () => {
    // Ловит: скачок строгости — урок, на котором ребёнок «на своём уровне» проигрывает чаще, чем в 30 % матчей; или слишком лёгкий.
    for (const { x, ref } of withPrev(0.8)) {
      const p1 = winChance(x, ref);
      expect(p1, x.id).toBeGreaterThanOrEqual(0.7);
      if (x.n >= 2 && x.n <= 9) expect(p1, x.id).toBeLessThanOrEqual(0.85);
    }
  });

  it('средний растёт на 0,3 п. п. за урок: среднее с первой на уроках 10–32 ≥ 0,8', () => {
    // Ловит: лестница, которая не учитывает рост ребёнка и остаётся слишком жёсткой на всём курсе.
    const ps: number[] = [];
    let ref = a80(scoring[0]!);
    let refN = scoring[0]!.n;
    for (const x of scoring.slice(1)) {
      if (x.n >= 10) ps.push(winChance(x, Math.min(0.995, ref + 0.003 * (x.n - refN))));
      ref = a80(x);
      refN = x.n;
    }
    expect(ps.length).toBeGreaterThan(15);
    expect(ps.reduce((s, v) => s + v, 0) / ps.length).toBeGreaterThanOrEqual(0.8);
  });

  it('точный (98 %): победа ≥ 0,99 на каждом зачётном уроке', () => {
    // Ловит: уроки, на которых проигрывает даже аккуратный ребёнок.
    for (const x of scoring) expect(winChance(x, 0.98), x.id).toBeGreaterThanOrEqual(0.99);
  });

  it('слабый (A50 прошлого): победа ≥ 0,35 на каждом зачётном уроке', () => {
    // Ловит: стену для слабого — урок, после которого шансы упираются в ноль.
    for (const { x, ref } of withPrev(0.5)) expect(winChance(x, ref), x.id).toBeGreaterThanOrEqual(0.35);
  });

  it('A80 не убывает по лестнице; урока 1 — 89,1 ± 0,2, урока 32 — 95,8 ± 0,2', () => {
    // Ловит: ступенька вниз по строгости и сдвиг краёв лестницы (числа ТЗ-2.1).
    const a = lessons.map((x) => a80(x) * 100);
    for (let i = 1; i < a.length; i++) expect(a[i]!, lessons[i]!.id).toBeGreaterThanOrEqual(a[i - 1]! - 1e-9);
    expect(Math.abs(a[0]! - 89.1)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(a[31]! - 95.8)).toBeLessThanOrEqual(0.2);
  });

  it('урок после товарищеского — те же attacks, g, c; товарищеский — у новых букв или бо́льшего числа строк', () => {
    // Ловит: товарищеский, который не готовит следующий урок, или лишний/пропущенный товарищеский (ТЗ-2.1, ТЗ-2.2).
    lessons.forEach((x, i) => {
      if (x.friendly) {
        const next = lessons[i + 1]!;
        expect([next.attacks, next.g, next.c], x.id).toEqual([x.attacks, x.g, x.c]);
      }
      const prev = lessons[i - 1];
      const fresh = x.newKeys !== '' || (prev !== undefined && x.rows > prev.rows);
      expect(x.friendly, x.id).toBe(fresh);
    });
  });

  it('атака растёт не больше чем на 3 знака на строку от урока к уроку', () => {
    // Ловит: резкий скачок длины, который ребёнок почувствует как стену.
    for (let i = 1; i < lessons.length; i++) {
      const [a, b] = [lessons[i - 1]!, lessons[i]!];
      b.attacks.forEach((len, k) => expect(len / b.rows - a.attacks[k]! / a.rows, `${b.id} #${k}`).toBeLessThanOrEqual(3));
    }
  });
});

// --- словарь (016-Т3) -------------------------------------------------------------------------------------

// --- реестр id (060-Т3, К7) -------------------------------------------------------------------------------
describe('реестр id: правила 1–6', () => {
  /** Таблица id Двора, 060 design §2: id навсегда, порядок — порядок прохождения. */
  const YARD_TABLE = ['ao', 'ao-pairs', 'vl', 'vl-combos', 'first-words', 'yd', 'yd-combos', 'six-keys-words', 'six-keys-review', 'fzh', 'fzh-words',
    'fzh-again', 'eight-keys-words', 'test-eight', 'pr', 'pr-words', 'longer-words', 'row-no-eh', 'eh', 'eh-combos', 'test-row', 'short-words',
    'long-words', 'mixed-words', 'return-match', 'rematch', 'first-phrases', 'phrases', 'longer-phrases', 'fingers-not-words', 'final-first', 'final']
    .map((w) => `ru.yard.${w}`);
  /** Живые id Двора — `order` настоящего пакета ru.yard. */
  const YARD = yardPack.order;
  const reg = (over: Partial<Registry> = {}): Registry => ({ course: 'ru', released: [], retired: {}, ...over });
  const live = ['ru.yard.a', 'ru.yard.b', 'ru.yard.c'];

  it('настоящий ids.json: форма верна, правила 2–5 держатся; до выпуска released и retired пусты, после — сверка с голденом', () => {
    // Ловит: испорченный ids.json, выпущенный id без голдена, снятый id до первого выпуска и голден, которого нет
    // в released (список сократили). Состояние «до выпуска» узнаём по голдену: tools/ids-release.mjs пишет его вместе
    // с released, поэтому первое «выпускай» не краснит check (мина ревизии Э0, docs/quality/review-e0.md).
    expect(checkIds(ruIds)).toEqual([]);
    expect(checkRegistry(ruIds as Registry, YARD)).toEqual([]);
    const goldenPath = join(__dirname, '../golden/ids/ru.released.json');
    if (!existsSync(goldenPath)) {
      expect(ruIds.released, 'выпуск без голдена: запусти tools/ids-release.mjs').toEqual([]);
      expect(ruIds.retired, 'снят id, который ещё не выпускали').toEqual({});
    } else expect(checkGolden(ruIds as Registry, JSON.parse(readFileSync(goldenPath, 'utf8')) as string[])).toEqual([]);
  });

  it('форма ids.json: чужой курс, мусор и повтор — замечания', () => {
    // Ловит: id чужого курса или не по формату в реестре, повтор в released, наследник не id.
    expect(checkIds(reg({ released: ['en.yard.a'] })).join()).toContain('не этого курса');
    expect(checkIds(reg({ released: ['ru.Yard.a'] })).join()).toContain('не по формату');
    expect(checkIds(reg({ released: ['ru.yard.a', 'ru.yard.a'] })).join()).toContain('повторяется');
    expect(checkIds({ ...reg(), retired: { 'ru.yard.a': 7 } }).join()).toContain('наследник');
    expect(checkIds(null)).not.toEqual([]);
  });

  it('правило 1: id живого контента уникальны и по формату (32 id Двора по таблице — годны)', () => {
    // Ловит: повтор id, кириллицу или заглавные в id, id не из своего курса или пакета.
    expect(YARD).toHaveLength(32);
    expect(YARD).toEqual(YARD_TABLE); // 32 id пакета — ровно таблица design §2, в том же порядке
    expect(checkLiveIds(YARD, 'ru.yard.')).toEqual([]);
    expect(checkLiveIds(['ru.yard.a', 'ru.yard.a']).join()).toContain('duplicate');
    expect(checkLiveIds(['yard-01']).join()).toContain('bad format');
    expect(checkLiveIds(['ru.yard.Ао']).join()).toContain('bad format');
    expect(checkLiveIds(['ru.city.a'], 'ru.yard.').join()).toContain('outside ru.yard.');
  });

  it('правило 2: выпущенный id — живой или в retired', () => {
    // Ловит: выпущенный урок, пропавший из контента без записи о снятии (у детей остались бы мёртвые звёзды).
    expect(checkRegistry(reg({ released: ['ru.yard.a', 'ru.yard.old'], retired: { 'ru.yard.old': 'ru.yard.b' } }), live)).toEqual([]);
    expect(checkRegistry(reg({ released: ['ru.yard.old'] }), live).join()).toContain('vanished');
  });

  it('правило 3: наследник — живой или null, цепочка без циклов и без висящих концов', () => {
    // Ловит: наследник, которого нет нигде, и цикл в цепочке (reconcile ходил бы по кругу).
    const ok = reg({ retired: { 'ru.yard.x': 'ru.yard.y', 'ru.yard.y': 'ru.yard.a', 'ru.yard.z': null } });
    expect(checkRegistry(ok, live)).toEqual([]);
    expect(checkRegistry(reg({ retired: { 'ru.yard.x': 'ru.yard.nowhere' } }), live).join()).toContain('dangling heir');
    expect(checkRegistry(reg({ retired: { 'ru.yard.x': 'ru.yard.y', 'ru.yard.y': 'ru.yard.x' } }), live).join()).toContain('cycle');
    expect(checkRegistry(reg({ retired: { 'ru.yard.x': 'ru.yard.x' } }), live).join()).toContain('cycle');
  });

  it('правило 4: id не живой и снятый одновременно', () => {
    // Ловит: урок, снятый «на бумаге», но оставленный в контенте (или наоборот) — двойная правда.
    expect(checkRegistry(reg({ retired: { 'ru.yard.a': null } }), live).join()).toContain('both live and retired');
  });

  it('правило 5: голден входит в released — список не сокращается', () => {
    // Ловит: правку ids.json, из которой выпавший id убрали руками из released.
    expect(checkGolden(reg({ released: ['ru.yard.a', 'ru.yard.b'] }), ['ru.yard.a'])).toEqual([]);
    expect(checkGolden(reg({ released: ['ru.yard.a'] }), ['ru.yard.a', 'ru.yard.b']).join()).toContain('"ru.yard.b"');
  });

  it('правило 6: order пакета по длине равен lessons лиги (Двор — 32)', () => {
    // Ловит: пакет с лишним или недостающим уроком против каркаса (сумму каркаса 200 держит content.test.ts).
    const yardFrame = ruFrames.find((f) => f.id === 'yard')!;
    expect(yardFrame.lessons).toBe(32);
    expect(checkPackSize(YARD, yardFrame)).toEqual([]);
    expect(checkPackSize(YARD.slice(1), yardFrame).join()).toContain('frame 32 lessons, pack 31');
  });

  it('resolveHeir: живой — сам себе, цепочка — до живого, null и цикл — без наследника', () => {
    // Ловит: цепочку, оборванную на первом звене, и бесконечный обход цикла.
    const r = reg({ retired: { 'ru.yard.x': 'ru.yard.y', 'ru.yard.y': 'ru.yard.a', 'ru.yard.n': null, 'ru.yard.p': 'ru.yard.q', 'ru.yard.q': 'ru.yard.p' } });
    const l = new Set(live);
    expect(resolveHeir(r, l, 'ru.yard.a')).toBe('ru.yard.a');
    expect(resolveHeir(r, l, 'ru.yard.x')).toBe('ru.yard.a');
    expect(resolveHeir(r, l, 'ru.yard.n')).toBeNull();
    expect(resolveHeir(r, l, 'ru.yard.p')).toBeNull();
    expect(resolveHeir(r, l, 'ru.yard.unknown')).toBeNull();
  });

  it('releaseIds: дописывает только новые живые id, прежний порядок и вход целы', () => {
    // Ловит: выпуск, который переставляет, сокращает released или меняет входной реестр.
    const before = reg({ released: ['ru.yard.old', 'ru.yard.a'], retired: { 'ru.yard.old': null } });
    const frozen = structuredClone(before);
    const after = releaseIds(before, ['ru.yard.a', 'ru.yard.b', 'ru.yard.b', 'ru.yard.c']);
    expect(after.released).toEqual(['ru.yard.old', 'ru.yard.a', 'ru.yard.b', 'ru.yard.c']);
    expect(after.retired).toEqual(before.retired);
    expect(before).toEqual(frozen);
    expect(releaseIds(after, ['ru.yard.a', 'ru.yard.b', 'ru.yard.c'])).toEqual(after);
  });

  it('tools/ids-release.mjs на временной копии: пишет ids.json и голден, повтор ничего не меняет, нарушение — отказ без записи', () => {
    // Ловит: команду выпуска, которая не пишет голден, сокращает released или выпускает при нарушении правил 1–4.
    const tmp = mkdtempSync(join(tmpdir(), 'kk-ids-'));
    try {
      const content = join(tmp, 'content');
      const golden = join(tmp, 'golden');
      const write = (rel: string, data: unknown) => {
        mkdirSync(join(content, rel, '..'), { recursive: true });
        writeFileSync(join(content, rel), JSON.stringify(data));
      };
      write('courses/ru/leagues.json', [{ id: 'yard', lessons: 2, layer: 'home', cup: 'cup-yard', status: 'ready', pack: 'ru.yard' }]);
      write('packs/ru.yard/lessons.json', { order: ['ru.yard.a', 'ru.yard.b'] });
      write('courses/ru/ids.json', { course: 'ru', released: [], retired: {} });
      const run = () => execFileSync('node', ['tools/ids-release.mjs', 'ru', '--content', content, '--golden', golden], { cwd: join(__dirname, '../..'), encoding: 'utf8', stdio: 'pipe' });
      const read = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
      expect(run()).toContain('добавлено — 2');
      expect(read(join(content, 'courses/ru/ids.json'))).toEqual({ course: 'ru', released: ['ru.yard.a', 'ru.yard.b'], retired: {} });
      expect(read(join(golden, 'ru.released.json'))).toEqual(['ru.yard.a', 'ru.yard.b']);
      expect(run()).toContain('добавлено — 0');
      write('packs/ru.yard/lessons.json', { order: ['ru.yard.a', 'ru.yard.c'] });
      const failed = (() => {
        try {
          run();
          return null;
        } catch (e) {
          return e as { status: number; stderr: string };
        }
      })();
      expect(failed?.status).toBe(1);
      expect(failed?.stderr).toContain('"ru.yard.b" vanished');
      expect(read(join(golden, 'ru.released.json'))).toEqual(['ru.yard.a', 'ru.yard.b']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);
});

// --- reconcile (060-Т3, К8) -------------------------------------------------------------------------------
describe('reconcile', () => {
  const mk = (stars: 0 | 1 | 2 | 3, best: number, tries = 1, done?: string): LessonMark => (done === undefined ? { stars, best, tries } : { stars, best, tries, done });
  const prog = (over: Partial<CourseProgress> = {}): CourseProgress => ({ current: 'ru.yard.a', lessons: {}, archive: {}, leaguesDone: {}, ...over });
  const reg = (retired: Registry['retired']): Registry => ({ course: 'ru', released: [], retired });
  const ORDER = ['ru.yard.a', 'ru.yard.b', 'ru.yard.c', 'ru.yard.d'];

  it('снятый с наследником: запись в архив, наследник получает лучшее (stars, затем best), done — раньшая дата, current — к наследнику', () => {
    // Ловит: потерянные звёзды снятого урока, затёртую лучшую отметку наследника, позднюю дату защёлки, current на мёртвом id.
    const p = prog({ current: 'ru.yard.old', lessons: { 'ru.yard.old': mk(3, 80, 5, '2026-03-02'), 'ru.yard.b': mk(2, 95, 2, '2026-03-01') } });
    const { progress, changes } = reconcile(p, reg({ 'ru.yard.old': 'ru.yard.b' }), ORDER);
    expect(progress.archive['ru.yard.old']).toEqual(mk(3, 80, 5, '2026-03-02'));
    expect(progress.lessons['ru.yard.old']).toBeUndefined();
    expect(progress.lessons['ru.yard.b']).toEqual(mk(3, 80, 5, '2026-03-01'));
    expect(progress.current).toBe('ru.yard.b');
    expect(changes).toEqual([
      { kind: 'archived', id: 'ru.yard.old' },
      { kind: 'inherited', from: 'ru.yard.old', to: 'ru.yard.b' },
      { kind: 'current', from: 'ru.yard.old', to: 'ru.yard.b' },
    ]);
  });

  it('равные звёзды — решает best; у наследника лучше — остаётся его отметка', () => {
    // Ловит: перезапись лучшего наследника худшей отметкой снятого и выбор по best раньше stars.
    const a = reconcile(prog({ lessons: { 'ru.yard.old': mk(2, 70), 'ru.yard.b': mk(2, 90) } }), reg({ 'ru.yard.old': 'ru.yard.b' }), ORDER);
    expect(a.progress.lessons['ru.yard.b']).toMatchObject({ stars: 2, best: 90 });
    const b = reconcile(prog({ lessons: { 'ru.yard.old': mk(1, 99), 'ru.yard.b': mk(2, 10) } }), reg({ 'ru.yard.old': 'ru.yard.b' }), ORDER);
    expect(b.progress.lessons['ru.yard.b']).toMatchObject({ stars: 2, best: 10 });
  });

  it('равные звёзды и best — выигрывает больше попыток, в любом порядке аргументов', () => {
    // Ловит: порядок при полной ничьей по stars и best не закреплён — мутант `a.tries >= b.tries` → `<=` отдавал бы меньше попыток.
    expect(bestMark(mk(2, 80, 7), mk(2, 80, 3))).toEqual(mk(2, 80, 7));
    expect(bestMark(mk(2, 80, 3), mk(2, 80, 7))).toEqual(mk(2, 80, 7));
    const r = reconcile(prog({ lessons: { 'ru.yard.old': mk(2, 80, 7), 'ru.yard.b': mk(2, 80, 3) } }), reg({ 'ru.yard.old': 'ru.yard.b' }), ORDER);
    expect(r.progress.lessons['ru.yard.b']).toEqual(mk(2, 80, 7));
  });

  it('снятый id уже есть в архиве (запись вернулась из старого снимка): архив получает лучшее, не затирается худшим', () => {
    // Ловит: затирание архивной отметки свежей худшей при повторном снятии.
    const p = prog({ lessons: { 'ru.yard.old': mk(1, 30, 1, '2026-05-05') }, archive: { 'ru.yard.old': mk(3, 80, 4, '2026-04-04') } });
    const { progress } = reconcile(p, reg({ 'ru.yard.old': null }), ORDER);
    expect(progress.archive['ru.yard.old']).toEqual(mk(3, 80, 4, '2026-04-04'));
  });

  it('цепочка старый → промежуточный → живой: оба в архив, живой получает лучшее из всех', () => {
    // Ловит: цепочку, оборванную на снятом звене.
    const p = prog({ lessons: { 'ru.yard.x': mk(3, 60), 'ru.yard.y': mk(1, 99) } });
    const { progress } = reconcile(p, reg({ 'ru.yard.x': 'ru.yard.y', 'ru.yard.y': 'ru.yard.c' }), ORDER);
    expect(Object.keys(progress.archive).sort()).toEqual(['ru.yard.x', 'ru.yard.y']);
    expect(progress.lessons).toEqual({ 'ru.yard.c': mk(3, 60) });
  });

  it('снятый без наследника (null): только архив; current → первый непройденный после последнего пройденного', () => {
    // Ловит: current, прыгнувший назад на вставленный непройденный урок, и потерю отметки снятого без наследника.
    const p = prog({ current: 'ru.yard.old', lessons: { 'ru.yard.old': mk(2, 80), 'ru.yard.b': mk(1, 50, 1, '2026-03-01') } });
    const { progress } = reconcile(p, reg({ 'ru.yard.old': null }), ORDER);
    expect(progress.archive['ru.yard.old']).toEqual(mk(2, 80));
    expect(progress.lessons).toEqual({ 'ru.yard.b': mk(1, 50, 1, '2026-03-01') });
    expect(progress.current).toBe('ru.yard.c');
  });

  it('null-наследник: все пройдены — последний урок; order пуст — current не трогаем', () => {
    // Ловит: current за краем списка и падение на пустом order.
    const all = Object.fromEntries(ORDER.map((id) => [id, mk(1, 50)]));
    expect(reconcile(prog({ current: 'ru.yard.old', lessons: all }), reg({ 'ru.yard.old': null }), ORDER).progress.current).toBe('ru.yard.d');
    expect(reconcile(prog({ current: 'ru.yard.old' }), reg({ 'ru.yard.old': null }), []).progress.current).toBe('ru.yard.old');
  });

  it('вставленный позади урок — «открыт»: записи не появляются, current не двигается', () => {
    // Ловит: reconcile, который «пересчитывает» позицию по порядку и сдвигает current на новый урок.
    const p = prog({ current: 'ru.yard.c', lessons: { 'ru.yard.a': mk(3, 90), 'ru.yard.c': mk(0, 0, 1) } });
    const { progress, changes } = reconcile(p, reg({}), ['ru.yard.a', 'ru.yard.new', 'ru.yard.c']);
    expect(progress).toEqual(p);
    expect(changes).toEqual([]);
  });

  it('чужой id (другой курс, будущая версия) — дословно, в lessons и в current; leaguesDone не пересчитывается', () => {
    // Ловит: удаление или перенос неизвестного id и защёлку лиги, выведенную заново из уроков.
    const p = prog({
      current: 'en.yard.zzz',
      lessons: { 'en.yard.zzz': mk(3, 77, 4, '2026-01-01'), 'ru.yard.future': mk(2, 66), ...Object.fromEntries(ORDER.map((id) => [id, mk(3, 90)])) },
      leaguesDone: { city: '2026-02-02' },
    });
    const { progress, changes } = reconcile(p, reg({ 'ru.yard.old': null }), ORDER);
    expect(progress).toEqual(p);
    expect(changes).toEqual([]);
  });

  it('вход не меняется, результат — новые объекты', () => {
    // Ловит: правку прогресса на месте (отмена и сравнение «до/после» стали бы невозможны).
    const p = prog({ current: 'ru.yard.old', lessons: { 'ru.yard.old': mk(3, 80, 5, '2026-03-02') }, leaguesDone: { yard: '2026-04-01' } });
    const frozen = structuredClone(p);
    const out = reconcile(p, reg({ 'ru.yard.old': 'ru.yard.b' }), ORDER).progress;
    expect(p).toEqual(frozen);
    expect(out.leaguesDone).not.toBe(p.leaguesDone);
  });

  describe('свойства на семенах', () => {
    const stars = (p: CourseProgress) => [...Object.values(p.lessons), ...Object.values(p.archive)].reduce((s, m) => s + m.stars, 0);
    const shuffle = <T>(rnd: () => number, xs: readonly T[]): T[] => {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) {
        const j = randomInt(rnd, i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    };

    /** Случайное, но допустимое состояние: реестр — DAG (наследник: живой, null или более поздний снятый). */
    function world(seed: number) {
      const rnd = createRandom(seed);
      const live = Array.from({ length: 3 + randomInt(rnd, 8) }, (_, i) => `ru.yard.l${i}`);
      const dead = Array.from({ length: randomInt(rnd, 6) }, (_, i) => `ru.yard.r${i}`);
      const alien = [...Array.from({ length: randomInt(rnd, 3) }, (_, i) => `en.yard.f${i}`), ...Array.from({ length: randomInt(rnd, 2) }, (_, i) => `ru.yard.x${i}`)];
      const retired: Registry['retired'] = {};
      dead.forEach((id, i) => {
        const t = rnd();
        const later = dead.slice(i + 1);
        retired[id] = t < 0.2 ? null : t < 0.5 && later.length > 0 ? pick(rnd, later) : pick(rnd, live);
      });
      const mark = (): LessonMark => mk(randomInt(rnd, 4) as 0 | 1 | 2 | 3, randomInt(rnd, 101), randomInt(rnd, 10), rnd() < 0.5 ? `2026-0${1 + randomInt(rnd, 9)}-1${randomInt(rnd, 9)}` : undefined);
      const lessons: Record<string, LessonMark> = {};
      for (const id of [...live, ...dead, ...alien]) if (rnd() < 0.6) lessons[id] = mark();
      const archive: Record<string, LessonMark> = {};
      for (let i = 0; i < randomInt(rnd, 3); i++) archive[`ru.yard.a${i}`] = mark();
      const p: CourseProgress = { current: pick(rnd, [...live, ...dead, ...alien]), lessons, archive, leaguesDone: rnd() < 0.5 ? { yard: '2026-05-01' } : {} };
      return { p, r: reg(retired), order: shuffle(rnd, live), rnd };
    }
    const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

    it('идемпотентность r(r(x)) = r(x), второй проход без изменений; вход не меняется; реестр генератора годен', () => {
      // Ловит: reconcile, который при повторном запуске снова переносит звёзды или двигает current (запуск на каждом входе в игру).
      for (const seed of SEEDS) {
        const { p, r, order } = world(seed);
        const frozen = structuredClone(p);
        expect(checkRegistry({ ...r, released: [] }, order), `seed ${seed}`).toEqual([]);
        const once = reconcile(p, r, order);
        expect(p, `seed ${seed}: вход изменён`).toEqual(frozen);
        const twice = reconcile(once.progress, r, order);
        expect(twice.progress, `seed ${seed}`).toEqual(once.progress);
        expect(twice.changes, `seed ${seed}`).toEqual([]);
      }
    });

    it('сумма звёзд по живым и архиву не убывает; снятых нет в lessons; их отметки целы в архиве', () => {
      // Ловит: потерю звёзд при переносе (ТЗ «ничего не сгорает») и снятый урок, оставшийся «живым».
      for (const seed of SEEDS) {
        const { p, r, order } = world(seed);
        const { progress } = reconcile(p, r, order);
        expect(stars(progress), `seed ${seed}`).toBeGreaterThanOrEqual(stars(p));
        for (const id of Object.keys(r.retired)) {
          expect(progress.lessons[id], `seed ${seed} ${id}`).toBeUndefined();
          if (p.lessons[id]) expect(progress.archive[id], `seed ${seed} ${id}`).toEqual(p.lessons[id]);
        }
        for (const [id, m] of Object.entries(p.archive)) expect(progress.archive[id], `seed ${seed} ${id}`).toEqual(m);
      }
    });

    it('перестановка order не меняет lessons, archive и leaguesDone', () => {
      // Ловит: зависимость переноса звёзд от порядка уроков в пакете (А-3).
      for (const seed of SEEDS) {
        const { p, r, order, rnd } = world(seed);
        const a = reconcile(p, r, order).progress;
        const b = reconcile(p, r, shuffle(rnd, order)).progress;
        expect({ l: b.lessons, a: b.archive, d: b.leaguesDone }, `seed ${seed}`).toEqual({ l: a.lessons, a: a.archive, d: a.leaguesDone });
      }
    });

    it('чужой id и leaguesDone — дословно; наследник = лучшее по (stars, best), done — раньшая дата; current по правилам', () => {
      // Ловит: тронутый чужой id, неверный выбор «лучшего» и current вне контента после снятия.
      for (const seed of SEEDS) {
        const { p, r, order } = world(seed);
        const { progress } = reconcile(p, r, order);
        const known = new Set([...order, ...Object.keys(r.retired)]);
        for (const [id, m] of Object.entries(p.lessons)) if (!known.has(id)) expect(progress.lessons[id], `seed ${seed} ${id}`).toBe(m);
        expect(progress.leaguesDone, `seed ${seed}`).toEqual(p.leaguesDone);
        const live = new Set(order);
        const endOf = (id: string): string | null => {
          for (let cur: string | null = id; cur !== null; cur = r.retired[cur] ?? null) if (live.has(cur)) return cur;
          return null;
        };
        for (const id of order) {
          const group = [id, ...Object.keys(r.retired).filter((d) => endOf(d) === id)].flatMap((g) => (p.lessons[g] ? [p.lessons[g]] : []));
          const got = progress.lessons[id];
          if (group.length === 0) {
            expect(got, `seed ${seed} ${id}`).toBeUndefined();
            continue;
          }
          const top = group.reduce((a, b) => (a.stars !== b.stars ? (a.stars > b.stars ? a : b) : a.best >= b.best ? a : b));
          const days = group.flatMap((m) => (m.done === undefined ? [] : [m.done])).sort();
          expect({ stars: got?.stars, best: got?.best, done: got?.done }, `seed ${seed} ${id}`).toEqual({ stars: top.stars, best: top.best, done: days[0] });
        }
        if (live.has(p.current) || !known.has(p.current)) expect(progress.current, `seed ${seed}`).toBe(p.current);
        else expect(live.has(progress.current), `seed ${seed}`).toBe(true);
        if (!live.has(p.current) && known.has(p.current) && endOf(p.current) !== null) expect(progress.current, `seed ${seed}`).toBe(endOf(p.current));
      }
    });
  });
});
