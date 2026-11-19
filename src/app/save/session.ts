/**
 * Мост сохранения к Vue (063-Р5) — единственный, кто держит `Store` для экранов: экраны и компоненты не зовут `createStore`.
 * Одна реактивная копия устройства и игрока вкладки; запись — только по событиям игры (конец матча, выбор, покупка), не на нажатие;
 * в хранилище уходят «сырые» данные (`toRaw`, 062 А2: Proxy в записи — `DataCloneError`). Ответ записи — в `status`,
 * плашку рисует экран (Т4), мост компонентов не знает.
 *
 * Контракт Т4 ↔ Т5: `device`, `player`, `status`, `save(patch)`, `choose(pid)`; сверх него — `tabPid` и `entryState()`
 * для охраны входа, `create` (первый запуск и «новый игрок», Т6), `init`/`reload`. Часы и случайность (`newPid`) приходят снаружи.
 *
 * `status`: `broken` (игрок или устройство не открылись) › `readonly` (запись новее программы) › `busy` (игрока держит другая
 * вкладка — просмотр без записи, 063-Р16) › `conflict` (на диске другая запись: «обнови страницу», пока не `reload`) ›
 * `quota` (места или доступа нет: игра идёт из памяти, плашка «позови взрослого») › `ok`. Запись при `broken/readonly/busy/conflict` — отказ (З1).
 */
import { computed, shallowRef, toRaw, type Ref } from 'vue';
import { MAX_PLAYERS, type EntryInput } from '../../engine/players/entry';
import { prefix, type Channel } from '../../engine/release/keys';
import { APP_VERSION, createPlayer, writePlayer, type Envelope } from '../../engine/save/envelope';
import { withPlayer, type Device } from '../../engine/save/device';
import type { SectionDef } from '../../engine/save/section';
import { createBin, type Bin } from './bin';
import { browserLocks, type Hold } from './locks';
import { SECTIONS } from './sections';
import { browserLocal, browserSession, createKeyValue } from './storage';
import { createStore, newDevice, type Store } from './store';
import { createTransfer, type Transfer } from './transfer';

export type Status = 'ok' | 'busy' | 'readonly' | 'quota' | 'conflict' | 'broken';

export type DeviceState = { kind: 'ok'; value: Device } | { kind: 'absent' | 'denied' | 'broken' | 'newer' };
/** `ok` — конверт в памяти (при `busy` — для просмотра); `newer`/`broken` — сырое лежит в хранилище, игра его не показывает. */
export type PlayerState = { kind: 'none' } | { kind: 'ok'; pid: string; env: Envelope } | { kind: 'newer' | 'broken'; pid: string };

export type SaveResult = { ok: true } | { ok: false; status: Status; why?: string[] };
export type CreateResult = { ok: true; pid: string } | { ok: false; why: 'limit' | 'readonly' | 'broken' | 'conflict' | 'quota' | 'invalid' };

export interface SessionDeps {
  store: Store;
  /** Разделы нового игрока; по умолчанию — реестр сборки. */
  defs?: readonly SectionDef<unknown>[];
  /** Новый pid (случайность снаружи); обязан быть годным для `validPid` и не занятым. */
  newPid: () => string;
  /** Версия программы для файла выгрузки; по умолчанию — `APP_VERSION`. */
  app?: string;
}

export interface Session {
  /**
   * Перенос клуба файлом (063 Т11): выгрузка, разбор и запись. Единственный путь к `Store` для экранов (063-Р5): после записи файла сеанс
   * перечитывается сам (`apply`), после отметки выгрузки — перечитывается устройство (`markExported`), иначе `create` писал бы по старому `rev`.
   */
  transfer: Transfer;
  /** Корзина игроков (063-Р62): удалить, вернуть, очистить. После записи сеанс перечитывает устройство сам. */
  bin: Bin;
  device: Readonly<Ref<DeviceState>>;
  player: Readonly<Ref<PlayerState>>;
  status: Readonly<Ref<Status>>;
  /** Игрок этой вкладки (`sessionStorage`); `undefined` — вкладка не выбирала. */
  tabPid: Readonly<Ref<string | undefined>>;
  /**
   * Читает устройство, берёт игрока вкладки (или единственного). Повторный вызов — тот же результат; заново — `reload`.
   * `look` — вкладка только смотрит (страница родителя, 063-Р59): игрока не выбирает и замок не берёт, вкладка ребёнка пишет свободно;
   * режим держится до явного `choose` (охрана входа зовёт его, когда вкладка уходит играть).
   */
  init(opts?: { look?: boolean }): Promise<void>;
  reload(): Promise<void>;
  /**
   * Запись разделов игрока: `patch` — раздел → новые данные. Данные, равные лежащим в памяти, не пишутся (двойной вызов — `rev` +1 один раз);
   * ничего нового и память равна диску — `ok` без записи; после отказа (квота) тот же вызов снова пишет на диск. Отказ — `{ ok:false, status }`, состояние выставлено.
   */
  save(patch: Record<string, unknown>): SaveResult;
  /** Игрок вкладки: замок, загрузка, `tabPid`. Тот же игрок — холостой вызов (замок не берётся повторно, иначе вкладка «занята» самой собой). */
  choose(pid: string): Promise<void>;
  /** Новый игрок (и устройство, если его нет): конверт, запись устройства, `choose`. Повтор, пока идёт первый, — тот же промис. */
  create(init: { name: string }): Promise<CreateResult>;
  /** Состояние для охраны входа: остальное (`route`, `pack`, `crash`) знает роутер. */
  entryState(): Pick<EntryInput, 'device' | 'players' | 'tabPid' | 'player'>;
}

/** Глубокая копия без Proxy: каждый уровень — `toRaw`. Реактивный объект внутри сырого тоже раскрывается. */
export function plain(x: unknown, depth = 0): unknown {
  if (depth > 32) throw new Error('session: data too deep');
  const raw: unknown = toRaw(x);
  if (Array.isArray(raw)) return raw.map((item) => plain(item, depth + 1));
  if (raw !== null && typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, plain(v, depth + 1)]));
  }
  return raw;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function createSession(deps: SessionDeps): Session {
  const { store } = deps;
  const defs = deps.defs ?? SECTIONS;
  const device = shallowRef<DeviceState>({ kind: 'absent' });
  const player = shallowRef<PlayerState>({ kind: 'none' });
  const tabPid = shallowRef<string | undefined>(undefined);
  const busy = shallowRef(false);
  const problem = shallowRef<'quota' | 'conflict' | null>(null);
  /** `rev` игрока на диске: от него считается `expectRev`; в памяти он может быть больше (запись не легла). */
  let diskRev = 0;
  let hold: Hold | undefined;
  let holdPid: string | undefined;
  /** Замок, переживший `reload`: освобождение асинхронно, и тут же взятый заново замок видел бы «занято» от самой вкладки. */
  let spare: { pid: string; hold: Hold } | undefined;
  /** Номер выбора: устаревший `choose` (пока ждал замок, вкладка выбрала другого) сам откатывается. */
  let choice = 0;
  let inflight: { pid: string; done: Promise<void> } | undefined;
  let started: Promise<void> | undefined;
  /** Вкладка в режиме просмотра (`init({ look })`): `run` игрока не берёт, пока вкладка явно не выбрала (`choose`). */
  let looking = false;

  const status = computed<Status>(() => {
    const d = device.value.kind;
    const p = player.value.kind;
    if (p === 'broken' || d === 'broken') return 'broken';
    if (p === 'newer' || d === 'newer') return 'readonly';
    if (busy.value) return 'busy';
    if (problem.value === 'conflict') return 'conflict';
    if (problem.value === 'quota' || d === 'denied') return 'quota';
    return 'ok';
  });

  function releaseHold(): void {
    if (hold?.kind === 'held') hold.release();
    hold = undefined;
    holdPid = undefined;
  }

  function readDevice(): void {
    const got = store.loadDevice();
    device.value = got.kind === 'ok' ? { kind: 'ok', value: got.device } : { kind: got.kind };
  }

  /** Запись легла — сеанс перечитывает устройство (корзина и перенос пишут мимо него). */
  function synced<R extends boolean | { ok: boolean }>(done: R): R {
    if (done === true || (typeof done === 'object' && done.ok)) readDevice();
    return done;
  }

  function resetPlayer(): void {
    choice++;
    inflight = undefined;
    releaseHold();
    player.value = { kind: 'none' };
    busy.value = false;
    problem.value = null;
  }

  async function pick(pid: string): Promise<void> {
    const d = device.value;
    if (d.kind !== 'ok' || !d.value.players.some((p) => p.pid === pid)) return;
    resetPlayer();
    const mine = choice;
    const reuse = spare?.pid === pid ? spare.hold : undefined;
    if (reuse) spare = undefined;
    const got = reuse ?? (await store.hold(pid));
    if (mine !== choice) {
      if (got.kind === 'held') got.release();
      return;
    }
    hold = got;
    holdPid = pid;
    busy.value = got.kind === 'busy';
    const loaded = store.loadPlayer(pid);
    store.setTabPid(pid);
    tabPid.value = pid;
    if (loaded.kind === 'ok') {
      diskRev = loaded.env.rev;
      player.value = { kind: 'ok', pid, env: loaded.env };
    } else if (loaded.kind === 'newer') {
      player.value = { kind: 'newer', pid };
    } else {
      // `broken`; ключа нет (в списке есть, файла нет) и «доступа нет» — тоже «нужна помощь взрослого».
      player.value = { kind: 'broken', pid };
    }
  }

  function choose(pid: string): Promise<void> {
    looking = false;
    if (inflight?.pid === pid) return inflight.done;
    const cur = player.value;
    if (cur.kind !== 'none' && cur.pid === pid) return Promise.resolve();
    const done = pick(pid).finally(() => {
      if (inflight?.done === done) inflight = undefined;
    });
    inflight = { pid, done };
    return done;
  }

  async function run(): Promise<void> {
    // Свой замок не отпускаем и не берём заново (см. `spare`): тот же игрок после перезагрузки подхватит его, иначе — отпустим.
    if (hold?.kind === 'held' && holdPid !== undefined) {
      if (spare?.hold.kind === 'held') spare.hold.release();
      spare = { pid: holdPid, hold };
      hold = undefined;
    }
    resetPlayer();
    tabPid.value = undefined;
    readDevice();
    try {
      const d = device.value;
      if (d.kind !== 'ok') return;
      const pids = d.value.players.map((p) => p.pid);
      const tab = store.tabPid();
      const pid = tab !== undefined && pids.includes(tab) ? tab : pids.length === 1 ? pids[0] : undefined;
      if (pid !== undefined && !looking) await choose(pid);
      // Просмотр: игрока вкладки не берём, но выбор вкладки (`sessionStorage`) помним — по нему охрана входа после ухода со страницы
      // родителя возьмёт того же игрока (`choose`), а не отправит в «Кто играет?».
      else if (looking && tab !== undefined && pids.includes(tab)) tabPid.value = tab;
    } finally {
      if (spare?.hold.kind === 'held') spare.hold.release();
      spare = undefined;
    }
  }

  function save(patch: Record<string, unknown>): SaveResult {
    const cur = player.value;
    const st = status.value;
    if (cur.kind !== 'ok' || st === 'busy' || st === 'readonly' || st === 'broken' || st === 'conflict') return { ok: false, status: st };
    const changed: Record<string, unknown> = {};
    for (const [name, data] of Object.entries(patch)) {
      const value = plain(data);
      const old = Object.hasOwn(cur.env.sections, name) ? cur.env.sections[name]?.data : undefined;
      if (!same(old, value)) changed[name] = value;
    }
    // Память впереди диска (прежняя запись не легла): тот же `save` повторяется как запись, а не «ничего нового» (К8).
    const pending = cur.env.rev !== diskRev;
    if (Object.keys(changed).length === 0 && !pending) return { ok: true };
    const next = Object.keys(changed).length === 0 ? cur.env : writePlayer(cur.env, changed);
    const res = store.savePlayer(cur.pid, next, diskRev);
    if (res.ok) {
      diskRev = next.rev;
      problem.value = null;
      player.value = { kind: 'ok', pid: cur.pid, env: next };
      return { ok: true };
    }
    if (res.err === 'invalid') return { ok: false, status: st, why: res.why };
    if (res.err === 'readonly') {
      player.value = { kind: 'newer', pid: cur.pid };
      return { ok: false, status: 'readonly' };
    }
    // Не легло: игра идёт из памяти (результат не пропадает на экране), на диске прежнее.
    player.value = { kind: 'ok', pid: cur.pid, env: next };
    problem.value = res.err === 'conflict' ? 'conflict' : 'quota';
    return { ok: false, status: status.value };
  }

  /** Второй «Готово», пока первое пишет: тот же ответ, а не второй клуб. */
  let creating: Promise<CreateResult> | undefined;

  function create(init: { name: string }): Promise<CreateResult> {
    creating ??= createOnce(init).finally(() => {
      creating = undefined;
    });
    return creating;
  }

  async function createOnce(init: { name: string }): Promise<CreateResult> {
    const d = device.value;
    if (d.kind === 'newer') return { ok: false, why: 'readonly' };
    if (d.kind === 'broken') return { ok: false, why: 'broken' };
    const base = d.kind === 'ok' ? d.value : newDevice();
    if (base.players.length >= MAX_PLAYERS) return { ok: false, why: 'limit' };
    const pid = deps.newPid();
    // Замок нового игрока — до записи файла (063-Р74): `settle` другой вкладки пропускает занятого, и `choose` не получит busy.
    // Замок уходит в `pick` как `spare`.
    const mine = await store.hold(pid);
    if (mine.kind === 'busy') return { ok: false, why: 'conflict' }; // pid уже занят другой вкладкой — не наш игрок
    try {
      const env = createPlayer({ pid, name: init.name }, defs);
      const wrote = store.savePlayer(pid, env, null);
      if (!wrote.ok) return { ok: false, why: wrote.err === 'invalid' ? 'invalid' : wrote.err === 'conflict' ? 'conflict' : wrote.err === 'readonly' ? 'readonly' : 'quota' };
      const next = withPlayer(base, pid);
      const listed = store.saveDevice(next, d.kind === 'ok' ? base.rev : null);
      if (!listed.ok) {
        if (listed.err === 'conflict') readDevice(); // другая вкладка успела раньше: покажем её список
        return { ok: false, why: listed.err === 'conflict' ? 'conflict' : listed.err === 'invalid' ? 'invalid' : listed.err === 'readonly' ? 'readonly' : 'quota' };
      }
      device.value = { kind: 'ok', value: next };
      if (spare?.hold.kind === 'held') spare.hold.release();
      spare = { pid, hold: mine };
      await choose(pid);
      return { ok: true, pid };
    } finally {
      // Отказ записи или замок остался в `spare` — отпускаем; ушедший в `hold` отпустит `releaseHold`.
      if (spare?.hold === mine) spare = undefined;
      if (mine.kind === 'held' && hold !== mine) mine.release();
    }
  }

  function reload(): Promise<void> {
    started = run();
    return started;
  }

  const moved = createTransfer({ store, defs, app: deps.app ?? APP_VERSION, own: (pid) => hold?.kind === 'held' && holdPid === pid });
  const transfer: Transfer = {
    ...moved,
    markExported: (day) => synced(moved.markExported(day)),
    async apply(plan, picks) {
      const done = await moved.apply(plan, picks);
      // Отказ до первой записи не трогает ничего. Иначе сеанс видит диск: игрока вкладки перечитываем, только если его файл записан
      // (или игрока нет — терять нечего); чужие записи — только устройство, иначе пропадает то, что у своего игрока лишь в памяти (квота).
      if (!done.ok && !done.written) return done;
      const own = player.value.kind === 'none' ? undefined : player.value.pid;
      if (own === undefined || done.written?.includes(own)) await reload();
      else readDevice();
      return done;
    },
  };

  const binApi = createBin({ store, defs, own: (pid) => hold?.kind === 'held' && holdPid === pid });
  const bin: Bin = {
    ...binApi,
    async remove(pid, day) {
      const own = player.value.kind !== 'none' && player.value.pid === pid;
      const done = await binApi.remove(pid, day);
      if (!done.ok) return done;
      if (own) await reload(); // удалили игрока этой вкладки: вкладка отпускает его и выбирает заново
      else readDevice();
      return done;
    },
    restore: (pid) => synced(binApi.restore(pid)),
    empty: (typed) => synced(binApi.empty(typed)),
    async restart(pid, fallbackName) {
      const done = await binApi.restart(pid, fallbackName);
      if (!done.ok) return done;
      if (player.value.kind !== 'none' && player.value.pid === pid) await reload();
      else readDevice();
      return done;
    },
    async newClub(day) {
      const done = await binApi.newClub(day);
      if (done.ok) void reload(); // устройство новое: вкладка начинает с первого запуска
      return done;
    },
    settle: async (day) => synced(await binApi.settle(day)),
  };

  return {
    transfer,
    bin,
    device,
    player,
    status,
    tabPid,
    init(opts) {
      if (started === undefined && opts?.look === true) looking = true;
      started ??= run();
      return started;
    },
    reload,
    save,
    choose,
    create,
    entryState() {
      const d = device.value;
      return {
        device: d.kind,
        players: d.kind === 'ok' ? d.value.players.map((p) => p.pid) : [],
        tabPid: tabPid.value,
        player: player.value.kind === 'ok' && busy.value ? 'busy' : player.value.kind,
      };
    },
  };
}

/** Канал сборки по адресу: `/next/` в конце — готовящаяся версия, иначе выпуск (060-Р3). */
export function channelOf(base: string): Channel {
  return /\/next\/?$/.test(base) ? 'next' : 'release';
}

/** Новый pid из случайных байтов браузера: `p` + 10 шестнадцатеричных знаков. */
function browserPid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `p${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

let shared: Session | undefined;

/** Подменяет общий сеанс (Т4 и тесты); `undefined` — сбросить. */
export function setSession(s: Session | undefined): void {
  shared = s;
}

/** Общий сеанс вкладки. Первый вызов строит его на хранилище браузера; `init()` зовёт `main.ts` до монтирования. */
export function useSession(): Session {
  shared ??= createSession({
    store: createStore({
      prefix: prefix(Number(APP_VERSION.split('.')[0]), channelOf(import.meta.env.BASE_URL)),
      local: createKeyValue(browserLocal()),
      session: createKeyValue(browserSession()),
      ...(browserLocks() ? { locks: browserLocks()! } : {}),
    }),
    newPid: browserPid,
  });
  return shared;
}
