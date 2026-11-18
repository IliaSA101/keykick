/**
 * Карта клавиатуры: физическая клавиша (`KeyboardEvent.code`) → символы в раскладках и палец.
 * Данные — файлы раскладок src/content/layouts/*.json (060 §2, схема content/schema/layout);
 * здесь сборка с проверками и поиск клавиши по символу. Раскладок может быть сколько угодно:
 * «не та раскладка» ищется по всем известным, а не по одной паре.
 */
import { FINGERS, type Finger as SchemaFinger } from '../../content/schema/layout';

/** Пальцы: l/r — рука, p/r/m/i — мизинец, безымянный, средний, указательный; th — большие. */
export const fingers = FINGERS;
export type Finger = SchemaFinger;

/**
 * Id раскладки — имя её файла в `content/layouts/`: `jcuken-win`, `qwerty-win`. Раскладку урока называет курс
 * (`course.json`, поле `layout`); известные сборке — `Keymap.layouts`.
 */
export type Layout = string;

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
  chars: Readonly<Record<string, KeyChars>> | null;
  label: string;
}

/** Где набирается символ: клавиша и нужен ли Shift. */
export interface KeyHit {
  key: KeyDef;
  shift: boolean;
}

export interface Keymap {
  /** Имена всех известных раскладок в порядке сборки (ключи при сборке); первая — главная: по ней ряды и подписи. */
  layouts: readonly string[];
  rows: readonly (readonly KeyDef[])[];
  byCode: ReadonlyMap<string, KeyDef>;
  byChar: Readonly<Record<string, ReadonlyMap<string, KeyHit>>>;
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

type RawKeys = Record<string, Record<string, unknown> | undefined>;

/** Ряды раскладки как списки кодов; не список — ошибка. */
function rowsOf(file: unknown, name: string): string[][] {
  const rows = (file as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows) || rows.length === 0) fail(name, 'expected rows');
  return rows.map((row: unknown, n) => {
    if (!Array.isArray(row)) fail(`${name} row ${n}`, 'expected array');
    return row.map((code: unknown) => {
      if (typeof code !== 'string' || code === '') fail(`${name} row ${n}`, 'expected code');
      return code;
    });
  });
}

/**
 * Собирает карту из файлов раскладок: `{ 'jcuken-win': <jcuken-win.json>, 'qwerty-win': <qwerty-win.json> }`.
 * Ключ — id раскладки в карте. У всех раскладок одни и те же физические клавиши (ряды, палец,
 * ширина, засечка совпадают); различаются знаки на клавишах.
 */
export function parseKeymap(raw: unknown): Keymap {
  const files = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const names = Object.keys(files);
  const main = names[0];
  if (main === undefined) fail('', 'expected at least one layout');

  const layoutRows = new Map(names.map((n) => [n, rowsOf(files[n], n)]));
  const mainRows = layoutRows.get(main) ?? [];
  for (const n of names) {
    if (JSON.stringify(layoutRows.get(n)) !== JSON.stringify(mainRows)) fail(n, `rows differ from ${main}`);
  }
  const keysOf = (n: string): RawKeys => (files[n] as { keys?: RawKeys } | null)?.keys ?? {};

  const byCode = new Map<string, KeyDef>();
  const byChar: Record<string, Map<string, KeyHit>> = Object.fromEntries(names.map((n) => [n, new Map<string, KeyHit>()]));

  const rows = mainRows.map((rowCodes, row) =>
    rowCodes.map((code, n): KeyDef => {
      const where = `row ${row} key ${n}`;
      if (byCode.has(code)) fail(where, `duplicate code ${code}`);
      const r = keysOf(main)[code] ?? {};
      const finger = r.finger;
      if (typeof finger !== 'string' || !(fingers as readonly string[]).includes(finger)) {
        fail(where, `bad finger ${String(finger)}`);
      }
      const width = r.width ?? 1;
      if (typeof width !== 'number' || width < 1) fail(where, 'bad width');

      // Остальные раскладки — на той же физической клавише: палец, ширина и засечка те же.
      for (const other of names.slice(1)) {
        const o = keysOf(other)[code] ?? {};
        if (o.finger !== finger || (o.width ?? 1) !== width || (o.bump === true) !== (r.bump === true)) {
          fail(where, `key ${code} differs between ${main} and ${other}`);
        }
      }

      const withChars = names.filter((l) => keysOf(l)[code]?.ch !== undefined);
      if (withChars.length !== 0 && withChars.length !== names.length) fail(where, `key ${code} has chars not in every layout`);
      const keyChars = withChars.length
        ? (Object.fromEntries(names.map((l) => [l, chars(keysOf(l)[code]?.ch, `${where}.${l}`)])) as Record<string, KeyChars>)
        : null;
      const label = keyChars ? keyChars[main]![0] : r.label;
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
        for (const layout of names) {
          keyChars[layout]!.forEach((ch, i) => {
            const seen = byChar[layout]!.get(ch);
            // Пробел одинаков с Shift и без — это та же клавиша, не дубль.
            if (seen && seen.key !== key) fail(where, `char ${JSON.stringify(ch)} in ${layout} is on two keys`);
            if (!seen) byChar[layout]!.set(ch, { key, shift: i === 1 });
          });
        }
      }
      return key;
    }),
  );

  return { layouts: names, rows, byCode, byChar };
}

/**
 * Буква, а не знак (009-Р5): веса, пробежки и разминка урока — только из букв, знаки («.»)
 * генератор ставит отдельно. Общий признак движка — и для пазла «Собери клавиатуру».
 */
export const isLetter = (ch: string): boolean => /^\p{L}$/u.test(ch);

/** Клавиша для символа в раскладке; undefined — символа на этой раскладке нет. */
export function findChar(map: Keymap, layout: string, ch: string): KeyHit | undefined {
  return map.byChar[layout]?.get(ch);
}

/** В какой раскладке набирается символ: в одной или в обеих (цифры, пробел, знаки на одних местах). */
export function layoutsOf(map: Keymap, ch: string): string[] {
  return map.layouts.filter((l) => map.byChar[l]?.has(ch));
}

/** Большой палец, которым бьют пробел. */
export type Thumb = 'left' | 'right';

/**
 * Пробел — большим пальцем другой руки, чем прошлая буква (04.11): после буквы
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
