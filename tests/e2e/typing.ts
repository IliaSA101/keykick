/*
 * Общие помощники e2e матча: знаки идут через CDP Input.dispatchKeyEvent (у русской буквы нужны и `key`, и `code`
 * клавиши — keyboard.press их не даёт); где матч сейчас — по тому, что видно на экране.
 */
import { readFileSync } from 'node:fs'
import type { CDPSession, Page } from '@playwright/test'

// Раскладка — тот же файл, что читает игра (запуск из корня проекта).
const keyboard = JSON.parse(readFileSync('src/content/keyboard.json', 'utf8')) as { rows: KeyDef[][] }

interface KeyDef {
  code?: string
  ru?: string[]
  en?: string[]
}

/** Знак → код клавиши и нужен ли Shift (русская раскладка, затем английская). */
function keyFor(ch: string): { code: string; shift: boolean } {
  const keys = keyboard.rows.flat()
  for (const layout of ['ru', 'en'] as const) {
    for (const k of keys) {
      const i = k[layout]?.indexOf(ch) ?? -1
      if (k.code && i >= 0) return { code: k.code, shift: i === 1 }
    }
  }
  throw new Error(`нет клавиши для знака ${JSON.stringify(ch)}`)
}

export async function typeChar(cdp: CDPSession, ch: string): Promise<void> {
  const { code, shift } = keyFor(ch)
  const base = { key: ch, code, modifiers: shift ? 8 : 0 }
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, ...base })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
}

export type Stage = 'result' | 'intro' | 'break' | 'kick' | 'typing' | 'busy'

/** Где матч сейчас — по тому, что видно на экране. */
export async function stage(page: Page): Promise<Stage> {
  if (await page.locator('.result-card').isVisible()) return 'result'
  if (await page.locator('.intro').isVisible()) return 'intro'
  if (await page.locator('.break').isVisible()) return 'break'
  if (await page.locator('.kick').isVisible()) return 'kick'
  // Строка принимает печать, когда она не приглушена и ещё ничего не набрано.
  const fresh = (await page.locator('.typing:not(.waiting) .line').count()) > 0
  if (fresh && (await page.locator('.typing .line .cell.done').count()) === 0) return 'typing'
  return 'busy'
}
