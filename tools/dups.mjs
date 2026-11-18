// Храповик дублей (спека 066, Т6; владелец 18.11: «а + б с храповиком и jscpd»).
// Два счётчика: копии кода (jscpd по src/ и tools/) и одинаковые тексты под разными ключами (src/i18n/ru/*.ts).
// Число сравнивается с базой `tools/dups-baseline.json`: выше — check красный и называет места, ниже — подсказка
// опустить базу, база только опускается. Здесь — чистые функции (тесты — tests/tools/dups.test.ts) и чтение файлов;
// запуск и печать — tools/dups-step.mjs.
import fs from 'node:fs'
import path from 'node:path'

// ───────── i18n: одинаковое значение под разными ключами ─────────

/** Плоский список строк: путь ключа (`home.cup.name`) → значение. Числовые и вложенные ключи — как есть. */
export function flattenStrings(value, prefix = '') {
  if (typeof value === 'string') return [{ key: prefix, value }]
  if (value === null || typeof value !== 'object') return []
  const out = []
  for (const [k, v] of Object.entries(value)) out.push(...flattenStrings(v, prefix ? `${prefix}.${k}` : k))
  return out
}

/** Строка без букв (только знаки, цифры, `{подстановки}`) — не текст: «★», «·», «{n}» повтором не считаем. */
export function hasWords(text) {
  return /[A-Za-zА-Яа-яЁё]/.test(text.replace(/\{[^}]*\}/g, ''))
}

/** Проверка файла исключений: у каждого повтора — причина (намеренный повтор). */
export function validateAllow(allow) {
  const list = allow?.allow
  if (!Array.isArray(list)) throw new Error('исключения i18n: ожидается {"allow": [{"value", "why"}]}')
  for (const e of list) {
    if (typeof e?.value !== 'string' || !e.value) throw new Error('исключения i18n: у записи нет value')
    if (typeof e.why !== 'string' || e.why.trim().length < 5) throw new Error(`исключения i18n: у «${e.value}» нет причины (why)`)
  }
  return list.map((e) => e.value)
}

/** Группы значений, что стоят под двумя и больше ключами. `allowed` — значения, повтор которых намеренный. */
export function findI18nDuplicates(entries, allowed = []) {
  const skip = new Set(allowed)
  const byValue = new Map()
  for (const { key, value } of entries) {
    if (skip.has(value) || !hasWords(value)) continue
    byValue.set(value, [...(byValue.get(value) ?? []), key])
  }
  return [...byValue].filter(([, keys]) => keys.length > 1).map(([value, keys]) => ({ value, keys })).sort((a, b) => b.keys.length - a.keys.length || a.value.localeCompare(b.value))
}

/** Счёт i18n: `extra` — лишние повторы (ключей минус один по каждой группе), `values` — число ключей по значению. */
export function i18nMetric(groups) {
  const values = {}
  let extra = 0
  for (const g of groups) {
    values[g.value] = g.keys.length
    extra += g.keys.length - 1
  }
  return { extra, values }
}

/** Тексты `src/i18n/ru/*.ts` как объекты: TypeScript → JS → data-URL (файлы блоков без импортов). */
export async function loadI18nEntries(dir) {
  const ts = (await import('typescript')).default
  const entries = []
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.ts')).sort()) {
    const js = ts.transpileModule(fs.readFileSync(path.join(dir, f), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
    for (const [name, obj] of Object.entries(mod)) entries.push(...flattenStrings(obj, `${path.basename(f, '.ts')}.${name}`))
  }
  return entries
}

// ───────── jscpd: копии кода ─────────

/** Копии из отчёта jscpd: пути — от корня, область — `src`, если хотя бы один край в src/, иначе `tools`. */
export function parseClones(report, root) {
  const rel = (p) => path.relative(root, p).split(path.sep).join('/')
  return (report.duplicates ?? []).map((d) => {
    const a = { file: rel(d.firstFile.name), start: d.firstFile.start, end: d.firstFile.end }
    const b = { file: rel(d.secondFile.name), start: d.secondFile.start, end: d.secondFile.end }
    const scope = a.file.startsWith('src/') || b.file.startsWith('src/') ? 'src' : 'tools'
    return { scope, a, b, lines: d.lines, tokens: d.tokens, pair: [a.file, b.file].sort().join('|') }
  })
}

/** Счёт jscpd по области: число копий, строк в копиях и копий по паре файлов (пары — только чтобы назвать место). */
export function jscpdMetric(clones) {
  const out = { src: { clones: 0, lines: 0, pairs: {} }, tools: { clones: 0, lines: 0, pairs: {} } }
  for (const c of clones) {
    const s = out[c.scope]
    s.clones += 1
    s.lines += c.lines
    s.pairs[c.pair] = (s.pairs[c.pair] ?? 0) + 1
  }
  return out
}

// ───────── сравнение с базой ─────────

const fmtPlace = (c) => `${c.a.file}:${c.a.start}-${c.a.end} ↔ ${c.b.file}:${c.b.start}-${c.b.end} (${c.lines} стр.)`

/**
 * Текущее против базы. Выросло любое число — `grew` (с названными местами), только упало — `lower`.
 * current = { jscpd: jscpdMetric, i18n: i18nMetric, clones, groups }, base — содержимое tools/dups-baseline.json.
 */
export function compareToBase(current, base) {
  const grew = []
  const lower = []
  const judge = (label, pairs) => {
    const up = pairs.filter(([, c, b]) => c > b)
    const down = pairs.filter(([, c, b]) => c < b)
    return { label, up, down }
  }
  for (const scope of ['src', 'tools']) {
    const cur = current.jscpd[scope]
    const b = base.jscpd?.[scope] ?? { clones: 0, lines: 0, pairs: {} }
    const j = judge(`jscpd ${scope}`, [['копий', cur.clones, b.clones], ['строк в копиях', cur.lines, b.lines]])
    const text = (rows) => rows.map(([n, c, bb]) => `${n} ${bb}→${c}`).join(', ')
    if (j.up.length) {
      const places = []
      for (const [pair, n] of Object.entries(cur.pairs)) {
        if (n > (b.pairs?.[pair] ?? 0)) places.push(...current.clones.filter((c) => c.scope === scope && c.pair === pair).map(fmtPlace))
      }
      grew.push({ label: j.label, text: text(j.up), places })
    } else if (j.down.length) lower.push({ label: j.label, text: text(j.down) })
  }
  const bi = base.i18n ?? { extra: 0, values: {} }
  if (current.i18n.extra > bi.extra) {
    const places = current.groups.filter((g) => g.keys.length > (bi.values?.[g.value] ?? 1)).map((g) => `«${g.value}» — ${g.keys.join(', ')}`)
    grew.push({ label: 'i18n одинаковые тексты', text: `лишних повторов ${bi.extra}→${current.i18n.extra}`, places })
  } else if (current.i18n.extra < bi.extra) lower.push({ label: 'i18n одинаковые тексты', text: `лишних повторов ${bi.extra}→${current.i18n.extra}` })
  return { grew, lower }
}

/** База из текущего прогона: пары по областям и значения i18n — чтобы называть новые места. */
export function makeBase(current) {
  return { jscpd: current.jscpd, i18n: current.i18n }
}

/** Крупнейшие копии — для отчёта: по числу строк, затем токенов. */
export function largestClones(clones, n = 15) {
  return [...clones].sort((x, y) => y.lines - x.lines || y.tokens - x.tokens).slice(0, n).map((c) => ({ scope: c.scope, text: fmtPlace(c), tokens: c.tokens }))
}
