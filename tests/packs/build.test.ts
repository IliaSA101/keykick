/**
 * Плагин Vite для пакетов (060-Т4б, К12) и предел первого экрана (059-В8, спека 062). Настоящую сборку здесь не гоняем
 * (она — шаг `build` в `npm run check`, а плагин сам роняет её при нарушении): хуки плагина зовутся на подложенных папках.
 * У каждого теста строка «Ловит:».
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import packsPlugin, { FIRST_SCREEN_LIMIT, findClosedInDist, firstScreenBytes, packIndex, selectPacks } from '../../tools/packs.mjs';

const REAL = new URL('../../src/content/packs/', import.meta.url).pathname;
const FIXTURE = new URL('../fixtures/packs/', import.meta.url).pathname;

const tmps: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'kk-packs-'));
  tmps.push(d);
  return d;
}
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Папка пакетов «как в дереве»: открытый ru.yard и закрытая фикстура x.closed. */
function treeWithClosed(): string {
  const d = tmp();
  cpSync(join(REAL, 'ru.yard'), join(d, 'ru.yard'), { recursive: true });
  cpSync(join(FIXTURE, 'x.closed'), join(d, 'x.closed'), { recursive: true });
  return d;
}

/** Прогон сборки плагином: что он положил в dist (имя → тело) и что написал. */
function runBuild(packsDir: string, edition: string | undefined) {
  const log: string[] = [];
  const plugin = packsPlugin({ packsDir, edition, log: (l) => log.push(l) }) as unknown as {
    configResolved(c: unknown): void;
    generateBundle(this: { emitFile(f: { fileName: string; source: Buffer | string }): void }): void;
  };
  plugin.configResolved({ base: '/keykick/', root: '/x', build: { outDir: 'dist' }, command: 'build' });
  const emitted = new Map<string, string>();
  plugin.generateBundle.call({ emitFile: (f) => void emitted.set(f.fileName, String(f.source)) });
  return { emitted, log };
}

describe('отбор пакетов по редакции (К12)', () => {
  const ms = [
    { id: 'ru.yard', rev: 1, access: 'public' },
    { id: 'ru.moscow', rev: 2, access: 'closed' },
  ];

  it('К12: публичная редакция берёт открытые, закрытые пропускает', () => {
    // Ловит: закрытый пакет попадает в публичную сборку.
    expect(selectPacks(ms, undefined)).toEqual({ picked: [ms[0]], skipped: [ms[1]] });
    expect(selectPacks(ms, 'public').skipped).toEqual([ms[1]]);
  });

  it('К12: редакция closed берёт всё', () => {
    // Ловит: закрытая сборка теряет закрытые пакеты (платная часть без уроков).
    expect(selectPacks(ms, 'closed')).toEqual({ picked: ms, skipped: [] });
  });

  it('К12: указатель — «id → ревизия» только отобранных', () => {
    // Ловит: загрузчик не знает ревизии (адрес с ревизией не собрать) или указатель выдаёт закрытое.
    expect(packIndex(selectPacks(ms, undefined).picked)).toEqual({ 'ru.yard': 1 });
  });
});

describe('сборка плагином: dist/packs/<id>/<rev>/ (К12)', () => {
  it('К12: публичная — ru.yard в dist/packs/ru.yard/1/, закрытая фикстура не попадает, в выводе строка о пропуске', () => {
    // Ловит: пакет не кладётся по адресу загрузчика; закрытый уезжает в публичный dist; пропуск молчаливый.
    const { emitted, log } = runBuild(treeWithClosed(), undefined);
    expect([...emitted.keys()].sort()).toEqual([
      'packs/index.json',
      'packs/ru.yard/1/lessons.json',
      'packs/ru.yard/1/pack.json',
      'packs/ru.yard/1/text.ru.json',
    ]);
    expect(JSON.parse(emitted.get('packs/index.json') ?? '')).toEqual({ 'ru.yard': 1 });
    expect(emitted.get('packs/ru.yard/1/pack.json')).toBe(readFileSync(join(REAL, 'ru.yard/pack.json'), 'utf8'));
    expect(log.some((l) => l.includes('x.closed') && l.includes('пропущен'))).toBe(true);
  });

  it('К12: закрытая редакция кладёт и закрытый пакет по его ревизии', () => {
    // Ловит: KK_EDITION=closed не включает закрытые пакеты или берёт ревизию не из манифеста.
    const { emitted, log } = runBuild(treeWithClosed(), 'closed');
    expect(emitted.has('packs/x.closed/3/pack.json')).toBe(true);
    expect(emitted.has('packs/x.closed/3/text.en.json')).toBe(true);
    expect(JSON.parse(emitted.get('packs/index.json') ?? '')).toEqual({ 'ru.yard': 1, 'x.closed': 3 });
    expect(log).toEqual([]);
  });

  it('К12: dev отдаёт пакет по адресу загрузчика с base и без; чужое — 404', () => {
    // Ловит: dev не отдаёт пакеты (игра в dev без уроков), отдаёт файл не из манифеста или путь с «..».
    const plugin = packsPlugin({ packsDir: treeWithClosed(), edition: undefined, log: () => undefined }) as unknown as {
      configResolved(c: unknown): void;
      configureServer(s: unknown): void;
    };
    plugin.configResolved({ base: '/keykick/', root: '/x', build: { outDir: 'dist' }, command: 'serve' });
    let handler: (req: { url: string }, res: unknown, next: () => void) => void = () => undefined;
    plugin.configureServer({ middlewares: { use: (h: typeof handler) => (handler = h) } });
    const get = (url: string) => {
      const out = { code: 0, body: '', passed: false };
      const res = { statusCode: 0, setHeader: () => undefined, end(b: unknown) { out.code = this.statusCode; out.body = String(b); } };
      handler({ url }, res, () => (out.passed = true));
      return out;
    };
    expect(JSON.parse(get('/keykick/packs/ru.yard/1/pack.json').body)).toMatchObject({ id: 'ru.yard', rev: 1 });
    expect(JSON.parse(get('/packs/index.json').body)).toEqual({ 'ru.yard': 1 });
    expect(get('/keykick/packs/ru.yard/2/pack.json').code).toBe(404);
    expect(get('/keykick/packs/x.closed/3/pack.json').code).toBe(404);
    expect(get('/keykick/packs/ru.yard/1/../../ru.yard/1/pack.json').code).toBe(404);
    expect(get('/keykick/assets/a.js').passed).toBe(true);
  });
});

describe('проверка dist после сборки (К12)', () => {
  it('К12: закрытый id в dist — находится по пути и по тексту; чистый dist — пусто', () => {
    // Ловит: закрытый пакет, подложенный в dist (или вшитый в js), проходит сборку.
    const dist = tmp();
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'assets/a.js'), 'const a = 1;');
    expect(findClosedInDist(dist, ['x.closed'])).toEqual([]);
    mkdirSync(join(dist, 'packs/x.closed/3'), { recursive: true });
    writeFileSync(join(dist, 'packs/x.closed/3/pack.json'), '{}');
    expect(findClosedInDist(dist, ['x.closed'])).toEqual(['x.closed: packs/x.closed/3/pack.json']);
    rmSync(join(dist, 'packs'), { recursive: true });
    writeFileSync(join(dist, 'assets/b.js'), 'load("x.closed.one")');
    expect(findClosedInDist(dist, ['x.closed'])).toEqual(['x.closed: assets/b.js']);
    expect(findClosedInDist(dist, [])).toEqual([]);
  });

  it('К12: writeBundle роняет сборку, если закрытое попало в dist публичной редакции, и не роняет в закрытой', () => {
    // Ловит: проверка dist не подключена к сборке — «красная сборка» из спеки на деле зелёная.
    const packsDir = treeWithClosed();
    const dist = tmp();
    writeFileSync(join(dist, 'index.html'), '<html></html>');
    mkdirSync(join(dist, 'packs/x.closed/3'), { recursive: true });
    writeFileSync(join(dist, 'packs/x.closed/3/pack.json'), '{}');
    const make = (edition: string | undefined) => {
      const p = packsPlugin({ packsDir, edition, log: () => undefined }) as unknown as { configResolved(c: unknown): void; writeBundle(): void };
      p.configResolved({ base: '/keykick/', root: dist, build: { outDir: '.' }, command: 'build' });
      return p;
    };
    expect(() => make(undefined).writeBundle()).toThrow(/x\.closed/);
    expect(() => make('closed').writeBundle()).not.toThrow();
  });
});

describe('первый экран ≤ 1,5 МБ (059-В8)', () => {
  /** dist из index.html с js, css и картинкой из css; пакеты лиг и ленивый кусок лежат рядом. */
  function fakeDist(opts: { cssImage: number; lazy: number; pack: number }): string {
    const dist = tmp();
    mkdirSync(join(dist, 'assets'), { recursive: true });
    mkdirSync(join(dist, 'packs/ru.yard/1'), { recursive: true });
    writeFileSync(
      join(dist, 'index.html'),
      '<script type="module" src="/keykick/assets/i.js"></script><link rel="stylesheet" href="/keykick/assets/i.css"><link rel="modulepreload" href="/keykick/assets/v.js"><link rel="prefetch" href="/keykick/packs/ru.yard/1/lessons.json">',
    );
    writeFileSync(join(dist, 'assets/i.js'), 'x'.repeat(1000));
    writeFileSync(join(dist, 'assets/v.js'), 'x'.repeat(500));
    writeFileSync(join(dist, 'assets/i.css'), 'a{background:url(./bg.webp)}');
    writeFileSync(join(dist, 'assets/bg.webp'), Buffer.alloc(opts.cssImage));
    writeFileSync(join(dist, 'assets/lazy.js'), 'x'.repeat(opts.lazy));
    writeFileSync(join(dist, 'packs/ru.yard/1/lessons.json'), 'x'.repeat(opts.pack));
    return dist;
  }

  it('К12: в вес входят html, скрипты, предзагрузки, стили и картинки из стилей; ленивое и пакеты — нет', () => {
    // Ловит: пакеты лиг или ленивые куски раздувают «первый экран»; картинка из css выпадает из счёта.
    const dist = fakeDist({ cssImage: 2000, lazy: 9_000_000, pack: 9_000_000 });
    const { total, files } = firstScreenBytes(dist);
    expect(files.map((f) => f.file).sort()).toEqual(['assets/bg.webp', 'assets/i.css', 'assets/i.js', 'assets/v.js', 'index.html']);
    expect(total).toBe(2000 + 1000 + 500 + 'a{background:url(./bg.webp)}'.length + readFileSync(join(dist, 'index.html')).length);
  });

  it('К12: тяжелее предела — writeBundle роняет сборку; впритык — нет', () => {
    // Ловит: предел 1,5 МБ не стережётся — первый экран растёт молча (спека 062).
    const run = (img: number) => {
      const dist = fakeDist({ cssImage: img, lazy: 0, pack: 0 });
      const p = packsPlugin({ packsDir: tmp(), edition: undefined, log: () => undefined }) as unknown as { configResolved(c: unknown): void; writeBundle(): void };
      p.configResolved({ base: '/keykick/', root: dist, build: { outDir: '.' }, command: 'build' });
      p.writeBundle();
    };
    expect(() => run(FIRST_SCREEN_LIMIT)).toThrow(/первый экран/);
    expect(() => run(FIRST_SCREEN_LIMIT - 5000)).not.toThrow();
  });
});
