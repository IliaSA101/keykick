/**
 * Голдены сохранения (060-Т7, К21; замок — решение 062-Т4): байты конверта игрока и снимка клуба выпущенного формата.
 *
 *   node tools/golden-save.mjs [--dir <каталог>] [--lock]
 *
 * Без флагов пишет недостающие голдены в `tests/golden/save/` (образцы — `tests/fixtures/goldenSave.ts`; время, семя и
 * версия программы — константы там). Голден, уже записанный в замок `LOCK.json`, не перезаписывается: байты выпущенного
 * формата не правятся, изменился формат — это новый голден с новым именем. С `--lock` дописывает в замок отпечаток
 * (sha-256) тех голденов, которых там ещё нет; запись замка — только этим флагом, явно. Отпечатки из замка не меняются
 * и не удаляются никогда. Тест `tests/golden/save.test.ts` сверяет байты с замком. `--dir` — другой каталог (так
 * команду пробует тест). TypeScript образцов грузится через vite (ssr, без порта).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dirAt = args.indexOf('--dir');
const dir = dirAt >= 0 && args[dirAt + 1] ? resolve(args[dirAt + 1]) : join(repo, 'tests/golden/save');
const lockMode = args.includes('--lock');
const lockPath = join(dir, 'LOCK.json');
const sha = (text) => createHash('sha256').update(text).digest('hex');

const server = await createServer({
  root: repo,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, watch: null, hmr: false },
});
let goldens;
try {
  goldens = (await server.ssrLoadModule('/tests/fixtures/goldenSave.ts')).buildGoldens();
} finally {
  await server.close();
}

const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : { files: {} };
const errors = [];
const toWrite = [];
for (const [name, text] of Object.entries(goldens)) {
  const path = join(dir, name);
  const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (have !== null && have !== text && Object.hasOwn(lock.files, name)) {
    errors.push(`${name}: голден выпущен (он в LOCK.json), его байты не правятся; формат изменился — новый голден с новым именем`);
  } else if (have !== text) toWrite.push([name, text]);
}
// Замок помнит голден, а файла нет: выпущенный голден не удаляют — восстановить из git, замок не трогаем.
for (const name of Object.keys(lock.files)) {
  if (!existsSync(join(dir, name))) errors.push(`${name}: в замке есть, файла нет — восстановить из git`);
}
if (errors.length > 0) {
  console.error(`Голдены сохранения не тронуты:\n${errors.map((e) => `  ${e}`).join('\n')}`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });
for (const [name, text] of toWrite) writeFileSync(join(dir, name), text);
let added = 0;
if (lockMode) {
  const files = { ...lock.files };
  for (const name of Object.keys(goldens)) {
    if (Object.hasOwn(files, name)) continue;
    files[name] = sha(readFileSync(join(dir, name), 'utf8'));
    added++;
  }
  if (added > 0) {
    const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
    const about =
      'Замок голденов выпущенных форматов: sha-256 байтов файлов рядом. Не править руками: новый голден — ' +
      '`node tools/golden-save.mjs --lock`; выпущенный не меняется и не удаляется (docs/testing.md, голдены).';
    writeFileSync(lockPath, `${JSON.stringify({ about, files: sorted }, null, 2)}\n`);
  }
}
const present = readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'LOCK.json').length;
console.log(`Голдены сохранения: записано ${toWrite.length}, в замок добавлено ${added}, всего файлов ${present}.`);
