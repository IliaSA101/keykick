/*
 * Окна поверх карты на 1024×640 (спека 019-Т8д): правка клуба, лист лиги и «Что нового» целиком в экране —
 * рамка не заходит за край (раньше окно правки выходило на 8 px влево и было выше экрана), с отступом от краёв
 * и без внутренней прокрутки. Какую поломку ловит, которую не ловят vitest: вёрстка; размеры знает только браузер.
 * Адрес `?sheet|news|edit=1` открывает окно без кликов (только dev-сервер). Запуск — `npm run e2e`.
 */
import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1024, height: 640 } })

const EDGE = 16
const cases: { name: string; ask: string }[] = [
  { name: 'правка клуба', ask: 'edit' },
  { name: 'лист лиги', ask: 'sheet' },
  { name: 'что нового', ask: 'news' },
]

for (const c of cases) {
  test(`1024×640 окно в экране без прокрутки: ${c.name}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`?seed=v2-mid#/map?${c.ask}=1`)
    const dialog = page.locator('[role=dialog]')
    await expect(dialog).toBeVisible()
    // Дать вёрстке осесть: шрифты, картинки формы, конец появления окна.
    await page.waitForTimeout(500)
    const m = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return {
        left: r.left,
        top: r.top,
        right: window.innerWidth - r.right,
        bottom: window.innerHeight - r.bottom,
        scroll: el.scrollHeight,
        client: el.clientHeight,
        scrollX: el.scrollWidth,
        clientX: el.clientWidth,
      }
    })
    const gaps = `слева ${m.left}, сверху ${m.top}, справа ${m.right}, снизу ${m.bottom}`
    expect(m.left, gaps).toBeGreaterThanOrEqual(EDGE)
    expect(m.top, gaps).toBeGreaterThanOrEqual(EDGE)
    expect(m.right, gaps).toBeGreaterThanOrEqual(EDGE)
    expect(m.bottom, gaps).toBeGreaterThanOrEqual(EDGE)
    expect(m.scroll, `scrollHeight ${m.scroll} при clientHeight ${m.client}`).toBeLessThanOrEqual(m.client)
    expect(m.scrollX, `scrollWidth ${m.scrollX} при clientWidth ${m.clientX}`).toBeLessThanOrEqual(m.clientX)
    expect(errors).toEqual([])
  })
}
