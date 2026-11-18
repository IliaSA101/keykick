/**
 * Раздел `club` (063-Р6, ТЗ-12.8, 5.13): название, форма, город, тренер, имя и номер на спине.
 * Монеты и звёзды сюда не входят — у них свои разделы (дальше по этапу Э1). Чистые функции: хранилища и часов нет.
 * Пустой клуб — `name === ''`: первый запуск (Т6) заполняет поля одной записью.
 */
import clubs from '../../content/clubs.json';
import { isInt, type SectionDef } from '../save/section';

/** Форма клуба в палитре `clubs.json`: рисунок и цвета (`sleeves` бывает словом `split`). */
export interface ClubKit {
  pattern: string;
  body: string;
  alt?: string;
  sleeves: string;
  trim: string;
}

export interface Club {
  /** Название клуба; пусто — ещё не придумано. */
  name: string;
  kit: ClubKit;
  /** Город; пусто — не указан. */
  city: string;
  /** Id тренера из `content/coach.json`; пусто — тренер по умолчанию (показ решает экран). */
  coach: string;
  /** Имя на спине, ≤ `BACK_NAME_MAX`; пусто — без имени. */
  backName: string;
  /** Номер на спине 1–99; 0 — не выбран. */
  backNumber: number;
}

export const NAME_MAX = 20;
export const CITY_MAX = 24;
export const COACH_MAX = 32;
export const BACK_NAME_MAX = 12;
export const NUMBER_MAX = 99;

const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
const isStr = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;
const HEX = /^#[0-9a-fA-F]{6}$/;
const PATTERN = /^[a-z]{2,16}$/;

/** Форма по умолчанию — первая палитра `clubs.json` (белое с синим — разрешённое сочетание). */
export function defaultKit(): ClubKit {
  const p = clubs.palettes[0]!;
  return { pattern: p.pattern, body: p.body, sleeves: p.sleeves, trim: p.trim };
}

function kitProblems(kit: unknown): string[] {
  if (!isObj(kit)) return ['kit'];
  if (typeof kit.pattern !== 'string' || !PATTERN.test(kit.pattern)) return ['kit:pattern'];
  if (typeof kit.body !== 'string' || !HEX.test(kit.body)) return ['kit:body'];
  if (typeof kit.trim !== 'string' || !HEX.test(kit.trim)) return ['kit:trim'];
  if (typeof kit.sleeves !== 'string' || !(kit.sleeves === 'split' || HEX.test(kit.sleeves))) return ['kit:sleeves'];
  if (kit.alt !== undefined && (typeof kit.alt !== 'string' || !HEX.test(kit.alt))) return ['kit:alt'];
  return [];
}

export const clubDef: SectionDef<Club> = {
  name: 'club',
  v: 1,
  empty: () => ({ name: '', kit: defaultKit(), city: '', coach: '', backName: '', backNumber: 0 }),
  up: {},
  check(d) {
    if (!isObj(d)) return ['shape'];
    const why: string[] = [];
    if (!isStr(d.name, NAME_MAX)) why.push('name');
    if (!isStr(d.city, CITY_MAX)) why.push('city');
    if (!isStr(d.coach, COACH_MAX)) why.push('coach');
    if (!isStr(d.backName, BACK_NAME_MAX)) why.push('backName');
    if (!isInt(d.backNumber) || d.backNumber < 0 || d.backNumber > NUMBER_MAX) why.push('backNumber');
    why.push(...kitProblems(d.kit));
    return why;
  },
};
