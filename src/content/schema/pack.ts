/**
 * Пакет уроков лиги (060 §2, §5): манифест `pack.json`, файл чисел и материала `lessons.json`, файл текстов
 * `text.<язык>.json`. Проверки рукописные, как у остальных схем: пусто — годен. Глубокий разбор урока
 * (полосы длины, лесенки, буквы) делает движок курса; здесь — форма и связи между файлами пакета.
 */
import { ID_RE } from './ids';

export const ACCESS = ['public', 'closed'] as const;
export type PackAccess = (typeof ACCESS)[number];

export interface PackManifest {
  /** `<курс>.<лига>`, например `ru.yard`. */
  id: string;
  course: string;
  league: string;
  /** `closed` едет в сборку только закрытой редакции (059-Р1). */
  access: PackAccess;
  /** Ревизия пакета: целое, растёт при каждой правке; часть адреса `/packs/<id>/<rev>/`. */
  rev: number;
  /** Версия оболочки, которой хватает для пакета (060-Р5: целое, не semver). */
  shellApi: number;
  files: {
    /** Относительный путь файла уроков внутри папки пакета. */
    lessons: string;
    /** Файлы текстов по языку объяснения. */
    text: Record<string, string>;
  };
}

/** Урок в файле уроков: только числа, флаги и материал — тексты в `text.<язык>.json`. */
export interface PackLesson {
  stage: number;
  material: string;
  attacks: number[];
  rows: number;
  g: number;
  c: number;
  warmup: number;
  friendly?: boolean;
  control?: boolean;
  trap?: boolean;
  noWords?: boolean;
  chants?: boolean;
  focus?: string;
  focusWeak?: number;
  wordLen?: [number, number];
}

export interface PackLessons {
  /** Порядок прохождения; длина равна `lessons` лиги в каркасе курса. */
  order: string[];
  /** Ширина строки атаки в знаках. */
  rowWidth: number;
  stages: { n: number; newKeys: string }[];
  ladders: Record<string, string[]>;
  lengthBands: { stages: [number, number]; min: number; max: number }[];
  lessons: Record<string, PackLesson>;
}

/** Тексты одного языка: название и советы урока по id, названия ступеней по номеру. */
export interface PackText {
  lessons: Record<string, { name: string; tip: string | string[] }>;
  stages: Record<string, string>;
}

/** Пакет целиком, как его отдаёт загрузчик. */
export interface Pack {
  manifest: PackManifest;
  lessons: PackLessons;
  text: Record<string, PackText>;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown, min: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min;
const filled = (s: unknown): s is string => typeof s === 'string' && s.trim() !== '';
const WORD = /^[a-z0-9-]+$/;
/** Путь внутри папки пакета: без выхода наверх, без корня и обратных слэшей. */
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;

/** Проверка манифеста пакета: пусто — годен. */
export function check(x: unknown): string[] {
  if (!isObj(x)) return ['манифест: ожидался объект'];
  const errs: string[] = [];
  if (typeof x.id !== 'string' || !/^[a-z0-9-]+\.[a-z0-9-]+$/.test(x.id)) errs.push('id: ожидалось <курс>.<лига>');
  if (typeof x.course !== 'string' || !WORD.test(x.course)) errs.push('course: ожидалась латиница');
  if (typeof x.league !== 'string' || !WORD.test(x.league)) errs.push('league: ожидалась латиница');
  if (typeof x.id === 'string' && typeof x.course === 'string' && typeof x.league === 'string' && x.id !== `${x.course}.${x.league}`) {
    errs.push('id: должен быть <course>.<league>');
  }
  if (typeof x.access !== 'string' || !(ACCESS as readonly string[]).includes(x.access)) errs.push('access: public или closed');
  if (!isInt(x.rev, 1)) errs.push('rev: ожидалось целое от 1');
  if (!isInt(x.shellApi, 1)) errs.push('shellApi: ожидалось целое от 1');
  const files = x.files;
  if (!isObj(files)) errs.push('files: ожидался объект');
  else {
    if (typeof files.lessons !== 'string' || !SAFE_PATH.test(files.lessons)) errs.push('files.lessons: ожидался путь внутри пакета');
    const text = files.text;
    if (!isObj(text) || Object.keys(text).length === 0) errs.push('files.text: ожидался объект «язык: файл», хотя бы один');
    else {
      for (const [lang, path] of Object.entries(text)) {
        if (!WORD.test(lang)) errs.push(`files.text.${lang}: язык — латиница`);
        if (typeof path !== 'string' || !SAFE_PATH.test(path)) errs.push(`files.text.${lang}: ожидался путь внутри пакета`);
      }
    }
  }
  return errs;
}

/** Проверка файла уроков: форма и связи. Числовые границы урока проверяет разбор курса (`parseLeagueLessons`). */
export function checkLessons(x: unknown, packId: string): string[] {
  if (!isObj(x)) return ['уроки: ожидался объект'];
  const errs: string[] = [];
  const order = x.order;
  const lessons = x.lessons;
  if (!Array.isArray(order) || order.length === 0) errs.push('order: ожидался непустой список id');
  else {
    const seen = new Set<string>();
    for (const id of order) {
      if (typeof id !== 'string' || !ID_RE.test(id)) errs.push(`order: id ${String(id)} — не по формату`);
      else if (!id.startsWith(`${packId}.`)) errs.push(`order: id ${id} — вне пакета ${packId}`);
      if (seen.has(String(id))) errs.push(`order: id ${String(id)} повторяется`);
      seen.add(String(id));
    }
  }
  if (!isInt(x.rowWidth, 1)) errs.push('rowWidth: ожидалось целое от 1');
  if (!Array.isArray(x.stages) || x.stages.length === 0) errs.push('stages: ожидался непустой список');
  if (!isObj(x.ladders)) errs.push('ladders: ожидался объект');
  if (!Array.isArray(x.lengthBands) || x.lengthBands.length === 0) errs.push('lengthBands: ожидался непустой список');
  if (!isObj(lessons)) errs.push('lessons: ожидался объект');
  else if (Array.isArray(order)) {
    for (const id of order) if (typeof id === 'string' && !Object.hasOwn(lessons, id)) errs.push(`lessons: нет урока ${id}`);
    for (const id of Object.keys(lessons)) {
      if (!order.includes(id)) errs.push(`lessons: урок ${id} не в order`);
      const l = lessons[id];
      if (!isObj(l)) errs.push(`lessons.${id}: ожидался объект`);
      else if ('name' in l || 'tip' in l) errs.push(`lessons.${id}: тексты — в text.<язык>.json`);
    }
  }
  return errs;
}

/** Проверка файла текстов против порядка уроков: у каждого id имя и совет, у каждой ступени имя. */
export function checkText(x: unknown, order: readonly string[], stageNumbers: readonly number[]): string[] {
  if (!isObj(x)) return ['тексты: ожидался объект'];
  const errs: string[] = [];
  const lessons = x.lessons;
  const stages = x.stages;
  if (!isObj(lessons)) errs.push('lessons: ожидался объект');
  else {
    for (const id of order) {
      const t = lessons[id];
      if (!isObj(t)) errs.push(`lessons.${id}: нет текстов`);
      else {
        if (!filled(t.name)) errs.push(`lessons.${id}.name: пусто`);
        const tips: unknown[] = Array.isArray(t.tip) ? t.tip : [t.tip];
        if (tips.length === 0 || !tips.every(filled)) errs.push(`lessons.${id}.tip: ожидался совет или список советов`);
      }
    }
    for (const id of Object.keys(lessons)) if (!order.includes(id)) errs.push(`lessons.${id}: лишний текст — урока нет в order`);
  }
  if (!isObj(stages)) errs.push('stages: ожидался объект');
  else for (const n of stageNumbers) if (!filled(stages[String(n)])) errs.push(`stages.${n}: нет названия ступени`);
  return errs;
}
