// Общее для оснастки проверки: системный Chrome и порты стендов.
// Браузер не качаем: Playwright берёт установленный Chrome (channel: 'chrome').
import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'

/** Порты стендов оснастки (5174 — владельца, 5175+ — оркестратора). */
export const PORTS = { e2e: 5290, shots: 5291, smoke: 5292 }

/** Запускает системный Chrome. Нет Chrome — понятная ошибка, ничего не скачиваем. */
export async function launchChrome() {
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch (e) {
    throw new Error(`нет системного Chrome (${e instanceof Error ? e.message.split('\n')[0] : e})`)
  }
}

/** Поднимает свой vite на порту; ждёт ответа /keykick/; stop() гасит только свой процесс. */
export async function startVite(port) {
  const url = `http://localhost:${port}/keykick/`
  if (await answers(url)) throw new Error(`порт ${port} занят`)
  // Своя группа процессов: npx запускает vite внуком, и без группы SIGTERM оставлял сервер жить после выхода.
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true })
  const stop = () => {
    if (child.exitCode !== null) return
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`vite не запустился на порту ${port}`)
    if (await answers(url)) return stop
    await new Promise((r) => setTimeout(r, 200))
  }
  stop()
  throw new Error(`vite не ответил на порту ${port}`)
}

async function answers(url) {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}
