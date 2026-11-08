// npm run check по шагам со временем (спека 015, ТЗ-13.10): typecheck → lint → тесты → сборка.
// Первый красный шаг — стоп с его выводом. Итог — строкой и строкой CHECK {json} для tools/accept.mjs.
// Бюджеты: check ≤ 60 с, vitest ≤ 10 с, файл vitest ≤ 2 с (здесь — только печать; стоп делает accept).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const cache = path.join(root, 'node_modules', '.cache', 'kk')
fs.mkdirSync(cache, { recursive: true })
const vitestJson = path.join(cache, 'vitest.json')

const STEPS = [
  ['typecheck', ['vue-tsc', '--noEmit']],
  ['lint', ['eslint', '.', '--cache', '--cache-location', 'node_modules/.cache/eslint', '--max-warnings', '0']],
  ['test', ['vitest', 'run', '--reporter=dot', '--reporter=json', `--outputFile.json=${vitestJson}`]],
  ['build', ['vite', 'build']],
]
const BUDGET = { total: 60, test: 10, file: 2 }
const sec = (ms) => Math.round(ms / 100) / 10
const fmt = (s) => String(s).replace('.', ',')

const steps = {}
let tests = null
const slow = []
const t0 = Date.now()
for (const [name, cmd] of STEPS) {
  const t = Date.now()
  const r = spawnSync('npx', cmd, { cwd: root, encoding: 'utf8' })
  steps[name] = sec(Date.now() - t)
  if (r.status !== 0) {
    process.stdout.write(r.stdout + r.stderr)
    console.log(`check: КРАСНЫЙ шаг ${name} (${fmt(steps[name])} с)`)
    process.exit(1)
  }
  if (name === 'test') {
    try {
      const j = JSON.parse(fs.readFileSync(vitestJson, 'utf8'))
      tests = j.numTotalTests
      for (const f of j.testResults ?? []) {
        const s = sec((f.endTime ?? 0) - (f.startTime ?? 0))
        if (s > BUDGET.file) slow.push(`${path.relative(root, f.name)} ${fmt(s)} с`)
      }
    } catch {
      console.log('check: не прочитан отчёт vitest — число тестов неизвестно')
    }
  }
  console.log(`${name} ${fmt(steps[name])} с`)
}
const total = sec(Date.now() - t0)
if (slow.length) console.log(`предупреждение: файлы тестов дольше ${BUDGET.file} с:\n  ${slow.join('\n  ')}`)
const over = total > BUDGET.total || steps.test > BUDGET.test
console.log(`check ${fmt(total)} с (бюджет ${BUDGET.total}), тестов ${tests ?? '?'}${over ? ' — ВНЕ БЮДЖЕТА' : ''}`)
console.log(`CHECK ${JSON.stringify({ total, steps, tests })}`)
