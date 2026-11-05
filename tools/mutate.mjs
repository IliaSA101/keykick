/**
 * Мутации: проверка, что тесты ловят настоящие поломки, а не просто зелёные.
 * Перенесено из первой игры владельца.
 *
 * Качество тестов меряется не их числом, а тем, сколько поломок они ловят.
 * Скрипт по очереди портит одну строку в коде (мутант), гоняет весь набор
 * и смотрит, покраснел ли он. Файл восстанавливается всегда, в том числе
 * после Ctrl+C и падения: мутант не должен остаться в репозитории.
 *
 * Запуск:
 *   node tools/mutate.mjs              # все мутанты из tools/mutants.json
 *   node tools/mutate.mjs theme        # только мутанты, в чьём id есть строка
 *
 * Выжил мутант — в тестах пробел: поведение сломано, а набор молчит.
 * Не применился мутант (строка не найдена ровно один раз) — он устарел: это тоже
 * провал, иначе он молча числился бы пойманным. Код выхода 1 в обоих случаях.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv[2] ?? '';
const mutants = JSON.parse(readFileSync(join(root, 'tools/mutants.json'), 'utf8')).filter((m) =>
  m.id.includes(filter),
);

/** Прогон всего набора: он идёт секунды, выбирать зону незачем. */
function runTests() {
  const r = spawnSync(
    process.execPath,
    [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--reporter=dot'],
    { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 },
  );
  return r.status === 0;
}

if (!runTests()) {
  console.error('Набор красный ещё до мутаций — сначала чиним тесты.');
  process.exit(2);
}
console.log(`Набор зелёный. Мутантов: ${mutants.length}\n`);

const survived = [];
const stale = [];
for (const m of mutants) {
  const path = join(root, m.file);
  if (!existsSync(path)) {
    stale.push(m);
    console.log(`УСТАРЕЛ  ${m.id}: нет файла ${m.file}`);
    continue;
  }
  const original = readFileSync(path, 'utf8');
  const hits = original.split(m.find).length - 1;
  if (hits !== 1) {
    stale.push(m);
    console.log(`УСТАРЕЛ  ${m.id}: строка найдена ${hits} раз вместо одного`);
    continue;
  }
  const restore = () => writeFileSync(path, original, 'utf8');
  process.on('SIGINT', restore);
  let green = true;
  try {
    writeFileSync(path, original.replace(m.find, () => m.replace), 'utf8');
    green = runTests();
  } finally {
    restore();
    process.removeListener('SIGINT', restore);
  }
  if (green) survived.push(m);
  console.log(`${green ? 'ВЫЖИЛ   ' : 'пойман  '} ${m.id} — ${m.note}`);
}

const applied = mutants.length - stale.length;
console.log(`\nПойманных: ${applied - survived.length} из ${applied}`);
if (survived.length > 0) {
  console.log('Пробелы в тестах:');
  for (const m of survived) console.log(`  ${m.id}: ${m.note}`);
}
if (stale.length > 0) console.log(`Устаревших мутантов: ${stale.length} — поправить find в tools/mutants.json`);
process.exit(survived.length > 0 || stale.length > 0 ? 1 : 0);
