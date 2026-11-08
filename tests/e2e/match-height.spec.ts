/*
 * Экран матча v2 на окне 1024×640 не прокручивается (спека 017-Р29): тестировщик мерил перерыв в 783 px,
 * вступление в 669, тайм в 676, stuck5 в 663 — страница уезжала за край окна.
 *
 * Какую поломку ловит, которую не ловят vitest: вёрстка. Высоту страницы знает только настоящий браузер —
 * вернувшаяся клавиатура на перерыве или итоге, раздувшаяся плашка вступления, подсказка решающей серии
 * в две строки. Прыжки `#/match?at=…` ставят матч в нужную фазу без печати (только dev-сервер).
 * Запуск — `npm run e2e`; в `npm run check` не входит.
 */
import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1024, height: 640 } })

// Фаза → адрес. Вступление — обычный вход без `at`. Урок yard-05: 4 атаки, g = 1, c = 5 (есть и сейв, и мячи запаса).
const LESSON = 'yard-05'
const cases: { name: string; hash: string; ready: string }[] = [
  { name: 'вступление', hash: `#/match?lesson=${LESSON}`, ready: '.intro' },
  // Возврат ≥ 5 суток смягчает урок (017-Р55): на вступлении добавляется строка «Сегодня матч полегче…» (Р57).
  { name: 'вступление смягчённого матча (возврат)', hash: `#/match?at=comeback&lesson=${LESSON}`, ready: '[data-soft]' },
  { name: 'тайм', hash: `#/match?at=half1&lesson=${LESSON}`, ready: '.status' },
  { name: 'решающая атака', hash: `#/match?at=decisive&lesson=${LESSON}`, ready: '.status' },
  { name: 'перерыв', hash: `#/match?at=break&lesson=${LESSON}`, ready: '.break' },
  // Метку помощи `[data-help-tag]` («С запасом») не видит ни один vitest-тест: прыжок `reserve` — 1-й тайм после «С запасом» (017-Р46).
  { name: 'тайм с запасом (метка помощи)', hash: `#/match?at=reserve&lesson=${LESSON}`, ready: '[data-help-tag]' },
  { name: 'доп. время', hash: `#/match?at=extra&lesson=${LESSON}`, ready: '.status' },
  { name: 'минута тренера', hash: `#/match?at=coach&lesson=${LESSON}`, ready: '.coach' },
  { name: 'пенальти', hash: `#/match?at=kick&lesson=${LESSON}`, ready: '.kick' },
  { name: 'итог: застрял (5 провалов)', hash: `#/match?at=stuck5&lesson=${LESSON}`, ready: '.result-card' },
  { name: 'итог: поражение', hash: `#/match?at=loss&lesson=${LESSON}`, ready: '.result-card' },
  { name: 'итог: ничья', hash: `#/match?at=draw&lesson=${LESSON}`, ready: '.result-card' },
]

for (const c of cases) {
  test(`1024×640 без прокрутки: ${c.name}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`?seed=v2-mid${c.hash}`)
    await expect(page.locator(c.ready).first()).toBeVisible()
    // Дать вёрстке осесть: шрифты, картинки поля, конец появления слоя.
    await page.waitForTimeout(500)
    const size = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      inner: window.innerHeight,
    }))
    expect(size.scroll, `scrollHeight ${size.scroll} при окне ${size.inner}`).toBeLessThanOrEqual(size.inner)
    expect(errors).toEqual([])
  })
}

/*
 * Кнопки итога — в одну строку на 1024 (спека 017-Р34): высота кнопки не больше одной строки текста плюс отступы.
 * Ловит возврат длинных подписей («С тренером — ★, вернёшься за звёздами»), что переносились на 2–3 строки,
 * и карточку, что теснит три кнопки в два ряда.
 */
const resultCases: { name: string; at: string }[] = [
  { name: 'застрял (3 провала)', at: 'stuck3' },
  { name: 'застрял (5 провалов)', at: 'stuck5' },
  { name: 'капитан вернулся', at: 'comeback' },
  { name: 'поражение', at: 'loss' },
]

for (const c of resultCases) {
  test(`1024×640 кнопки итога в одну строку: ${c.name}`, async ({ page }) => {
    await page.goto(`?seed=v2-mid#/match?at=${c.at}&lesson=${LESSON}`)
    await expect(page.locator('.result-card, .intro').first()).toBeVisible()
    await page.waitForTimeout(500)
    const buttons = page.locator('.result-card .key-btn, .intro .key-btn')
    const count = await buttons.count()
    expect(count, 'кнопок на экране').toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const info = await buttons.nth(i).evaluate((el) => {
        // Высоту текста, а не кнопки: соседи в ряду тянутся по высоте главной (крупнее шрифт) — это не перенос.
        const cs = getComputedStyle(el)
        const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4
        const range = document.createRange()
        range.selectNodeContents(el)
        return { text: el.textContent?.trim() ?? '', height: range.getBoundingClientRect().height, max: line * 1.5 }
      })
      expect(info.height, `«${info.text}»: ${info.height} px при потолке ${info.max}`).toBeLessThanOrEqual(info.max)
    }
  })
}

/*
 * Строка статуса в решающей атаке и доп. времени (017-Р49): счётчик «Строка N из M», мячи запаса и подсказка не слипаются
 * и лежат внутри своей колонки. Поломка, которую видит только браузер: полоска хода с минимальной шириной
 * вылезала на первый мяч, подсказка уходила к правому краю.
 */
for (const at of ['decisive', 'extra', 'reserve']) {
  test(`1024×640 строка статуса: элементы не пересекаются и внутри колонки (${at})`, async ({ page }) => {
    await page.goto(`?seed=v2-mid#/match?at=${at}&lesson=${LESSON}`)
    await expect(page.locator('.status').first()).toBeVisible()
    await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const box = (el: Element) => el.getBoundingClientRect()
      const status = document.querySelector('.status')!
      const col = box(status)
      const items = [...status.querySelectorAll('.progress .label, .progress .bar, .help-tag, .reserve, .hint')]
        .filter((el) => box(el).width > 0 && (el.textContent?.trim() || !el.classList.contains('hint')))
        .map((el) => ({ name: el.className, r: box(el) }))
      const outside = items.filter((i) => i.r.left < col.left - 1 || i.r.right > col.right + 1).map((i) => i.name)
      const overlaps: string[] = []
      items.forEach((a, k) => items.slice(k + 1).forEach((b) => {
        const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
        const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
        if (x > 0 && y > 0) overlaps.push(`${a.name} × ${b.name}`)
      }))
      // Зазор между счётчиком строки и мячами запаса (если они в одной строке): не меньше 8 px.
      const prog = status.querySelector('.progress')
      const reserve = status.querySelector('.reserve')
      const sameRow = prog && reserve && box(prog).top < box(reserve).bottom && box(reserve).top < box(prog).bottom
      const gap = prog && reserve && sameRow ? box(reserve).left - box(prog).right : 99
      return { outside, overlaps, gap, n: items.length }
    })
    expect(r.n, 'элементов статуса').toBeGreaterThan(1)
    expect(r.overlaps, 'пересечения').toEqual([])
    expect(r.outside, 'вне колонки статуса').toEqual([])
    expect(r.gap, 'зазор счётчика и мячей').toBeGreaterThanOrEqual(8)
  })
}

/*
 * Вступление: «Совет тренера» читается — контраст текста к фону плашки не ниже 4.5 (017-Р49).
 * Фон считаем из вычисленного стиля: плашка непрозрачная, иначе цвет под ней неизвестен.
 */
test('1024×640 вступление: контраст «Совета тренера» ≥ 4.5', async ({ page }) => {
  await page.goto(`?seed=v2-mid#/match?lesson=${LESSON}`)
  await expect(page.locator('.intro .tip')).toBeVisible()
  const ratio = await page.evaluate(() => {
    const el = document.querySelector('.intro .tip')!
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number)
    const lum = (rgb: number[]) => {
      const [r = 0, g = 0, b = 0] = rgb.slice(0, 3).map((v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const cs = getComputedStyle(el)
    const bg = parse(cs.backgroundColor)
    if ((bg[3] ?? 1) < 1) return 0 // полупрозрачный фон — не считаем
    const a = lum(parse(cs.color))
    const b = lum(bg)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  })
  expect(ratio, 'контраст текста к фону плашки (0 — фон полупрозрачный)').toBeGreaterThanOrEqual(4.5)
})

/* Строка о смягчении (017-Р57) есть на вступлении только у смягчённого матча: возврат — есть, обычный вход — нет. */
test('1024×640 вступление: строка «Сегодня матч полегче» только при смягчении', async ({ page }) => {
  await page.goto(`?seed=v2-mid#/match?lesson=${LESSON}`)
  await expect(page.locator('.intro')).toBeVisible()
  await expect(page.locator('[data-soft]')).toHaveCount(0)
  await page.goto(`?seed=v2-mid#/match?at=comeback&lesson=${LESSON}`)
  await page.reload()
  await expect(page.locator('[data-soft]')).toHaveText('Сегодня матч полегче — звёзды до\u00a0★★')
})

/*
 * Фокус «Дальше» одинаков на всех итогах (017-Р49): рамка не зависит от того, трогали ли мышь до появления кнопки
 * (программный фокус без клавиатуры не включал :focus-visible — на одних итогах рамка была, на других нет).
 */
for (const mouse of [false, true]) {
  test(`1024×640 фокус «Дальше» одинаков на итогах${mouse ? ' (после клика мышью)' : ''}`, async ({ page }) => {
    const outlines: string[] = []
    const outlineOf = (): Promise<string> =>
      page.evaluate(() => {
        const el = document.querySelector('.result-card [data-offer="next"]')
        if (!el) return 'нет кнопки'
        const cs = getComputedStyle(el)
        return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`
      })
    for (const hash of ['#/match?at=win', '#/match?at=win&lesson=yard-05']) {
      await page.goto(`?seed=v2-mid${hash}`)
      await expect(page.locator('.result-card [data-offer="next"]')).toBeVisible()
      if (mouse) await page.mouse.click(5, 5)
      // Рамка есть и до того, как фокус встал (он ставится через screenDelay.resultMs): кадр не зависит от момента съёмки.
      const early = await outlineOf()
      await page.waitForTimeout(900)
      expect(early, 'рамка до установки фокуса').toBe(await outlineOf())
      outlines.push(
        await page.evaluate(() => {
          const el = document.activeElement
          if (!el || !el.matches('[data-offer="next"]')) return `фокус не на «Дальше»: ${el?.tagName}`
          const cs = getComputedStyle(el)
          return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`
        }),
      )
    }
    expect(outlines[0]).toMatch(/^solid 4px/)
    expect(outlines[1]).toBe(outlines[0])
  })
}
