/**
 * Курс: разминка урока (спека 016, design §3) — два удара по 2–3 строки на `warmup` знаков.
 * Чистые функции без Vue и DOM: случайность — от зерна. Строки атак тайма — в `attack.ts`.
 */
import { HOME_KEYS, lettersOf, unique } from './lessonModel';
import { createRandom, randomInt } from '../random';
import type { Keymap } from '../typing/keymap';
import type { TypingStats } from '../typing/typing';
import type { CourseLesson, Dictionary } from './lesson';

/** Букв фокуса в разминке — не больше. */
const WARMUP_MAX_KEYS = 12;
/** Соль зерна: разминка не повторяет текст тайма. */
const SALT_WARMUP = 0x5eed;

/** Перемешанные круги букв: каждая буква появится, прежде чем какая-то повторится. */
function letterStream(rnd: () => number, letters: readonly string[], count: number): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const round = [...letters];
    for (let i = round.length - 1; i > 0; i--) {
      const j = randomInt(rnd, i + 1);
      [round[i], round[j]] = [round[j] ?? '', round[i] ?? ''];
    }
    if (round.length > 1 && round[0] === out.at(-1)) round.push(round.shift() ?? '');
    out.push(...round);
  }
  return out.slice(0, count);
}

/** Удар разминки: буквы, пары (с «осью» — буквой, которая есть в каждой паре) и сколько знаков он занимает. */
interface Kick {
  kind: 'letters' | 'pairs';
  letters: string[];
  pivot?: string;
}

/**
 * План ударов (правило v1 `warmupPlan`, 016-Р12): новые буквы урока, без них — фокус (до 12), без фокуса — основной
 * ряд. Одна буква — её удар и пары с соседями по фокусу («эж жэ»), а не шесть строк «э э э». Несколько букв: пары
 * идут вторым ударом, если лесенка их знает; без пар — два удара буквами по половине набора.
 */
function warmupKicks(l: CourseLesson): Kick[] {
  const fresh = unique(l.newKeys);
  const base = fresh.length > 0 ? fresh : l.focus ? unique(l.focus).slice(0, WARMUP_MAX_KEYS) : lettersOf(l).slice(0, HOME_KEYS);
  const pairs = l.ladder.some((m) => m !== 'letters');
  if (base.length === 1) {
    const ch = base[0] ?? '';
    const mates = unique(l.focus).filter((c) => c !== ch);
    const others = mates.length > 0 ? mates : lettersOf(l).filter((c) => c !== ch).slice(0, 2);
    if (others.length === 0) return [{ kind: 'letters', letters: [ch] }, { kind: 'letters', letters: [ch] }];
    return [{ kind: 'letters', letters: [ch] }, pairs ? { kind: 'pairs', letters: others, pivot: ch } : { kind: 'letters', letters: [ch, ...others] }];
  }
  if (pairs) return [{ kind: 'letters', letters: base }, { kind: 'pairs', letters: base }];
  const half = Math.ceil(base.length / 2);
  return [{ kind: 'letters', letters: base.slice(0, half) }, { kind: 'letters', letters: base.slice(half) }];
}

/** Строки удара ровно на `budget` знаков (пробелы считаются), каждая не длиннее `cap`; зерно `seed` даёт тот же текст. */
function fillKick(kick: Kick, seed: number, budget: number, cap: number): string[] {
  const rnd = createRandom(seed);
  const isPairs = kick.kind === 'pairs';
  // С осью поток — «соседи» по кругу, пара собирается с осью в случайном порядке.
  const stream = letterStream(rnd, kick.letters, budget * 2);
  const rows: string[] = [];
  let left = budget;
  let at = 0;
  while (left > 0) {
    const tokens: string[] = [];
    let length = 0;
    while (left > 0) {
      const gap = tokens.length > 0 ? 1 : 0;
      if (left - gap < 1) break;
      const size = isPairs && left - gap >= 2 ? 2 : 1;
      let t: string;
      if (kick.pivot !== undefined && size === 2) t = rnd() < 0.5 ? kick.pivot + (stream[at] ?? '') : (stream[at] ?? '') + kick.pivot;
      else if (kick.pivot !== undefined) t = kick.pivot;
      else t = stream.slice(at, at + size).join('');
      // Та же пара дважды подряд не идёт — повтор переворачивается («вл лв вл»).
      if (size === 2 && t === tokens.at(-1)) t = [...t].reverse().join('');
      if (gap > 0 && length + 1 + t.length > cap) break;
      tokens.push(t);
      at += kick.pivot !== undefined ? 1 : size;
      length += gap + t.length;
      left -= gap + t.length;
    }
    rows.push(tokens.join(' '));
  }
  return rows;
}

/**
 * Удар в 2–3 строки (016-Р12): ширина строки подбирается так, чтобы знаки легли ровно в 2 строки (иначе в 3), а
 * последняя строка вышла самой длинной — без хвоста из одной буквы. Не легло — null.
 */
function fitKick(kick: Kick, seed: number, budget: number, rowWidth: number): string[] | null {
  for (const n of [2, 3]) {
    let best: string[] | null = null;
    for (let cap = Math.max(1, Math.ceil(budget / n)); cap <= rowWidth; cap++) {
      const rows = fillKick(kick, seed, budget, cap);
      if (rows.length <= n && (best === null || (rows.at(-1)?.length ?? 0) > (best.at(-1)?.length ?? 0))) best = rows;
    }
    if (best) return best;
  }
  return null;
}

/**
 * Разминка: ровно `warmup` знаков строками не длиннее `rowWidth`, два удара по 2–3 строки (урок 1 тоже).
 * Состав ударов — `warmupKicks`. Знаки делятся пополам; если ряд из одиночных букв так не ложится (строка из
 * одиночных букв всегда нечётной длины), доля одного удара сдвигается на несколько знаков.
 * Результат — удары-блоки строк, как в v1 (`makeWarmup`).
 * `_d`, `_map`, `_stats` — зарезервировано контрактом §3 (разминка пока не зависит от словаря и ошибок).
 */
export function makeCourseWarmup(l: CourseLesson, _d: Dictionary, _map: Keymap, seed: number, _stats?: TypingStats): string[][] {
  if (l.warmup <= 0) return [];
  const rnd = createRandom(seed ^ SALT_WARMUP);
  const kicks = warmupKicks(l);
  const seeds = kicks.map(() => randomInt(rnd, 0x7fffffff));
  const first = Math.ceil(l.warmup / 2);
  for (const shift of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    const budgets = [first + shift, l.warmup - first - shift];
    const blocks = kicks.map((kick, k) => (budgets[k]! > 0 ? fitKick(kick, seeds[k]!, budgets[k]!, l.rowWidth) : []));
    if (blocks.every((b) => b !== null)) return blocks;
  }
  // Не легло и так (узкая строка или очень длинная разминка): ровные удары по ширине строки, строк — сколько выйдет.
  return kicks.map((kick, k) => fillKick(kick, seeds[k]!, k === 0 ? first : l.warmup - first, l.rowWidth));
}
