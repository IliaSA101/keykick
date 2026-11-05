/**
 * Карта клавиатуры: физическая клавиша (`KeyboardEvent.code`) → символы в двух раскладках и палец.
 * Данные — src/content/keyboard.json; здесь разбор с проверками и поиск клавиши по символу.
 */

/** Пальцы: l/r — рука, p/r/m/i — мизинец, безымянный, средний, указательный; th — большие. */
export const fingers = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp', 'th'] as const;
export type Finger = (typeof fingers)[number];

export const layouts = ['ru', 'en'] as const;
export type Layout = (typeof layouts)[number];

/** [без Shift, с Shift]. */
export type KeyChars = readonly [string, string];

export interface KeyDef {
  code: string;
  row: number;
  finger: Finger;
  /** Ширина в долях обычной клавиши — для экранной клавиатуры. */
  width: number;
  /** Засечка на клавише (А и О, F и J) — по ней рука находит место на ощупь. */
  bump: boolean;
  /** Символы по раскладкам; у служебных клавиш (Shift, Enter) их нет — есть подпись. */
  chars: Readonly<Record<Layout, KeyChars>> | null;
  label: string;
}

/** Где набирается символ: клавиша и нужен ли Shift. */
export interface KeyHit {
  key: KeyDef;
  shift: boolean;
}

export interface Keymap {
  rows: readonly (readonly KeyDef[])[];
  byCode: ReadonlyMap<string, KeyDef>;
  byChar: Readonly<Record<Layout, ReadonlyMap<string, KeyHit>>>;
}

function fail(where: string, what: string): never {
  throw new Error(`keyboard ${where}: ${what}`);
}

function chars(raw: unknown, where: string): KeyChars {
  if (!Array.isArray(raw) || raw.length !== 2) fail(where, 'expected [plain, shifted]');
  const [a, b] = raw as unknown[];
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 1 || b.length !== 1) {
    fail(where, 'each char must be a single character');
  }
  return [a, b];
}

export function parseKeymap(raw: unknown): Keymap {
  const rowsRaw = (raw as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) fail('', 'expected rows');

  const byCode = new Map<string, KeyDef>();
  const byChar = { ru: new Map<string, KeyHit>(), en: new Map<string, KeyHit>() };

  const rows = rowsRaw.map((rowRaw: unknown, row) => {
    if (!Array.isArray(rowRaw)) fail(`row ${row}`, 'expected array');
    return rowRaw.map((item: unknown, n): KeyDef => {
      const r = (item ?? {}) as Record<string, unknown>;
      const where = `row ${row} key ${n}`;
      const code = r.code;
      if (typeof code !== 'string' || code === '') fail(where, 'expected code');
      if (byCode.has(code)) fail(where, `duplicate code ${code}`);
      const finger = r.finger;
      if (typeof finger !== 'string' || !(fingers as readonly string[]).includes(finger)) {
        fail(where, `bad finger ${String(finger)}`);
      }
      const width = r.width ?? 1;
      if (typeof width !== 'number' || width < 1) fail(where, 'bad width');

      const hasChars = r.ru !== undefined || r.en !== undefined;
      const keyChars = hasChars ? { ru: chars(r.ru, `${where}.ru`), en: chars(r.en, `${where}.en`) } : null;
      const label = keyChars ? keyChars.ru[0] : r.label;
      if (typeof label !== 'string' || label === '') fail(where, 'service key needs a label');

      const key: KeyDef = {
        code,
        row,
        finger: finger as Finger,
        width,
        bump: r.bump === true,
        chars: keyChars,
        label,
      };
      byCode.set(code, key);

      if (keyChars) {
        for (const layout of layouts) {
          keyChars[layout].forEach((ch, i) => {
            const seen = byChar[layout].get(ch);
            // Пробел одинаков с Shift и без — это та же клавиша, не дубль.
            if (seen && seen.key !== key) fail(where, `char ${JSON.stringify(ch)} in ${layout} is on two keys`);
            if (!seen) byChar[layout].set(ch, { key, shift: i === 1 });
          });
        }
      }
      return key;
    });
  });

  return { rows, byCode, byChar };
}

/**
 * Буква, а не знак (009-Р5): веса, пробежки и разминка урока — только из букв, знаки («.»)
 * генератор ставит отдельно. Общий признак движка — и для пазла «Собери клавиатуру».
 */
export const isLetter = (ch: string): boolean => /^\p{L}$/u.test(ch);

/** Клавиша для символа в раскладке; undefined — символа на этой раскладке нет. */
export function findChar(map: Keymap, layout: Layout, ch: string): KeyHit | undefined {
  return map.byChar[layout].get(ch);
}

/** В какой раскладке набирается символ: ru, en или обе (цифры, пробел, знаки на одних местах). */
export function layoutsOf(map: Keymap, ch: string): Layout[] {
  return layouts.filter((l) => map.byChar[l].has(ch));
}

/** Большой палец, которым бьют пробел. */
export type Thumb = 'left' | 'right';

/**
 * Пробел — большим пальцем другой руки, чем прошлая буква (как в «Соло», 04.11): после буквы
 * левой руки — правым, после правой — левым. Начало строки и неясный случай — правым.
 */
export function thumbAfter(finger: Finger | undefined): Thumb {
  if (finger?.startsWith('r')) return 'left';
  return 'right';
}

/** Shift другой руки: заглавную левой руки берут правым Shift, и наоборот. */
export function shiftFor(finger: Finger): 'ShiftLeft' | 'ShiftRight' {
  return finger.startsWith('l') ? 'ShiftRight' : 'ShiftLeft';
}
