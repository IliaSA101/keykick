/**
 * Курс v2: разбор трёх схем контента (спека 016, design §1) — каркас лиг, уроки лиги, словарь.
 * Чистые функции без Vue и DOM. Загрузку файлов делает `app/course/load.ts`.
 */
import { findChar, isLetter, layouts, type Keymap, type Layout } from '../keymap';
import { fail, materials, unique, type Material } from '../lessonModel';

export const depths = ['full', 'base', 'frame'] as const;
export type Depth = (typeof depths)[number];

export interface League {
  id: string;
  name: string;
  depth: Depth;
  part: string;
  keys: string;
  lessons: number;
  cup: string;
  stadium: string;
  skill: string;
  story: string;
  shiftFrom?: number;
  games?: { learn: string[]; fun: string[] };
  /** Якоря карты (019-Р5): уроки-кубки и этапы стадиона; у `full`/`base` обязательны. */
  anchors?: Anchors;
}

export interface Anchors {
  /** Номера уроков, после которых кубок (флажки карты), по возрастанию. */
  cup: number[];
  stadium: { after: number; name: string }[];
}

export interface CourseLesson {
  id: string;
  league: string;
  /** Номер в лиге, с 1. */
  n: number;
  stage: number;
  name: string;
  friendly: boolean;
  control: boolean;
  keys: string;
  newKeys: string;
  focus: string;
  focusWeak: number;
  material: Material;
  wordLen?: [number, number];
  trap: boolean;
  noWords: boolean;
  chants: boolean;
  attacks: number[];
  rows: number;
  g: number;
  c: number;
  warmup: number;
  tips: string[];
  layout: Layout;
  /** Ширина строки атаки в знаках (из файла лиги). */
  rowWidth: number;
  /** Лесенка материала урока: `ladders[material]`, по одной ступени на атаку. */
  ladder: Material[];
}

export interface Dictionary {
  words: string[];
  phrases: string[];
  chants: string[];
}

type Rec = Record<string, unknown>;

const rec = (item: unknown): Rec => (item && typeof item === 'object' && !Array.isArray(item) ? (item as Rec) : {});

/** Белый список ключей: опечатка в имени поля не должна молча пропадать. */
function known(r: Rec, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(r)) if (!allowed.includes(key)) fail(where, `unknown field ${key}`);
}

function str(r: Rec, key: string, where: string, allowEmpty = false): string {
  const v = r[key];
  if (typeof v !== 'string' || (!allowEmpty && v === '')) fail(where, `expected ${key}`);
  return v;
}

function int(r: Rec, key: string, where: string, min: number, max = Infinity): number {
  const v = r[key];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) fail(where, `expected integer ${key} in ${min}..${max}`);
  return v;
}

function flag(r: Rec, key: string, where: string): boolean {
  const v = r[key];
  if (v !== undefined && typeof v !== 'boolean') fail(where, `expected boolean ${key}`);
  return v === true;
}

function onLayout(map: Keymap, layout: Layout, text: string, where: string): void {
  for (const ch of text) if (!findChar(map, layout, ch)) fail(where, `key ${ch} is not on the ${layout} layout`);
}

function list(raw: unknown, key: string): unknown[] {
  const v = rec(raw)[key];
  if (!Array.isArray(v) || v.length === 0) fail('file', `expected ${key}`);
  return v;
}

/** Целые 1…max строго по возрастанию. */
function ascending(nums: number[], max: number, where: string): void {
  nums.forEach((v, i) => {
    if (!Number.isInteger(v) || v < 1 || v > max) fail(where, `expected integers in 1..${max}`);
    if (i > 0 && v <= nums[i - 1]!) fail(where, 'expected strictly ascending numbers');
  });
}

function parseAnchors(raw: unknown, lessons: number, where: string): Anchors {
  const r = rec(raw);
  known(r, ['cup', 'stadium'], where);
  if (!Array.isArray(r.cup) || r.cup.length === 0) fail(where, 'expected cup');
  const cup = r.cup as number[];
  ascending(cup, lessons, `${where}.cup`);
  if (!Array.isArray(r.stadium) || r.stadium.length === 0) fail(where, 'expected stadium');
  const stadium = r.stadium.map((item, i) => {
    const w = `${where}.stadium[${i}]`;
    const s = rec(item);
    known(s, ['after', 'name'], w);
    return { after: int(s, 'after', w, 1, lessons), name: str(s, 'name', w) };
  });
  ascending(stadium.map((x) => x.after), lessons, `${where}.stadium`);
  return { cup, stadium };
}

/** Каркас лиг: `leagues.json`. */
export function parseLeagues(raw: unknown, map: Keymap): League[] {
  known(rec(raw), ['about', 'leagues'], 'file');
  const ids = new Set<string>();
  return list(raw, 'leagues').map((item, n): League => {
    const r = rec(item);
    const where = `leagues[${n}]`;
    known(r, ['id', 'name', 'depth', 'part', 'keys', 'lessons', 'cup', 'stadium', 'skill', 'story', 'shiftFrom', 'games', 'anchors'], where);
    const id = str(r, 'id', where);
    if (!/^[a-z]+$/.test(id)) fail(where, `id ${id} must be latin`);
    if (ids.has(id)) fail(where, `duplicate id ${id}`);
    ids.add(id);
    const depth = str(r, 'depth', where);
    if (!(depths as readonly string[]).includes(depth)) fail(where, `bad depth ${depth}`);
    const keys = str(r, 'keys', where, true);
    onLayout(map, 'ru', keys, where);
    const league: League = {
      id,
      name: str(r, 'name', where),
      depth: depth as Depth,
      part: str(r, 'part', where),
      keys,
      lessons: int(r, 'lessons', where, 1),
      cup: str(r, 'cup', where),
      stadium: str(r, 'stadium', where),
      skill: str(r, 'skill', where),
      story: str(r, 'story', where),
    };
    if (r.shiftFrom !== undefined) {
      league.shiftFrom = int(r, 'shiftFrom', where, 2);
      if (league.shiftFrom > league.lessons) fail(where, `shiftFrom ${league.shiftFrom} is after the last lesson ${league.lessons}`);
    }
    if (r.games !== undefined) {
      const g = rec(r.games);
      known(g, ['learn', 'fun'], `${where}.games`);
      const names = (key: string, max: number): string[] => {
        const v = g[key];
        if (!Array.isArray(v) || v.length < 1 || v.length > max || v.some((s) => typeof s !== 'string' || s === '')) {
          fail(where, `expected games.${key} with 1..${max} names`);
        }
        return v as string[];
      };
      league.games = { learn: names('learn', 2), fun: names('fun', 1) };
    }
    if (r.anchors !== undefined) league.anchors = parseAnchors(r.anchors, league.lessons, `${where}.anchors`);
    else if (depth !== 'frame') fail(where, `expected anchors for depth ${depth}`);
    return league;
  });
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

function parseStages(raw: unknown, map: Keymap, layout: Layout): Stage[] {
  const seen = new Set<number>();
  return list(raw, 'stages').map((item, i) => {
    const r = rec(item);
    const where = `stages[${i}]`;
    known(r, ['n', 'name', 'newKeys'], where);
    const n = int(r, 'n', where, 1);
    if (seen.has(n)) fail(where, `duplicate stage ${n}`);
    seen.add(n);
    str(r, 'name', where);
    const newKeys = str(r, 'newKeys', where, true);
    onLayout(map, layout, newKeys, where);
    return { n, newKeys };
  });
}

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

/** Уроки одной лиги: `lessons-<лига>.json`. Буквы урока — `newKeys` ступеней до его ступени включительно. */
export function parseLeagueLessons(raw: unknown, map: Keymap, league: League): CourseLesson[] {
  const root = rec(raw);
  known(root, ['about', 'league', 'layout', 'rowWidth', 'ladders', 'lengthBands', 'stages', 'lessons'], 'file');
  if (root.league !== league.id) fail('file', `file is for league ${String(root.league)}, expected ${league.id}`);
  const layout = str(root, 'layout', 'file');
  if (!(layouts as readonly string[]).includes(layout)) fail('file', `bad layout ${layout}`);
  const rowWidth = int(root, 'rowWidth', 'file', 1);
  const ladders = parseLadders(raw);
  const stages = parseStages(raw, map, layout as Layout);
  const bands = parseBands(raw, stages);
  const items = list(raw, 'lessons');
  if (items.length !== league.lessons) fail('file', `expected ${league.lessons} lessons, got ${items.length}`);

  const ids = new Set<string>();
  let prevStage = 0;
  return items.map((item, i): CourseLesson => {
    const r = rec(item);
    const where = `lessons[${i}]`;
    known(r, ['id', 'stage', 'name', 'friendly', 'control', 'focus', 'focusWeak', 'material', 'wordLen', 'trap', 'noWords', 'chants', 'attacks', 'rows', 'g', 'c', 'warmup', 'tip'], where);
    // Номер — место в списке; id хранится в сохранении и при вставке урока остаётся прежним (016-Р4).
    const n = i + 1;
    const id = str(r, 'id', where);
    if (!new RegExp(`^${league.id}-\\d\\d$`).test(id)) fail(where, `id ${id} must be ${league.id}-NN`);
    if (ids.has(id)) fail(where, `duplicate id ${id}`);
    ids.add(id);
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
    const tip: unknown = r.tip;
    const tips: unknown[] = Array.isArray(tip) ? tip : [tip];
    if (tips.length === 0 || tips.some((t) => typeof t !== 'string' || t === '')) fail(where, 'expected tip');
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
      league: league.id,
      n,
      stage,
      name: str(r, 'name', where),
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
      tips: tips as string[],
      layout: layout as Layout,
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

/** Слова, фразы и кричалки: `dictionary.json`. Всё строчными буквами раскладки. */
export function parseDictionary(raw: unknown, map: Keymap, layout: Layout): Dictionary {
  const part = rec(rec(raw)[layout]);
  const read = (key: keyof Dictionary, multi: boolean): string[] => {
    const v = part[key];
    if (!Array.isArray(v)) fail(`dictionary.${layout}`, `expected ${key} list`);
    const seen = new Set<string>();
    return v.map((entry: unknown, n) => {
      const where = `dictionary.${layout}.${key}[${n}]`;
      if (typeof entry !== 'string' || entry === '') fail(where, 'expected string');
      if (seen.has(entry)) fail(where, `duplicate ${entry}`);
      seen.add(entry);
      if (multi && (entry.startsWith(' ') || entry.endsWith(' ') || entry.includes('  '))) fail(where, `${entry}: bad spaces`);
      for (const ch of entry) {
        if (multi && ch === ' ') continue;
        const hit = findChar(map, layout, ch);
        if (!hit || hit.shift || !isLetter(ch) || ch !== ch.toLowerCase()) fail(where, `${entry}: ${ch} is not a lowercase letter`);
      }
      return entry;
    });
  };
  return { words: read('words', false), phrases: read('phrases', true), chants: read('chants', true) };
}

/** Фраза и кричалка не длиннее строки атаки (design §1.3): `width` — наименьший `rowWidth` курса. */
export function checkDictionaryFits(d: Dictionary, width: number): void {
  for (const key of ['phrases', 'chants'] as const) {
    d[key].forEach((entry, n) => {
      if (entry.length > width) fail(`dictionary.${key}[${n}]`, `${entry}: longer than ${width}`);
    });
  }
}
