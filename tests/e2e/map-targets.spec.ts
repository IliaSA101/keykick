/*
 * Цели нажатия и наложения на карте Двора, 1024×640 (спека 019-Т12д, Т12д2; находки ребёнка-критика и ревью, 019-Р41, Р45):
 * точки уроков и ссылки угла не меньше 44×44; круги точек и звёзды не налезают друг на друга; подписи мест и флажки не лежат
 * на кругах, звёздах и значках мест; «Стадион» и «Ворота» целиком внутри поля. Попадание проверяется по-настоящему
 * (`elementFromPoint`): центр круга и точка в 3 px от края с четырёх сторон — своя кнопка, угол квадрата 44×44 — не она.
 * Какую поломку ловит, которую не ловит vitest: вёрстка и размеры знает только браузер. Сиды v2-day1 / v2-mid / v2-end —
 * только dev-сервер. Запуск — `npm run e2e`.
 */
import { expect, test, type Page } from '@playwright/test'
import clubs from '../../src/content/clubs.json' with { type: 'json' }
import { ru } from '../../src/i18n/ru'

test.use({ viewport: { width: 1024, height: 640 } })

const MIN = 44
const SEEDS = ['v2-day1', 'v2-mid', 'v2-end']

interface Box {
  name: string
  l: number
  t: number
  r: number
  b: number
}

/** Откуда брать имя прямоугольника в сообщении: id фокуса, текст, id фокуса родителя или id точки обёртки. */
type Name = 'focus' | 'text' | 'parent-focus' | 'wrap-pt'

/** Прямоугольники по селектору; пустые и скрытые не берём. Имя — «приставка id», по id находятся «свои» пары. */
async function boxes(page: Page, selector: string, prefix: string, name: Name): Promise<Box[]> {
  return page.evaluate(
    ([sel, pre, from]) =>
      [...document.querySelectorAll(sel)]
        .map((el) => {
          const r = el.getBoundingClientRect()
          const id =
            from === 'focus'
              ? el.getAttribute('data-focus')
              : from === 'parent-focus'
                ? el.parentElement?.getAttribute('data-focus')
                : from === 'wrap-pt'
                  ? el.closest('[data-pt]')?.getAttribute('data-pt')
                  : el.textContent?.trim()
          return { name: `${pre} ${id ?? ''}`, l: r.left, t: r.top, r: r.right, b: r.bottom }
        })
        .filter((x) => x.r - x.l > 0 && x.b - x.t > 0),
    [selector, prefix, name] as const,
  )
}

const hit = (a: Box, b: Box): boolean => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5
const idOf = (b: Box): string => b.name.split(' ').slice(1).join(' ')

for (const seed of SEEDS) {
  test(`1024×640 ${seed}: цели ≥ 44×44, круги и звёзды не налезают, подписи и флажки не на точках, здания внутри поля`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`?seed=${seed}#/map`)
    await expect(page.locator('.field')).toBeVisible()
    await page.waitForTimeout(500)

    // Цели нажатия: каждая кнопка-точка и обе ссылки угла.
    const targets = [
      ...(await boxes(page, 'button.pt', 'точка', 'focus')),
      ...(await boxes(page, '.corner a, .corner .link', 'ссылка', 'text')),
    ]
    expect(targets.length).toBeGreaterThan(2)
    for (const x of targets) {
      expect(x.r - x.l, `${x.name}: ширина`).toBeGreaterThanOrEqual(MIN - 0.5)
      expect(x.b - x.t, `${x.name}: высота`).toBeGreaterThanOrEqual(MIN - 0.5)
    }

    // Что видно глазами: круги точек, звёзды под ними, подписи, флажки, значки мест, здания.
    const dots = await boxes(page, '.pt .dot', 'круг', 'wrap-pt')
    const stars = await boxes(page, '.st', 'звёзды', 'wrap-pt')
    const labels = await boxes(page, '.place b', 'подпись', 'text')
    const marks = await boxes(page, '.place i', 'значок места', 'text')
    expect(labels.length, 'подписи мест есть').toBeGreaterThan(0)
    expect(marks.length, 'значки мест есть').toBeGreaterThan(0)
    const flags = await boxes(page, 'button.flag', 'флажок', 'focus')
    const places = await boxes(page, 'button.bld, button.gate', 'место', 'text')

    // Круг × круг и звёзды × чужой круг (свой круг звёзды не трогают тоже).
    for (const a of dots) for (const b of dots) if (a !== b) expect(hit(a, b), `${a.name} налезает на ${b.name}`).toBe(false)
    for (const s of stars) for (const d of dots) expect(hit(s, d), `${s.name} лежат на объекте: ${d.name}`).toBe(false)
    for (const s of stars) for (const o of stars) if (s !== o) expect(hit(s, o), `${s.name} налезают на ${o.name}`).toBe(false)
    for (const l of labels) for (const d of [...dots, ...stars]) expect(hit(l, d), `${l.name} лежит на объекте: ${d.name}`).toBe(false)
    for (const f of flags) for (const d of [...dots, ...stars, ...marks]) expect(hit(f, d), `${f.name} лежит на объекте: ${d.name}`).toBe(false)
    for (const p of places) {
      for (const f of flags) expect(hit(p, f), `${p.name} закрывает ${f.name}`).toBe(false)
      for (const l of [...labels, ...marks]) expect(hit(p, l), `${p.name} закрывает ${l.name}`).toBe(false)
      for (const d of [...dots, ...stars]) expect(hit(p, d), `${p.name} лежит на объекте: ${d.name}`).toBe(false)
    }
    for (const f of flags) for (const g of flags) if (f !== g) expect(hit(f, g), `${f.name} налезает на ${g.name}`).toBe(false)

    // «Стадион», «Ворота» и остальные места — целиком внутри поля.
    const field = (await boxes(page, '.field', 'поле', 'text'))[0]!
    for (const p of [...places, ...flags, ...stars]) {
      expect(p.l, `${p.name}: левый край`).toBeGreaterThanOrEqual(field.l - 0.5)
      expect(p.r, `${p.name}: правый край`).toBeLessThanOrEqual(field.r + 0.5)
      expect(p.t, `${p.name}: верх`).toBeGreaterThanOrEqual(field.t - 0.5)
      expect(p.b, `${p.name}: низ`).toBeLessThanOrEqual(field.b + 0.5)
    }

    // Звёзды под точками крупнее прежних 8 px (ребёнок-критик, 019-Р41, Р48): не мельче 12 px.
    const small = await page.evaluate(() => [...document.querySelectorAll('.st')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12).length)
    expect(small, 'звёзд мельче 12 px').toBe(0)

    // Попадание: центр круга и точка в 3 px внутрь от края с четырёх сторон — своя кнопка; угол квадрата 44×44 — не она.
    const misses = await page.evaluate(
      ([min]) => {
        const bad: string[] = []
        for (const el of document.querySelectorAll<HTMLElement>('button.pt')) {
          const r = el.getBoundingClientRect()
          const cx = (r.left + r.right) / 2
          const cy = (r.top + r.bottom) / 2
          const rad = r.width / 2
          const owner = (x: number, y: number): boolean => document.elementFromPoint(x, y)?.closest('button.pt') === el
          const id = el.dataset.focus ?? ''
          const inside: [string, number, number][] = [
            ['центр', cx, cy],
            ['слева', cx - rad + 3, cy],
            ['справа', cx + rad - 3, cy],
            ['сверху', cx, cy - rad + 3],
            ['снизу', cx, cy + rad - 3],
          ]
          for (const [where, x, y] of inside) if (!owner(x, y)) bad.push(`${id}: ${where} круга — не своя кнопка`)
          const k = rad * 0.9
          if (owner(cx + k, cy + k) || owner(cx - k, cy - k)) bad.push(`${id}: угол квадрата ${min}×${min} ловит нажатие (область не круглая)`)
        }
        return bad
      },
      [MIN] as const,
    )
    expect(misses).toEqual([])
    expect(errors).toEqual([])
  })
}

test('1024×640: фокус и пульс помещаются в круг нажатия, фокус не похож на контрольную точку (019-Р48)', async ({ page }) => {
  // День 1: у текущей точки 1 самая крупная точка и кольцо фокуса; середина: контрольная точка среди пройденных.
  await page.goto('?seed=v2-day1#/map')
  await expect(page.locator('button.pt.current')).toBeVisible()
  await page.locator('button.pt.current').focus()
  const ring = await page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>('button.pt.current')!
    const dot = btn.querySelector<HTMLElement>('.dot')!
    const css = getComputedStyle(dot)
    const b = btn.getBoundingClientRect()
    const d = dot.getBoundingClientRect()
    // Радиус кольца: круг точки + зазор + толщина; пульс — тень до 4 px.
    const out = d.width / 2 + parseFloat(css.outlineOffset) + parseFloat(css.outlineWidth)
    const pulse = d.width / 2 + 4
    return { out, pulse, half: b.width / 2, style: css.outlineStyle, color: css.outlineColor }
  })
  expect(ring.style, 'у сфокусированной точки есть кольцо').toBe('solid')
  expect(ring.out, `кольцо ${ring.out} px не влезает в круг нажатия ${ring.half} px — его срежет clip-path`).toBeLessThanOrEqual(ring.half + 0.01)
  expect(ring.pulse, 'пульс не влезает в круг нажатия').toBeLessThanOrEqual(ring.half + 0.01)

  await page.goto('?seed=v2-mid#/map')
  const control = page.locator('button.pt.control').first()
  await expect(control).toBeVisible()
  const plain = page.locator('button.pt.passed:not(.control)').first()
  await plain.focus()
  const look = await page.evaluate(() => {
    const dotOf = (sel: string) => getComputedStyle(document.querySelector(sel + ' .dot')!)
    const f = dotOf('button.pt.passed:not(.control):focus-visible')
    const c = dotOf('button.pt.control')
    return {
      focus: { outline: f.outlineStyle, color: f.outlineColor, width: f.outlineWidth },
      control: { outline: c.outlineStyle, border: c.borderStyle, color: c.borderColor, width: c.borderWidth },
    }
  })
  expect(look.focus.outline).toBe('solid')
  expect(look.control.outline, 'контрольная точка не рисует кольцо-фокус').toBe('none')
  expect(look.control.border, 'контрольная — двойная рамка').toBe('double')
  expect(look.control.color, 'цвет рамки контрольной точки не цвет кольца фокуса').not.toBe(look.focus.color)
})

test('1024×640: подписи мест и звёзды названы по своим точкам (self-check хелпера)', async ({ page }) => {
  await page.goto('?seed=v2-end#/map')
  await expect(page.locator('.field')).toBeVisible()
  const stars = await boxes(page, '.st', 'звёзды', 'wrap-pt')
  const dots = await boxes(page, '.pt .dot', 'круг', 'wrap-pt')
  expect(stars.length).toBe(32)
  expect(new Set(stars.map(idOf)).size).toBe(32)
  expect(dots.length).toBeGreaterThanOrEqual(32)
})

test('1024×640: «Продолжить 2-й тайм» в карточке урока — в одну строку', async ({ page }) => {
  await page.goto('?seed=v2-mid#/map?focus=yard-17')
  const play = page.locator('#lesson-card-play')
  await expect(play).toBeVisible()
  await expect(play).toContainText(ru.map.card.resume.split(' ')[0]!)
  const box = await play.boundingBox()
  expect(box!.height, 'кнопка не выше одной строки').toBeLessThan(56)
  const overflow = await play.evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(overflow, 'надпись не вылезает за кнопку').toBeLessThanOrEqual(0)
})

test('1024×640: лист лиги — звёзды и одна строка про альбом, без «Скоро»', async ({ page }) => {
  await page.goto('?seed=v2-mid#/map?sheet=1')
  const dialog = page.locator('[role=dialog]')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(ru.map.sheet.later)
  await expect(dialog).not.toContainText(ru.map.lock.soon)
})

test('1024×640: правка клуба — видимая «Закрыть», окно ниже вкладок; Esc тоже закрывает', async ({ page }) => {
  await page.goto('?seed=v2-mid#/map?edit=1')
  const dialog = page.locator('[role=dialog]')
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(400)
  const tabs = await page.locator('header.topbar').boundingBox()
  const win = await dialog.boundingBox()
  expect(win!.y, 'окно не накрывает вкладки').toBeGreaterThanOrEqual(tabs!.y + tabs!.height)
  const close = dialog.getByRole('button', { name: ru.map.edit.close, exact: true })
  const cb = await close.boundingBox()
  expect(cb!.height).toBeGreaterThanOrEqual(MIN - 0.5)
  await close.click()
  await expect(dialog).toHaveCount(0)
  // Esc — тот же выход.
  await page.goto('?seed=v2-mid#/map?edit=1')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('1024×640: первый запуск, шаг города — 6–8 чипов, а не один', async ({ page }) => {
  await page.goto('?seed=v2-fresh#/start?at=city')
  const options = page.getByRole('option')
  await expect(options.first()).toBeVisible()
  const n = await options.count()
  expect(n).toBeGreaterThanOrEqual(6)
  expect(n).toBeLessThanOrEqual(8)
  // Набран готовый город — выбор остаётся виден.
  const city = clubs.cities[0]!
  await page.getByRole('combobox').fill(city)
  await expect(options.first()).toHaveText(city)
  expect(await options.count()).toBeGreaterThanOrEqual(6)
})

test('1024×640: кнопки шапки карты — «Путь клуба», «Клуб», «Лист лиги» не ниже 44 (019-Т15)', async ({ page }) => {
  await page.goto('?seed=v2-mid#/map')
  for (const name of [ru.map.header.path, ru.map.header.club, ru.map.header.sheet]) {
    const b = await page.locator('header.bar').getByRole('button', { name, exact: true }).boundingBox()
    expect(b, name).not.toBeNull()
    expect(b!.height, `высота «${name}»`).toBeGreaterThanOrEqual(MIN - 0.5)
  }
})

test('первый запуск: название выделено целиком — на входе и после Esc с шага города (019-Т15)', async ({ page }) => {
  await page.goto('?seed=v2-fresh#/start')
  await page.getByRole('button', { name: ru.firstRun.card.start }).click()
  const name = page.getByRole('textbox', { name: ru.clubForm.nameLabel })
  await expect(name).toBeFocused()
  const sel = (): Promise<number[]> => name.evaluate((el: HTMLInputElement) => [el.selectionStart!, el.selectionEnd!, el.value.length])
  const first = await sel()
  expect(first[2], 'предложенное название есть').toBeGreaterThan(0)
  expect([first[0], first[1]], 'выделено всё').toEqual([0, first[2]])
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(name).toBeFocused()
  const back = await sel()
  expect([back[0], back[1]], 'после Esc выделено всё').toEqual([0, back[2]])
})

/** Настоящий первый запуск (не образец `?at=`): карточка → название → шаг города с фокусом в поле. */
async function toCityStep(page: Page): Promise<void> {
  await page.goto('?seed=v2-fresh#/start')
  await page.getByRole('button', { name: ru.firstRun.card.start }).click()
  await page.getByRole('button', { name: ru.clubForm.next }).click()
  await expect(page.getByRole('combobox')).toBeFocused()
}

test('город: «Тверь» и один Enter завершают; «ndthm» + Enter подставляет Тверь и не завершает (019-Т15)', async ({ page }) => {
  await toCityStep(page)
  const city = page.getByRole('combobox')
  await city.fill('ndthm')
  await page.keyboard.press('Enter')
  await expect(city).toHaveValue('Тверь')
  expect(new URL(page.url()).hash, 'форма не завершена').toContain('/start')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/map/)
})

test('город: набрано «Тверь» — один Enter; «орел» (Е вместо Ё) — тоже один Enter (019-Т15)', async ({ page }) => {
  await toCityStep(page)
  await page.getByRole('combobox').fill('Тверь')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/map/)
  await page.evaluate(() => localStorage.clear())
  await toCityStep(page)
  await page.getByRole('combobox').fill('орел')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/map/)
  // В клуб легло написание из списка, а не набранное.
  await expect(page.locator('header.bar .city')).toContainText('Орёл')
})
