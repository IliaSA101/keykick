/**
 * Стражи по исходникам: правила проекта, которые иначе держались бы только на памяти.
 * Каждый страж проверяет и себя — что он вообще что-то видит (иначе молчал бы всегда).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decisiveBanner,
  decisiveCaption,
  decisiveResult,
  decisiveRule,
  starsWhy,
  tryAgain,
} from '../src/app/decisiveText';
import { LEAGUE_RULES, leagueRules } from '../src/engine/match';
import { plural } from '../src/i18n/plural';
import { ru } from '../src/i18n/ru';

const root = join(import.meta.dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const rel = (path: string) => relative(root, path).split(sep).join('/');
const codeFiles = (dir: string) => walk(join(root, dir)).filter((p) => /\.(ts|vue|mjs)$/.test(p));

/**
 * Текст без комментариев и стилей: комментарии у нас по-русски законно,
 * а тексты интерфейса — нет. `//` после двоеточия не трогаем: это ссылка в строке.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CYRILLIC = /[А-Яа-яЁё]/;

describe('тексты интерфейса — только в i18n и content', () => {
  const allowed = ['src/i18n/', 'src/content/'];
  const files = codeFiles('src').filter((p) => !allowed.some((a) => rel(p).startsWith(a)));

  it('страж видит файлы и находит кириллицу в строке, но не в комментарии', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(CYRILLIC.test(withoutComments("const a = 'Гол!'; // комментарий"))).toBe(true);
    expect(CYRILLIC.test(withoutComments('// комментарий\n/* ещё */ const a = 1;'))).toBe(false);
    expect(CYRILLIC.test(withoutComments("const url = 'https://x.ru/путь';"))).toBe(true);
  });

  it('в коде вне i18n и content нет русского текста', () => {
    const offenders = files.filter((p) => CYRILLIC.test(withoutComments(readFileSync(p, 'utf8'))));
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe('размер файлов', () => {
  const LIMIT = 600;
  const files = [...codeFiles('src'), ...codeFiles('tests'), ...codeFiles('tools')];

  it(`файл кода не длиннее ${LIMIT} строк`, () => {
    expect(files.length).toBeGreaterThan(5);
    const big = files
      .map((p) => ({ file: rel(p), lines: readFileSync(p, 'utf8').split('\n').length }))
      .filter((f) => f.lines > LIMIT);
    expect(big).toEqual([]);
  });
});

describe('тексты ru.ts', () => {
  function leaves(node: unknown, path: string): [string, unknown][] {
    if (node !== null && typeof node === 'object') {
      return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
    }
    return [[path, node]];
  }

  it('каждый текст — непустая строка', () => {
    const all = leaves(ru, '');
    expect(all.length).toBeGreaterThan(5);
    const bad = all.filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('подсказки матча — одной строкой рядом с полоской хода (до 52 знаков)', () => {
    // Длинная подсказка раскладки шла в две строки, и страница матча уходила за край окна 640.
    const fingers = [...Object.values(ru.keyboard.fingers), ...Object.values(ru.keyboard.thumbs)].map(
      (f) => `${ru.match.hints.finger} ${f}`,
    );
    const hints = [
      ...Object.values(ru.match.hints),
      ...fingers,
      ru.match.warmup.hint,
      ...Object.values(ru.match.decisiveHint),
    ];
    expect(hints.length).toBeGreaterThan(5);
    expect(hints.filter((h) => h.length > 52)).toEqual([]);
  });

  it('строка итога урока-вехи — до 52 знаков: длиннее переносится, и итог уходит за окно 640', () => {
    // Спека 002: «В решающей атаке: 2 ошибки. Открыт 1/8 финала кубка!» — с самыми длинными словами;
    // спека 008: и «В решающей серии: 3 ошибки. …» — для каждой лиги со своим запасом.
    const errors = Object.values(ru.match.decisiveErrors).reduce((a, b) => (b.length > a.length ? b : a));
    for (const rules of Object.values(LEAGUE_RULES)) {
      const head = `${decisiveResult(rules)}: ${rules.maxErrors} ${errors}.`;
      const lines = ru.unlocks.cup.map((name) => `${head} ${ru.unlocks.opened} ${name}!`);
      expect(lines).toHaveLength(4);
      expect(lines.filter((l) => l.length > 52)).toEqual([]);
      // Возможности (спека 005): «… 2 ошибки. Новое: пенальти в матче!».
      const features = Object.values(ru.unlocks.featureOpened).map((t) => `${head} ${t}`);
      expect(features.length).toBeGreaterThan(0);
      expect(features.filter((l) => l.length > 52)).toEqual([]);
    }
  });

  it('решающая по лигам (спека 008): числа — шаблоном, правило вступления до 58 знаков, во дворе слова прежние', () => {
    const yard = leagueRules('yard');
    const district = leagueRules('district');
    // Двор — как было до серии.
    expect(decisiveRule(yard, false)).toEqual({
      title: 'Решающая атака',
      text: 'Шестая во втором тайме: не больше 2 ошибок — новый урок.',
    });
    expect(decisiveRule(yard, true).text).toBe(
      'Шестая во втором тайме. При ничьей пройдёшь дальше, если в ней не больше 2 ошибок.',
    );
    expect([decisiveBanner(yard), decisiveCaption(yard, 1), decisiveResult(yard)]).toEqual([
      'Решающая атака!',
      'Решающая атака',
      'В решающей атаке',
    ]);
    expect(starsWhy(yard)).toBe(
      '★ — матч доигран · ★★ — в решающей атаке не больше 2 ошибок · ★★★ — решающая без ошибок и точность от 97 %',
    );
    expect(tryAgain(yard)).toBe('Нужно не больше 2. Пробей пенальти — и снова на матч, получится!');
    // Район: серия, запас 3; подпись над полем — какая атака серии.
    expect(decisiveRule(district, false)).toEqual({
      title: 'Решающая серия',
      text: 'Пятая и шестая во втором тайме: не больше 3 ошибок на обе.',
    });
    expect(decisiveRule(district, true).text).toContain('не больше 3 ошибок');
    expect([decisiveCaption(district, 1), decisiveCaption(district, 2)]).toEqual([
      'Решающая серия · 1 из 2',
      'Решающая серия · 2 из 2',
    ]);
    expect([decisiveBanner(district), decisiveResult(district)]).toEqual(['Решающая серия!', 'В решающей серии']);
    expect([starsWhy(district), tryAgain(district)].every((t) => t.includes('3') && !t.includes('{'))).toBe(true);
    // Числа не зашиты в шаблоны: запас — только подстановкой.
    const templates = [
      ...Object.values(ru.match.decisive).flatMap((d) => [d.rule.text, d.starsWhy]),
      ...Object.values(ru.cup.decisiveRule),
      ru.match.tryAgain,
    ];
    expect(templates.filter((t) => !t.includes('{n}') || /не больше \d/.test(t))).toEqual([]);
    // Три правила в ряд на 1024×640: правило решающей — не длиннее 58 знаков.
    const intro = Object.values(LEAGUE_RULES).map((r) => decisiveRule(r, false).text);
    expect(intro.filter((t) => t.length > 58)).toEqual([]);
    // Правило кубка — не длиннее правила двора (82): длиннее — пятая строка, вступление выше окна 640.
    const cup = Object.values(LEAGUE_RULES).map((r) => decisiveRule(r, true).text);
    expect(cup.filter((t) => t.length > 82)).toEqual([]);
  });
});

describe('движок без Vue, DOM, часов и случайности', () => {
  // Движок проверяется тестами только потому, что он чистый: часы и случайность передаются снаружи.
  const FORBIDDEN = /from ['"]vue['"]|\bdocument\.|\bwindow\.|\bDate\.now\b|\bnew Date\(|\bMath\.random\b|\bfetch\(/;
  const files = codeFiles('src/engine');

  it('страж видит движок и узнаёт запрещённое', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(FORBIDDEN.test("import { ref } from 'vue';")).toBe(true);
    expect(FORBIDDEN.test('const t = Date.now();')).toBe(true);
    expect(FORBIDDEN.test('const r = Math.random();')).toBe(true);
    expect(FORBIDDEN.test('const v = Math.round(x);')).toBe(false);
  });

  it('в src/engine нет запрещённого', () => {
    const bad = files.filter((p) => FORBIDDEN.test(withoutComments(readFileSync(p, 'utf8'))));
    expect(bad.map(rel)).toEqual([]);
  });
});

describe('родительская панель', () => {
  it('открывается только ссылкой: экраны ребёнка на неё не ведут', () => {
    const childFacing = [join(root, 'src/App.vue'), ...codeFiles('src/screens')].filter(
      (p) => !p.endsWith('ParentScreen.vue'),
    );
    expect(childFacing.length).toBeGreaterThan(3);
    const linking = childFacing.filter((p) => /["'`]\/parent\b/.test(readFileSync(p, 'utf8')));
    expect(linking.map(rel)).toEqual([]);
  });

  it('ссылки быстрой проверки матча — только на ней: матч по ним не сохраняется', () => {
    // Адрес проверки строит checkQuery (app/matchJump); звать его может только блок родителя.
    const files = codeFiles('src').filter((p) => !p.endsWith('matchJump.ts'));
    expect(files.length).toBeGreaterThan(10);
    const users = files.filter((p) => /\bcheckQuery\b|[?&]at=/.test(withoutComments(readFileSync(p, 'utf8'))));
    expect(users.map(rel)).toEqual(['src/components/ParentCheck.vue']);
  });
});

describe('склонение по числу', () => {
  it('1 ошибка, 3 ошибки, 5 ошибок, 11 ошибок, 21 ошибка, 0 ошибок', () => {
    const forms = { one: 'ошибка', few: 'ошибки', many: 'ошибок' };
    expect([1, 3, 5, 11, 21, 0, 104].map((n) => `${n} ${plural(n, forms)}`)).toEqual([
      '1 ошибка',
      '3 ошибки',
      '5 ошибок',
      '11 ошибок',
      '21 ошибка',
      '0 ошибок',
      '104 ошибки',
    ]);
  });
});
