// Плагин Vite для пакетов лиг (060 §5, 059 С-29): dev отдаёт `/packs/<id>/<rev>/<файл>` из src/content/packs/,
// сборка кладёт те же файлы в dist/packs/<id>/<rev>/ и указатель dist/packs/index.json («id → ревизия»).
// Закрытый пакет (access:'closed') едет только при KK_EDITION=closed; иначе пропуск и строка в выводе.
// После сборки: id закрытых пакетов в dist — сборка красная; первый экран тяжелее 1,5 МБ — красная (059-В8, спека 062).
// Чистые части — selectPacks, findClosedInDist, firstScreenBytes — проверяет tests/packs/build.test.ts.
import fs from 'node:fs';
import path from 'node:path';

/** Предел первого экрана: 1,5 МБ (059-В8, спека 062). */
export const FIRST_SCREEN_LIMIT = 1.5 * 1024 * 1024;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.json': 'application/json; charset=utf-8' };

/**
 * Отбор пакетов для редакции: открытые — всегда, закрытые — только в `closed`.
 * @param {Array<{ id: string, rev: number, access: string }>} manifests
 * @param {string | undefined} edition
 * @returns {{ picked: typeof manifests, skipped: typeof manifests }}
 */
export function selectPacks(manifests, edition) {
  const picked = [];
  const skipped = [];
  for (const m of manifests) (m.access === 'closed' && edition !== 'closed' ? skipped : picked).push(m);
  return { picked, skipped };
}

/** Манифесты всех пакетов в папке: `<dir>/<id>/pack.json`, с полем `dir` — путь к папке пакета. */
export function readManifests(packsDir) {
  if (!fs.existsSync(packsDir)) return [];
  return fs
    .readdirSync(packsDir)
    .filter((name) => fs.existsSync(path.join(packsDir, name, 'pack.json')))
    .map((name) => ({ ...JSON.parse(fs.readFileSync(path.join(packsDir, name, 'pack.json'), 'utf8')), dir: path.join(packsDir, name) }));
}

/** Файлы пакета, которые нужны загрузчику: манифест, уроки, тексты — пути внутри папки пакета. */
export function packFiles(manifest) {
  return ['pack.json', manifest.files.lessons, ...Object.values(manifest.files.text)];
}

/** Указатель `packs/index.json`: «id → ревизия» отобранных пакетов. */
export function packIndex(picked) {
  return Object.fromEntries(picked.map((m) => [m.id, m.rev]));
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const TEXT_FILE = /\.(js|mjs|css|html|json|map|txt|svg|webmanifest)$/;

/**
 * Какие из закрытых id встречаются в dist — в пути файла или в тексте файла. Пусто — чисто.
 * @returns {string[]} строки «id: файл»
 */
export function findClosedInDist(distDir, closedIds) {
  const found = [];
  if (closedIds.length === 0 || !fs.existsSync(distDir)) return found;
  for (const file of walk(distDir)) {
    const rel = path.relative(distDir, file).split(path.sep).join('/');
    const body = TEXT_FILE.test(file) ? fs.readFileSync(file, 'utf8') : '';
    for (const id of closedIds) if (rel.includes(id) || body.includes(id)) found.push(`${id}: ${rel}`);
  }
  return found;
}

/**
 * Вес первого экрана: index.html и всё, что он подключает (скрипты, стили, предзагрузки), плюс файлы из `url(...)` этих стилей.
 * Пакеты лиг (`packs/`) и лениво подгружаемые куски в сумму не входят.
 * @returns {{ total: number, files: Array<{ file: string, bytes: number }> }}
 */
export function firstScreenBytes(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const seen = new Map([['index.html', fs.statSync(indexPath).size]]);
  const queue = [];
  const add = (ref, from) => {
    const clean = ref.split(/[?#]/)[0];
    if (!clean || /^(https?:|data:|\/\/)/.test(clean)) return;
    // Путь от корня сайта: срезаем «base» — всё до первого сегмента, который есть в dist.
    const parts = clean.split('/').filter(Boolean);
    let file = null;
    if (from === null) {
      for (let i = 0; i < parts.length && file === null; i++) {
        const cand = parts.slice(i).join('/');
        if (fs.existsSync(path.join(distDir, cand)) && fs.statSync(path.join(distDir, cand)).isFile()) file = cand;
      }
    } else {
      const cand = path.posix.normalize(path.posix.join(path.posix.dirname(from), clean));
      if (fs.existsSync(path.join(distDir, cand))) file = cand;
    }
    if (file === null || seen.has(file) || file.startsWith('packs/')) return;
    seen.set(file, fs.statSync(path.join(distDir, file)).size);
    queue.push(file);
  };
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) add(m[1], null);
  while (queue.length > 0) {
    const file = queue.shift();
    if (!file.endsWith('.css')) continue;
    const css = fs.readFileSync(path.join(distDir, file), 'utf8');
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) add(m[1], file);
  }
  const files = [...seen].map(([file, bytes]) => ({ file, bytes }));
  return { total: files.reduce((s, f) => s + f.bytes, 0), files };
}

/**
 * @param {{ edition?: string, packsDir?: string, log?: (line: string) => void }} [opts]
 * `packsDir` — откуда брать пакеты (по умолчанию src/content/packs; тест подставляет фикстуры).
 */
export default function packsPlugin(opts = {}) {
  const packsDir = opts.packsDir ?? path.join(root, 'src/content/packs');
  const log = opts.log ?? ((line) => console.log(line));
  let base = '/';
  let outDir = path.join(root, 'dist');
  let isBuild = false;

  const state = () => {
    const all = readManifests(packsDir);
    return { all, ...selectPacks(all, opts.edition) };
  };
  const reportSkipped = (skipped) => {
    for (const m of skipped) log(`packs: ${m.id} закрыт, пропущен (нужен KK_EDITION=closed)`);
  };

  return {
    name: 'kk-packs',
    configResolved(config) {
      base = config.base;
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },
    configureServer(server) {
      reportSkipped(state().skipped);
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        const rest = url.startsWith(base) ? url.slice(base.length) : url.replace(/^\//, '');
        if (!rest.startsWith('packs/')) return next();
        const parts = rest.slice('packs/'.length).split('/');
        const send = (code, body, type = 'text/plain; charset=utf-8') => {
          res.statusCode = code;
          res.setHeader('Content-Type', type);
          res.end(body);
        };
        const current = state().picked; // пакеты читаем заново: правку в src/content/packs видно без перезапуска
        if (parts.length === 1 && parts[0] === 'index.json') return send(200, JSON.stringify(packIndex(current)), MIME['.json']);
        const [id, rev, ...file] = parts;
        const m = current.find((p) => p.id === id && String(p.rev) === rev);
        const rel = file.join('/');
        if (!m || !packFiles(m).includes(rel)) return send(404, 'not found');
        return send(200, fs.readFileSync(path.join(m.dir, rel)), MIME[path.extname(rel)] ?? 'application/octet-stream');
      });
    },
    generateBundle() {
      if (!isBuild) return;
      const { picked, skipped } = state();
      reportSkipped(skipped);
      for (const m of picked) {
        for (const rel of packFiles(m)) {
          this.emitFile({ type: 'asset', fileName: `packs/${m.id}/${m.rev}/${rel}`, source: fs.readFileSync(path.join(m.dir, rel)) });
        }
      }
      this.emitFile({ type: 'asset', fileName: 'packs/index.json', source: JSON.stringify(packIndex(picked)) });
    },
    writeBundle() {
      // Закрытое в публичной сборке — красная сборка; в закрытой редакции закрытые id в dist ожидаемы.
      if (opts.edition !== 'closed') {
        const closedIds = state().all.filter((m) => m.access === 'closed').map((m) => m.id);
        const bad = findClosedInDist(outDir, closedIds);
        if (bad.length > 0) throw new Error(`packs: закрытые пакеты попали в публичный dist:\n  ${bad.join('\n  ')}`);
      }
      const { total, files } = firstScreenBytes(outDir);
      log(`packs: первый экран ${(total / 1024 / 1024).toFixed(2)} МБ из ${(FIRST_SCREEN_LIMIT / 1024 / 1024).toFixed(1)} (файлов ${files.length})`);
      if (total > FIRST_SCREEN_LIMIT) {
        const top = files.sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((f) => `${f.file} ${f.bytes}`);
        throw new Error(`packs: первый экран ${total} байт, предел ${FIRST_SCREEN_LIMIT} (059-В8). Тяжелее всего:\n  ${top.join('\n  ')}`);
      }
    },
  };
}
