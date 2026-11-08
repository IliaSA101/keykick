/**
 * Окружение цепочек сохранения (018-Т5, design §8): хранилище на двух вкладках, общие действия, семь инвариантов, прогон
 * `runChain`. Общее для tests/saveChain.test.ts (прогоны по семенам) и tests/saveChainGuards.test.ts (сторож видит нарушение).
 * Действия разделов лежат рядом (`./<name>.ts`) и подбираются маской в saveChain.test.ts — здесь маски нет.
 */
import { isDeepStrictEqual } from 'node:util';
import { courseLessons, leagues } from '../../src/app/course/load';
import { keymap } from '../../src/app/keymap';
import { registry } from '../../src/app/save/registry';
import { createSaveStore, type SaveStore } from '../../src/app/save/store';
import { createSectionLayer, type SectionLayer } from '../../src/app/save/tx';
import { section as courseSection } from '../../src/engine/course/save';
import type { JournalInput } from '../../src/engine/journal/records';
import { section as matchSection } from '../../src/engine/match/save';
import { createRandom } from '../../src/engine/random';
import type { RewardKind } from '../../src/engine/save/rewards';
import type { Catalog } from '../../src/engine/save/section';
import { section as schoolSection } from '../../src/engine/school/save';
import { TASK_NO_MAX } from '../../src/engine/tasks';
import { credit } from '../../src/engine/wallet/wallet';
import { edit, oneOf, upTo, type ChainAction, type ChainCtx } from './types';
import { passLesson } from './course';
import { twoTabs } from '../saveFixtures';
import { NEXT, TODAY } from '../saveStoreHelpers';

export const STEPS = 200;
export const PLAYERS = ['p1', 'p2', 'p3', 'p4'];
export const DAY = 86_400_000;
export const START = 1_800_000_000_000;

export const cat: Catalog = {
  lessonIds: courseLessons.map((l) => l.id),
  leagueIds: leagues.map((l) => l.id),
  keyCodes: [...keymap.byCode.keys()],
  taskNoMax: TASK_NO_MAX,
};


// ───────────── окружение: хранилище, вкладки, журнал ─────────────

export type Sections = Record<string, unknown>;
export type Tab = SectionLayer & { store: SaveStore };
export interface Env {
  t: ReturnType<typeof twoTabs>;
  a: Tab;
  b: Tab;
  follow(id: string): void;
  journal: Array<{ player: string; rec: JournalInput }>;
}

export const keyOf = (id: string): string => `${NEXT}save.${id}`;
export const tabCtx = { version: '0.10.1', lessonIds: courseLessons.slice(0, 5).map((l) => l.id) };

export function lying(env: Env, id: string): Sections {
  const text = env.t.data.get(keyOf(id));
  return text === undefined ? {} : ((JSON.parse(text) as { sections?: Sections }).sections ?? {});
}

/** Новый слой (вкладка) на том же хранилище — как перезагрузка страницы. */
export function newTab(env: Pick<Env, 't' | 'journal'>, cur: () => string): Tab {
  const store = createSaveStore({ prefix: NEXT, channel: 'next', storage: env.t.io, sections: registry, now: () => START, today: () => TODAY, app: '0.10.1', ctx: tabCtx });
  const layer = createSectionLayer({ store, registry, ctx: tabCtx, currentId: cur, freeze: true });
  layer.setJournalSink((recs, player) => void env.journal.push(...recs.map((rec) => ({ player, rec }))));
  return { ...layer, store };
}

export function setup(): Env {
  const t = twoTabs();
  const env = { t, journal: [] as Env['journal'] } as Env;
  for (const id of PLAYERS.slice(1)) t.a.store.create(id);
  env.a = t.a;
  env.b = t.b;
  env.a.setJournalSink((recs, player) => void env.journal.push(...recs.map((rec) => ({ player, rec }))));
  env.b.setJournalSink((recs, player) => void env.journal.push(...recs.map((rec) => ({ player, rec }))));
  env.follow = (id) => {
    env.a.store.follow(id, () => env.a.refreshRefs());
  };
  env.follow('p1');
  return env;
}

// ───────────── общие действия ─────────────

export class Invariant extends Error {
  constructor(
    readonly n: number,
    text: string,
  ) {
    super(text);
  }
}

export interface Step {
  name: string;
  rewards: RewardKind[];
  mayDecrease?: string[];
  run(env: Env, rnd: () => number, ctx: ChainCtx, clock: { now: number }): void;
}

export const inTx = (a: ChainAction): Step => ({
  name: a.name,
  rewards: a.rewards,
  ...(a.mayDecrease ? { mayDecrease: a.mayDecrease } : {}),
  run: (env, rnd, ctx) => env.a.updatePlayer((tx) => a.run(tx, rnd, ctx)),
});

export const common: Step[] = [
  {
    name: 'switchPlayer',
    rewards: [],
    run: (env, rnd, ctx) => {
      const id = oneOf(rnd, PLAYERS.filter((p) => p !== ctx.player));
      env.t.cur.value = id;
      env.a.store.load(id);
      env.follow(id);
    },
  },
  {
    // Перезагрузка страницы: новый слой на том же хранилище, память — из лежащего.
    name: 'reload',
    rewards: [],
    run: (env, _rnd, ctx) => {
      const fresh = newTab(env, () => env.t.cur.value ?? 'p1');
      fresh.store.load(ctx.player);
      env.a = fresh;
      env.follow(ctx.player);
    },
  },
  {
    // Вторая вкладка между двумя записями первой: зачислила монеты — в лежащем должны быть все три изменения (инвариант 7).
    name: 'secondTab',
    rewards: ['coins', 'stars'],
    run: (env, rnd, ctx) => {
      const id = ctx.player;
      const before = lying(env, id) as { wallet: { coins: number; earned: number }; school: { expert: number } };
      env.a.updatePlayer((tx) => void passLesson(tx, rnd, ctx));
      const course1 = lying(env, id).course;
      const k = 1 + upTo(rnd, 30);
      env.b.updatePlayer((tx) => credit(tx, k, 'prize', 'tab'));
      env.a.updatePlayer((tx) => {
        const s = edit(tx, schoolSection);
        s.expert += 1;
        tx.set(schoolSection, s);
      });
      const now = lying(env, id) as { wallet: { coins: number; earned: number }; school: { expert: number }; course: unknown };
      if (now.wallet.coins !== before.wallet.coins + k || now.wallet.earned !== before.wallet.earned + k) {
        throw new Invariant(7, `зачисление второй вкладки ${k} потеряно: coins ${before.wallet.coins} → ${now.wallet.coins}`);
      }
      if (now.school.expert !== before.school.expert + 1 || !isDeepStrictEqual(now.course, course1)) throw new Invariant(7, 'запись первой вкладки после чужой кассы потеряна или затёрла чужое');
      env.t.notify(keyOf(id));
    },
  },
  {
    // Пауза до двух недель: старые ошибки клавиш затухают, смягчение снимается; счётчики не убывают (ТЗ-0.11).
    name: 'pause',
    rewards: [],
    run: (env, rnd, _ctx, clock) => {
      clock.now += (1 + upTo(rnd, 14)) * DAY;
      env.a.updatePlayer((tx) => {
        const s = edit(tx, matchSection);
        s.keyErrors = Object.fromEntries(Object.entries(s.keyErrors).map(([k, v]) => [k, Math.floor(v / 2)] as const).filter(([, v]) => v > 0));
        s.soften = null;
        tx.set(matchSection, s);
      });
    },
  },
  {
    // Серия провалов (2–10): растут провалы урока и ошибки клавиш, помощь включается; звёзды и рекорды не трогаются (ТЗ-0.11).
    name: 'lossStreak',
    rewards: [],
    run: (env, rnd, ctx) => {
      const n = 2 + upTo(rnd, 9);
      const id = oneOf(rnd, ctx.lessonIds);
      env.a.updatePlayer((tx) => {
        const c = edit(tx, courseSection);
        const r = c.lessons[id] ?? { stars: 0, cpm: 0, acc: 0, fails: 0, help: 'none' as const, back: false };
        c.lessons[id] = { ...r, fails: Math.min(1000, r.fails + n), help: 'coach' };
        tx.set(courseSection, c);
        const m = edit(tx, matchSection);
        m.keyErrors.KeyF = (m.keyErrors.KeyF ?? 0) + n;
        m.soften = { lessonId: id, from: id };
        tx.set(matchSection, m);
      });
    },
  },
];

// ───────────── инварианты ─────────────

export const numbersOf = (v: unknown, path: string, out: Array<[string, number]> = []): Array<[string, number]> => {
  if (typeof v === 'number') out.push([path, v]);
  else if (v !== null && typeof v === 'object') for (const [k, x] of Object.entries(v)) numbersOf(x, `${path}.${k}`, out);
  return out;
};

export type Snap = Record<string, { raw: string; sections: Sections }>;
export const snap = (env: Env): Snap =>
  Object.fromEntries(PLAYERS.map((id) => [id, { raw: env.t.data.get(keyOf(id)) ?? '', sections: lying(env, id) }]));

/** Счётчики всех разделов игрока: `раздел.имя` → число. */
export function countersOf(sections: Sections): Record<string, number> {
  const out: Record<string, number> = {};
  for (const def of registry) {
    const v = sections[def.name] ?? def.empty(tabCtx);
    for (const [k, n] of Object.entries(def.counters(v))) out[`${def.name}.${k}`] = n;
  }
  return out;
}

export function checkInvariants(env: Env, before: Snap, target: string, step: Step, n: number): void {
  const after = snap(env);
  for (const id of PLAYERS) {
    const b = before[id] as Snap[string];
    const a = after[id] as Snap[string];
    if (id !== target && a.raw !== b.raw) throw new Invariant(5, `ключ игрока ${id} изменился при шаге игрока ${target}`);
    for (const def of registry) {
      const v = a.sections[def.name] ?? def.empty(tabCtx);
      const bad = def.check(v, cat);
      if (bad.length > 0) throw new Invariant(1, `${id}: ${bad.join('; ')}`);
      const frac = numbersOf(v, `${id}.${def.name}`).find(([, x]) => !Number.isInteger(x));
      if (frac) throw new Invariant(2, `не целое: ${frac[0]} = ${frac[1]}`);
    }
    const was = countersOf(b.sections);
    const now = countersOf(a.sections);
    for (const [k, x] of Object.entries(now)) {
      if (x < (was[k] ?? 0) && !step.mayDecrease?.includes(k)) throw new Invariant(3, `${id}: счётчик ${k} убыл ${was[k]} → ${x}`);
    }
    if ((now['wallet.earned'] ?? 0) > (was['wallet.earned'] ?? 0) && !step.rewards.includes('coins')) throw new Invariant(4, `${id}: выданы монеты, а действие не объявляет награду coins`);
    if ((now['course.stars'] ?? 0) > (was['course.stars'] ?? 0) && !step.rewards.includes('stars')) throw new Invariant(4, `${id}: выданы звёзды, а действие не объявляет награду stars`);
  }
  if (n % 20 === 19) {
    const probe = newTab(env, () => target);
    const disk = probe.store.load(target);
    const mem = env.a.store.memory(target);
    const strip = (v: unknown): Sections => JSON.parse(JSON.stringify(v ?? {})) as Sections;
    const d = strip(disk);
    const m = strip(mem);
    const diff = Object.keys(d).filter((k) => !isDeepStrictEqual(d[k], m[k]));
    if (diff.length > 0) throw new Invariant(6, `память игрока ${target} не равна лежащему после перезагрузки: ${diff.join(', ')}`);
  }
}

/** Журнал по игроку (ТЗ-12.10): монеты и траты в записях равны `earned` и `spent` раздела этого игрока. */
export function checkJournal(env: Env): string[] {
  const bad: string[] = [];
  for (const id of PLAYERS) {
    const w = lying(env, id).wallet as { earned: number; spent: number };
    const mine = env.journal.filter((j) => j.player === id).map((j) => j.rec);
    const sum = (kind: string, field: string): number => mine.filter((r) => r.kind === kind).reduce((s, r) => s + ((r.data as Record<string, number>)[field] ?? 0), 0);
    if (sum('coin', 'coins') !== w.earned) bad.push(`${id}: журнал coin ${sum('coin', 'coins')} != earned ${w.earned}`);
    if (sum('spend', 'cost') !== w.spent) bad.push(`${id}: журнал spend ${sum('spend', 'cost')} != spent ${w.spent}`);
  }
  return bad;
}

// ───────────── прогон ─────────────

export function runChain(seed: number, steps: number, pool: Step[]): Env {
  const env = setup();
  const rnd = createRandom(seed);
  const clock = { now: START };
  for (let n = 0; n < steps; n++) {
    const step = oneOf(rnd, pool);
    const ctx: ChainCtx = { now: clock.now, player: env.t.cur.value ?? 'p1', step: n, lessonIds: cat.lessonIds, leagueIds: cat.leagueIds };
    const before = snap(env);
    try {
      step.run(env, rnd, ctx, clock);
      clock.now += 1000 + upTo(rnd, 60_000);
      checkInvariants(env, before, ctx.player, step, n);
    } catch (e) {
      const why = e instanceof Invariant ? `инвариант ${e.n} — ${e.message}` : `исключение — ${e instanceof Error ? e.message : String(e)}`;
      throw new Error(`семя ${seed}, шаг ${n}, действие ${step.name}: ${why}`, { cause: e });
    }
  }
  const bad = checkJournal(env);
  if (bad.length > 0) throw new Error(`семя ${seed}, итог: журнал по игроку — ${bad.join('; ')}`);
  return env;
}
