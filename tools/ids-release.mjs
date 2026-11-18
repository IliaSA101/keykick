/**
 * Выпуск id курса (060-Т3, 059-Р7): дописывает живые id курса в `released` реестра и пишет голден списка.
 *
 *   node tools/ids-release.mjs <курс> [--content <каталог>] [--golden <каталог>]
 *
 * Запускается только при «выпускай»: `released` растёт и не сокращается, снять выпущенный id можно лишь строкой
 * `retired`. Живые id — `order` пакетов лиг курса (`courses/<курс>/leagues.json` → `packs/<пакет>/lessons.json`).
 * Нарушение правил реестра 1–4 (`engine/course/registry.ts`) — список в stderr, выход 1, файлы не пишутся.
 * `--content` и `--golden` — другие корни (по умолчанию `src/content` и `tests/golden/ids`): так команду пробует тест
 * на временной копии. TypeScript движка грузится через vite (ssr, без порта).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : dflt;
};
const course = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!course) {
  console.error('Использование: node tools/ids-release.mjs <курс> [--content <каталог>] [--golden <каталог>]');
  process.exit(2);
}
const contentDir = flag('--content', join(repo, 'src/content'));
const goldenDir = flag('--golden', join(repo, 'tests/golden/ids'));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const idsPath = join(contentDir, 'courses', course, 'ids.json');
const reg = readJson(idsPath);
const frames = readJson(join(contentDir, 'courses', course, 'leagues.json'));
const live = frames.filter((f) => f.pack !== null).flatMap((f) => readJson(join(contentDir, 'packs', f.pack, 'lessons.json')).order);

const server = await createServer({
  root: repo,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, watch: null, hmr: false },
});
let next;
try {
  const { checkLiveIds, checkRegistry, releaseIds } = await server.ssrLoadModule('/src/engine/course/registry.ts');
  next = releaseIds(reg, live);
  const errs = [...checkLiveIds(live, `${course}.`), ...checkRegistry(next, live)];
  if (errs.length > 0) {
    console.error(`Выпуск id курса ${course} отменён:\n${errs.map((e) => `  ${e}`).join('\n')}`);
    process.exitCode = 1;
    next = null;
  }
} finally {
  await server.close();
}
if (next) {
  mkdirSync(goldenDir, { recursive: true });
  writeFileSync(idsPath, `${JSON.stringify(next, null, 2)}\n`);
  writeFileSync(join(goldenDir, `${course}.released.json`), `${JSON.stringify(next.released, null, 2)}\n`);
  console.log(`Курс ${course}: выпущено id — ${next.released.length}, добавлено — ${next.released.length - reg.released.length}.`);
}
