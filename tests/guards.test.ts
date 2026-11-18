/**
 * Стражи по исходникам: правила проекта, которые иначе держались бы только на памяти.
 * Каждый страж проверяет и себя — что он вообще что-то видит (иначе молчал бы всегда).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { plural } from '../src/i18n/plural';
import { ru } from '../src/i18n/ru';
import { codeFiles, rel, root, walk, withoutComments } from './guards/lib';

// Стражи этапа Э1 (063 С1, С4, С5) — tests/guards/e1.test.ts; общие помощники — tests/guards/lib.ts.

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
    expect(files.length).toBeGreaterThanOrEqual(20); // С6 (063 design §7): поднят с 9 (060 Т0) к значению v2 — тестов этапа Э1 хватает
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

/** Правило «шаблон — только в этих файлах или папках» (папка — с `/` на конце); нарушение — шаблон вне разрешённых. */
interface OutsideRule {
  name: string;
  pattern: RegExp;
  allowed: string[];
}

export function outsideViolation(file: string, source: string, rule: OutsideRule): boolean {
  const ok = rule.allowed.some((a) => (a.endsWith('/') ? file.startsWith(a) : file === a));
  return !ok && rule.pattern.test(withoutComments(source));
}

describe('хранилище, сеть и замки — только в своих папках (060 §8 п. 1–2)', () => {
  // Ключи хранилища зависят от мажорной версии и канала сборки: обход storage.ts писал бы под чужими ключами.
  // Сеть живёт в загрузчике пакетов, звуке и доступе; замки вкладок — в одном файле сохранения.
  const storage: OutsideRule = {
    name: 'localStorage, sessionStorage, indexedDB',
    pattern: /\b(localStorage|sessionStorage|indexedDB)\b/,
    allowed: ['src/app/save/storage.ts'],
  };
  const net: OutsideRule = { name: 'fetch(', pattern: /\bfetch\(/, allowed: ['src/app/packs/', 'src/app/sound/', 'src/app/access/'] };
  const locks: OutsideRule = { name: 'navigator.locks', pattern: /\bnavigator\.locks\b/, allowed: ['src/app/save/locks.ts'] };
  const rules = [storage, net, locks];
  const setItem = "localStorage.setItem('k', v);";
  const idb = "const db = window.indexedDB.open('x');";
  const get = "const r = await fetch('/packs/a.json');";
  const lock = "await navigator.locks.request('save', fn);";
  const files = codeFiles('src').map(rel);

  it('страж видит код и узнаёт нарушение в строке-образце', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
    expect(outsideViolation('src/app/x.ts', setItem, storage)).toBe(true);
    expect(outsideViolation('src/app/x.ts', idb, storage)).toBe(true);
    expect(outsideViolation('src/app/x.ts', 'sessionStorage.clear();', storage)).toBe(true);
    expect(outsideViolation('src/app/save/storage.ts', setItem, storage)).toBe(false);
    expect(outsideViolation('src/app/storage.ts', setItem, storage)).toBe(true); // старый адрес больше не свой
    expect(outsideViolation('src/screens/A.vue', get, net)).toBe(true);
    expect(outsideViolation('src/app/packs/load.ts', get, net)).toBe(false);
    expect(outsideViolation('src/app/sound/play.ts', get, net)).toBe(false);
    expect(outsideViolation('src/app/access/gate.ts', get, net)).toBe(false);
    expect(outsideViolation('src/app/packs-extra/x.ts', get, net)).toBe(true); // папка — с границей
    expect(outsideViolation('src/app/x.ts', lock, locks)).toBe(true);
    expect(outsideViolation('src/app/save/locks.ts', lock, locks)).toBe(false);
    expect(outsideViolation('src/app/x.ts', "// localStorage в комментарии\nconst a = 1;", storage)).toBe(false);
  });

  for (const rule of rules) {
    it(`${rule.name} — только в ${rule.allowed.join(', ')}`, () => {
      const bad = files.filter((p) => outsideViolation(p, readFileSync(join(root, p), 'utf8'), rule));
      expect(bad).toEqual([]);
    });
  }
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
/** Роутер (подсистема `app/router/`, 063-Р1, владелец 18.11) — единственный в app, кто знает экраны. */
const LAYER_EXCEPTIONS: [prefix: string, layers: string[]][] = [['src/app/router/', ['screens']]];
const exceptionsOf = (file: string) => LAYER_EXCEPTIONS.filter(([p]) => file.startsWith(p)).flatMap(([, l]) => l);

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
    if (to !== from && !allowed.includes(to) && !exceptionsOf(file).includes(to)) bad.push(`${file} → ${spec}`);
  }
  return bad;
}

describe('слои: кто кого импортирует', () => {
  // Движок не знает интерфейса, компоненты не знают экранов: иначе подсистему не вынуть и не проверить отдельно.
  const files = codeFiles('src').map(rel);

  it('страж видит слои и узнаёт нарушение', () => {
    expect(files.filter((p) => p.startsWith('src/engine/')).length).toBeGreaterThanOrEqual(10); // С6: с Т4 экраны есть — слой screens виден и самой выборке
    expect(files.filter((p) => p.startsWith('src/screens/')).length).toBeGreaterThanOrEqual(2);
    expect(files.length).toBeGreaterThanOrEqual(20);
    expect(layerViolations('src/engine/save/rules.ts', "import { x } from '../../app/storage';")).toHaveLength(1);
    expect(layerViolations('src/components/A.vue', "import S from '../screens/HomeScreen.vue';")).toHaveLength(1);
    expect(layerViolations('src/engine/save/rules.ts', "import { y } from '../match/flow';")).toEqual([]);
    expect(layerViolations('src/app/router/index.ts', "const H = () => import('../../screens/HomeScreen.vue');")).toEqual([]);
    expect(layerViolations('src/app/store/index.ts', "const H = () => import('../../screens/HomeScreen.vue');")).toHaveLength(1);
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

/** Статические импорты файла (`from '…'`, `import '…'`; не `import()`): относительные сведены к пути от корня репозитория. */
export function staticImports(file: string, source: string): string[] {
  const dir = file.split('/').slice(0, -1);
  const out: string[] = [];
  for (const m of withoutComments(source).matchAll(/\b(?:from|import)\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1] ?? '';
    if (!spec.startsWith('.')) {
      out.push(spec);
      continue;
    }
    const path = [...dir];
    for (const step of spec.split('/')) {
      if (step === '..') path.pop();
      else if (step !== '.') path.push(step);
    }
    out.push(path.join('/'));
  }
  return out;
}

/** Импорты из папки пакета `src/content/packs/<id>/` — пакет едет только загрузчиком, а не бандлом. */
export function packImportViolations(file: string, source: string): string[] {
  return staticImports(file, source)
    .filter((to) => /(^|\/)content\/packs\/[^/]+\//.test(to))
    .map((to) => `${file} → ${to}`);
}

describe('пакеты — не в бандле (060 §8 п. 3)', () => {
  // Закрытый пакет в импорте открытого кода попал бы в публичный dist; открытые едут так же, одним путём.
  // Разрешено: tools/packs.mjs (сборка раскладывает пакеты в dist) и тесты.
  const files = [...codeFiles('src'), ...codeFiles('tools')].map(rel).filter((p) => p !== 'tools/packs.mjs');

  it('страж видит код и узнаёт импорт пакета в строке-образце', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
    expect(packImportViolations('src/app/x.ts', "import p from '../content/packs/ru.yard/pack.json';")).toHaveLength(1);
    expect(packImportViolations('src/app/course/load.ts', "import { a } from '../../content/packs/ru.moscow/lessons.json';")).toHaveLength(1);
    expect(packImportViolations('tools/build.mjs', "import x from '../src/content/packs/ru.yard/text.json'")).toHaveLength(1);
    expect(packImportViolations('src/app/x.ts', "import '../content/packs/ru.yard/side.json';")).toHaveLength(1);
    expect(packImportViolations('src/app/x.ts', "export { a } from '../content/packs/ru.yard/a';")).toHaveLength(1);
    expect(packImportViolations('src/app/x.ts', "import t from '../content/tasks.json';")).toEqual([]);
    expect(packImportViolations('src/app/x.ts', "// import p from '../content/packs/ru.yard/pack.json';")).toEqual([]);
  });

  it('вне tools/packs.mjs и тестов никто не импортирует src/content/packs/<id>/', () => {
    const bad = files.flatMap((p) => packImportViolations(p, readFileSync(join(root, p), 'utf8')));
    expect(bad).toEqual([]);
  });
});

/** Закрытые пакеты, чья папка не покрыта строкой `publish-exclude.txt` (те же правила, что у `isExcluded` в tools/publish-main.mjs). */
export function uncoveredClosedPacks(packs: { dir: string; access: string }[], excludeText: string): string[] {
  const lines = excludeText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const covered = (path: string) => lines.some((e) => (e.endsWith('/') ? path.startsWith(e) : path === e));
  return packs.filter((p) => p.access === 'closed' && !covered(p.dir)).map((p) => p.dir);
}

describe('закрытые пакеты не публикуются (060 §8 п. 4)', () => {
  // Папка пакета с access:'closed' обязана быть в tools/publish-exclude.txt, иначе она уйдёт в открытый main.
  const packsDir = join(root, 'src/content/packs');
  // В открытом main файла исключений нет (он сам в исключениях), но нет и закрытых папок — проверка проходит пусто.
  const excludeFile = join(root, 'tools/publish-exclude.txt');
  const exclude = existsSync(excludeFile) ? readFileSync(excludeFile, 'utf8') : '';
  const packs = existsSync(packsDir)
    ? readdirSync(packsDir)
        .filter((id) => existsSync(join(packsDir, id, 'pack.json')))
        .map((id) => ({
          dir: `src/content/packs/${id}/`,
          access: String((JSON.parse(readFileSync(join(packsDir, id, 'pack.json'), 'utf8')) as { access?: unknown }).access),
        }))
    : [];

  it('страж узнаёт непокрытую папку в строке-образце', () => {
    const closed = [{ dir: 'src/content/packs/ru.moscow/', access: 'closed' }];
    expect(uncoveredClosedPacks(closed, '# кухня\ndocs/\n')).toEqual(['src/content/packs/ru.moscow/']);
    expect(uncoveredClosedPacks(closed, 'docs/\nsrc/content/packs/ru.moscow/\n')).toEqual([]);
    expect(uncoveredClosedPacks(closed, 'src/content/packs/\n')).toEqual([]);
    expect(uncoveredClosedPacks(closed, 'src/content/packs/ru.moscow\n')).toEqual(['src/content/packs/ru.moscow/']); // без «/» — не папка
    expect(uncoveredClosedPacks(closed, 'src/content/packs/ru.moscow/pack.json\n')).toEqual(['src/content/packs/ru.moscow/']);
    expect(uncoveredClosedPacks(closed, '# src/content/packs/ru.moscow/\n')).toEqual(['src/content/packs/ru.moscow/']);
    expect(uncoveredClosedPacks([{ dir: 'src/content/packs/ru.yard/', access: 'public' }], 'docs/\n')).toEqual([]);
    expect(uncoveredClosedPacks([], 'docs/\n')).toEqual([]);
  });

  it('каждый закрытый пакет в src/content/packs покрыт publish-exclude.txt', () => {
    expect(uncoveredClosedPacks(packs, exclude)).toEqual([]);
  });
});

/** Импорты движка из `content`, кроме схем и JSON: движок знает только типы схем и данные. */
export function engineContentViolations(file: string, source: string): string[] {
  if (layerOf(file) !== 'engine') return [];
  return importsOf(file, source)
    .filter((to) => (to === 'src/content' || to.startsWith('src/content/')) && !to.startsWith('src/content/schema/') && !to.endsWith('.json'))
    .map((to) => `${file} → ${to}`);
}

describe('движок смотрит в content только через схемы и JSON (060 §8 п. 5)', () => {
  const files = codeFiles('src/engine').map(rel);

  it('страж видит движок и узнаёт нарушение в строке-образце', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(engineContentViolations('src/engine/save/rules.ts', "import { x } from '../../content/helpers';")).toHaveLength(1);
    expect(engineContentViolations('src/engine/a.ts', "import { x } from '../content';")).toHaveLength(1);
    expect(engineContentViolations('src/engine/a.ts', "export * from '../content/packs/loader';")).toHaveLength(1);
    expect(engineContentViolations('src/engine/a.ts', "import type { Course } from '../content/schema/course';")).toEqual([]);
    expect(engineContentViolations('src/engine/a.ts', "import tasks from '../content/tasks.json';")).toEqual([]);
    expect(engineContentViolations('src/app/a.ts', "import { x } from '../content/helpers';")).toEqual([]); // это правило — только про движок
  });

  it('в src/engine нет импортов из content мимо schema и JSON', () => {
    const bad = files.flatMap((p) => engineContentViolations(p, readFileSync(join(root, p), 'utf8')));
    expect(bad).toEqual([]);
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
