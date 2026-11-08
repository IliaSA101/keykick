/*
 * Игрока вкладки удалили в другой вкладке (спека 014-Р18, К4): первая вкладка уходит на «Кто играет?», ключ сохранения
 * удалённого игрока она больше не пишет. Вкладки — две страницы одного контекста (общий localStorage, у каждой свой
 * sessionStorage); событие `storage` приходит только во вторую страницу, поэтому список меняет другая страница.
 *
 * Какую поломку ловит, которую не ловят vitest: связку события storage, выбора вкладки и роутера в настоящем браузере.
 * Запуск — `npm run e2e`.
 */
import { expect, test } from '@playwright/test'
import { ru } from '../../src/i18n/ru'

test('игрока удалили в другой вкладке: вкладка уходит на «Кто играет?» и ничего не пишет за него', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto('?seed=v2-day1#/map')
  await expect(page.locator('[data-focus="yard-01"]')).toBeVisible()

  // Вторая страница (родитель): список без p1 — как после удаления; ключ p1 нарочно оставлен (копия «до» могла не лечь).
  const other = await context.newPage()
  await other.goto('./#/parent')
  const before = await other.evaluate(() => {
    const listKey = Object.keys(localStorage).find((k) => k.endsWith('players')) ?? ''
    const saveKey = Object.keys(localStorage).find((k) => k.endsWith('save.p1')) ?? ''
    localStorage.setItem(
      listKey,
      JSON.stringify({ players: [{ id: 'p2', name: 'Витя' }, { id: 'p3', name: 'Гоша' }], current: 'p2', lastId: 3 }),
    )
    return { saveKey, text: localStorage.getItem(saveKey) }
  })

  await expect(page.getByRole('heading', { name: ru.players.title })).toBeVisible()
  expect(new URL(page.url()).hash).toContain('/players')

  // Ключ p1 первая вкладка не тронула (ни при уходе с карты, ни позже).
  const after = await other.evaluate((k) => localStorage.getItem(k), before.saveKey)
  expect(after).toBe(before.text)
  expect(errors).toEqual([])
})

// Исключение роутера (`app/router.ts`, watch на tabPlayerRemoved): родитель сам правит список игроков, поэтому его
// страница при чужом удалении остаётся на месте, а не уходит на «Кто играет?». Ловит: убранное исключение parent.
test('игрока удалили в другой вкладке: страница родителя остаётся на месте и показывает новый список', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto('?seed=v2-day1#/map')
  await expect(page.locator('[data-focus="yard-01"]')).toBeVisible()
  // Прогрев ленивого экрана «Кто играет?»: иначе сборка его чанка могла бы оттянуть уход дальше паузы ниже,
  // и поломка исключения `parent` прошла бы незамеченной (ревью 014-Т7д).
  await page.evaluate(() => {
    location.hash = '#/players'
  })
  await expect(page.getByRole('heading', { name: ru.players.title })).toBeVisible()
  await page.evaluate(() => {
    location.hash = '#/parent'
  })
  await expect(page.getByRole('heading', { name: ru.parent.title })).toBeVisible()

  const other = await context.newPage()
  await other.goto('./#/parent')
  await other.evaluate(() => {
    const listKey = Object.keys(localStorage).find((k) => k.endsWith('players')) ?? ''
    localStorage.setItem(
      listKey,
      JSON.stringify({ players: [{ id: 'p2', name: 'Витя' }, { id: 'p3', name: 'Гоша' }], current: 'p2', lastId: 3 }),
    )
  })

  // Событие дошло: новый список виден на самой странице родителя. И она не ушла со своего места.
  await expect(page.getByText('Витя').first()).toBeVisible()
  // Уход роутера — отдельный асинхронный переход после обновления списка: даём ему время случиться, чтобы «не ушла» что-то значило.
  await page.waitForTimeout(500)
  expect(new URL(page.url()).hash).toContain('/parent')
  await expect(page.getByRole('heading', { name: ru.parent.title })).toBeVisible()
  expect(errors).toEqual([])
})
