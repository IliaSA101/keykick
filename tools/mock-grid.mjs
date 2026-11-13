// Сетка макетов: «лесенка» в рядах карточек (решение владельца 11.11: правило + автопроверка).
// Название в 1–3 строки сдвигает картинку и подписи соседей по ряду — mock-check.mjs (статический) этого не видит.
// Здесь кадры листов открываются в Chromium (тот же playwright, что в shots.mjs), ряды измеряются по раскладке.
//   tools/heavy.sh node tools/mock-grid.mjs [--sheet <лист>]
// Ряд: соседи одного родителя с одним тегом и первым классом, одной ширины (±2 px), ≥ 3 в одной строке (top ±2 px).
// В каждой карточке ряда мерим (от верха/низа карточки): верх первой картинки, низ первой текстовой строки после неё,
// низ последнего текста. Разброс по ряду > 2 px — КАНДИДАТ (не ошибка: правило опасное, выравнивать вслепую нельзя).
// На каждого кандидата — вырезка ряда с рамкой и подписью разброса: docs/analysis/grid/<лист>/<кадр>-<n>.png;
// второй контролёр (kk-art) подтверждает глазами. Задуманный разброс — в tools/mock-grid-allow.json
// (кадр или «*», селектор ряда, причина); порог не ослабляем. Выход 0; с ключом --strict при кандидатах — 1.
// В mock-check и npm run check не встроено (нужен браузер, решение владельца 11.11).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchChrome } from './lib/chrome.mjs'

const ROOT = 'docs/mockups'
// те же листы, что в mock-check.mjs, плюс игры
const SHEETS = ['kit', 'match-b', 'map-yard', 'champ', 'collection', 'school', 'games', 'story', 'path'].filter((d) => existsSync(`${ROOT}/${d}`))
const SIZES = { 1024: 640, 1280: 800, 1920: 1080, 2560: 1440 }
const TOL = 2
const PARALLEL = 4
const OUT = 'docs/analysis/grid'
const ALLOW_FILE = 'tools/mock-grid-allow.json'
const METRICS = { media: 'верх картинки', first: 'низ первой строки после картинки', last: 'низ последнего текста от низа карточки' }

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const only = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null
if (args.includes('--sheet') && !SHEETS.includes(only)) {
  console.error(`Сетка: нет листа «${only}» (есть: ${SHEETS.join(', ')})`)
  process.exit(2)
}
const allow = existsSync(ALLOW_FILE) ? JSON.parse(readFileSync(ALLOW_FILE, 'utf8')) : []
// запись allow: { frame: кадр или «*», selector, metric: media|first|last (необязательно — иначе все три), reason }
const allowed = (frame, sel, metric) =>
  allow.some((a) => (a.frame === '*' || a.frame === frame) && a.selector === sel && (!a.metric || a.metric === metric))

/** Работает в странице: возвращает ряды карточек с тремя замерами на карточку (px от верха/низа карточки). */
function measureRows(tol) {
  const cls = (e) => (typeof e.className === 'string' ? e.className.trim().split(/\s+/)[0] : '')
  const label = (e) => e.tagName.toLowerCase() + (cls(e) ? `.${cls(e)}` : '')
  const MEDIA = 'img, svg, picture, canvas, video'
  const isMedia = (e) => e.matches(MEDIA) || (getComputedStyle(e).backgroundImage !== 'none' && e.children.length === 0)
  // первая картинка карточки; поднимаемся до самой большой обёртки без текста (рамка картинки, а не сам рисунок в ней)
  const firstMedia = (card) => {
    let m = [...card.querySelectorAll('*')].find((e) => isMedia(e) && e.getBoundingClientRect().height > 4)
    while (m && m.parentElement && m.parentElement !== card && !m.parentElement.textContent.trim()) m = m.parentElement
    return m
  }
  const outOfFlow = (el, card) => {
    for (let e = el; e && e !== card; e = e.parentElement) if (getComputedStyle(e).position === 'absolute') return true
    return false
  }
  const textRects = (card, media) => {
    const out = []
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || (media && media.contains(n.parentElement)) || n.parentElement.closest('svg, script, style')) continue
      if (outOfFlow(n.parentElement, card)) continue // бейдж поверх картинки — не строка ряда
      const range = document.createRange()
      range.selectNodeContents(n)
      const rs = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
      if (rs.length) out.push({ n, first: rs[0], last: rs[rs.length - 1] })
    }
    return out
  }
  const metrics = (card) => {
    const cr = card.getBoundingClientRect()
    const media = firstMedia(card)
    const texts = textRects(card, media)
    const after = media ? texts.filter((t) => media.compareDocumentPosition(t.n) & Node.DOCUMENT_POSITION_FOLLOWING) : texts
    return {
      media: media ? media.getBoundingClientRect().top - cr.top : null,
      first: after.length ? after[0].first.bottom - cr.top : null,
      last: texts.length ? cr.bottom - texts[texts.length - 1].last.bottom : null,
    }
  }
  const path = (e) => {
    const parts = []
    for (let p = e.parentElement; p && p !== document.body && parts.length < 2; p = p.parentElement) parts.unshift(label(p))
    return parts.join(' > ')
  }
  const rows = []
  window.__gridRows = []
  for (const parent of document.querySelectorAll('body, body *')) {
    const kids = [...parent.children].filter((k) => {
      const r = k.getBoundingClientRect()
      return r.width >= 40 && r.height >= 30 && getComputedStyle(k).display !== 'none'
    })
    // серии соседей: тот же тег и первый класс, ширина ±tol; внутри серии — строки по top
    let run = []
    const flush = () => {
      const byTop = []
      for (const k of run) {
        const top = k.getBoundingClientRect().top
        const line = byTop.find((l) => Math.abs(l.top - top) <= tol)
        line ? line.cards.push(k) : byTop.push({ top, cards: [k] })
      }
      for (const l of byTop) {
        if (l.cards.length >= 3) window.__gridRows.push(l.cards)
        if (l.cards.length >= 3) rows.push({ sel: `${path(l.cards[0])} > ${label(l.cards[0])}`, cards: l.cards.map(metrics) })
      }
      run = []
    }
    for (const k of kids) {
      const w = k.getBoundingClientRect().width
      const same = run.length && label(run[0]) === label(k) && Math.abs(run[0].getBoundingClientRect().width - w) <= tol
      if (run.length && !same) flush()
      run.push(k)
    }
    flush()
  }
  return rows
}

/** Работает в странице: рисует рамки на карточках ряда и подпись над ним; возвращает область снимка (координаты документа). */
function markRow({ idx, text }) {
  const cards = window.__gridRows[idx]
  const box = document.createElement('div')
  box.id = '__grid-mark'
  const rects = cards.map((c) => c.getBoundingClientRect())
  const left = Math.min(...rects.map((r) => r.left)) + scrollX
  const top = Math.min(...rects.map((r) => r.top)) + scrollY
  const right = Math.max(...rects.map((r) => r.right)) + scrollX
  const bottom = Math.max(...rects.map((r) => r.bottom)) + scrollY
  for (const r of rects) {
    const f = document.createElement('div')
    f.style.cssText = `position:absolute;z-index:99999;pointer-events:none;outline:2px solid #ff2d95;left:${r.left + scrollX}px;top:${r.top + scrollY}px;width:${r.width}px;height:${r.height}px`
    box.append(f)
  }
  const label = document.createElement('div')
  label.textContent = text
  label.style.cssText = `position:absolute;z-index:99999;left:${left}px;top:${Math.max(0, top - 26)}px;padding:3px 8px;background:#ff2d95;color:#fff;font:bold 14px sans-serif;white-space:nowrap`
  box.append(label)
  document.body.append(box)
  const y = Math.max(0, top - 30)
  return { x: Math.max(0, left - 6), y, width: right - left + 12, height: bottom - y + 6 }
}

/** Кадры листа: имя файла → ширина из имени (по умолчанию 1920). */
function framesOf(sheet) {
  return readdirSync(`${ROOT}/${sheet}`)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => ({ sheet, file: f, width: Number(/-(1024|1280|1920|2560)\.html$/.exec(f)?.[1]) || 1920 }))
}

/** Разброс замера по ряду; null-замеры (нет картинки или текста) в сравнении не участвуют. */
function spread(cards, key) {
  const v = cards.map((c) => c[key]).filter((x) => x !== null)
  return v.length >= 2 ? Math.max(...v) - Math.min(...v) : 0
}

async function main() {
  const frames = (only ? [only] : SHEETS).flatMap(framesOf)
  const browser = await launchChrome()
  const found = []
  for (const sh of only ? [only] : SHEETS) rmSync(`${OUT}/${sh}`, { recursive: true, force: true })
  const perSheet = {}
  let rowsN = 0
  let cardsN = 0
  const queue = [...frames]
  const worker = async () => {
    const page = await browser.newPage()
    for (let f = queue.shift(); f; f = queue.shift()) {
      await page.setViewportSize({ width: f.width, height: SIZES[f.width] })
      await page.goto(pathToFileURL(resolve(`${ROOT}/${f.sheet}/${f.file}`)).href)
      await page.waitForLoadState('load')
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null))))
      })
      const rows = await page.evaluate(measureRows, TOL)
      const short = f.file.replace(/\.html$/, '')
      let n = 0
      for (const [idx, r] of rows.entries()) {
        rowsN++
        cardsN += r.cards.length
        const bad = Object.keys(METRICS).map((key) => ({ key, d: spread(r.cards, key) })).filter((x) => x.d > TOL && !allowed(short, r.sel, x.key))
        if (!bad.length) continue
        n++
        const png = `${OUT}/${f.sheet}/${short}-${n}.png`
        const caption = bad.map((x) => `${METRICS[x.key]}: ${Math.round(x.d)} px`).join('; ')
        const clip = await page.evaluate(markRow, { idx, text: `${r.sel} — ${caption}` })
        // ряд нулевой высоты или ширины (скрытый, свёрнутый) — снимать нечего, это не лесенка на экране (050 №10)
        if (!clip || clip.width < 1 || clip.height < 1) {
          await page.evaluate(() => document.getElementById('__grid-mark')?.remove())
          n--
          continue
        }
        mkdirSync(`${OUT}/${f.sheet}`, { recursive: true })
        await page.screenshot({ path: png, fullPage: true, clip })
        await page.evaluate(() => document.getElementById('__grid-mark')?.remove())
        found.push(`кандидат: ${f.sheet}/${short} ${r.sel} (${r.cards.length} шт.) ${caption} → ${png}`)
        perSheet[f.sheet] = (perSheet[f.sheet] ?? 0) + 1
      }
    }
    await page.close()
  }
  try {
    await Promise.all(Array.from({ length: PARALLEL }, worker))
  } finally {
    await browser.close()
  }
  found.sort()
  if (!found.length) {
    console.log(`Сетка: ок — рядов ${rowsN}, карточек ${cardsN}`)
    return
  }
  for (const f of found) console.log(f)
  const by = Object.entries(perSheet).map(([s, n]) => `${s} ${n}`).join(', ')
  console.log(`Сетка: кандидатов ${found.length} (проверить по кадрам; ${by}) — рядов ${rowsN}, карточек ${cardsN}, кадров ${frames.length}`)
  if (strict) process.exitCode = 1
}

await main()
