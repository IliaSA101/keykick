/**
 * Курс: разбор уроков лиги из пакета (060-Т9а, спека 016, design §1.2) — числа и материал из `lessons.json`,
 * имена и советы из текстов языка объяснения. Формы файлов пакета проверяет `engine/packs/manifest.ts`
 * (`checkPack`); здесь — глубокие правила: полосы длины, лесенки, буквы ступеней, границы атак.
 * Чистые функции без Vue и DOM: пакет приходит снаружи (загрузчик или тест).
 */
import { ID_RE } from '../../content/schema/ids';
import type { Pack } from '../../content/schema/pack';
import type { Keymap, Layout } from '../typing/keymap';
import type { CourseLesson } from './lesson';
import { fail, materials, unique, type Material } from './lessonModel';
import { flag, int, known, list, onLayout, rec, str } from './read';

/** Что известно курсу про лигу пакета: язык текстов, раскладка, карта клавиатуры, лига и число её уроков по каркасу. */
export interface LessonsContext {
  /** Язык объяснения: ключ в `pack.text`. */
  lang: string;
  /** Id раскладки курса (`jcuken-win`). */
  layout: Layout;
  keymap: Keymap;
  /** Id лиги каркаса курса. */
  league: string;
  /** Сколько уроков в лиге по каркасу. */
  lessons: number;
}

interface Stage {
  n: number;
  newKeys: string;
}

interface Band {
  from: number;
  to: number;
  min: number;
  max: number;
}

/** Ступени: номер и новые буквы; название — в текстах языка (`names`). */
function parseStages(raw: unknown, map: Keymap, layout: Layout, names: Rec): Stage[] {
  const seen = new Set<number>();
  return list(raw, 'stages').map((item, i) => {
    const r = rec(item);
    const where = `stages[${i}]`;
    known(r, ['n', 'newKeys'], where);
    const n = int(r, 'n', where, 1);
    if (seen.has(n)) fail(where, `duplicate stage ${n}`);
    seen.add(n);
    if (typeof names[String(n)] !== 'string' || names[String(n)] === '') fail(where, 'expected name');
    const newKeys = str(r, 'newKeys', where, true);
    onLayout(map, layout, newKeys, where);
    return { n, newKeys };
  });
}

type Rec = Record<string, unknown>;

function parseBands(raw: unknown, stages: Stage[]): Band[] {
  const bands = list(raw, 'lengthBands').map((item, i): Band => {
    const r = rec(item);
    const where = `lengthBands[${i}]`;
    known(r, ['stages', 'min', 'max'], where);
    const range = r.stages;
    if (!Array.isArray(range) || range.length !== 2 || range.some((v) => !Number.isInteger(v) || (v as number) < 1)) {
      fail(where, 'expected stages [from, to] of integers');
    }
    const [from, to] = range as [number, number];
    if (from > to) fail(where, `stages from ${from} is after to ${to}`);
    const min = int(r, 'min', where, 1);
    const max = int(r, 'max', where, 1);
    if (min > max) fail(where, `min ${min} is above max ${max}`);
    return { from, to, min, max };
  });
  bands.forEach((band, i) => {
    if (bands.slice(0, i).some((o) => band.from <= o.to && o.from <= band.to)) fail(`lengthBands[${i}]`, 'bands overlap');
  });
  for (const s of stages) if (!bands.some((b) => s.n >= b.from && s.n <= b.to)) fail('lengthBands', `no length band for stage ${s.n}`);
  return bands;
}

/** Лесенки материалов: на каждый материал непустой список материалов-ступеней. */
function parseLadders(raw: unknown): Record<Material, Material[]> {
  const r = rec(rec(raw).ladders);
  const out = {} as Record<Material, Material[]>;
  for (const m of materials) {
    const steps = r[m];
    if (!Array.isArray(steps) || steps.length === 0 || steps.some((s) => !(materials as readonly string[]).includes(s as string))) {
      fail(`ladders.${m}`, 'expected a non-empty list of materials');
    }
    out[m] = steps as Material[];
  }
  return out;
}

const LESSON_FIELDS = ['stage', 'friendly', 'control', 'focus', 'focusWeak', 'material', 'wordLen', 'trap', 'noWords', 'chants', 'attacks', 'rows', 'g', 'c', 'warmup'];

/** Советы урока: строка или непустой список непустых строк. */
function parseTips(text: Rec, where: string): string[] {
  const tip: unknown = text.tip;
  const tips: unknown[] = Array.isArray(tip) ? tip : [tip];
  if (tips.length === 0 || tips.some((t) => typeof t !== 'string' || t === '')) fail(where, 'expected tip');
  return tips as string[];
}

/**
 * Уроки одной лиги по пакету, в порядке `order`. Буквы урока — `newKeys` ступеней до его ступени включительно;
 * номер урока — место в `order` (id остаётся прежним при вставке урока, 016-Р4).
 */
export function parseLessons(pack: Pack, ctx: LessonsContext): CourseLesson[] {
  const { keymap: map, layout } = ctx;
  const file: unknown = pack.lessons;
  const root = rec(file);
  known(root, ['order', 'rowWidth', 'stages', 'ladders', 'lengthBands', 'lessons'], 'file');
  if (pack.manifest.league !== ctx.league) fail('file', `file is for league ${String(pack.manifest.league)}, expected ${ctx.league}`);
  if (!map.layouts.includes(layout)) fail('file', `bad layout ${layout}`);
  const text = pack.text[ctx.lang];
  if (text === undefined) fail('file', `no text for language ${ctx.lang}`);
  const rowWidth = int(root, 'rowWidth', 'file', 1);
  const ladders = parseLadders(file);
  const stages = parseStages(file, map, layout, rec(rec(text).stages));
  const bands = parseBands(file, stages);
  const order = list(file, 'order');
  if (order.length !== ctx.lessons) fail('file', `expected ${ctx.lessons} lessons, got ${order.length}`);
  const byId = rec(root.lessons);

  // Id — первым делом: формат и повтор ловятся до чтения самих уроков.
  const ids = new Set<string>();
  order.forEach((rawId, i) => {
    const where = `lessons[${i}]`;
    if (typeof rawId !== 'string' || !ID_RE.test(rawId) || rawId.split('.')[1] !== ctx.league) fail(where, `id ${String(rawId)} must be <course>.${ctx.league}.<word>`);
    if (ids.has(rawId)) fail(where, `duplicate id ${rawId}`);
    ids.add(rawId);
  });
  let prevStage = 0;
  return order.map((rawId, i): CourseLesson => {
    const where = `lessons[${i}]`;
    // Номер — место в списке; id хранится в сохранении и при вставке урока остаётся прежним (016-Р4).
    const n = i + 1;
    const id = rawId as string;
    const r = rec(byId[id]);
    known(r, LESSON_FIELDS, where);
    const words = rec(rec(rec(text).lessons)[id]);
    const stage = int(r, 'stage', where, 1);
    if (!stages.some((s) => s.n === stage)) fail(where, `unknown stage ${stage}`);
    if (stage < prevStage) fail(where, `stage ${stage} goes down`);
    const firstOfStage = stage !== prevStage;
    prevStage = stage;
    const keys = unique(stages.filter((s) => s.n <= stage).map((s) => s.newKeys).join('')).join('');
    const newKeys = firstOfStage ? (stages.find((s) => s.n === stage)?.newKeys ?? '') : '';
    const focus = r.focus === undefined ? newKeys : str(r, 'focus', where);
    for (const ch of focus) if (!keys.includes(ch)) fail(where, `focus ${ch} is not in keys`);
    const material = str(r, 'material', where);
    if (!(materials as readonly string[]).includes(material)) fail(where, `bad material ${material}`);
    const tips = parseTips(words, where);
    const attacks = r.attacks;
    const ladder = ladders[material as Material];
    if (!Array.isArray(attacks) || attacks.length < 3 || attacks.length > 6 || attacks.some((a) => !Number.isInteger(a) || (a as number) < 1)) {
      fail(where, 'expected 3..6 attacks');
    }
    if (attacks.length !== ladder.length) fail(where, `expected ${ladder.length} attacks for ladder of ${material}`);
    const rows = int(r, 'rows', where, 1, 3);
    if (Math.max(...(attacks as number[])) > rows * rowWidth) fail(where, `attack does not fit ${rows} rows`);
    const g = int(r, 'g', where, 0);
    const c = int(r, 'c', where, 1);
    if (g >= c) fail(where, 'expected g < c');
    const warmup = int(r, 'warmup', where, 0);
    const match = warmup + 2 * (attacks as number[]).reduce((a, b) => a + b, 0);
    const band = bands.find((b) => stage >= b.from && stage <= b.to);
    if (!band) fail(where, `no length band for stage ${stage}`);
    if (match < band.min || match > band.max) fail(where, `match length ${match} is outside ${band.min}..${band.max}`);
    // Ловушка смены (генератор атак) строится на двух новых буквах урока: «а а а о о о».
    const trap = flag(r, 'trap', where);
    if (trap && unique(newKeys).length !== 2) fail(where, 'trap needs exactly two new keys');
    const lesson: CourseLesson = {
      id,
      league: ctx.league,
      n,
      stage,
      name: str(words, 'name', where),
      friendly: flag(r, 'friendly', where),
      control: flag(r, 'control', where),
      keys,
      newKeys,
      focus,
      focusWeak: r.focusWeak === undefined ? 0 : int(r, 'focusWeak', where, 0, 5),
      material: material as Material,
      trap,
      noWords: flag(r, 'noWords', where),
      chants: flag(r, 'chants', where),
      attacks: attacks as number[],
      rows,
      g,
      c,
      warmup,
      tips,
      layout,
      rowWidth,
      ladder,
    };
    if (r.wordLen !== undefined) {
      const w = r.wordLen;
      if (!Array.isArray(w) || w.length !== 2 || !w.every((v) => Number.isInteger(v) && (v as number) >= 1) || (w[0] as number) > (w[1] as number)) {
        fail(where, 'expected wordLen [min, max]');
      }
      lesson.wordLen = [w[0] as number, w[1] as number];
    }
    return lesson;
  });
}
