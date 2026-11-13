// Замер покоя экрана печати: раскладки и пересчёты стилей за 2 с, когда ребёнок ничего не нажимает.
//   tools/heavy.sh node tools/probe-idle.mjs
// Корень — рабочая копия, где лежит скрипт; свой vite на порту 5297 гасится по своему PID.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { launchChrome, startVite } = await import(join(ROOT, 'tools/lib/chrome.mjs'))
process.chdir(ROOT)
const PORT = 5297
const stop = await startVite(PORT)
const browser = await launchChrome()
try {
  for (const [name, css] of [['как есть', ''], ['без анимаций в svg клавиатуры и рук', 'svg *, svg { animation: none !important }'], ['без .ring клавиатуры', '.ring { animation: none !important }'], ['без .halo рук', '.halo { animation: none !important }'], ['без перехода полосы', '.fill { transition: none !important }'], ['без всех анимаций', '*, *::before, *::after { animation: none !important; transition: none !important }']]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const cdp = await page.context().newCDPSession(page)
    await page.goto(`http://localhost:${PORT}/keykick/?seed=v2-day1#/map`)
    await page.locator('[data-focus="yard-01"]').waitFor()
    await page.goto(`http://localhost:${PORT}/keykick/#/match?lesson=yard-01`)
    await page.locator('.intro').waitFor()
    await page.keyboard.press('Space')
    await page.locator('.typing:not(.waiting) .line').first().waitFor()
    if (css) await page.addStyleTag({ content: css })
    await page.waitForTimeout(500)
    await cdp.send('Performance.enable')
    const g = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
    const a = await g(); await page.waitForTimeout(2000); const b = await g()
    console.log(`${name}: за 2 с покоя LayoutCount +${b.LayoutCount - a.LayoutCount}, RecalcStyleCount +${b.RecalcStyleCount - a.RecalcStyleCount}, Layout ${Math.round((b.LayoutDuration - a.LayoutDuration) * 1000)} мс, Style ${Math.round((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000)} мс`)
    await page.close()
  }
} finally { await browser.close(); stop() }
