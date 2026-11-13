/**
 * Стражи по исходникам: правила проекта, которые иначе держались бы только на памяти.
 * Каждый страж проверяет и себя — что он вообще что-то видит (иначе молчал бы всегда).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REWARD_SOURCES } from '../src/engine/save/rewards';
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

describe('оснастка без временных путей (ретро 023)', () => {
  // Ловит: скрипт сборки пишет или читает во временной папке сессии — после перезагрузки ВМ её нет
  // (compose_gold.py писал в scratchpad, пересборка жила там же).
  const TMP = /\/tmp\/[\w.]+-\d+\/|scratchpad\//; // папка сессии агента: /tmp/<имя>-<uid>/…
  const files = walk(join(root, 'tools')).filter((p) => /\.(py|mjs|sh)$/.test(p));
  it('страж видит оснастку и узнаёт временный путь', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(TMP.test("S = '/tmp/agent-1000/x/'")).toBe(true);
    expect(TMP.test("S = 'x/scratchpad/'")).toBe(true);
  });
  it('в tools/ нет путей во временную папку сессии', () => {
    const bad = files.filter((p) => TMP.test(readFileSync(p, 'utf8'))).map(rel);
    expect(bad).toEqual([]);
  });
});

describe('тесты без .only и .skip (web-frontend, 14.11)', () => {
  // Ловит: забытый `.only` молча выключает остальные тесты файла, `.skip` — тест, который «временно» не идёт никогда.
  // Эталон числа тестов в accept ловит пропажу теста, но не `.only` в одном файле (остальные файлы идут).
  const FOCUS = /\b(?:it|test|describe)\.(?:only|skip)\(/;
  const files = walk(join(root, 'tests')).filter((p) => /\.(test|spec)\.ts$/.test(p) && !p.endsWith('guards.test.ts'));
  it('страж видит тесты и узнаёт .only', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(FOCUS.test("it.only('x', () => {})")).toBe(true);
    expect(FOCUS.test("it('only', () => {})")).toBe(false);
  });
  it('в тестах нет .only и .skip', () => {
    const bad = files.filter((p) => FOCUS.test(withoutComments(readFileSync(p, 'utf8')))).map(rel);
    expect(bad).toEqual([]);
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

describe('хранилище — только через storage.ts (спека 013)', () => {
  // Ключи зависят от мажорной версии и канала сборки: обход storage.ts писал бы под ключами сына из /next/ и v2.
  const files = codeFiles('src').filter((p) => !p.endsWith(`app${sep}storage.ts`));
  it('страж видит код', () => expect(files.length).toBeGreaterThan(10));
  it('localStorage и sessionStorage — только в src/app/storage.ts', () => {
    const bad = files.filter((p) => /\b(localStorage|sessionStorage)\b/.test(withoutComments(readFileSync(p, 'utf8'))));
    expect(bad.map(rel)).toEqual([]);
  });
});

/** Слой файла: первая папка под src (`engine`, `app`…), для файлов в корне src — `root`. */
export function layerOf(srcPath: string): string {
  const parts = srcPath.split('/');
  return parts.length > 2 ? (parts[1] ?? 'root') : 'root';
}

/** Слои, в которые слою можно смотреть (журнал 08.11 «Структура кода»). Свой слой — всегда можно. */
const LAYERS: Record<string, string[]> = {
  engine: ['content'],
  i18n: [],
  content: [],
  art: ['engine'],
  app: ['engine', 'content', 'i18n', 'art'],
  components: ['app', 'engine', 'content', 'i18n', 'art', 'styles'],
  screens: ['components', 'app', 'engine', 'content', 'i18n', 'art', 'styles'],
};
/** Роутер — единственный в app, кто знает экраны. */
const LAYER_EXCEPTIONS: Record<string, string[]> = { 'src/app/router.ts': ['screens'] };

/** Импорты файла, которые нарушают слои: относительные пути, сведённые к `src/...`. */
export function layerViolations(file: string, source: string): string[] {
  const from = layerOf(file);
  const allowed = LAYERS[from];
  if (!allowed) return [];
  const dir = file.split('/').slice(0, -1);
  const bad: string[] = [];
  for (const m of withoutComments(source).matchAll(/(?:from\s+|import\(\s*)['"](\.[^'"]+)['"]/g)) {
    const path = [...dir];
    const spec = m[1] ?? '';
    for (const step of spec.split('/')) {
      if (step === '..') path.pop();
      else if (step !== '.') path.push(step);
    }
    // Вне src (package.json — номер версии) слоёв нет.
    if (path[0] !== 'src') continue;
    const to = layerOf(path.join('/'));
    if (to !== from && !allowed.includes(to) && !(LAYER_EXCEPTIONS[file] ?? []).includes(to)) bad.push(`${file} → ${spec}`);
  }
  return bad;
}

describe('слои: кто кого импортирует', () => {
  // Движок не знает интерфейса, компоненты не знают экранов: иначе подсистему не вынуть и не проверить отдельно.
  const files = codeFiles('src').map(rel);

  it('страж видит слои и узнаёт нарушение', () => {
    expect(files.some((p) => p.startsWith('src/screens/'))).toBe(true);
    expect(layerViolations('src/engine/save/rules.ts', "import { x } from '../../app/storage';")).toHaveLength(1);
    expect(layerViolations('src/components/A.vue', "import S from '../screens/HomeScreen.vue';")).toHaveLength(1);
    expect(layerViolations('src/engine/save/rules.ts', "import { y } from '../match/flow';")).toEqual([]);
    expect(layerViolations('src/app/router.ts', "const H = () => import('../screens/HomeScreen.vue');")).toEqual([]);
  });

  it('в src нет импортов против слоёв', () => {
    const bad = files.flatMap((p) => layerViolations(p, readFileSync(join(root, p), 'utf8')));
    expect(bad).toEqual([]);
  });
});

/** Относительные импорты файла (`import`, `import type`, `export … from`, `import()`), сведённые к `src/...` без `.ts`. */
export function importsOf(file: string, source: string): string[] {
  const dir = file.split('/').slice(0, -1);
  const out: string[] = [];
  for (const m of withoutComments(source).matchAll(/(?:from\s+|import\(\s*|import\s+)['"](\.[^'"]+)['"]/g)) {
    const path = [...dir];
    for (const step of (m[1] ?? '').split('/')) {
      if (step === '..') path.pop();
      else if (step !== '.') path.push(step);
    }
    out.push(path.join('/').replace(/\.ts$/, ''));
  }
  return out;
}

const WALLET = 'src/engine/wallet/wallet.ts';
/** Вызовы кассы (018 design §8): имена функций `engine/wallet/wallet.ts`. */
const CASH_CALL = /\b(creditPresses|creditStake|credit|spend)\s*\(/;
/** Запись раздела кошелька в обход кассы: ключ показа (`wallet/view`) открыт всем, писать им — только подсистеме. */
const WALLET_SET = /\bset\s*\(\s*walletKey\b/;

/**
 * Нарушения кассы (ТЗ-0.3, 018 design §8): раздел `wallet/save` импортирует только сама касса; кассу (импорт
 * `wallet/wallet` или вызов её функций) — только `callers` той награды, чья это касса, и сама подсистема `wallet`.
 */
export function cashViolations(file: string, source: string): string[] {
  const imports = importsOf(file, source);
  const bad: string[] = [];
  if (file.startsWith('src/engine/wallet/')) return bad;
  if (imports.includes('src/engine/wallet/save')) bad.push(`${file} → wallet/save`);
  if (WALLET_SET.test(withoutComments(source))) bad.push(`${file} → запись кошелька мимо кассы`);
  const allowed = Object.values(REWARD_SOURCES).some((r) => r.cash === WALLET && r.callers.includes(file));
  const calls = imports.includes('src/engine/wallet/wallet') || CASH_CALL.test(withoutComments(source));
  if (calls && !allowed) bad.push(`${file} → касса`);
  return bad;
}

describe('награды — только через кассу из REWARD_SOURCES (ТЗ-0.3, 018 design §8)', () => {
  // Монеты не появляются ниоткуда: кто платит — записан в реестре, раздел кошелька трогает только касса.
  const files = codeFiles('src').map(rel);

  it('страж видит нарушение', () => {
    const shop = 'src/app/shop.ts';
    expect(cashViolations(shop, "import { section } from '../engine/wallet/save.ts';")).toHaveLength(1);
    expect(cashViolations(shop, "import type { WalletSave } from '../engine/wallet/save';")).toHaveLength(1);
    expect(cashViolations(shop, "export { section } from '../engine/wallet/save';")).toHaveLength(1);
    expect(cashViolations(shop, "const w = await import('../engine/wallet/save');")).toHaveLength(1);
    expect(cashViolations('src/engine/school/save.ts', "import { spend } from '../wallet/wallet';")).toHaveLength(1);
    expect(cashViolations('src/engine/match/verdict.ts', "tx => credit(tx, 5, 'match')")).toHaveLength(1);
    expect(cashViolations('src/engine/matchResult/coins.ts', "import { creditPresses } from '../wallet/wallet';")).toEqual([]);
    expect(cashViolations(WALLET, "import { section } from './save';")).toEqual([]);
    // Показ монет (019-Т8): ключ и баланс из `wallet/view` — можно всем; писать этим ключом — нельзя.
    expect(cashViolations('src/components/map/MapHeader.vue', "import { walletKey, coinsOf } from '../../engine/wallet/view';")).toEqual([]);
    expect(cashViolations('src/app/shop.ts', "updatePlayer((tx) => tx.set(walletKey, { ...w, coins: 9 }))")).toHaveLength(1);
    // Маска реестра — не импорт.
    expect(cashViolations('src/app/save/registry.ts', "import.meta.glob('../../engine/*/save.ts')")).toEqual([]);
  });

  it('файл показа монет (`wallet/view`) не пишет: ни кассы, ни `set`, ни `SectionTx`', () => {
    // Ловит: зачисление или трату, добавленные в открытый всем файл показа, — обход кассы через разрешённый импорт.
    const view = withoutComments(readFileSync(join(root, 'src/engine/wallet/view.ts'), 'utf8'));
    expect(CASH_CALL.test(view) || /\bset\s*\(|SectionTx|from '\.\/wallet'/.test(view)).toBe(false);
  });

  it('файлы реестра наград существуют: переезд файла не оставит мёртвую строку', () => {
    const named = Object.values(REWARD_SOURCES).flatMap((r) => [...r.callers, ...(r.cash ? [r.cash] : [])]);
    expect(named.length).toBeGreaterThan(1);
    expect(named.filter((f) => !files.includes(f))).toEqual([]);
  });

  it('в src касса и раздел кошелька — только у разрешённых', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.flatMap((p) => cashViolations(p, readFileSync(join(root, p), 'utf8')))).toEqual([]);
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
    // ParentCheck (v1) уходит в 018-Т6а: после него ссылок быстрой проверки нет нигде; до — только он.
    expect(users.map(rel).filter((p) => p !== 'src/components/ParentCheck.vue')).toEqual([]);
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

describe('перехват ошибок — первым (спека 014, К7)', () => {
  it('первый импорт src/main.ts — components/crash/installCrash', () => {
    // Ловит: перестановку импортов — бросок при оценке App.vue или роутера до перехвата дал бы белый экран, а не экран сбоя.
    const text = withoutComments(readFileSync('src/main.ts', 'utf8'));
    const first = /^\s*import\b[^;]*?['"]([^'"]+)['"]/m.exec(text);
    expect(first?.[1]).toBe('./components/crash/installCrash');
  });
});

describe('кнопка «Сломать» (dev, спека 014-Т6)', () => {
  it('breakButton подключает только src/dev/routes.ts: из игры её не достать', () => {
    // Ловит: импорт кнопки сбоя из экрана или main.ts в обход dev-маршрутов — она попала бы в выпускную сборку.
    const files = codeFiles('src').filter((p) => !p.endsWith('breakButton.ts'));
    expect(files.length).toBeGreaterThan(10);
    // Импорт по пути (статический и `import()`), а не слово: ключ текстов `ru.dev.breakButton` — не подключение.
    const users = files.filter((p) => /(from|import)\s*\(?\s*['"][^'"]*\/breakButton(\.ts)?['"]/.test(withoutComments(readFileSync(p, 'utf8'))));
    expect(users.map(rel)).toEqual(['src/dev/routes.ts']);
  });
});
