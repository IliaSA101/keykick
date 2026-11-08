/*
 * F5 посреди матча (спека 017-Р4, К16): перерыв пишет «ожидающий 2-й тайм» в сохранение, и перезагрузка возвращает
 * на перерыв, а не в вступление.
 *
 * Какую поломку ловит, которую не ловят vitest: связку страницы с хранилищем в настоящем браузере — страница матча
 * пишет не в память (тогда после F5 было бы вступление и потерянный 1-й тайм), `beforeunload` не мешает перезагрузке,
 * 1-й тайм не требуется печатать заново. Сохранение лежит в `localStorage` и переживает `reload`.
 * Профиль — сид `v2-day1` (клуб есть, уроков не пройдено); сид задаётся один раз, потом адрес без `seed`
 * (иначе перезагрузка снова стёрла бы прогресс). Запуск — `npm run e2e`.
 */
import { expect, test } from '@playwright/test'
import { stage, typeChar } from './typing'
import { ru } from '../../src/i18n/ru'

test('F5 на перерыве возвращает на перерыв, 1-й тайм не теряется', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const cdp = await page.context().newCDPSession(page)
  // Хромовый диалог «покинуть страницу?» на печати тоже не должен останавливать тест.
  page.on('dialog', (d) => void d.accept())

  await page.goto('?seed=v2-day1#/map')
  await expect(page.locator('[data-focus="yard-01"]')).toBeVisible()
  await page.goto('./#/match?lesson=yard-01')
  await expect(page.locator('.intro')).toBeVisible()

  // До перерыва: вступление → разминка → 1-й тайм (печатаем без ошибок).
  await expect
    .poll(
      async () => {
        const s = await stage(page)
        if (s === 'break') return true
        if (s === 'intro') await page.keyboard.press('Space')
        if (s === 'typing') {
          const text = await page.locator('.typing .line').getAttribute('aria-label')
          for (const ch of text ?? '') await typeChar(cdp, ch)
        }
        return false
      },
      { timeout: 40_000, intervals: [50] },
    )
    .toBe(true)

  // F5: тот же адрес, перерыв на месте (не вступление), клавиатуры печати нет.
  await page.reload()
  await expect(page.locator('.break')).toBeVisible()
  await expect(page.locator('.intro')).toHaveCount(0)
  expect(new URL(page.url()).hash).toContain('lesson=yard-01')

  // Ещё одна перезагрузка на перерыве — снова перерыв (запись не съедена первым чтением).
  await page.reload()
  await expect(page.locator('.break')).toBeVisible()

  expect(errors).toEqual([])
})

test('пауза: Tab не выходит из окна, Esc возвращает; «Выйти» ведёт на карту, меню на матче нет (017-Т9д)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('dialog', (d) => void d.accept())

  await page.goto('?seed=v2-day1#/map')
  await expect(page.locator('[data-focus="yard-01"]')).toBeVisible()
  await page.goto('./#/match?lesson=yard-01')
  await expect(page.locator('.intro')).toBeVisible()
  // Верхнего меню на странице матча нет (017-Р42): «Карта» не бросает тайм молча.
  await expect(page.locator('header.topbar')).toHaveCount(0)
  await page.keyboard.press('Space')
  await expect(page.locator('.typing')).toBeVisible()

  const dialog = page.getByRole('dialog')
  const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))

  // Пауза: фокус на «Продолжить»; сколько ни жми Tab и Shift+Tab — фокус в окне.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key)
    expect(await inside()).toBe(true)
  }

  // Esc закрывает паузу, второй Esc снова открывает; «Выйти» — на карту, матч брошен.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: ru.match2.pause.quit }).click()
  await expect(page.locator('[data-focus="yard-01"]')).toBeVisible()
  expect(new URL(page.url()).hash).toBe('#/map')
  expect(errors).toEqual([])
})

test('F5 во 2-м тайме: «Продолжить 2-й тайм (a:b)» со счётом, соперник тот же (017-Т9д)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const cdp = await page.context().newCDPSession(page)
  page.on('dialog', (d) => void d.accept())

  await page.goto('?seed=v2-day1#/map')
  await expect(page.locator('[data-focus="yard-01"]')).toBeVisible()
  await page.goto('./#/match?lesson=yard-01')
  await expect(page.locator('.intro')).toBeVisible()
  const rival = async () => (await page.locator('.break .teams').textContent()) ?? ''

  // До перерыва, потом Enter — второй тайм, одно верное нажатие (запись «2-й тайм начат») и F5.
  await expect
    .poll(
      async () => {
        const s = await stage(page)
        if (s === 'break') return true
        if (s === 'intro') await page.keyboard.press('Space')
        if (s === 'typing') {
          const text = await page.locator('.typing .line').getAttribute('aria-label')
          for (const ch of text ?? '') await typeChar(cdp, ch)
        }
        return false
      },
      { timeout: 40_000, intervals: [50] },
    )
    .toBe(true)
  const team = await rival()
  // Enter сразу после входа в перерыв глушится (017-Р27) — жмём, пока не пройдёт.
  await expect
    .poll(
      async () => {
        if ((await stage(page)) === 'break') await page.keyboard.press('Enter')
        return stage(page)
      },
      { timeout: 10_000, intervals: [200] },
    )
    .toBe('typing')
  const text = await page.locator('.typing .line').getAttribute('aria-label')
  await typeChar(cdp, (text ?? ' ')[0] ?? ' ')

  await page.reload()
  await expect(page.locator('.break')).toBeVisible()
  await expect(page.locator('.break .go button')).toHaveText(/^Продолжить 2-й тайм \(\d+:\d+\)$/)
  expect(await rival()).toBe(team)
  await page.reload()
  expect(await rival()).toBe(team)
  expect(errors).toEqual([])
})

test('F5 на итоге поражения (до «Переиграть тайм»): перерыв «Продолжить 2-й тайм (a:b)», выигранный 1-й тайм цел (017-Т9в)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const cdp = await page.context().newCDPSession(page)
  page.on('dialog', (d) => void d.accept())

  // Сид `v2-mid`: урок yard-17, перерыв с выигранным 1-м таймом 1:0. Второй тайм проигрываем: в каждой строке
  // после первого верного знака — шесть неверных (пять ошибок атаки — гол соперника), потом строка допечатывается.
  await page.goto('?seed=v2-mid#/map')
  await expect(page.locator('[data-focus="yard-17"]')).toBeVisible()
  await page.goto('./#/match?lesson=yard-17')
  await expect(page.locator('.break')).toBeVisible()
  await expect(page.locator('.break .go button')).toHaveText('Второй тайм')
  await expect
    .poll(
      async () => {
        const s = await stage(page)
        if (s === 'result') return true
        if (s === 'break') await page.keyboard.press('Enter')
        if (s === 'kick') await page.getByRole('button', { name: ru.match2.kick.skip }).click()
        if (s === 'typing') {
          const text = (await page.locator('.typing .line').getAttribute('aria-label')) ?? ''
          await typeChar(cdp, text[0] ?? ' ')
          for (let i = 0; i < 6; i++) await typeChar(cdp, text[0] === 'ъ' ? 'ы' : 'ъ')
          for (const ch of text.slice(1)) await typeChar(cdp, ch)
        }
        return false
      },
      { timeout: 50_000, intervals: [50] },
    )
    .toBe(true)
  await expect(page.locator('.result-card')).toHaveAttribute('data-kind', 'loss')
  await expect(page.getByRole('button', { name: ru.match2Result.offers.replay2 })).toBeVisible()

  // F5 до нажатия «Переиграть тайм»: тот же перерыв со счётом выигранного 1-го тайма.
  await page.reload()
  await expect(page.locator('.break')).toBeVisible()
  await expect(page.locator('.intro')).toHaveCount(0)
  await expect(page.locator('.break .go button')).toHaveText('Продолжить 2-й тайм (1:0)')
  expect(errors).toEqual([])
})

test('победа во 2-м тайме после F5 на перерыве: F5 на итоге — урок засчитан, «Продолжить» нет (017-Т9ж)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const cdp = await page.context().newCDPSession(page)
  page.on('dialog', (d) => void d.accept())

  // Сид `v2-mid`: урок yard-17, перерыв (1:0). F5 на перерыве, затем «Второй тайм» и чистая печать до итога победы.
  await page.goto('?seed=v2-mid#/map')
  await expect(page.locator('[data-focus="yard-17"]')).toBeVisible()
  await page.goto('./#/match?lesson=yard-17')
  await expect(page.locator('.break')).toBeVisible()
  await page.reload()
  await expect(page.locator('.break')).toBeVisible()
  await expect(page.locator('.break .go button')).toHaveText('Второй тайм')
  await expect
    .poll(
      async () => {
        const s = await stage(page)
        if (s === 'result') return true
        if (s === 'break') await page.keyboard.press('Enter')
        if (s === 'kick') await page.getByRole('button', { name: ru.match2.kick.skip }).click()
        if (s === 'typing') {
          const text = (await page.locator('.typing .line').getAttribute('aria-label')) ?? ''
          for (const ch of text) await typeChar(cdp, ch)
        }
        return false
      },
      { timeout: 50_000, intervals: [50] },
    )
    .toBe(true)
  await expect(page.locator('.result-card')).toHaveAttribute('data-kind', 'win')
  // Что лежит в сохранении игрока p1: урок засчитан, ожидающего 2-го тайма нет.
  const saved = () =>
    page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.endsWith('.p1'))
      const raw: string = (key === undefined ? null : localStorage.getItem(key)) ?? '{}'
      const sections = (JSON.parse(raw) as { sections?: Record<string, unknown> }).sections ?? {}
      const course = sections.course as { passed: string[]; lessons: Record<string, { stars: number }> }
      const match = sections.match as { half2: unknown }
      return { passed: course.passed.includes('yard-17'), stars: course.lessons['yard-17']?.stars ?? 0, half2: match.half2 }
    })
  expect(await saved()).toMatchObject({ passed: true, half2: null })

  // F5 до «Дальше»: на итоге ничего не потеряно — вступление нового матча, не «Продолжить 2-й тайм».
  await page.reload()
  await expect(page.locator('.intro')).toBeVisible()
  await expect(page.getByRole('button', { name: /Продолжить 2-й тайм/ })).toHaveCount(0)
  expect(await saved()).toMatchObject({ passed: true, half2: null })
  expect(errors).toEqual([])
})

// Esc — «Пауза» на каждой фазе матча (ТЗ-0.16, 017-Р54): итог, перерыв и пенальти тоже. Витрина `?at=` — dev-сервер.
const PAUSE_PLACES = [
  { name: 'итог', at: 'win', ready: '.result-card', focus: '.result-card button' },
  { name: 'перерыв', at: 'break', ready: '.break', focus: null },
  { name: 'пенальти', at: 'kick', ready: '.kick', focus: '.answer input' },
] as const

for (const place of PAUSE_PLACES) {
  test(`Esc на «${place.name}»: пауза, Enter — назад на то же место и фокус, «Выйти» — на карту (017-Р54)`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    const dialog = page.getByRole('dialog')
    // Что в фокусе: тег, id и подпись — чтобы сравнить до и после паузы.
    const focused = () =>
      page.evaluate(() => {
        const a = document.activeElement
        return a ? `${a.tagName}:${a.id}:${a.textContent?.trim().slice(0, 30) ?? ''}` : ''
      })

    await page.goto(`?seed=v2-mid#/match?at=${place.at}&lesson=yard-05`)
    await expect(page.locator(place.ready).first()).toBeVisible()
    // Итог берёт фокус через 600 мс (017-Р27), перерыв не слушает Enter первые мгновения.
    await page.waitForTimeout(1200)
    if (place.focus) await expect(page.locator(place.focus).first()).toBeFocused()
    if (place.name === 'пенальти') await page.locator(place.focus).fill('42')
    const before = await focused()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(1)
    await expect(dialog).toContainText(ru.match2.pause.title)
    // Окно одно: ещё один Esc закрывает его, а не открывает второе.
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(1)

    // Enter — назад: то же место, фокус там же, ответ на листе цел; итог и перерыв Enter не «проглотили».
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(page.locator(place.ready).first()).toBeVisible()
    expect(await focused()).toBe(before)
    if (place.name === 'пенальти') await expect(page.locator(place.focus)).toHaveValue('42')
    expect(new URL(page.url()).hash).toContain('/match')

    // «Выйти» — на карту, как F5.
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: ru.match2.pause.quit }).click()
    await expect(page).toHaveURL(/#\/map/)
    expect(errors).toEqual([])
  })
}
