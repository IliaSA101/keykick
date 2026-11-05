/**
 * Статистика для экрана ребёнка: только чтение сохранения, без часов и случайности.
 */
import type { Keymap, Layout } from './keymap';

export interface WeakKey {
  code: string;
  /**
   * Символ клавиши в раскладке урока (буква — заглавной), у служебной — её подпись.
   * Пробел так и остаётся « »: слово для него берёт экран из ru.ts.
   */
  label: string;
  errors: number;
}

/** Самые трудные клавиши: больше ошибок — раньше; при равенстве — по коду, чтобы порядок не прыгал. */
export function weakKeys(
  keyErrors: Readonly<Record<string, number>>,
  map: Keymap,
  layout: Layout,
  limit = 5,
): WeakKey[] {
  return Object.entries(keyErrors)
    .filter(([, n]) => n > 0)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, limit)
    .map(([code, errors]) => {
      const key = map.byCode.get(code);
      const ch = key?.chars?.[layout][0];
      return { code, errors, label: ch ? ch.toUpperCase() : (key?.label ?? code) };
    });
}
