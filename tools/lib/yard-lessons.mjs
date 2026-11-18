// Уроки Двора прежним видом (как был `src/content/lessons-yard.json`): числа из пакета ru.yard, имена ступеней,
// имена и советы уроков — из его `text.ru.json`. Для служебных скриптов и макетов; игра читает пакет сама.
// Пакет читается файлами (readFileSync), не импортом: статический импорт пакета запрещён стражем (060 §8 п. 3).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../src/content/packs/ru.yard')
const read = (file) => JSON.parse(readFileSync(join(dir, file), 'utf8'))

/** Пакет `ru.yard` как его отдаёт загрузчик: `{ manifest, lessons, text: { <язык>: … } }` — на вход `parseLessons`. */
export function readYardPack() {
  const manifest = read('pack.json')
  const text = {}
  for (const [lang, file] of Object.entries(manifest.files.text)) text[lang] = read(file)
  return { manifest, lessons: read(manifest.files.lessons), text }
}

/** `{ league, rowWidth, ladders, lengthBands, stages: [{ n, name, newKeys }], lessons: [{ id, stage, name, tip, … }] }` */
export function readYardLessons() {
  const pack = read('pack.json')
  const data = read(pack.files.lessons)
  const text = read(pack.files.text.ru)
  return {
    league: pack.league,
    rowWidth: data.rowWidth,
    ladders: data.ladders,
    lengthBands: data.lengthBands,
    stages: data.stages.map((s) => ({ n: s.n, name: text.stages[String(s.n)], newKeys: s.newKeys })),
    lessons: data.order.map((id) => ({ id, ...data.lessons[id], name: text.lessons[id].name, tip: text.lessons[id].tip })),
  }
}
