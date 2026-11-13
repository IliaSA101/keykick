import { defineConfig } from '@playwright/test'

// Сквозные проверки в настоящем Chrome (спека 015). Не входят в `npm run check`: запуск — `npm run e2e`.
// Свой dev-сервер на порту оснастки поднимает и гасит сам раннер; порт владельца (5174) не трогаем.
const PORT = 5290 // то же значение — PORTS.e2e в tools/lib/chrome.mjs

export default defineConfig({
  testDir: 'tests/e2e',
  // Только от зависания: бюджет сценария (30 с) смотрим по напечатанному времени, не порогом.
  timeout: 60_000,
  workers: 1,
  retries: 0,
  // забытый test.only молча выключил бы остальные сценарии — падаем всегда, не только в CI (web-frontend, 14.11)
  forbidOnly: true,
  reporter: 'list',
  use: {
    channel: 'chrome',
    baseURL: `http://localhost:${PORT}/keykick/`,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/keykick/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
