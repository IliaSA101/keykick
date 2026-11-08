// Метрики журнала игры по файлу выгрузки (спека 018 design §7).
//
//   node tools/metrics.mjs <файл выгрузки> [--player <id>] [--json]
//
// Читает JournalDump (`{ jv: 1, records, keys }`) или сохранение-обёртку с полем `journal`, считает 13 метрик
// `src/engine/journal/metrics.ts` (модуль грузит runnerImport из vite) и печатает таблицу по каждому игроку.
// Подписи живут здесь: страж кириллицы смотрит только src.
import fs from 'node:fs'
import path from 'node:path'
import { runnerImport } from 'vite'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const args = process.argv.slice(2)
const pIdx = args.indexOf('--player')
const onlyPlayer = pIdx >= 0 ? args[pIdx + 1] : null
const asJson = args.includes('--json')
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--player')
if (!file) {
  console.error('Использование: node tools/metrics.mjs <файл выгрузки> [--player <id>] [--json]')
  process.exit(2)
}

const LABELS = {
  coinSources: 'Монеты по источникам',
  gameCoinShare: 'Доля монет из игр (тревога > 20 %)',
  milestones: 'Вехи',
  restAfterFinal: 'Перерыв после финала лиги, дни',
  firstLessonsAcc: 'Точность первых 5 уроков лиги и Shift',
  schoolShare: 'Доля «Школы» во времени (тревога > 20 %)',
  baseGames: 'Игр на базе',
  breakSkips: 'Пропусков перерыва',
  gamesToGold: 'Игр до «золота»',
  schoolSkips: '«Пропустить» в «Школе»',
  firstTryMedals: 'Медалей с первой попытки, доля',
  firstTryPass: 'Проход урока с 1-й попытки, доля',
  medianCpm: 'Медиана печати, знаков/мин',
}

let dump
try {
  dump = JSON.parse(fs.readFileSync(file, 'utf8'))
} catch (e) {
  console.error(`Не прочитать ${file}: ${e.message}`)
  process.exit(2)
}
if (dump && dump.journal && !dump.records) dump = dump.journal
if (!dump || !Array.isArray(dump.records)) {
  console.error('В файле нет журнала (ждали { records, keys })')
  process.exit(2)
}

const { module: mod } = await runnerImport(path.join(root, 'src/engine/journal/metrics.ts'))
const course = JSON.parse(fs.readFileSync(path.join(root, 'src/content/leagues.json'), 'utf8'))
const keys = Array.isArray(dump.keys) ? dump.keys : []

const players = [...new Set([...dump.records, ...keys].map((x) => x.player))].filter((p) => !onlyPlayer || p === onlyPlayer)
const result = {}
for (const p of players) {
  result[p] = mod.metrics(
    dump.records.filter((r) => r.player === p),
    keys.filter((k) => k.player === p),
    course,
  )
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2))
} else if (players.length === 0) {
  console.log('Журнал пуст: игроков нет')
} else {
  const fmt = (v) => (v === null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(2))
  for (const p of players) {
    console.log(`Игрок ${p}`)
    for (const r of result[p]) {
      const det = r.detail ? '  ' + Object.entries(r.detail).map(([k, v]) => `${k}=${fmt(v)}`).join(' ') : ''
      console.log(`  ${(LABELS[r.id] ?? r.id).padEnd(46)} ${fmt(r.value).padStart(8)}${r.alarm ? '  ТРЕВОГА' : ''}${det}`)
    }
  }
}
