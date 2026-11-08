/**
 * Окружение карты (спека 019-Т8): какие листы и окна открываются адресом в dev-сборке (кадры) и когда клубу нужна
 * правка. Чистые функции без Vue — экран только применяет ответ.
 */

/** Что лежит поверх карты: лист лиги, «Что нового», правка клуба. */
export type Overlay = 'sheet' | 'news' | 'edit';

const OVERLAYS: readonly Overlay[] = ['sheet', 'news', 'edit'];

/**
 * Окно из адреса `#/map?sheet=1|news=1|edit=1`. Лист и «Что нового» — быстрые проверки и кадры, только в dev-сборке.
 * Правка клуба (`edit`) открывается и в выпуске: так её открывает пункт «Клуб» верхнего меню (019-Т11д).
 * Если указаны несколько — первое по порядку «лист, новости, правка».
 */
export function overlayFromQuery(query: Readonly<Record<string, unknown>>, dev: boolean): Overlay | null {
  return OVERLAYS.find((k) => query[k] !== undefined && (dev || k === 'edit')) ?? null;
}

/** Адрес карты с открытой правкой клуба (пункт меню «Клуб»). */
export const EDIT_QUERY = { edit: '1' } as const;

/** Клубу нужна правка: нет названия или города (порча при живом клубе — «Исправить» вместо «Клуб»). */
export const clubNeedsFix = (c: { name: string; city: string }): boolean => c.name.trim() === '' || c.city.trim() === '';
