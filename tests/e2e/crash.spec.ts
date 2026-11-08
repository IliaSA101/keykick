/*
 * Экран сбоя (спека 014-Т7, замечание тестировщик 08.11): «На главную» уводит на `#/` и при строке запроса в адресе
 * (`?utm=`, `?seed=`) — раньше reload сразу за assign перебивал переход, и ребёнок оставался на сломанной странице.
 * Ловит то, чего не ловит vitest: настоящую навигацию браузера. Сбой — dev-кнопкой «Сломать» на `#/parent`.
 */
import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1024, height: 640 } })

for (const query of ['', '?y=1']) {
  test(`«На главную» с экрана сбоя уводит на #/ (адрес ${query || 'без запроса'})`, async ({ page }) => {
    await page.goto(`${query}#/parent`)
    await page.getByRole('button', { name: 'Сломать' }).click()
    const screen = page.getByRole('alertdialog')
    await expect(screen).toBeVisible()
    await expect(screen.getByRole('button', { name: 'На главную' })).toBeFocused()
    await screen.getByRole('button', { name: 'На главную' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })
}
