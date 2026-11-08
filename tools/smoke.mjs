// Дым трёх адресов сайта (спека 013, design.md §3): страница не пустая, консоль чиста, ключи свои.
// node tools/smoke.mjs [адрес]. Без адреса — свой статический сервер из dist/ на PORTS.smoke
// (dist/ не сборка сайта — сначала собирается tools/build-site.mjs). С адресом — тот же дым по живому сайту
// в одноразовом профиле Playwright (настоящий браузер сына не задет).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTS, launchChrome } from './lib/chrome.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(repo, 'dist');
const fixture = JSON.parse(readFileSync(join(repo, 'tools', 'smoke-fixture.json'), 'utf8'));
const LIMIT_MS = 60_000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

/** Статический сервер: /keykick/<путь> → dist/<путь>; папка → index.html. Занятый порт — ошибка. */
function serve(port) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (!path.startsWith('/keykick/')) {
      res.writeHead(404).end();
      return;
    }
    let file = normalize(join(dist, path.slice('/keykick/'.length)));
    if (!file.startsWith(dist)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok, fail) => {
    server.once('error', (e) => fail(new Error(`порт ${port}: ${e.message}`)));
    server.listen(port, () => ok(server));
  });
}

const seed = Object.fromEntries(Object.entries(fixture.keys).map(([k, v]) => [k, JSON.stringify(v)]));

/** Один адрес в новом контексте. Возвращает список провалов (пусто — ок). */
async function checkAddress(browser, url, mode) {
  const fails = [];
  const ctx = await browser.newContext();
  try {
    // Фикстура — только при первой загрузке контекста, дальше игра пишет сама.
    await ctx.addInitScript(
      ({ seed, once }) => {
        if (sessionStorage.getItem(once)) return;
        sessionStorage.setItem(once, '1');
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      },
      { seed, once: '__smoke_seeded' },
    );
    const page = await ctx.newPage();
    const problems = [];
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`запрос не прошёл: ${r.url()}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const app = (await page.locator('#app').innerText().catch(() => '')).trim();
    if (app === '') fails.push('#app пуст');
    fails.push(...problems);
    const body = await page.locator('body').innerText();
    const ls = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    if (mode === 'own') {
      if (!body.includes(fixture.marker)) fails.push(`клуб «${fixture.marker}» не видно; на экране: ${body.replace(/\s+/g, ' ').slice(0, 200)}`);
    } else {
      for (const [k, v] of Object.entries(seed)) {
        if (ls[k] !== v) fails.push(`ключ ${k} изменён или пропал`);
      }
      const alien = Object.keys(ls).filter((k) => !(k in seed) && !k.startsWith('keykick-next.'));
      if (alien.length) fails.push(`чужие ключи: ${alien.join(', ')}`);
      if (body.includes(fixture.marker)) fails.push(`клуб «${fixture.marker}» видно — это чужой прогресс`);
    }
  } catch (e) {
    fails.push(e instanceof Error ? e.message : String(e));
  } finally {
    await ctx.close();
  }
  return fails;
}

async function main() {
  const t0 = Date.now();
  const arg = process.argv[2];
  let server = null;
  let origin;
  let base;
  if (arg) {
    const u = new URL(arg);
    origin = u.origin;
    base = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
  } else {
    // dist/ от `npm run check` — обычная сборка без /v1/ и /next/: признак сборки сайта — обе подпапки.
    if (!['index.html', 'v1/index.html', 'next/index.html'].every((f) => existsSync(join(dist, f)))) {
      console.log('dist/ не сборка сайта — собираю tools/build-site.mjs');
      const r = spawnSync('node', [join(repo, 'tools', 'build-site.mjs')], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('сборка dist/ не удалась');
    }
    server = await serve(PORTS.smoke);
    origin = `http://localhost:${PORTS.smoke}`;
    base = '/keykick/';
  }
  const browser = await launchChrome();
  let bad = 0;
  try {
    const targets = [
      [base, 'own'],
      [`${base}v1/`, 'own'],
      [`${base}next/`, 'next'],
    ];
    for (const [path, mode] of targets) {
      const t = Date.now();
      const fails = await checkAddress(browser, origin + path, mode);
      const sec = ((Date.now() - t) / 1000).toFixed(1);
      console.log(`${path} — ${fails.length ? 'провал' : 'ок'} — ${sec} с`);
      for (const f of fails) console.log(`    ${f}`);
      if (fails.length) bad++;
    }
  } finally {
    await browser.close();
    server?.close();
  }
  const total = Date.now() - t0;
  console.log(`итого: ${(total / 1000).toFixed(1)} с${total > LIMIT_MS ? ' — дольше минуты, провал' : ''}`);
  if (total > LIMIT_MS) bad++;
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(`дым не прошёл: ${e.message}`);
  process.exit(1);
});
