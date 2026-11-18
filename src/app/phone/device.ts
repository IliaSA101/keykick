/**
 * Факты об устройстве для правила `engine/phone/rule.ts` (063 Т12б): читаем `matchMedia` и окно, правило решает само.
 * Нет `matchMedia` (старый браузер, тест без окна) — «не телефон»: лучше пустить в игру, чем закрыть её зря.
 * Ничего не пишет: ни хранилище, ни сеанс.
 */
import { isPhone, pageAddress, type DeviceFacts } from '../../engine/phone/rule';

export type DeviceEnv = Pick<typeof globalThis, 'matchMedia' | 'innerWidth' | 'addEventListener' | 'removeEventListener' | 'location'>;

const QUERIES = ['(pointer: coarse)', '(any-pointer: fine)', '(any-hover: hover)'] as const;

const matches = (win: DeviceEnv, q: string): boolean => typeof win.matchMedia === 'function' && win.matchMedia(q).matches;

export function readFacts(win: DeviceEnv = globalThis): DeviceFacts {
  return {
    coarse: matches(win, QUERIES[0]),
    anyFine: matches(win, QUERIES[1]),
    anyHover: matches(win, QUERIES[2]),
    width: win.innerWidth,
  };
}

/** Сейчас экран «Открой на компьютере»? Спрашивают охрана входа и `main.ts`. */
export const phoneNow = (win: DeviceEnv = globalThis): boolean => isPhone(readFacts(win));

/** Адрес этой страницы крупно (без хэша). */
export const addressNow = (win: DeviceEnv = globalThis): string => pageAddress(win.location);

/**
 * Следит за устройством: `onChange(phone)` — когда ответ «телефон?» сменился (поворот планшета, подключили мышь или
 * клавиатуру, окно растянули). Возвращает отписку.
 */
export function watchPhone(onChange: (phone: boolean) => void, win: DeviceEnv = globalThis): () => void {
  let last = phoneNow(win);
  const check = (): void => {
    const now = phoneNow(win);
    if (now !== last) {
      last = now;
      onChange(now);
    }
  };
  const lists = typeof win.matchMedia === 'function' ? QUERIES.map((q) => win.matchMedia(q)) : [];
  win.addEventListener('resize', check);
  win.addEventListener('orientationchange', check);
  for (const l of lists) l.addEventListener('change', check);
  return () => {
    win.removeEventListener('resize', check);
    win.removeEventListener('orientationchange', check);
    for (const l of lists) l.removeEventListener('change', check);
  };
}
