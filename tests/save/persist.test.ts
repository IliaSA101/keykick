/**
 * «Защитить сохранение» (063-Р8): `persist()` — только по кнопке, состояние — из `persisted()`, отказы не бросают.
 * Другая подготовка, чем у хранилища: подмена `navigator.storage`, а не ключей. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { createPersist, type PersistApi } from '../../src/app/save/persist';

describe('persist.ts — «Защитить сохранение» (063-Р8)', () => {
  const api = (persisted: boolean, grants: boolean) => {
    const calls: string[] = [];
    let now = persisted;
    const fake: PersistApi = {
      persist: () => {
        calls.push('persist');
        now = grants;
        return Promise.resolve(grants);
      },
      persisted: () => {
        calls.push('persisted');
        return Promise.resolve(now);
      },
    };
    return { fake, calls };
  };

  it('К4: state не просит защиту — только спрашивает; request просит и отвечает итогом persisted()', async () => {
    // Ловит: проверка состояния вызывает persist() (Firefox спросит разрешение у ребёнка при открытии); итог берётся из ответа persist(), а не из persisted().
    const { fake, calls } = api(false, true);
    const persist = createPersist(fake);
    expect(await persist.state()).toBe('not-persisted');
    expect(calls).toEqual(['persisted']);
    expect(await persist.request()).toBe('persisted');
    expect(calls).toEqual(['persisted', 'persist', 'persisted']);
  });

  it('К4: браузер отказал — not-persisted; повторная кнопка при уже защищённом — persisted', async () => {
    // Ловит: отказ браузера показывается как успех; защищённое хранилище при повторном нажатии «ломается».
    expect(await createPersist(api(false, false).fake).request()).toBe('not-persisted');
    expect(await createPersist(api(true, true).fake).request()).toBe('persisted');
  });

  it('К4: нет API или он бросает/отклоняется — unsupported, ничего не бросается', async () => {
    // Ловит: старый браузер или запрет роняют страницу родителя исключением из persist()/persisted().
    const boom: PersistApi = {
      persist: () => Promise.reject(new Error('x')),
      persisted: () => {
        throw new Error('y');
      },
    };
    for (const persist of [createPersist(undefined), createPersist(boom)]) {
      expect(await persist.state()).toBe('unsupported');
      expect(await persist.request()).toBe('unsupported');
    }
  });
});
