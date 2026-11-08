// Кадры всех экранов: `npm run shots` (спека 015, design.md §3).
// Свой vite на порту оснастки → ссылки a[data-frame] со страницы #/dev/frames → PNG каждого кадра
// в 4 окнах × 2 темах → лист index.html. Бюджет — 2 минуты (печатается, порогом не рвёт).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PORTS, launchChrome, startVite } from './lib/chrome.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// KK_SHOTS_PORT — запасной порт, если 5291 занят (две копии снимают кадры одновременно).
const PORT = Number(process.env.KK_SHOTS_PORT) || PORTS.shots
const BASE = `http://localhost:${PORT}/keykick/`
const WINDOWS = [
  [1024, 640],
  [1280, 800],
  [1920, 1080],
  [2560, 1440],
]
const THEMES = ['light', 'dark']
const PARALLEL = 8
const BROWSERS = 4
const BUDGET_S = 120

const started = Date.now()
const errors = []

/** Метка времени для папки: ГГГГММДД-ЧЧММ по местным часам. */
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/** Кадр дождался готовности: отметка роутера, шрифты, картинки, два кадра отрисовки. */
async function settle(page) {
  await page.waitForSelector('html[data-kk-ready]', { timeout: 15_000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))),
    )
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  })
}

/** Адрес кадра: ?seed до решётки, хэш — путь внутри игры. */
const frameUrl = (seed, hash) => `${BASE}?seed=${seed}${hash}`

/** Открывает кадр в странице; пишет ошибки консоли и уход на другой путь. */
async function openFrame(page, frame) {
  const problems = []
  const onError = (e) => problems.push(`ошибка страницы: ${e.message}`)
  const onConsole = (m) => {
    if (m.type() === 'error') problems.push(`консоль: ${m.text()}`)
  }
  page.on('pageerror', onError)
  page.on('console', onConsole)
  try {
    await page.goto(frameUrl(frame.seed, frame.hash), { waitUntil: 'load', timeout: 20_000 })
    await settle(page)
    const now = await page.evaluate(() => location.hash)
    if (now.split('?')[0] !== frame.hash.split('?')[0]) problems.push(`перенаправлен на ${now}`)
  } finally {
    page.off('pageerror', onError)
    page.off('console', onConsole)
  }
  return problems
}

/** Кадры со страницы-списка; `expand` — ссылки блока на другой странице, каждая отдельным кадром. */
async function collectFrames(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  try {
    await page.goto(`${BASE}#/dev/frames`, { waitUntil: 'load', timeout: 20_000 })
    await page.waitForSelector('a[data-frame]', { timeout: 15_000 })
    const links = await page.$$eval('a[data-frame]', (as) =>
      as.map((a) => ({
        id: a.dataset.frame,
        group: a.dataset.group,
        seed: a.dataset.seed,
        hash: `#${a.dataset.path}`,
        expand: a.dataset.expand || null,
      })),
    )
    const frames = []
    for (const link of links) {
      if (!link.expand) {
        frames.push(link)
        continue
      }
      await openFrame(page, link)
      const hashes = await page.$$eval(link.expand, (as) => as.map((a) => a.getAttribute('href')))
      const seen = new Set()
      for (const h of hashes) {
        if (!h) continue
        const q = new URLSearchParams(h.split('?')[1] ?? '')
        q.delete('lesson')
        const key = [...q.entries()].map(([k, v]) => `${k}-${v}`).join('-').replace(/[^a-zA-Z0-9-]+/g, '')
        const id = `${link.id}-${key}`
        if (seen.has(id)) continue
        seen.add(id)
        frames.push({ id, group: link.group, seed: link.seed, hash: h, expand: null })
      }
      if (hashes.length === 0) errors.push(`кадр ${link.id} — ссылок ${link.expand} на странице нет`)
    }
    return frames
  } finally {
    await context.close()
  }
}

/**
 * Одно окно и часть кадров: свой контекст, у каждого кадра своя страница. Страница грузится один раз,
 * обе темы снимаются на ней сменой emulateMedia (prefers-color-scheme) — вдвое меньше загрузок.
 */
async function shootJob(browser, job, dir, done) {
  const [width, height] = job.size
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
  try {
    for (const frame of job.frames) {
      const page = await context.newPage()
      const where = `кадр ${frame.id} ${width}×${height}`
      try {
        await page.emulateMedia({ colorScheme: THEMES[0] })
        for (const p of await openFrame(page, frame)) errors.push(`${where} — ${p}`)
        for (const theme of THEMES) {
          await page.emulateMedia({ colorScheme: theme })
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
          const file = `${frame.id}__${width}x${height}__${theme}.png`
          await page.screenshot({ path: join(dir, file) })
          done.push({ frame, file, size: job.size, theme })
        }
      } catch (e) {
        errors.push(`${where} — ошибка: ${String(e.message).split('\n')[0]}`)
      } finally {
        await page.close()
      }
    }
  } finally {
    await context.close()
  }
}

/** Лист: строка на кадр, 8 миниатюр со ссылками на PNG; кадры по группам. */
function sheet(frames, done, dir, seconds) {
  const byGroup = new Map()
  for (const f of frames) byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f])
  const cell = (frame) =>
    done
      .filter((d) => d.frame.id === frame.id)
      .sort((a, b) => a.size[0] - b.size[0] || a.theme.localeCompare(b.theme))
      .map(
        (d) =>
          `<a href="${d.file}"><img loading="lazy" src="${d.file}" width="150" alt="${d.file}" title="${d.size[0]}×${d.size[1]} ${d.theme}"></a>`,
      )
      .join('')
  const groups = [...byGroup]
    .map(
      ([group, list]) =>
        `<h2>${group}</h2>\n` +
        list.map((f) => `<div class="row"><b>${f.id}</b><div>${cell(f)}</div></div>`).join('\n'),
    )
    .join('\n')
  const html = `<!doctype html><meta charset="utf-8"><title>Кадры</title>
<style>body{font:14px system-ui;margin:16px;background:#222;color:#eee}h2{margin:24px 0 8px}
.row{display:flex;gap:12px;align-items:flex-start;margin:8px 0}.row b{width:16em;flex:none;font-family:monospace}
img{margin:0 6px 6px 0;border:1px solid #666;background:#000}a{color:#9cf}</style>
<h1>Кадры: ${frames.length} × 8, ${seconds.toFixed(0)} с</h1>
<p>Окна по порядку: 1024×640, 1280×800, 1920×1080, 2560×1440; в каждом — светлая, затем тёмная тема.
Светлой темы в игре пока нет — светлые кадры совпадают с тёмными.</p>
${groups}
${errors.length ? `<h2>Ошибки</h2><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
`
  writeFileSync(join(dir, 'index.html'), html)
}

async function main() {
  const dir = join(ROOT, 'shots', stamp())
  mkdirSync(dir, { recursive: true })
  const stop = await startVite(PORT)
  process.once('exit', stop)
  process.once('SIGINT', () => process.exit(130))
  // Несколько браузеров: у одного все контексты делят процесс отрисовки, и он становится узким местом.
  const browsers = []
  try {
    for (let i = 0; i < BROWSERS; i++) browsers.push(await launchChrome())
  } catch (e) {
    await Promise.all(browsers.map((b) => b.close()))
    stop()
    throw e
  }
  let frames = []
  const done = []
  try {
    frames = await collectFrames(browsers[0])
    // Кадры каждого окна делятся пополам: 8 заданий на PARALLEL рабочих.
    const half = Math.ceil(frames.length / 2)
    const jobs = WINDOWS.flatMap((size) => [frames.slice(0, half), frames.slice(half)].map((part) => ({ size, frames: part })))
    const queue = [...jobs]
    await Promise.all(
      Array.from({ length: PARALLEL }, async (_, i) => {
        const browser = browsers[i % BROWSERS]
        for (let job = queue.shift(); job; job = queue.shift()) await shootJob(browser, job, dir, done)
      }),
    )
  } finally {
    await Promise.all(browsers.map((b) => b.close()))
    stop()
  }
  const seconds = (Date.now() - started) / 1000
  sheet(frames, done, dir, seconds)
  for (const e of errors) console.log(e)
  const over = seconds > BUDGET_S ? ' — ВНЕ БЮДЖЕТА' : ''
  console.log(`кадров ${frames.length} × 8, время ${seconds.toFixed(1)} с (бюджет 2 мин)${over}`)
  console.log(`лист: ${join(dir, 'index.html')}`)
  process.exitCode = errors.length ? 1 : 0
}

main().catch((e) => {
  console.error(`кадры не сняты: ${e.message}`)
  process.exit(1)
})
