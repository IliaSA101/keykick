/**
 * Языки: три оси, форма текстов (Messages), склонение (060-Т10, К29, К30).
 */
import { describe, expect, it } from 'vitest';
import { resolveAxes } from '../../src/engine/locale/axes';
import { plural } from '../../src/i18n/plural';
import type { Messages } from '../../src/i18n/ru';
import { ru } from '../../src/i18n/ru';
import { enShell } from '../fixtures/i18n/en';

const course = { id: 'ru', explain: ['ru', 'en'] };

describe('оси языка', () => {
  // Ловит: explain берётся не из выбора игрока, а всегда из ui.
  it('выбор игрока внутри course.explain сохраняется', () => {
    expect(resolveAxes({ uiLang: 'ru' }, { explain: 'en' }, course)).toEqual({ ui: 'ru', course: 'ru', explain: 'en' });
  });

  // Ловит: язык вне списка курса попадает в explain (текстов контента на нём нет).
  it('explain вне course.explain — первый из course.explain', () => {
    expect(resolveAxes({ uiLang: 'ru' }, { explain: 'de' }, course).explain).toBe('ru');
    expect(resolveAxes({ uiLang: 'en' }, { explain: 'de' }, { id: 'ru', explain: ['ru'] }).explain).toBe('ru');
  });

  // Ловит: по умолчанию explain не следует за ui, либо следует, когда курс язык не знает.
  it('по умолчанию explain = ui, если курс его знает, иначе первый из курса', () => {
    expect(resolveAxes({ uiLang: 'en' }, {}, course).explain).toBe('en');
    expect(resolveAxes({ uiLang: 'en' }, {}, { id: 'ru', explain: ['ru'] })).toEqual({ ui: 'en', course: 'ru', explain: 'ru' });
  });

  // Ловит: тихий пустой язык у курса без explain.
  it('курс без языков пояснений — ошибка', () => {
    expect(() => resolveAxes({ uiLang: 'ru' }, {}, { id: 'x', explain: [] })).toThrow();
  });
});

describe('форма текстов интерфейса', () => {
  // Ловит: пропуск ключа во втором языке перестаёт быть ошибкой типов (если @ts-expect-error
  // станет «лишним», vue-tsc в `npm run check` покраснеет).
  it('пропуск ключа в en — ошибка типов; полный блок проходит', () => {
    // @ts-expect-error — в блоке нет buildingHint
    const broken = { building: 'x' } satisfies Messages['shell'];
    // @ts-expect-error — нет блоков keyboard и handsHelp
    const partial = { shell: enShell } satisfies Messages;
    expect(broken.building).toBe('x');
    expect(partial.shell).toBe(enShell);
    expect(Object.keys(enShell).sort()).toEqual(Object.keys(ru.shell).sort());
  });
});

describe('plural', () => {
  const ruForms = { one: 'ошибка', few: 'ошибки', many: 'ошибок' };
  const enForms = { one: 'error', other: 'errors' };

  // Ловит: неверные формы ru (11 — «ошибок», 21 — «ошибка», 22 — «ошибки»).
  it('ru: 1/2/5/11/21/22/25', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => plural('ru', n, ruForms))).toEqual([
      'ошибка', 'ошибки', 'ошибок', 'ошибок', 'ошибка', 'ошибки', 'ошибок',
    ]);
  });

  // Ловит: en склоняется по русским правилам либо теряет форму other.
  it('en: 1/2 (и 0)', () => {
    expect([1, 2, 0].map((n) => plural('en', n, enForms))).toEqual(['error', 'errors', 'errors']);
  });

  // Ловит: старые вызовы plural(n, forms) перестали работать как русские.
  it('короткая запись без языка — русский', () => {
    expect(plural(3, ruForms)).toBe('ошибки');
    expect(plural(5, ruForms)).toBe('ошибок');
  });
});

describe('служебные окна: форма рядом с Telegram (063-Р68)', () => {
  // Ловит: адрес формы стал не https или подпись пропала (пустой url скрывает строку — это намеренно).
  it('адрес формы — https, подпись не пуста', () => {
    expect(ru.system.form.url).toMatch(/^https:\/\//);
    expect(ru.system.form.label.length).toBeGreaterThan(0);
  });
});
