/**
 * Клуб ребёнка: своё название (набранное или придуманное кнопкой), проверки названия и надписи на спине,
 * слова и города для соперников из content (docs/design.md, «свой клуб»).
 * Настоящих названий игра сама не даёт (журнал, 04.11), но ребёнок может набрать любое сам.
 * Цвета и формы — в `kit.ts`.
 */
import { parseKitColors, type Kit, type KitColors } from '../kit';

/** Клуб ребёнка в сохранении. Имя и номер на спине — необязательны. */
export interface Club {
  name: string;
  kit: KitColors;
  shirtName?: string;
  shirtNumber?: number;
}

/** Соперник на тайм: выдуманное название, настоящий город — «Прогресс, Тверь» — и своя форма. */
export interface Rival {
  name: string;
  city: string;
  kit: Kit;
}

export interface ClubData {
  /** Палитры для формы клуба. */
  palettes: KitColors[];
  /** Слова для названий: из них «Придумать» и соперники. */
  words: string[];
  cities: string[];
}


/** Название клуба длиннее этого не сохраняем: так испорченное сохранение не растянет экран. */
export const CLUB_NAME_MAX = 40;

/** Своё название: столько знаков после обрезки пробелов по краям. */
export const CUSTOM_NAME_MIN = 2;
export const CUSTOM_NAME_MAX = 20;

/** Имя на спине: столько букв — длиннее не влезает на форму крупно. */
export const SHIRT_NAME_MIN = 2;
export const SHIRT_NAME_MAX = 12;

// Буквы кириллицы (с Ё) и латиницы, цифры, пробел, дефис, точка. Кириллица — кодами:
// в коде вне i18n и content русских букв не бывает (страж в tests/guards.test.ts).
const NAME_CHARS = /^[0-9a-zA-Z\u0410-\u044f\u0401\u0451 .-]+$/;
const HAS_LETTER_OR_DIGIT = /[0-9a-zA-Z\u0410-\u044f\u0401\u0451]/;
const SHIRT_CHARS = /^[a-zA-Z\u0410-\u044f\u0401\u0451 -]+$/;
function words(v: unknown, where: string): string[] {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`${where}: expected non-empty array`);
  const out = v.map((w: unknown, n) => {
    if (typeof w !== 'string' || w.trim() !== w || w === '' || w.length > CUSTOM_NAME_MAX) {
      throw new Error(`${where}[${n}]: bad word`);
    }
    return w;
  });
  if (new Set(out).size !== out.length) throw new Error(`${where}: duplicate word`);
  return out;
}

/** Разбор палитр и слов из content: ошибка в данных должна падать в тесте, а не на экране. */
export function parseClubData(raw: unknown): ClubData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const { palettes } = r;
  if (!Array.isArray(palettes) || palettes.length === 0) throw new Error('clubs.palettes: expected non-empty array');
  return {
    palettes: palettes.map((p: unknown, n) => parseKitColors(p, `clubs.palettes[${n}]`)),
    words: words(r.words, 'clubs.words'),
    cities: words(r.cities, 'clubs.cities'),
  };
}

export type ClubNameError = 'short' | 'long' | 'chars' | 'spaces' | 'noLetters';

export type ClubNameCheck = { ok: true; name: string } | { ok: false; error: ClubNameError };

/** Проверка своего названия: пробелы по краям обрезаются, ошибка — код для текста на экране. */
export function checkClubName(raw: string): ClubNameCheck {
  const name = raw.trim();
  if (name.length < CUSTOM_NAME_MIN) return { ok: false, error: 'short' };
  if (name.length > CUSTOM_NAME_MAX) return { ok: false, error: 'long' };
  if (!NAME_CHARS.test(name)) return { ok: false, error: 'chars' };
  if (name.includes('  ')) return { ok: false, error: 'spaces' };
  if (!HAS_LETTER_OR_DIGIT.test(name)) return { ok: false, error: 'noLetters' };
  return { ok: true, name };
}

export type ShirtNameError = 'short' | 'long' | 'chars' | 'spaces';

/** Имя на спине: пустое — можно (без имени); иначе 2–12 букв, пробел и дефис. */
export function checkShirtName(raw: string): { ok: true; name: string } | { ok: false; error: ShirtNameError } {
  const name = raw.trim();
  if (name === '') return { ok: true, name };
  if (name.length < SHIRT_NAME_MIN) return { ok: false, error: 'short' };
  if (name.length > SHIRT_NAME_MAX) return { ok: false, error: 'long' };
  if (!SHIRT_CHARS.test(name) || !HAS_LETTER_OR_DIGIT.test(name)) return { ok: false, error: 'chars' };
  if (name.includes('  ')) return { ok: false, error: 'spaces' };
  return { ok: true, name };
}

/** Номер на спине: пусто — без номера; иначе целое 1–99 («07» — это 7). */
export function checkShirtNumber(raw: string): { ok: true; number: number | null } | { ok: false } {
  const t = raw.trim();
  if (t === '') return { ok: true, number: null };
  if (!/^[0-9]{1,2}$/.test(t)) return { ok: false };
  const n = Number(t);
  return n >= 1 ? { ok: true, number: n } : { ok: false };
}

/** Для сравнения: без регистра, Ё = Е («Полет» и «Полёт» — тёзки). */
export function plainWord(w: string): string {
  return w.toLowerCase().replaceAll('\u0451', '\u0435');
}

/** Слова названия для сравнения: «Прогресс Тверь» → прогресс, тверь. */
export function nameWords(name: string): string[] {
  return plainWord(name)
    .split(/[ .-]+/)
    .filter((w) => w !== '');
}
