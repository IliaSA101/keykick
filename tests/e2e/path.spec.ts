/*
 * Сквозной путь нового игрока (спека 019, К7): чистый профиль → первый запуск (карточка, клуб, город) → карта →
 * урок 1 → матч печатью до конца → итог → «Дальше» → карта.
 *
 * Какую поломку ловит, которую не ловят vitest: переходы между экранами и ввод в настоящем браузере — охрана
 * роутера (без клуба любой адрес игры уводит на `/start`, урок «впереди» — на карту), верхнее меню скрыто на `/start`
 * и есть на карте, клавиши доходят до окна матча, строка печати меняется после последнего знака, итог открывается
 * и «Дальше» приводит на карту. Лимит «≤ 6 экранов до игры» проверяет `club.test` (шаги + `FIRST_RUN_EXTRA`), не этот сценарий.
 * Движок (правила печати, очки, сохранение) проверяют тесты vitest; здесь они не дублируются.
 *
 * После матча итог лежит в сохранении (017-Т8): на карте под точкой 1 — звёзды (`.passed`), текущий урок — второй.
 *
 * Знаки берутся из видимой строки (aria-label строки печати), без пауз по таймеру; клавиши — `./typing`.
 * Выпуск тоже играет матч (`/match`); витрина `?at=` — только dev-сервер. Запуск — `npm run e2e`.
 */
import { expect, test, type Page } from '@playwright/test'
import { stage, typeChar } from './typing'
import { ru } from '../../src/i18n/ru'

const step = (page: Page, name: 'card' | 'club' | 'city') => page.locator(`main.start[data-step="${name}"]`)

test('новый игрок: первый запуск, карта, урок 1, матч до итога, карта', async ({ page }) => {
  const started = Date.now()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const cdp = await page.context().newCDPSession(page)

  // Чистый профиль: любой адрес игры ведёт на первый запуск, верхнего меню там нет.
  await page.goto('./#/path')
  await expect(step(page, 'card')).toBeVisible()
  expect(new URL(page.url()).hash).toBe('#/start')
  await expect(page.locator('header.topbar')).toHaveCount(0)
  await page.goto('./#/')
  await expect(step(page, 'card')).toBeVisible()
  await page.goto('./#/match?lesson=yard-01')
  await expect(step(page, 'card')).toBeVisible()

  // Карточка → название (готовое) → город → «Готово».
  await page.getByRole('button', { name: ru.firstRun.card.start }).click()
  await expect(step(page, 'club')).toBeVisible()
  // Предложенное название выделено целиком: свои буквы встают поверх, а не после «Прибоя» (019-Т15).
  const clubName = page.getByRole('textbox', { name: ru.clubForm.nameLabel })
  await expect(clubName).toBeFocused()
  await page.keyboard.type('Гром')
  await expect(clubName).toHaveValue('Гром')
  await page.getByRole('button', { name: ru.clubForm.next }).click()
  await expect(step(page, 'city')).toBeVisible()
  await page.getByRole('combobox', { name: ru.clubForm.cityLabel }).fill('Тверь')
  await page.getByRole('button', { name: ru.clubForm.done }).click()

  // Карта: меню v2 на месте, точка 1 — текущая.
  await expect(page.locator('[data-focus="yard-01"]')).toHaveAttribute('aria-current', 'step')
  expect(new URL(page.url()).hash).toBe('#/map')
  const nav = page.locator('header.topbar nav')
  for (const name of [ru.nav.map, ru.nav.path, ru.nav.club]) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  // С клубом урок «впереди» адресом не открывается — карта.
  await page.goto('./#/match?lesson=yard-30')
  await expect(page.locator('[data-focus="yard-01"]')).toBeVisible()
  expect(new URL(page.url()).hash).toBe('#/map')

  // Играть: карточка точки 1 → матч урока 1 (вступление).
  await page.getByRole('button', { name: ru.map.card.play, exact: true }).click()
  await expect(page.locator('.intro')).toBeVisible()
  expect(new URL(page.url()).hash).toContain('lesson=yard-01')

  // Разминка и два тайма: печатаем то, что показано; лишние слои проходим клавишами и кнопками.
  await expect
    .poll(
      async () => {
        const s = await stage(page)
        if (s === 'result') return true
        if (s === 'intro') await page.keyboard.press('Space')
        if (s === 'break') await page.keyboard.press('Enter')
        if (s === 'kick') await page.getByRole('button', { name: ru.match2.kick.skip }).click()
        if (s === 'typing') {
          const text = await page.locator('.typing .line').getAttribute('aria-label')
          for (const ch of text ?? '') await typeChar(cdp, ch)
        }
        return false
      },
      { timeout: 50_000, intervals: [50] },
    )
    .toBe(true)

  // Итог: печатали без ошибок — матч не проигран; «Дальше» ведёт на карту (шагов цепочки пока нет).
  await expect(page.locator('.result-card')).not.toHaveAttribute('data-kind', 'loss')
  await page.getByRole('button', { name: ru.match2Result.next }).click()
  await expect(page.locator('[data-focus="yard-01"]')).toBeVisible()
  expect(new URL(page.url()).hash).toBe('#/map')
  // Итог в сохранении: урок 1 пройден со звёздами, текущий — урок 2.
  await expect(page.locator('[data-focus="yard-01"]')).toHaveClass(/passed/)
  await expect(page.locator('[data-pt="yard-01"] .st')).not.toBeEmpty()
  await expect(page.locator('[data-focus="yard-02"]')).toHaveClass(/current/)
  await expect(page.locator('[data-focus="yard-02"]')).toHaveAttribute('aria-current', 'step')

  expect(errors).toEqual([])
  console.log(`сценарий: ${((Date.now() - started) / 1000).toFixed(1)} с (бюджет 30 с)`)
})
