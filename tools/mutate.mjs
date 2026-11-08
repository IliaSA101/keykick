/**
 * Разовый мутант: ловит ли набор одну конкретную поломку (спека 015, ТЗ-13.9).
 * Хранимого списка и полного прогона нет — решение владельца 07.11 (полный прогон стоил десятки минут на каждую правку без пользы).
 *
 *   node tools/mutate.mjs <файл> <найти> <заменить>
 *
 * Условия: дерево чистое (иначе выход 2), набор зелёный до мутации, строка «найти» в файле ровно одна.
 * Файл восстанавливается всегда, в том числе по Ctrl+C. Итог — «пойман» (выход 0) или «ВЫЖИЛ» (выход 1).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [file, find, replace] = process.argv.slice(2);
if (!file || find === undefined || replace === undefined) {
  console.error('Запуск: node tools/mutate.mjs <файл> <найти> <заменить>');
  process.exit(2);
}
if (spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()) {
  console.error('Дерево не чистое — мутант мог бы смешаться с правками. Сначала коммит.');
  process.exit(2);
}

/** Прогон всего набора: он идёт секунды, выбирать зону незачем. */
function runTests() {
  const r = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--reporter=dot'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  return r.status === 0;
}

const path = join(root, file);
if (!existsSync(path)) {
  console.error(`Нет файла ${file}`);
  process.exit(2);
}
const original = readFileSync(path, 'utf8');
const hits = original.split(find).length - 1;
if (hits !== 1) {
  console.error(`Строка найдена ${hits} раз вместо одного — уточните «найти».`);
  process.exit(2);
}
if (!runTests()) {
  console.error('Набор красный ещё до мутации — сначала чиним тесты.');
  process.exit(2);
}

const restore = () => writeFileSync(path, original, 'utf8');
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});
let green = true;
try {
  writeFileSync(path, original.replace(find, () => replace), 'utf8');
  green = runTests();
} finally {
  restore();
}
console.log(green ? `ВЫЖИЛ: набор не заметил поломку в ${file} — пробел в тестах` : `пойман: набор краснеет на поломке в ${file}`);
process.exit(green ? 1 : 0);
