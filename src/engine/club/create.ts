/**
 * Клуб v2 (спека 019, design §2, §2.1; Р2, Р11, Р13): город — проверка и подсказки (с переводом раскладки),
 * «Придумать» без города, новый клуб, правка, разбор поля сохранения с починкой.
 * Чистые функции: время и версия приходят снаружи; запись в хранилище — `app/club` и 018-Т8.
 */
import { CUSTOM_NAME_MAX, type ClubData } from './names';
import { parseKitColors, type KitColors } from '../kit';
import { findChar, type Keymap } from '../keymap';
import { compareVersions, isVersion } from '../news';
import { createRandom, pick } from '../random';

export const CITY_MIN = 2;
export const CITY_MAX = 24;
export const SUGGEST_MAX = 5;
/** Чипов городов под полем: не больше (019-Р40; ребёнок-критик: один чип при «выбери из списка» — пусто). */
export const CHIPS_MAX = 8;
/** Чипов городов в тесной правке клуба: больше не влезает в окно 1024×640 без прокрутки. */
export const EDIT_CHIPS = 5;

/** Версия, к которой приводится битый `newsSeen` (design §2, Р11): иначе в v2 всплывут строки v1. */
export const NEWS_SEEN_FALLBACK = '2.0.0';

/** Форма по умолчанию — обычная синяя; битый цвет в сохранении заменяется ею. */
export const DEFAULT_KIT: KitColors = { pattern: 'plain', body: '#2f6fe0', sleeves: '#ffffff', trim: '#ffffff' };

/** Раздел `club` сохранения (design §2). */
export interface ClubFields {
  name: string;
  kit: KitColors;
  city: string;
  coach: string;
  rival: string;
  createdAt: number;
  newsSeen: string;
}

/** Что ребёнок вводит на «Готово» и правит позже. */
export interface ClubDraft {
  name: string;
  kit: KitColors;
  city: string;
}

export function emptyClub(): ClubFields {
  return { name: '', kit: DEFAULT_KIT, city: '', coach: '', rival: '', createdAt: 0, newsSeen: '' };
}

/** «Клуб есть» ⇔ `createdAt > 0` (битое имя или город клуб не отменяют). */
export const hasClub = (c: Pick<ClubFields, 'createdAt'>): boolean => c.createdAt > 0;

// Кириллица — кодами: русских букв в коде вне i18n и content не бывает (страж guards.test).
const CYRILLIC = /[\u0410-\u044f\u0401\u0451]/;
const LATIN = /[a-zA-Z]/;
const CITY_CHARS = /^[0-9a-zA-Z\u0410-\u044f\u0401\u0451 .-]+$/;

export type CityError = 'short' | 'long' | 'chars' | 'spaces' | 'noLetters' | 'layout';
export type CityCheck = { ok: true; city: string } | { ok: false; error: CityError };

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Проверка города: 2–24 знака; только латиница без кириллицы — `layout` (забыта русская раскладка). */
export function checkCity(raw: string): CityCheck {
  const city = raw.trim();
  if (city.length < CITY_MIN) return { ok: false, error: 'short' };
  if (city.length > CITY_MAX) return { ok: false, error: 'long' };
  if (!CITY_CHARS.test(city)) return { ok: false, error: 'chars' };
  if (city.includes('  ')) return { ok: false, error: 'spaces' };
  const cyr = CYRILLIC.test(city);
  if (!cyr && LATIN.test(city)) return { ok: false, error: 'layout' };
  if (!cyr) return { ok: false, error: 'noLetters' };
  return { ok: true, city: capital(city) };
}

/** Для сравнения: без регистра, Ё = Е. */
const plain = (s: string): string => s.toLowerCase().replaceAll('\u0451', '\u0435');

/** Один и тот же город по тому же сравнению, что у подсказок: без регистра, Ё = Е, края без пробелов. */
export function sameCity(a: string, b: string): boolean {
  return plain(a.trim()) === plain(b.trim());
}

/** Город списка, который набран точно (Ё = Е, регистр не важен); нет такого — null. Латиница без перевода раскладки не совпадает. */
export function exactCity(cities: readonly string[], query: string): string | null {
  if (query.trim() === '') return null;
  return cities.find((c) => sameCity(c, query)) ?? null;
}

/**
 * Что набрал бы ребёнок на русской раскладке теми же клавишами: «Ndthm» → «Тверь». Знак латиницы → клавиша
 * → её русский знак того же регистра; чего на клавиатуре нет — остаётся как есть.
 */
export function toRu(map: Keymap, query: string): string {
  let out = '';
  for (const ch of query) {
    const hit = findChar(map, 'en', ch);
    const ru = hit?.key.chars?.ru[hit.shift ? 1 : 0];
    out += ru ?? ch;
  }
  return out;
}

function matches(cities: readonly string[], q: string): { whole: string[]; word: string[] } {
  const whole: string[] = [];
  const word: string[] = [];
  for (const c of cities) {
    const p = plain(c);
    if (p.startsWith(q)) whole.push(c);
    else if (p.split(/[ -]+/).some((w) => w.startsWith(q))) word.push(c);
  }
  return { whole, word };
}

/**
 * Подсказки города: пустой запрос — первые 5 из списка (без выделения: решает компонент); иначе — начало
 * названия или слова после дефиса/пробела, без регистра, Ё = Е, не больше 5, точное совпадение первым.
 * Запрос без кириллицы ищется ещё и переводом раскладки (`map`).
 */
export function suggestCities(cities: readonly string[], query: string, map: Keymap | null = null, limit = SUGGEST_MAX): string[] {
  const raw = query.trim();
  if (raw === '') return cities.slice(0, limit);
  const q = plain(raw);
  const ruQ = map && !CYRILLIC.test(raw) ? plain(toRu(map, raw)) : null;
  const direct = matches(cities, q);
  const translated = ruQ === null ? { whole: [], word: [] } : matches(cities, ruQ);
  const unique = [...new Set([...direct.whole, ...translated.whole, ...direct.word, ...translated.word])];
  const exact = unique.filter((c) => plain(c) === q || plain(c) === ruQ);
  return [...new Set([...exact, ...unique])].slice(0, limit);
}

/**
 * Чипы городов под полем (019-Р40): по введённому — до 8; поле пустое или город уже набран целиком — ещё и первые
 * из списка (частые), чтобы выбор был виден, а не «один чип». Точное совпадение — первым.
 */
export function cityChips(cities: readonly string[], query: string, map: Keymap | null = null, limit = CHIPS_MAX): string[] {
  const found = suggestCities(cities, query, map, limit);
  const raw = query.trim();
  const ready = found.length > 0 && raw !== '' && plain(found[0]!) === plain(raw);
  if (raw !== '' && !ready) return found;
  return [...new Set([...found, ...cities])].slice(0, limit);
}

/**
 * «Придумать» в v2 — без города (design §2.2): слово не из того, что уже в поле; одно зерно — то же название.
 */
export function suggestClubName(data: Pick<ClubData, 'words'>, current: string, seed: number): string {
  const taken = new Set(plain(current).split(/[ .-]+/).filter((w) => w !== ''));
  const fresh = data.words.filter((w) => !taken.has(plain(w)));
  const words = (fresh.length > 0 ? fresh : data.words).filter((w) => w.length <= CUSTOM_NAME_MAX);
  return pick(createRandom(seed), words);
}

/**
 * Новый клуб на «Готово». Если клуб уже есть (создала другая вкладка) — возвращается лежащий, ничего не меняется.
 * `createdAt = max(1, now)`: `time()` мусор превращает в 0, а 0 — «клуба нет» (В2, Р2).
 */
export function createClub(
  current: ClubFields,
  draft: ClubDraft,
  o: { now: number; coach: string; version: string },
): ClubFields {
  if (hasClub(current)) return current;
  return {
    name: draft.name,
    kit: draft.kit,
    city: draft.city,
    coach: o.coach,
    rival: '',
    createdAt: Math.max(1, Math.floor(o.now) || 0),
    newsSeen: o.version,
  };
}

/** Правка клуба — только три поля; остальное (тренер, соперник, дата, «что нового») не трогается. */
export function editClub(current: ClubFields, patch: ClubDraft): ClubFields {
  return { ...current, name: patch.name, kit: patch.kit, city: patch.city };
}

/** `newsSeen = max(newsSeen, v)` по сравнению версий: назад не идёт, битая версия игнорируется. */
export function markNewsSeen(current: ClubFields, version: string): ClubFields {
  if (!isVersion(version)) return current;
  if (isVersion(current.newsSeen) && compareVersions(current.newsSeen, version) >= 0) return current;
  return { ...current, newsSeen: version };
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Разбор поля `club` из сохранения (правила design §2): имя обрезается до 20; цвета битые → `DEFAULT_KIT`;
 * город вне 2–24 или не по правилам → ''; тренер и соперник строками; `newsSeen` битый → `2.0.0`.
 * При живом имени или городе и испорченном `createdAt` ставится 1 — клуб цел, первый запуск не повторится.
 */
export function repairClub(raw: unknown): { club: ClubFields; repaired: boolean } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const name = str(r.name, CUSTOM_NAME_MAX);
  const cityRaw = str(r.city, CITY_MAX);
  const city = cityRaw !== '' && checkCity(cityRaw).ok ? cityRaw : '';
  let kit = DEFAULT_KIT;
  try {
    kit = parseKitColors(r.kit, 'club.kit');
  } catch {
    // формат цвета неверен — форма по умолчанию
  }
  const at = typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) && r.createdAt > 0 ? Math.floor(r.createdAt) : 0;
  const alive = name !== '' || city !== '';
  const createdAt = at === 0 && alive ? 1 : at;
  const newsSeen = isVersion(r.newsSeen) ? r.newsSeen : NEWS_SEEN_FALLBACK;
  const club: ClubFields = { name, kit, city, coach: str(r.coach, 32), rival: str(r.rival, 20), createdAt, newsSeen };
  const out = createdAt === 0 ? emptyClub() : club;
  const repaired = (Object.keys(out) as (keyof ClubFields)[]).some((k) => JSON.stringify(out[k]) !== JSON.stringify(r[k]));
  return { club: out, repaired };
}
