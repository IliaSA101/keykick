/**
 * «Открой на компьютере» (059-В7, 063 Т12б): кому вместо игры показывать страницу «нужна клавиатура».
 * Чистое правило: DOM, `matchMedia` и окно здесь не читаются — факты приходят из `app/phone/device.ts`.
 *
 * Игра нужна с клавиатурой, а телефон и планшет её не дают. Признаки «это сенсорное устройство без клавиатуры»:
 *  - основной указатель грубый (`pointer: coarse`) — палец;
 *  - среди подключённых нет ни точного указателя, ни указателя с наведением (`any-pointer: fine`, `any-hover: hover`):
 *    планшет с клавиатурой и трекпадом (iPad Magic Keyboard) и ноутбук с сенсорным экраном мышь или трекпад имеют;
 *  - окно уже 1024 (`PHONE_BELOW`): планшет в «альбомной» ориентации (≥ 1024) и узкое окно на компьютере — в игру.
 * Все три условия сразу; хоть одно не выполнено — игра.
 */

/** Окно уже этой ширины (CSS px) — «не компьютер»; ровно 1024 — игра (ширина сцены, `stageScale`). */
export const PHONE_BELOW = 1024;

export interface DeviceFacts {
  /** `matchMedia('(pointer: coarse)')` — основной указатель грубый. */
  coarse: boolean;
  /** `matchMedia('(any-pointer: fine)')` — среди указателей есть точный (мышь, трекпад, стилус). */
  anyFine: boolean;
  /** `matchMedia('(any-hover: hover)')` — среди указателей есть тот, что умеет наводиться. */
  anyHover: boolean;
  /** Ширина окна, CSS px. */
  width: number;
}

/** Экран «Открой на компьютере» вместо игры? */
export function isPhone(f: DeviceFacts): boolean {
  return f.coarse && !f.anyFine && !f.anyHover && f.width < PHONE_BELOW;
}

/** Адрес страницы крупно: «iliasa101.github.io/keykick» — без схемы, хвостового слеша, `index.html` и хэша. */
export function pageAddress(loc: { host: string; pathname: string }): string {
  const path = loc.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
  return `${loc.host}${path}`;
}
