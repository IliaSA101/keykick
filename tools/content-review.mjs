/**
 * Сборка файла вычитки владельцем (спека 016, design §7): `docs/specs/016-yard-lessons/review.md`.
 *
 *   node tools/content-review.mjs
 *
 * Читает JSON контента (уроки Двора, словарь) и пишет читаемый файл:
 * 32 урока с советами, слова по ступеням («ф» — форма другого слова),
 * фразы, кричалки. Файл всегда совпадает с игрой; правки владельца вносятся в JSON, файл пересобирается.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readYardLessons } from './lib/yard-lessons.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const out = join(root, 'docs/specs/016-yard-lessons/review.md');

/** Ступени слов по буквам: каждое слово — на первой ступени, где все его буквы уже пройдены. */
const STEPS = [
  ['ао', 'А О'],
  ['вл', '+ В Л'],
  ['ыд', '+ Ы Д'],
  ['фж', '+ Ф Ж'],
  ['пр', '+ П Р'],
  ['э', '+ Э'],
];

const dict = read('src/content/dictionary.json').ru;
const all = new Set(dict.words);

function stepOf(word) {
  let need = 0;
  for (const ch of word) {
    const i = STEPS.findIndex(([keys]) => keys.includes(ch));
    need = Math.max(need, i);
  }
  return need;
}

/** Форма: у слова есть «родитель» (другое слово словаря) — его начало, не короче 3 букв, отличается ≤ 3 буквами. */
function isForm(word) {
  for (const base of all) {
    if (base === word || base.length < 3 || base.length >= word.length) continue;
    const stem = Math.max(3, base.length - 2);
    if (word.startsWith(base.slice(0, stem)) && Math.abs(word.length - base.length) <= 3) return true;
  }
  return false;
}

const lines = [];
const say = (s = '') => lines.push(s);

say('# Вычитка контента Двора (016)');
say();
say('Файл собран `node tools/content-review.mjs` из JSON; не править руками — правки идут в JSON, затем пересборка.');
say('Что смотреть: названия и советы уроков, слова (вычеркнуть неуместное), фразы, кричалки.');
say();

say('## Уроки (32)');
say();
const lessonsFile = join(root, 'src/content/packs/ru.yard/lessons.json');
if (existsSync(lessonsFile)) {
  const yard = readYardLessons();
  const stages = new Map((yard.stages ?? []).map((s) => [s.n, s]));
  yard.lessons.forEach((l, i) => {
    const st = stages.get(l.stage);
    say(`### ${i + 1}. ${l.name}${l.friendly ? ' (товарищеский)' : ''}${l.control ? ' (контрольный)' : ''}`);
    say();
    say(`Ступень ${l.stage}${st ? ` «${st.name}»` : ''}.`);
    const tips = Array.isArray(l.tip) ? l.tip : l.tip ? [l.tip] : [];
    tips.forEach((t) => say(`- ${t}`));
    say();
  });
} else {
  say('_Файла `src/content/packs/ru.yard/lessons.json` пока нет — после его появления пересобрать._');
  say();
}

say(`## Слова (${dict.words.length})`);
say();
say('«ф» — форма другого слова.');
say();
STEPS.forEach(([keys, title], step) => {
  const group = dict.words.filter((w) => stepOf(w) === step);
  if (group.length === 0) return;
  say(`### Ступень ${step + 1}: ${title} (${group.length})`);
  say();
  say(group.map((w) => (isForm(w) ? `${w} (ф)` : w)).join(', '));
  say();
});

say(`## Фразы (${dict.phrases.length})`);
say();
dict.phrases.forEach((p) => say(`- ${p}`));
say();
say(`## Кричалки (${dict.chants.length})`);
say();
dict.chants.forEach((c) => say(`- ${c}`));
say();

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join('\n'));
console.log(`review.md: слов ${dict.words.length}, фраз ${dict.phrases.length}, кричалок ${dict.chants.length}`);
