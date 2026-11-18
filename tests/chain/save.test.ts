/**
 * Цепочка сохранения с семенем (060 Т7, К22): 200 переходов четырёх игроков на настоящем хранилище (`createStore`,
 * хранилище в памяти): урок пройден, звёзды, монеты, снятие урока с наследником и `reconcile`, миграция раздела,
 * запись с конфликтом второй вкладки и с квотой, перезагрузка, снимок клуба → `planImport`. После каждого шага —
 * инварианты по тому, что лежит на диске. Повтор падения: `KK_SEED=<семя> npx vitest run tests/chain/save.test.ts`.
 * У каждого теста строка «Ловит:» — какую поломку он видит.
 */
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { Registry } from '../../src/content/schema/ids';
import { checkLiveIds, checkRegistry } from '../../src/engine/course/registry';
import { reconcile, type CourseProgress, type LessonMark } from '../../src/engine/course/reconcile';
import { createRandom, pick, randomInt } from '../../src/engine/random';
import { createPlayer, serializePlayer, writePlayer, type Envelope } from '../../src/engine/save/envelope';
import { planImport } from '../../src/engine/save/import';
import { openPlayer } from '../../src/engine/save/open';
import { isDay, isInt, type SectionDef } from '../../src/engine/save/section';
import { makeSnapshot, serializeSnapshot } from '../../src/engine/save/snapshot';
import { newDevice, type Store } from '../../src/app/save/store';
import { withPlayer, withoutPlayer } from '../../src/engine/save/device';
import { GOLDEN_APP, GOLDEN_FROM, GOLDEN_MADE, goldenClubDef, goldenCourseDef } from '../fixtures/goldenSave';
import { P, foreignIntact, key, setup } from '../fixtures/storageKit';

const PIDS = ['p1', 'p2', 'p3', 'p4'];
const STEPS = 200;
const SEEDS = process.env.KK_SEED ? [Number(process.env.KK_SEED)] : [1, 2, 3, 4, 5, 6];
const START = Date.UTC(2026, 10, 18);

const dayOf = (step: number): string => new Date(START + step * 86_400_000).toISOString().slice(0, 10);

/** `club` следующей версии: появилось поле `level` (миграция посреди цепочки). */
const clubV2: SectionDef<unknown> = {
  name: 'club',
  v: 2,
  empty: () => ({ coins: 0, level: 1 }),
  up: { 2: (d) => ({ ...(d as object), level: 1 }) },
  check: (d) => {
    const c = d as { coins?: unknown; level?: unknown } | null;
    return c && isInt(c.coins) && c.coins >= 0 && isInt(c.level) && c.level >= 1 ? [] : ['club'];
  },
};
const DEFS_A = [goldenCourseDef, goldenClubDef] as SectionDef<unknown>[];
const DEFS_B = [goldenCourseDef, clubV2] as SectionDef<unknown>[];

type Obj = Record<string, unknown>;
interface Tab {
  /** Что видит вкладка: может быть впереди диска (запись не легла — квота). */
  env: Envelope;
  /** `rev`, с которым игрок загружен/записан на диске. */
  diskRev: number;
}
interface Seen {
  rev: number;
  maxStars: Map<string, number>;
  totalStars: number;
  unknown: Record<string, string>;
}

class Chain {
  readonly rnd: () => number;
  readonly kit = setup();
  defs: SectionDef<unknown>[] = DEFS_A;
  store: Store = this.kit.open(DEFS_A);
  reg: Registry;
  order: string[];
  readonly tabs = new Map<string, Tab>();
  readonly seen = new Map<string, Seen>();
  step = 0;
  migratedAt: number;
  newLessons = 0;
  /** Игроки, чья запись на диске в этом шаге состоялась. */
  wrote = new Set<string>();
  counts: Record<string, number> = {};
  lastSnapshot = '';

  constructor(seed: number) {
    this.rnd = createRandom(seed);
    this.order = Array.from({ length: 8 }, (_, i) => `ru.yard.l${i}`);
    this.reg = { course: 'ru', released: [...this.order], retired: {} };
    this.migratedAt = 20 + randomInt(this.rnd, 140);
    for (const pid of PIDS) this.createPlayerOnDisk(pid);
    const device = { ...newDevice(), players: PIDS.map((pid, order) => ({ pid, order })) };
    expect(this.store.saveDevice(device, null)).toEqual({ ok: true });
    this.checkAll();
  }

  private createPlayerOnDisk(pid: string): void {
    const base = createPlayer({ pid, name: `Игрок ${pid}` }, this.defs);
    const course = { ...(base.sections['course:ru']!.data as CourseProgress), current: this.order[0]! };
    const written = writePlayer(base, { 'course:ru': course });
    // Разделы «из будущего»: их записала бы программа новее — незнакомы ядру, должны пережить всё.
    const unknown: Record<string, { v: number; data: unknown }> = {
      'future:badges': { v: 5, data: { got: [randomInt(this.rnd, 9), 'x'], ratio: 1.5, name: `б${pid}` } },
      'league:ru.country': { v: 2, data: { open: false, n: randomInt(this.rnd, 100), nested: { a: [1, { b: null }] } } },
    };
    const env: Envelope = { ...written, sections: { ...written.sections, ...unknown } };
    expect(this.store.savePlayer(pid, env, null)).toEqual({ ok: true });
    this.tabs.set(pid, { env, diskRev: env.rev });
    this.seen.set(pid, {
      rev: env.rev,
      maxStars: new Map(),
      totalStars: 0,
      unknown: Object.fromEntries(Object.entries(unknown).map(([k, v]) => [k, JSON.stringify(v)])),
    });
  }

  private count(name: string): void {
    this.counts[name] = (this.counts[name] ?? 0) + 1;
  }

  /** Запись вкладки: исход применяется к вкладке так, как это сделала бы игра. */
  private commit(pid: string, next: Envelope, tab = this.tabs.get(pid)!): 'ok' | 'quota' | 'conflict' {
    const res = this.store.savePlayer(pid, next, tab.diskRev);
    if (res.ok) {
      this.tabs.set(pid, { env: next, diskRev: next.rev });
      this.wrote.add(pid);
      return 'ok';
    }
    if (res.err === 'quota') {
      this.tabs.set(pid, { env: next, diskRev: tab.diskRev }); // игра идёт из памяти, на диске прежнее
      return 'quota';
    }
    if (res.err === 'conflict') {
      this.resync(pid);
      return 'conflict';
    }
    throw new Error(`save ${pid}: ${JSON.stringify(res)}`);
  }

  private resync(pid: string, store = this.store): void {
    const loaded = store.loadPlayer(pid);
    if (loaded.kind !== 'ok') throw new Error(`load ${pid}: ${loaded.kind}`);
    this.tabs.set(pid, { env: loaded.env, diskRev: loaded.env.rev });
  }

  private progressOf(env: Envelope): CourseProgress {
    return env.sections['course:ru']!.data as CourseProgress;
  }

  /** Игрок проходит текущий урок: звёзды только растут, монеты — за звёзды, текущий — следующий. */
  private pass(pid: string, squeeze: boolean): void {
    const tab = this.tabs.get(pid)!;
    const p = this.progressOf(tab.env);
    const old = p.lessons[p.current];
    const roll = 1 + randomInt(this.rnd, 3);
    const mark: LessonMark = {
      stars: Math.max(old?.stars ?? 0, roll) as LessonMark['stars'],
      best: Math.max(old?.best ?? 0, 40 + randomInt(this.rnd, 61)),
      tries: (old?.tries ?? 0) + 1,
      done: old?.done ?? dayOf(this.step),
    };
    const at = this.order.indexOf(p.current);
    const course: CourseProgress = {
      ...p,
      current: this.order[Math.min(at + 1, this.order.length - 1)]!,
      lessons: { ...p.lessons, [p.current]: mark },
    };
    const club = { ...(tab.env.sections.club!.data as Obj), coins: (tab.env.sections.club!.data as { coins: number }).coins + roll };
    const next = writePlayer(tab.env, { 'course:ru': course, club });
    if (squeeze) {
      const used = [...this.kit.mem.map].reduce((n, [k, v]) => n + k.length + v.length, 0);
      this.kit.mem.capacity = used + 10;
    }
    const out = this.commit(pid, next);
    this.kit.mem.capacity = Infinity;
    this.count(squeeze ? `pass-squeeze-${out}` : `pass-${out}`);
  }

  private spend(pid: string): void {
    const tab = this.tabs.get(pid)!;
    const club = tab.env.sections.club!.data as { coins: number };
    const next = writePlayer(tab.env, { club: { ...club, coins: club.coins - Math.min(club.coins, 1 + randomInt(this.rnd, 5)) } });
    this.count(`spend-${this.commit(pid, next)}`);
  }

  /** Вторая вкладка пишет игрока первой; первая со старым `rev` получает `conflict`, диск не меняется. */
  private twoTabs(pid: string): void {
    const tab = this.tabs.get(pid)!;
    const other = this.kit.open(this.defs);
    const loaded = other.loadPlayer(pid);
    if (loaded.kind !== 'ok') throw new Error(`tab2 load ${pid}`);
    const club = loaded.env.sections.club!.data as { coins: number };
    expect(other.savePlayer(pid, writePlayer(loaded.env, { club: { ...club, coins: club.coins + 3 } }), loaded.env.rev)).toEqual({ ok: true });
    this.wrote.add(pid);
    const raw = this.kit.mem.map.get(key(pid));
    const stale = writePlayer(tab.env, { club: { ...(tab.env.sections.club!.data as Obj), coins: 999 } });
    expect(this.commit(pid, stale)).toBe('conflict');
    expect(this.kit.mem.map.get(key(pid))).toBe(raw);
    this.count('conflict');
  }

  /** Новая версия контента: снимается урок (с наследником или без), добавляется новый; игроки сверяются при загрузке. */
  private retire(): void {
    const live = [...this.order];
    if (live.length < 5) return this.pass(pick(this.rnd, PIDS), false);
    const gone = pick(this.rnd, live);
    const rest = live.filter((id) => id !== gone);
    const heir = this.rnd() < 0.25 ? null : pick(this.rnd, rest);
    const retired = { ...this.reg.retired, [gone]: heir };
    const added = `ru.yard.n${this.newLessons++}`;
    const order = [...rest];
    order.splice(randomInt(this.rnd, order.length + 1), 0, added);
    this.reg = { course: 'ru', released: [...this.reg.released, added], retired };
    this.order = order;
    for (const pid of PIDS) {
      this.resync(pid);
      const tab = this.tabs.get(pid)!;
      const done = reconcile(this.progressOf(tab.env), this.reg, this.order);
      // Повторная сверка — пустая (С-13: идемпотентность).
      expect(reconcile(done.progress, this.reg, this.order).changes).toEqual([]);
      if (done.changes.length > 0) expect(this.commit(pid, writePlayer(tab.env, { 'course:ru': done.progress }))).toBe('ok');
    }
    this.count('retire');
  }

  /** Программа обновилась: раздел `club` поднимается до v2, перед записью сырое v1 — в копию c1. */
  private migrate(): void {
    this.defs = DEFS_B;
    this.store = this.kit.open(this.defs);
    for (const pid of PIDS) {
      const raw = this.kit.mem.map.get(key(pid))!;
      const loaded = this.store.loadPlayer(pid);
      if (loaded.kind !== 'ok') throw new Error(`migrate load ${pid}: ${loaded.kind}`);
      expect(loaded.changed).toBe(true);
      expect(loaded.backup).toBe(true);
      expect(this.kit.mem.map.get(`${key(pid)}.c1`)).toBe(raw);
      expect(loaded.env.sections.club).toEqual({ v: 2, data: { ...(JSON.parse(raw) as { sections: { club: { data: Obj } } }).sections.club.data, level: 1 } });
      this.tabs.set(pid, { env: loaded.env, diskRev: loaded.env.rev });
      expect(this.commit(pid, writePlayer(loaded.env, {}))).toBe('ok');
    }
    this.count('migrate');
  }

  /** Перезагрузка страницы: новое хранилище, игроки читаются заново. */
  private reload(): void {
    this.store = this.kit.open(this.defs);
    for (const pid of PIDS) {
      const loaded = this.store.loadPlayer(pid);
      if (loaded.kind !== 'ok') throw new Error(`reload ${pid}: ${loaded.kind}`);
      expect(loaded.changed).toBe(false);
      this.tabs.set(pid, { env: loaded.env, diskRev: loaded.env.rev });
    }
    this.count('reload');
  }

  /** Снимок клуба → файл → планирование импорта: на пустом устройстве — все игроки как есть, на том же — все совпадения. */
  snapshot(): void {
    const envs = PIDS.map((pid) => {
      const loaded = this.store.loadPlayer(pid);
      if (loaded.kind !== 'ok') throw new Error(`snapshot load ${pid}`);
      return loaded.env;
    });
    const device = this.store.loadDevice();
    if (device.kind !== 'ok') throw new Error('device');
    const text = serializeSnapshot(makeSnapshot(device.device, envs, { app: GOLDEN_APP, made: GOLDEN_MADE, from: GOLDEN_FROM }));
    this.lastSnapshot = text;
    const courses = { ru: { reg: this.reg, order: this.order } };
    const empty = planImport(text, { device: { players: [] }, players: [] }, this.defs, courses);
    if (empty.kind !== 'ok') throw new Error(`plan ${JSON.stringify(empty)}`);
    expect(empty.add.map(serializePlayer)).toEqual(envs.map(serializePlayer));
    expect(empty.clash).toEqual([]);
    const same = planImport(text, { device: { players: device.device.players }, players: envs }, this.defs, courses);
    expect(same.kind === 'ok' && same.add.length).toBe(0);
    expect(same.kind === 'ok' && same.clash.length).toBe(PIDS.length);
    this.count('snapshot');
  }

  /** Один переход: действие выбирает семя. */
  advance(): void {
    this.step++;
    this.wrote = new Set();
    if (this.step === this.migratedAt) return this.migrate();
    const pid = pick(this.rnd, PIDS);
    const r = this.rnd();
    if (r < 0.4) this.pass(pid, false);
    else if (r < 0.5) this.pass(pid, true);
    else if (r < 0.6) this.spend(pid);
    else if (r < 0.68) this.retire();
    else if (r < 0.78) this.twoTabs(pid);
    else if (r < 0.86) this.reload();
    else this.snapshot();
  }

  // --- Инварианты по диску -------------------------------------------------------------------------------------

  private checkAll(): void {
    expect(checkLiveIds(this.order, 'ru.')).toEqual([]);
    expect(checkRegistry(this.reg, this.order)).toEqual([]);
    foreignIntact(this.kit.mem);
    for (const pid of PIDS) this.checkPlayer(pid);
  }

  private checkPlayer(pid: string): void {
    const raw = this.kit.mem.map.get(key(pid))!;
    const seen = this.seen.get(pid)!;
    const at = `шаг ${this.step}, ${pid}`;
    // Диск всегда открывается нынешним кодом без миграции.
    const opened = openPlayer(raw, this.defs);
    expect(opened.kind, at).toBe('ok');
    if (opened.kind !== 'ok') return;
    expect(opened.changed, at).toBe(false);
    const env = opened.env;
    // 1. Целые числа в известных разделах.
    for (const name of ['course:ru', 'club']) assertIntegers(env.sections[name]!.data, `${at} ${name}`);
    // 2. rev растёт: не убывает никогда, на успешной записи — строго.
    expect(env.rev, at).toBeGreaterThanOrEqual(seen.rev);
    if (this.wrote.has(pid)) expect(env.rev, `${at}: запись без роста rev`).toBeGreaterThan(seen.rev);
    seen.rev = env.rev;
    // 3. Звёзды не убывают: по каждому id (урок или архив) и в сумме.
    const course = env.sections['course:ru']!.data as CourseProgress;
    let total = 0;
    const ids = new Set([...Object.keys(course.lessons), ...Object.keys(course.archive)]);
    for (const id of ids) {
      const stars = Math.max(course.lessons[id]?.stars ?? 0, course.archive[id]?.stars ?? 0);
      expect(stars, `${at}: звёзды ${id} убыли`).toBeGreaterThanOrEqual(seen.maxStars.get(id) ?? 0);
      seen.maxStars.set(id, stars);
      total += (course.lessons[id]?.stars ?? 0) + (course.archive[id]?.stars ?? 0);
    }
    expect(total, `${at}: сумма звёзд убыла`).toBeGreaterThanOrEqual(seen.totalStars);
    seen.totalStars = total;
    // 4. Сверка полная: снятых id среди живых отметок нет, текущий урок — живой.
    for (const id of Object.keys(course.lessons)) {
      expect(Object.hasOwn(this.reg.retired, id) && !this.order.includes(id), `${at}: снятый урок ${id} в lessons`).toBe(false);
    }
    expect(this.order, at).toContain(course.current);
    // 5. Незнакомые разделы — байт в байт.
    for (const [name, json] of Object.entries(seen.unknown)) {
      expect(JSON.stringify(env.sections[name]), `${at}: ${name} изменён`).toBe(json);
    }
    for (const m of Object.values(course.lessons)) if (m.done !== undefined) expect(isDay(m.done), at).toBe(true);
  }

  run(): void {
    for (let i = 0; i < STEPS; i++) {
      this.advance();
      this.checkAll();
    }
  }
}

function assertIntegers(x: unknown, at: string): void {
  if (typeof x === 'number') expect(isInt(x), `${at}: ${x}`).toBe(true);
  else if (Array.isArray(x)) x.forEach((i) => assertIntegers(i, at));
  else if (x !== null && typeof x === 'object') Object.values(x).forEach((i) => assertIntegers(i, at));
}

describe('К22: цепочка сохранения с семенем (060 Т7)', () => {
  for (const seed of SEEDS) {
    it(`К22: семя ${seed} — ${STEPS} переходов, инварианты после каждого`, () => {
      // Ловит: потерю звёзд при сверке с реестром, дробные числа, потерю незнакомого раздела, rev без роста на записи,
      // запись поверх чужой (конфликт), сбой миграции раздела, снимок/импорт, который не возвращает тех же игроков.
      const chain = new Chain(seed);
      chain.run();
      if (process.env.KK_SIZE) console.info(seed, JSON.stringify(chain.counts));
      // Цепочка не вырождена: каждый вид перехода хоть раз случился.
      for (const name of ['pass-ok', 'pass-squeeze-quota', 'spend-ok', 'retire', 'conflict', 'reload', 'snapshot', 'migrate']) {
        expect(chain.counts[name] ?? 0, `${name} не встретился`).toBeGreaterThan(0);
      }
    });
  }

  it('К22: размер снимка 4 игроков после «года» ≤ 32 КБ (гипотеза 060, нужна ссылке `#` в Э2)', () => {
    // Ловит: рост сохранения за год игры сверх порога, при котором ссылка-снимок перестаёт помещаться.
    const chain = new Chain(1);
    chain.run();
    chain.snapshot(); // снимок на конец цепочки, а не последний случайный
    const size = chain.lastSnapshot.length;
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThanOrEqual(32 * 1024);
    // Худший случай: все 200 уроков курса пройдены каждым из четверых, у каждого 30 снятых в архиве.
    expect(worstCase().raw).toBeGreaterThan(size);
    if (process.env.KK_SIZE) console.info(`снимок: цепочка ${size} Б (gzip ${gzipSync(chain.lastSnapshot).length}), худший ${JSON.stringify(worstCase())}`);
  });
});

/** Снимок четверых, у каждого пройдены все 200 уроков каркаса (с днём и тремя звёздами) и 30 снятых в архиве. */
function worstCase(): { raw: number; gzip: number } {
  const leagues = [
    ['yard', 32],
    ['district', 36],
    ['city', 30],
    ['country', 32],
    ['europe', 40],
    ['world', 30],
  ] as const;
  const ids = leagues.flatMap(([league, n]) => Array.from({ length: n }, (_, i) => `ru.${league}.lesson-${i + 1}-words`));
  const mark = (i: number): LessonMark => ({ stars: 3, best: 90 + (i % 10), tries: 1 + (i % 5), done: `2027-0${1 + (i % 9)}-1${i % 9}` });
  const players = PIDS.map((pid) => {
    const course: CourseProgress = {
      current: ids[ids.length - 1]!,
      lessons: Object.fromEntries(ids.map((id, i) => [id, mark(i)])),
      archive: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`ru.yard.old-${i}`, mark(i)])),
      leaguesDone: Object.fromEntries(leagues.map(([l], i) => [`ru.${l}`, `2027-0${1 + i}-15`])),
    };
    return writePlayer(createPlayer({ pid, name: `Игрок ${pid}` }, DEFS_B), { 'course:ru': course, club: { coins: 12345, level: 9 } });
  });
  const text = serializeSnapshot(makeSnapshot(newDevice(), players, { app: GOLDEN_APP, made: GOLDEN_MADE, from: GOLDEN_FROM }));
  return { raw: text.length, gzip: gzipSync(text).length };
}

// --- Вторая цепочка: края шва (063 Т2, долг 060 Т7) ------------------------------------------------------------------

/**
 * Края, которых нет в главной цепочке: корзина с записью устройства, `broken` и `newer` на диске, путь без копии
 * (миграция при полной квоте) и запись после выбора при совпадении pid (`putCopy` проигравшего). Семя выбирает действие.
 * Инварианты после каждого шага: чужие ключи целы; игрок либо на месте, либо в корзине байт в байт; игрок только для
 * чтения на диске не меняется; сырое битого лежит в карантине; проигравший clash лежит в c1.
 */
describe('К3, К22: цепочка краёв шва — корзина, broken/newer, путь без копии, запись после выбора (063 Т2)', () => {
  const live = ['q1', 'q2', 'q3'];
  const clubNext: SectionDef<unknown> = {
    name: 'club',
    v: 2,
    empty: () => ({ coins: 0, level: 1 }),
    up: { 2: (d) => ({ ...(d as object), level: 1 }) },
    check: (d) => ((d as { level?: unknown } | null)?.level === 1 ? [] : ['level']),
  };
  const used = (kit: ReturnType<typeof setup>) => [...kit.mem.map].reduce((n, [k, v]) => n + k.length + v.length, 0);

  for (const seed of SEEDS) {
    it(`К22: семя ${seed} — 120 переходов краёв`, () => {
      // Ловит: корзина теряет игрока или оставляет его в списке устройства; битое сырое не попадает в карантин или его затирают записью;
      // «новее» на диске перезаписывается; миграция при полной квоте пишет поверх сырого без копии; проигравший clash нигде не лежит.
      const rnd = createRandom(seed);
      const kit = setup();
      let store = kit.open(DEFS_A);
      let device = { ...newDevice(), players: live.map((pid, order) => ({ pid, order })) };
      expect(store.saveDevice(device, null)).toEqual({ ok: true });
      const envs = new Map<string, Envelope>();
      for (const pid of live) {
        const env = createPlayer({ pid, name: pid }, DEFS_A);
        expect(store.savePlayer(pid, env, null)).toEqual({ ok: true });
        envs.set(pid, env);
      }
      const trashed = new Map<string, string>();
      const frozen = new Map<string, string>(); // игрок только для чтения: сырое на диске не должно меняться
      const counts: Record<string, number> = {};
      const hit = (name: string) => (counts[name] = (counts[name] ?? 0) + 1);
      const rawOf = (pid: string) => kit.mem.map.get(key(pid));

      for (let step = 0; step < 120; step++) {
        const pid = pick(rnd, live);
        const r = rnd();
        if (frozen.has(pid)) {
          // Только чтение: запись отказывает, байты целы; чинит родитель — возвращает годный конверт.
          expect(store.savePlayer(pid, writePlayer(envs.get(pid)!, { club: { coins: 1 } }), envs.get(pid)!.rev)).toEqual({ ok: false, err: 'readonly' });
          expect(rawOf(pid)).toBe(frozen.get(pid));
          if (r < 0.5) {
            const fixed = writePlayer(envs.get(pid)!, {});
            kit.mem.map.set(key(pid), serializePlayer(fixed));
            const again = store.loadPlayer(pid);
            if (again.kind !== 'ok') throw new Error(`починка ${pid}: ${again.kind}`);
            envs.set(pid, again.env);
            frozen.delete(pid);
            hit('repair');
          }
        } else if (trashed.has(pid)) {
          expect(store.loadPlayer(pid)).toEqual({ kind: 'absent' });
          expect(store.restore(pid)).toEqual({ ok: true });
          expect(rawOf(pid)).toBe(trashed.get(pid));
          device = withPlayer(device, pid);
          expect(store.saveDevice(device, device.rev - 1)).toEqual({ ok: true });
          trashed.delete(pid);
          hit('restore');
        } else if (r < 0.2) {
          const raw = rawOf(pid)!;
          expect(store.trash(pid)).toEqual({ ok: true });
          device = withoutPlayer(device, pid);
          expect(store.saveDevice(device, device.rev - 1)).toEqual({ ok: true });
          trashed.set(pid, raw);
          hit('trash');
        } else if (r < 0.4) {
          kit.mem.map.set(key(pid), `битое ${step}`);
          expect(store.loadPlayer(pid)).toMatchObject({ kind: 'broken', quarantined: true });
          expect(store.quarantined(pid)[0]).toBe(`битое ${step}`);
          frozen.set(pid, `битое ${step}`);
          hit('broken');
        } else if (r < 0.55) {
          const future = JSON.stringify({ ...envs.get(pid)!, fmt: 2 });
          kit.mem.map.set(key(pid), future);
          expect(store.loadPlayer(pid)).toMatchObject({ kind: 'newer', raw: future });
          expect(store.quarantined(pid).includes(future)).toBe(false); // «новее» — не карантин: сырое цело на месте
          frozen.set(pid, future);
          hit('newer');
        } else if (r < 0.75) {
          // Путь без копии: следующая версия раздела, места на копию нет → backup:false, запись quota, сырое цело;
          // место нашлось → копия и запись.
          const before = rawOf(pid)!;
          const next = kit.open([goldenCourseDef, clubNext]);
          for (const n of [1, 2, 3]) kit.mem.map.delete(`${key(pid)}.c${n}`);
          kit.mem.capacity = used(kit);
          const loaded = next.loadPlayer(pid);
          kit.mem.capacity = Infinity;
          if (loaded.kind !== 'ok') throw new Error(`миграция ${pid}: ${loaded.kind}`);
          expect(loaded).toMatchObject({ changed: true, backup: false });
          expect(rawOf(pid)).toBe(before);
          kit.mem.capacity = used(kit);
          expect(next.savePlayer(pid, writePlayer(loaded.env, {}), loaded.env.rev)).toEqual({ ok: false, err: 'quota' });
          expect(rawOf(pid)).toBe(before);
          kit.mem.capacity = Infinity;
          expect(next.savePlayer(pid, writePlayer(loaded.env, {}), loaded.env.rev)).toEqual({ ok: true });
          expect(kit.mem.map.get(`${key(pid)}.c1`)).toBe(before); // исходное сырое — в копии, байт в байт
          // Старая программа читает club v2 как «новее»: игрок до починки только для чтения.
          store = kit.open(DEFS_A);
          for (const other of frozen.keys()) store.loadPlayer(other); // новая вкладка заново узнаёт, кто только для чтения
          expect(store.loadPlayer(pid).kind).toBe('newer');
          frozen.set(pid, rawOf(pid)!);
          hit('no-copy-path');
        } else {
          // Запись после выбора: «взять из файла» — проигравший (мой) в копию, победитель с rev = max + 1.
          const mine = envs.get(pid)!;
          const theirs = writePlayer({ ...mine, rev: mine.rev + 2 }, { club: { coins: 100 + step } });
          expect(store.putCopy(pid, mine)).toEqual({ ok: true });
          const winner = { ...theirs, rev: Math.max(mine.rev, theirs.rev) + 1 };
          expect(store.savePlayer(pid, winner, mine.rev)).toEqual({ ok: true });
          expect(kit.mem.map.get(`${key(pid)}.c1`)).toBe(serializePlayer(mine));
          envs.set(pid, winner);
          hit('choose');
        }
        foreignIntact(kit.mem);
        for (const [t, raw] of trashed) expect(kit.mem.map.get(`${P}trash.${t}`), `шаг ${step}: корзина ${t}`).toBe(raw);
        expect(device.players.map((p) => p.pid).sort(), `шаг ${step}: список устройства`).toEqual(live.filter((p) => !trashed.has(p)).sort());
        expect(store.loadDevice(), `шаг ${step}`).toMatchObject({ kind: 'ok', device: { rev: device.rev } });
      }
      for (const name of ['trash', 'restore', 'broken', 'newer', 'no-copy-path', 'choose']) expect(counts[name] ?? 0, `${name} не встретился`).toBeGreaterThan(0);
    });
  }
});
