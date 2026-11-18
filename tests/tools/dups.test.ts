/**
 * Храповик дублей (спека 066, Т6; tools/dups.mjs, шаг `dups` в npm run check): чистые функции счёта и сравнения с базой.
 * Подготовка другая, чем у остальных тестов tools/: свои данные в памяти и временная папка с блоками i18n.
 * Сам запуск jscpd проверен на поломке руками (копия функции → красный): отчёт задания 066 Т6.
 * У каждого теста строка «Ловит:».
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compareToBase,
  findI18nDuplicates,
  flattenStrings,
  hasWords,
  i18nMetric,
  jscpdMetric,
  largestClones,
  loadI18nEntries,
  makeBase,
  parseClones,
  validateAllow,
  type Clone,
  type Current,
} from '../../tools/dups.mjs';

const clone = (a: string, b: string, lines = 10, scope: 'src' | 'tools' = 'src'): Clone => ({
  scope,
  a: { file: a, start: 1, end: lines },
  b: { file: b, start: 5, end: 5 + lines },
  lines,
  tokens: lines * 8,
  pair: [a, b].sort().join('|'),
});

function now(clones: Clone[], groups: { value: string; keys: string[] }[] = []): Current {
  return { jscpd: jscpdMetric(clones), i18n: i18nMetric(groups), clones, groups };
}

describe('одинаковые тексты i18n', () => {
  it('плоский список: путь ключа, числовые ключи, не-строки пропущены', () => {
    // Ловит: потерю вложенных ключей (`flags: {9: …}`) — новые места нечем назвать.
    const got = flattenStrings({ a: { b: 'x', 9: 'y', n: 5, f: null }, c: 'z' }, 'home');
    expect(got).toEqual([
      { key: 'home.a.9', value: 'y' },
      { key: 'home.a.b', value: 'x' },
      { key: 'home.c', value: 'z' },
    ]);
  });

  it('группа — одно значение под двумя ключами; единственное значение не группа', () => {
    // Ловит: пропуск повтора под разными ключами или ложную группу из одного ключа.
    const groups = findI18nDuplicates([
      { key: 'a.go', value: 'На матч' },
      { key: 'b.go', value: 'На матч' },
      { key: 'a.x', value: 'Один' },
    ]);
    expect(groups).toEqual([{ value: 'На матч', keys: ['a.go', 'b.go'] }]);
  });

  it('значение без букв — «★», «·», «{n}» — повтором не считается', () => {
    // Ловит: шум от знаков и подстановок: их повтор не просьба «вынести в общее место».
    expect(hasWords('{n}')).toBe(false);
    expect(hasWords('★')).toBe(false);
    expect(hasWords('{n} из {m}')).toBe(true);
    const groups = findI18nDuplicates([
      { key: 'a', value: '·' },
      { key: 'b', value: '·' },
      { key: 'c', value: '{n}' },
      { key: 'd', value: '{n}' },
    ]);
    expect(groups).toEqual([]);
  });

  it('исключение из файла — значение не считается; без причины файл исключений не принимается', () => {
    // Ловит: исключение без объяснения («тихая» дыра в храповике).
    const entries = [
      { key: 'a.few', value: 'матчей' },
      { key: 'a.many', value: 'матчей' },
    ];
    const allowed = validateAllow({ allow: [{ value: 'матчей', why: 'формы склонения совпали' }] });
    expect(findI18nDuplicates(entries, allowed)).toEqual([]);
    expect(() => validateAllow({ allow: [{ value: 'матчей' }] })).toThrow(/причины/);
    expect(() => validateAllow({ allow: [{ value: 'матчей', why: ' ' }] })).toThrow(/причины/);
    expect(() => validateAllow({})).toThrow();
  });

  it('счёт: лишние повторы = ключей минус один по каждой группе', () => {
    // Ловит: счёт групп вместо повторов — пятый ключ к старому значению прошёл бы мимо базы.
    const m = i18nMetric([{ value: 'a', keys: ['1', '2', '3'] }, { value: 'b', keys: ['4', '5'] }]);
    expect(m).toEqual({ extra: 3, values: { a: 3, b: 2 } });
  });

  describe('чтение блоков src/i18n/ru', () => {
    const dirs: string[] = [];
    afterEach(() => {
      for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    });

    it('TypeScript-блок `as const` читается; путь — файл.экспорт.ключи', async () => {
      // Ловит: сбой чтения реальных блоков (type-only, `as Record`, несколько экспортов в файле).
      const dir = mkdtempSync(join(tmpdir(), 'kk-dups-'));
      dirs.push(dir);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'one.ts'), "export const one = { go: 'Дальше', flags: { 9: 'матч' } as Record<number, string>, n: 3 } as const;\nexport const two = { go: 'Дальше' } as const;\n");
      writeFileSync(join(dir, 'ignored.txt'), 'нет');
      const got = await loadI18nEntries(dir);
      expect(got).toEqual([
        { key: 'one.one.go', value: 'Дальше' },
        { key: 'one.one.flags.9', value: 'матч' },
        { key: 'one.two.go', value: 'Дальше' },
      ]);
    });
  });
});

describe('копии jscpd', () => {
  it('отчёт: пути от корня; область src, если хоть один край в src/', () => {
    // Ловит: смешение src и tools — падение копий в tools скрыло бы рост в src.
    const root = '/r';
    const rep = {
      duplicates: [
        { firstFile: { name: '/r/src/a.ts', start: 1, end: 9 }, secondFile: { name: '/r/tools/b.mjs', start: 2, end: 10 }, lines: 9, tokens: 80 },
        { firstFile: { name: '/r/tools/x.py', start: 1, end: 7 }, secondFile: { name: '/r/tools/y.py', start: 3, end: 9 }, lines: 7, tokens: 60 },
      ],
    };
    const cl = parseClones(rep, root);
    expect(cl.map((c) => c.scope)).toEqual(['src', 'tools']);
    expect(cl[0]?.a.file).toBe('src/a.ts');
    const m = jscpdMetric(cl);
    expect(m.src).toMatchObject({ clones: 1, lines: 9 });
    expect(m.tools).toMatchObject({ clones: 1, lines: 7 });
  });

  it('крупнейшие — по числу строк', () => {
    // Ловит: отчёт «что вынести» начинается с мелочи.
    const top = largestClones([clone('a', 'b', 6), clone('c', 'd', 20), clone('e', 'f', 12)], 2);
    expect(top.map((t) => t.text)).toEqual(['c:1-20 ↔ d:5-25 (20 стр.)', 'e:1-12 ↔ f:5-17 (12 стр.)']);
  });
});

describe('сравнение с базой', () => {
  const base = makeBase(now([clone('src/a.ts', 'src/b.ts'), clone('tools/x.py', 'tools/y.py', 8, 'tools')], [{ value: 'Esc', keys: ['k.esc', 's.esc'] }]));

  it('то же, что в базе — ни роста, ни спада', () => {
    // Ловит: ложный красный на нетронутой кодовой базе (иначе check не пройти никому).
    const v = compareToBase(now([clone('src/a.ts', 'src/b.ts'), clone('tools/x.py', 'tools/y.py', 8, 'tools')], [{ value: 'Esc', keys: ['k.esc', 's.esc'] }]), base);
    expect(v).toEqual({ grew: [], lower: [] });
  });

  it('новая копия в src — рост, место названо файлами и строками', () => {
    // Ловит: красный check без названия места — исполнитель не знает, что чинить.
    const cur = now([clone('src/a.ts', 'src/b.ts'), clone('src/c.ts', 'src/d.ts', 12), clone('tools/x.py', 'tools/y.py', 8, 'tools')]);
    const v = compareToBase(cur, base);
    expect(v.grew).toHaveLength(1);
    expect(v.lower.map((l) => l.label)).toEqual(['i18n одинаковые тексты']);
    const g = v.grew[0];
    expect(g?.label).toBe('jscpd src');
    expect(g?.text).toContain('копий 1→2');
    expect(g?.places).toEqual(['src/c.ts:1-12 ↔ src/d.ts:5-17 (12 стр.)']);
  });

  it('копия не выросла числом, но разрослась строками — рост без названной пары', () => {
    // Ловит: счёт только по числу копий — копию можно раздувать бесконечно.
    const cur = now([clone('src/a.ts', 'src/b.ts', 30), clone('tools/x.py', 'tools/y.py', 8, 'tools')], [{ value: 'Esc', keys: ['k.esc', 's.esc'] }]);
    const v = compareToBase(cur, base);
    expect(v.grew.map((g) => g.label)).toEqual(['jscpd src']);
    expect(v.grew[0]?.text).toContain('строк в копиях 10→30');
    expect(v.grew[0]?.places).toEqual([]);
  });

  it('рост в tools не прикрыт падением в src и наоборот: области считаются порознь', () => {
    // Ловит: общий счёт — починка в src «разрешила бы» новую копию в tools.
    const cur = now([clone('tools/x.py', 'tools/y.py', 8, 'tools'), clone('tools/p.py', 'tools/q.py', 9, 'tools')], [{ value: 'Esc', keys: ['k.esc', 's.esc'] }]);
    const v = compareToBase(cur, base);
    expect(v.grew.map((g) => g.label)).toEqual(['jscpd tools']);
    expect(v.lower.map((g) => g.label)).toEqual(['jscpd src']);
  });

  it('ниже базы — только подсказка, красного нет', () => {
    // Ловит: красный на улучшение — «база только опускается» превратится в штраф за починку.
    const v = compareToBase(now([], []), base);
    expect(v.grew).toEqual([]);
    expect(v.lower.map((l) => l.label)).toEqual(['jscpd src', 'jscpd tools', 'i18n одинаковые тексты']);
  });

  it('новый одинаковый текст i18n — рост, названы значение и ключи; третий ключ к старому значению — тоже', () => {
    // Ловит: пропуск «ещё одного Esc» под новым ключом при той же числе групп.
    const clones = [clone('src/a.ts', 'src/b.ts'), clone('tools/x.py', 'tools/y.py', 8, 'tools')];
    const v1 = compareToBase(now(clones, [{ value: 'Esc', keys: ['k.esc', 's.esc'] }, { value: 'Дальше', keys: ['a.n', 'b.n'] }]), base);
    expect(v1.grew).toHaveLength(1);
    expect(v1.grew[0]?.places).toEqual(['«Дальше» — a.n, b.n']);
    const v2 = compareToBase(now(clones, [{ value: 'Esc', keys: ['k.esc', 's.esc', 'z.esc'] }]), base);
    expect(v2.grew[0]?.places).toEqual(['«Esc» — k.esc, s.esc, z.esc']);
  });

  it('пустая база — любые копии растут от нуля', () => {
    // Ловит: падение сравнения на базе без областей (первый прогон до --init).
    const v = compareToBase(now([clone('src/a.ts', 'src/b.ts')]), {});
    expect(v.grew).toHaveLength(1);
  });
});
