/**
 * «Открой на компьютере» (059-В7, 063 Т12б, К14): правило «телефон без клавиатуры», чтение фактов, адрес страницы.
 * У каждого теста строка «Ловит:».
 */
import { describe, expect, it, vi } from 'vitest';
import { phoneNow, readFacts, watchPhone, type DeviceEnv } from '../../src/app/phone/device';
import { isPhone, pageAddress, PHONE_BELOW, type DeviceFacts } from '../../src/engine/phone/rule';

const facts = (over: Partial<DeviceFacts> = {}): DeviceFacts => ({ coarse: true, anyFine: false, anyHover: false, width: 390, ...over });

describe('правило «телефон без клавиатуры» (К14)', () => {
  it('К14: таблица краёв — кого пускать в игру, кого на «Открой на компьютере»', () => {
    // Ловит: ноутбук с сенсорным экраном или планшет с клавиатурой отрезаны от игры; телефон и планшет без клавиатуры в неё попадают.
    const table: [string, Partial<DeviceFacts>, boolean][] = [
      ['телефон 390', {}, true],
      ['телефон в «альбомной» ориентации 844', { width: 844 }, true],
      ['планшет 820 без клавиатуры', { width: 820 }, true],
      ['планшет в «альбомной» ориентации 1180 — окно не уже 1024', { width: 1180 }, false],
      ['ровно 1024 — игра', { width: PHONE_BELOW }, false],
      ['1023 — ещё «уже»', { width: PHONE_BELOW - 1 }, true],
      ['планшет с клавиатурой и трекпадом (any-pointer: fine)', { width: 820, anyFine: true }, false],
      ['планшет с мышью, умеющей наводиться (any-hover)', { width: 820, anyHover: true }, false],
      ['ноутбук с сенсорным экраном: основной указатель точный', { coarse: false, anyFine: true, anyHover: true, width: 1366 }, false],
      ['сенсорный ноутбук в узком окне — основной указатель точный, пускаем', { coarse: false, anyFine: true, anyHover: true, width: 700 }, false],
      ['узкое окно на компьютере с мышью', { coarse: false, anyFine: true, anyHover: true, width: 600 }, false],
      ['мышь без признаков наведения и не грубый указатель', { coarse: false, width: 600 }, false],
    ];
    for (const [name, over, phone] of table) expect(isPhone(facts(over)), name).toBe(phone);
  });
});

describe('адрес страницы (К14)', () => {
  it('К14: без схемы, слеша, index.html и хэша; /next/ и локальный порт сохраняются', () => {
    // Ловит: на экране крупно «https://…/», с хвостовым слешем или с `index.html` — адрес, который родитель не наберёт.
    expect(pageAddress({ host: 'iliasa101.github.io', pathname: '/keykick/' })).toBe('iliasa101.github.io/keykick');
    expect(pageAddress({ host: 'iliasa101.github.io', pathname: '/keykick/next/' })).toBe('iliasa101.github.io/keykick/next');
    expect(pageAddress({ host: 'iliasa101.github.io', pathname: '/keykick/index.html' })).toBe('iliasa101.github.io/keykick');
    expect(pageAddress({ host: 'localhost:5200', pathname: '/' })).toBe('localhost:5200');
  });
});

/** Окно-двойник: что вернёт `matchMedia` по запросу, какая ширина; события — вручную. */
function fakeWin(media: Record<string, boolean>, width: number) {
  const handlers = new Map<string, (() => void)[]>();
  const on = (name: string, h: () => void): void => void handlers.set(name, [...(handlers.get(name) ?? []), h]);
  const win = {
    innerWidth: width,
    location: { host: 'h', pathname: '/' },
    matchMedia: (q: string) => ({ matches: media[q] === true, addEventListener: (_: string, h: () => void) => on(`mq ${q}`, h), removeEventListener: vi.fn() }),
    addEventListener: (n: string, h: () => void) => on(n, h),
    removeEventListener: vi.fn(),
  } as unknown as DeviceEnv;
  const fire = (name: string): void => handlers.get(name)?.forEach((h) => h());
  return { win, fire, set: (w: number) => void ((win as { innerWidth: number }).innerWidth = w), media };
}

describe('чтение фактов (К14)', () => {
  it('К14: matchMedia и ширина окна читаются как есть; без matchMedia — не телефон', () => {
    // Ловит: перепутанные запросы (any-pointer вместо pointer) и закрытая игра на браузере без `matchMedia`.
    const { win } = fakeWin({ '(pointer: coarse)': true }, 390);
    expect(readFacts(win)).toEqual({ coarse: true, anyFine: false, anyHover: false, width: 390 });
    expect(phoneNow(win)).toBe(true);
    expect(phoneNow({ innerWidth: 390 } as unknown as DeviceEnv)).toBe(false);
  });

  it('К14: поворот планшета и подключённая мышь зовут onChange один раз на смену ответа; отписка снимает слушателей', () => {
    // Ловит: вкладка остаётся на «Открой на компьютере» после поворота планшета в 1180 или не возвращается на неё при повороте назад.
    const env = fakeWin({ '(pointer: coarse)': true }, 820);
    const seen: boolean[] = [];
    const stop = watchPhone((p) => seen.push(p), env.win);
    env.fire('resize');
    expect(seen).toEqual([]);
    env.set(1180);
    env.fire('orientationchange');
    env.fire('resize');
    expect(seen).toEqual([false]);
    env.set(820);
    env.fire('resize');
    expect(seen).toEqual([false, true]);
    env.media['(any-pointer: fine)'] = true;
    env.fire('mq (any-pointer: fine)');
    expect(seen).toEqual([false, true, false]);
    stop();
    expect(env.win.removeEventListener).toHaveBeenCalled();
  });
});
