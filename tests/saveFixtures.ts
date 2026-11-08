/** Общие фикстуры тестов сохранения (разбор — save.test.ts, переходы — saveRules.test.ts). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ref } from 'vue';
import { expect } from 'vitest';
import { registry } from '../src/app/save/registry';
import { createSaveStore } from '../src/app/save/store';
import { createSectionLayer } from '../src/app/save/tx';
import { defineSection, int, type SaveContext, type SectionDef } from '../src/engine/save/section';
import { NEXT, TODAY, ctx, memory } from './saveStoreHelpers';

// ───────────── тестовый раздел `probe` (018-Т6б): замена `legacy` как опоры тестов слоя хранилища ─────────────

/**
 * Поля, на которые опирались тесты слоя: счётчики (`goals`, `matches`, `coins`), словари (`days`, `keyErrors`) и строка.
 * Разбор чинит по полям, как разделы v2: мусор — 0 / пусто, дроби — вниз, потолки. Раздела в реестре игры нет.
 */
export interface Probe {
  goals: number;
  matches: number;
  coins: number;
  keyErrors: Record<string, number>;
  days: Record<string, number>;
  lessonId: string;
}

const rec = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function dict(v: unknown, max: number, keyOk: (k: string) => boolean): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(rec(v))) if (keyOk(k) && typeof x === 'number') out[k] = int(x, 0, max);
  return out;
}

export const probe: SectionDef<Probe> = defineSection<Probe>({
  name: 'probe',
  owner: 'test',
  parse: (raw) => {
    const r = rec(raw);
    return {
      goals: int(r.goals, 0, 1_000_000),
      matches: int(r.matches, 0, 1_000_000),
      coins: int(r.coins, 0, 100_000),
      keyErrors: dict(r.keyErrors, 20, (k) => k.length > 0 && k.length <= 64),
      days: dict(r.days, 86_400_000, (k) => /^\d{4}-\d{2}-\d{2}$/.test(k)),
      lessonId: typeof r.lessonId === 'string' ? r.lessonId.slice(0, 40) : '',
    };
  },
  empty: () => ({ goals: 0, matches: 0, coins: 0, keyErrors: {}, days: {}, lessonId: '' }),
  sample: () => ({ goals: 12, matches: 7, coins: 140, keyErrors: { KeyF: 4 }, days: { '2026-11-03': 600_000 }, lessonId: 'yard-04' }),
  maxSample: () => ({ goals: 1_000_000, matches: 1_000_000, coins: 100_000, keyErrors: {}, days: {}, lessonId: '' }),
  counters: () => ({}),
  check: () => [],
});

/** Реестр тестов слоя хранилища: один `probe`. */
export const PROBES: readonly SectionDef[] = [probe];

export const full: Probe = {
  goals: 12,
  matches: 7,
  coins: 140,
  keyErrors: { KeyF: 4, KeyJ: 1 },
  days: { '2026-11-03': 600_000, '2026-11-04': 120_000 },
  lessonId: 'yard-04',
};

// ───────────── голдены и формы (014-Т2): файлы создаются только при отсутствии, без снапшотов ─────────────

export const GOLDEN_DIR = join(import.meta.dirname, 'golden');

/**
 * Файл есть — значение должно `toEqual` ему; файла нет — красное с подсказкой (побочных эффектов нет).
 * Создать файл можно только явно: `KK_GOLDEN_WRITE=1 npx vitest run` (форма нового номера, голден выпуска). Флага `-u` нет.
 */
export function matchGolden(name: string, value: unknown, hint: string): void {
  const path = join(GOLDEN_DIR, name);
  if (!existsSync(path)) {
    if (process.env.KK_GOLDEN_WRITE !== '1') {
      throw new Error(`${name}: файла нет. Новый номер формата — создайте явно: KK_GOLDEN_WRITE=1 npx vitest run. ${hint}`);
    }
    mkdirSync(GOLDEN_DIR, { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  const stored: unknown = JSON.parse(readFileSync(path, 'utf8'));
  expect(JSON.parse(JSON.stringify(value)), `${name}: ${hint}`).toEqual(stored);
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  return Array.isArray(v) ? 'array' : typeof v;
}

/** Форма: пути полей → типы (массивы — `[]`, типы разных элементов склеиваются через `|`). */
export function shapeOf(value: unknown, path = '', out: Record<string, string> = {}): Record<string, string> {
  const key = path === '' ? '(root)' : path;
  const have = out[key]?.split('|') ?? [];
  out[key] = [...new Set([...have, typeOf(value)])].sort().join('|');
  if (Array.isArray(value)) {
    for (const item of value) shapeOf(item, `${path}[]`, out);
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) shapeOf(v, path === '' ? k : `${path}.${k}`, out);
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

// ───────────── образец без пустот и сверка с голденом выпуска (018-Т1, Б1, В1) ─────────────

/**
 * Пути, где образец раздела пуст: `null`, `[]`, `{}` на любой глубине. Такой образец не показывает форму —
 * `shapeOf` обходит только то, что есть, и новое поле записи прошло бы мимо голдена (018 design §1, Б1).
 */
export function fullGaps(value: unknown, path = ''): string[] {
  const at = path === '' ? '(root)' : path;
  if (value === null) return [`${at}: null`];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${at}: []`];
    return value.flatMap((item, i) => fullGaps(item, `${path}[${i}]`));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return [`${at}: {}`];
    return entries.flatMap(([k, v]) => fullGaps(v, path === '' ? k : `${path}.${k}`));
  }
  return [];
}

/** Образец раздела обязан быть полным: иначе красное с путём пустоты. */
export function assertFull(value: unknown, what = 'sample'): void {
  const gaps = fullGaps(value);
  if (gaps.length > 0) throw new Error(`${what}: образец с пустотами — ${gaps.join('; ')}`);
}

/**
 * Сверка разобранного голдена выпуска (В1): раздел, который был в выпущенном формате, равен ожиданию;
 * раздел, добавленный после выпуска, равен `empty(ctx)`. Пусто — всё сошлось. Реестр — параметр, чтобы
 * проверять саму сверку на синтетике.
 */
export function compareReleased(
  expected: Record<string, unknown>,
  parsed: Record<string, unknown>,
  registry: readonly SectionDef[],
  ctx: SaveContext,
): string[] {
  const bad: string[] = [];
  const same = (a: unknown, b: unknown): boolean => isDeepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)));
  for (const def of registry) {
    const released = def.name in expected;
    // Ожидание через JSON: `undefined`-поля и прочее, чего в файле быть не может, не расходятся с файлом.
    const want = released ? expected[def.name] : def.empty(ctx);
    if (!same(parsed[def.name], want)) {
      bad.push(`${def.name}: ${released ? 'не равен ожиданию выпуска' : 'новый раздел не равен empty()'}`);
    }
  }
  // Ключи вне реестра (незнакомые разделы) хранятся как есть: ни потерять, ни добавить их разбор не должен (018-Р18).
  const known = new Set(registry.map((d) => d.name));
  for (const key of new Set([...Object.keys(expected), ...Object.keys(parsed)])) {
    if (!known.has(key) && !(key in expected && key in parsed && same(parsed[key], expected[key]))) bad.push(`${key}: ключ вне реестра изменился`);
  }
  return bad;
}

// ───────────── две вкладки на одном хранилище (018-Т2, К16) ─────────────

/**
 * Два слоя 014 и два слоя транзакций на одном хранилище в памяти: игрок `p1` загружен в обеих «вкладках»
 * (`a`, `b`). Тест «вторая вкладка между двумя записями» — у каждого писателя (017-Т5, 021, 026).
 */
export function twoTabs(opts: { prefix?: string; channel?: string; quota?: number; freeze?: boolean } = {}) {
  const prefix = opts.prefix ?? NEXT;
  const mem = memory({}, opts.quota === undefined ? {} : { quota: opts.quota });
  const tabCtx = ctx;
  const cur = ref<string | null>('p1');
  const tab = () => {
    const store = createSaveStore({
      prefix,
      channel: opts.channel ?? 'next',
      storage: mem.io,
      sections: registry,
      now: () => 1_800_000_000_000,
      today: () => TODAY,
      app: '0.10.1',
      ctx: tabCtx,
    });
    const layer = createSectionLayer({ store, registry, ctx: tabCtx, currentId: () => cur.value, freeze: opts.freeze ?? true });
    return { store, ...layer };
  };
  const a = tab();
  a.store.create('p1');
  const b = tab();
  b.store.load('p1');
  // Как `sections.ts` + `progress.followActive`: чужая запись активного игрока освежает `sectionRef` вкладки a.
  a.store.follow('p1', () => a.refreshRefs());
  return { ...mem, a, b, cur, key: `${prefix}save.p1` };
}
