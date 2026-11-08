/**
 * Журнал игры над `JournalBackend` (спека 018 design §5–§6, Т4): очередь и сброс, итог матча вне пачки,
 * обрезка нажатий, выгрузка, слияние из файла, запасной режим в памяти. Без DOM и IndexedDB: бэкенд, часы и
 * «событие» приходят снаружи; браузерная обвязка — `session.ts`/`boot.ts`. Ни один промис отсюда не отклоняется:
 * сбой журнала не должен ронять игру (иначе экран «Что-то сломалось» из-за метрик).
 */
import { mergeJournal } from '../../engine/journal/merge';
import { clampDt, recordId, type JournalDump, type JournalInput, type JournalRecord, type KeysLog } from '../../engine/journal/records';
import { KEYS_KEEP, KEYS_KEEP_QUOTA, planTrim } from '../../engine/journal/trim';
import { isQuotaError, type JournalBackend } from './backend';
import { memoryBackend } from './memory';

export const FLUSH_MS = 500;
export const IDLE_MS = 30_000;
export const DUMP_TIMEOUT_MS = 3000;
/** Открытие базы дольше этого — запасной режим в памяти (зависший `open` не должен держать очередь). */
export const OPEN_TIMEOUT_MS = 3000;
/** Загрузка файла: слияние журнала ждут не дольше этого, дальше страница перезагружается. */
export const IMPORT_TIMEOUT_MS = 3000;
/** В памяти (запасной режим) — последние матчи с нажатиями. */
export const MEMORY_KEYS_KEEP = 50;
const SESSION_RECORDS_MAX = 5000;

export interface JournalDeps {
  /** Открыть основной бэкенд (IndexedDB). Отказ — журнал уходит в память. */
  open(): Promise<JournalBackend>;
  now(): number;
  /** Версия сборки (поле `app` записи). */
  app: string;
  /** 4 случайных знака вкладки: две вкладки не сталкиваются по `id`. */
  tab: string;
  /** Сообщить о сбое (событие `storage` 014): текст вида `journal-memory`; каждого вида — не больше одного раза за сеанс. */
  onStorage(text: string): void;
  /** Просить постоянное хранение при открытии базы (в приложении: `persisted()`, затем `persist()`); нет — пропуск. */
  persist?(): Promise<unknown>;
}

/** Нажатия матча, как их отдаёт 017: игрок и время добавляет журнал. */
export type KeysInput = Pick<KeysLog, 'match' | 'typed' | 'expected' | 'dt'>;

const isFinalMatch = (r: JournalInput): boolean => {
  if (r.kind !== 'match' || typeof r.data !== 'object' || r.data === null) return false;
  const o = (r.data as { outcome?: unknown }).outcome;
  return o === 'win' || o === 'loss';
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const okRecord = (x: unknown): x is JournalRecord => isObj(x) && typeof x.id === 'string' && typeof x.player === 'string' && typeof x.t === 'number';
const okKeys = (x: unknown): x is KeysLog =>
  isObj(x) && typeof x.match === 'string' && typeof x.player === 'string' && typeof x.t === 'number' && typeof x.typed === 'string' && typeof x.expected === 'string' && Array.isArray(x.dt);

/**
 * Копия `data` без связей с вызывающим. Прокси Vue (`reactive`) `structuredClone` не берёт (DataCloneError) —
 * тогда копия через JSON: данные записи — по контракту JSON-совместимы.
 */
function plainCopy<T>(x: T): T {
  try {
    return structuredClone(x);
  } catch {
    return JSON.parse(JSON.stringify(x)) as T;
  }
}

export function createJournal(deps: JournalDeps) {
  let seq = 0;
  let queue: JournalRecord[] = [];
  let keysQueue: KeysLog[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let trimTimer: ReturnType<typeof setTimeout> | null = null;
  let trimmed = false;
  /** Виды событий, о которых уже сказано: каждый вид — раз за сеанс (память и таймаут не глушат друг друга). */
  const told = new Set<string>();
  let be: Promise<JournalBackend> | null = null;
  let onMemory = false;
  let chain: Promise<unknown> = Promise.resolve();
  /** `t` первой записи по `id`: перезапись матча сохраняет время (индекс `[player, t]` не прыгает). */
  const firstT = new Map<string, number>();
  const players = new Set<string>();
  /** Всё, что ушло за сеанс, — чтобы при сбое базы запасной режим не остался пустым. */
  const sessionRecs = new Map<string, JournalRecord>();
  const sessionKeys = new Map<string, KeysLog>();

  function tell(kind: string, text: string = kind): void {
    if (told.has(kind)) return;
    told.add(kind);
    try {
      deps.onStorage(text);
    } catch {
      // событие — удобство, не условие работы
    }
  }

  function toMemory(reason: string): JournalBackend {
    const mem = memoryBackend({ keysKeep: MEMORY_KEYS_KEEP });
    void mem.put('records', [...sessionRecs.values()]);
    void mem.put('keys', [...sessionKeys.values()]);
    onMemory = true;
    be = Promise.resolve(mem);
    tell('journal-memory', `journal-memory ${reason}`);
    return mem;
  }

  /** Открыть базу один раз; отказ → память. */
  function backend(): Promise<JournalBackend> {
    be ??= openWithTimeout().then(
      (b) => {
        try {
          const p = deps.persist?.();
          if (p) void p.catch(() => undefined);
        } catch {
          // не критично
        }
        return b;
      },
      (e: unknown) => toMemory(`open ${errName(e)}`),
    );
    return be;
  }

  /** Открытие базы не дольше `OPEN_TIMEOUT_MS`: опоздавшее соединение закрываем, журнал уже в памяти. */
  function openWithTimeout(): Promise<JournalBackend> {
    return new Promise<JournalBackend>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        reject(Object.assign(new Error('journal: open timeout'), { name: 'TimeoutError' }));
      }, OPEN_TIMEOUT_MS);
      let opening: Promise<JournalBackend>;
      try {
        opening = deps.open();
      } catch (e) {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error('journal: open'));
        return;
      }
      opening.then(
        (b) => {
          clearTimeout(timer);
          if (settled) b.close();
          else resolve(b);
        },
        (e: unknown) => {
          clearTimeout(timer);
          if (!settled) reject(e instanceof Error ? e : new Error('journal: open'));
        },
      );
    });
  }

  const errName = (e: unknown): string => (isObj(e) && typeof e.name === 'string' ? e.name : 'error');

  /** Операция в общей очереди: порядок сохраняется, отказ не выходит наружу. */
  function exec<T>(op: () => Promise<T>, fallback: T): Promise<T> {
    const run = chain.then(op).catch(() => fallback);
    chain = run;
    return run;
  }

  /** Обрезать `keys` игроков до `keep` (по ключам индекса, без значений). */
  async function trimKeys(b: JournalBackend, who: Iterable<string>, keep: number): Promise<void> {
    for (const p of who) {
      const drop = planTrim(await b.list('keys', p), keep);
      if (drop.length > 0) await b.remove('keys', drop);
    }
  }

  async function writeBatch(recs: JournalRecord[], keys: KeysLog[]): Promise<void> {
    const attempt = async (b: JournalBackend): Promise<void> => {
      if (recs.length > 0) await b.put('records', recs);
      if (keys.length > 0) await b.put('keys', keys);
    };
    const b = await backend();
    try {
      await attempt(b);
    } catch (e) {
      if (!onMemory && isQuotaError(e)) {
        try {
          await trimKeys(b, new Set([...players, ...keys.map((k) => k.player)]), KEYS_KEEP_QUOTA);
          await attempt(b);
          return;
        } catch {
          // повтор не помог — запасной режим ниже
        }
      }
      if (onMemory) return;
      b.close();
      await attempt(toMemory(`put ${errName(e)}`));
    }
  }

  function flush(): Promise<void> {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (queue.length === 0 && keysQueue.length === 0) return exec(() => Promise.resolve(), undefined);
    const recs = queue;
    const keys = keysQueue;
    queue = [];
    keysQueue = [];
    return exec(() => writeBatch(recs, keys), undefined);
  }

  /** Обрезка раз за сеанс, в простое. */
  function trimOnce(): Promise<void> {
    if (trimTimer !== null) {
      clearTimeout(trimTimer);
      trimTimer = null;
    }
    if (trimmed) return Promise.resolve();
    trimmed = true;
    return exec(async () => trimKeys(await backend(), [...players], KEYS_KEEP), undefined);
  }

  function schedule(): void {
    flushTimer ??= setTimeout(() => void flush(), FLUSH_MS);
    trimTimer ??= trimmed ? null : setTimeout(() => void trimOnce(), IDLE_MS);
  }

  /** Принять записи игрока. Итог матча (`win`/`loss`) уходит сразу вместе с очередью, остальное — пачкой раз в 500 мс. */
  function log(recs: readonly JournalInput[], player: string): void {
    try {
      let final = false;
      for (const r of recs) {
        // Копия данных — до любых изменений состояния: не скопировалась (круговая ссылка, функция) — пропускаем одну запись (018-Р26).
        let data: unknown;
        try {
          data = plainCopy(r.data);
        } catch {
          continue;
        }
        const t = r.id !== undefined ? (firstT.get(r.id) ?? deps.now()) : deps.now();
        const id = r.id ?? recordId(player, t, deps.tab, seq++);
        firstT.set(id, t);
        const rec: JournalRecord = { id, player, t, app: deps.app, jv: 1, kind: r.kind, data };
        queue.push(rec);
        sessionRecs.set(id, rec);
        if (isFinalMatch(r)) final = true;
      }
      if (sessionRecs.size > SESSION_RECORDS_MAX) {
        for (const k of [...sessionRecs.keys()].slice(0, sessionRecs.size - SESSION_RECORDS_MAX)) sessionRecs.delete(k);
      }
      players.add(player);
      if (final) void flush().then(trimOnce);
      else schedule();
    } catch {
      // запись журнала не должна ронять игру
    }
  }

  /** Нажатия матча (до записи итога — они уйдут с ним одной пачкой). Повторный вызов того же матча — перезапись. */
  function logKeys(player: string, k: KeysInput): void {
    try {
      const entry: KeysLog = { match: k.match, player, t: firstT.get(k.match) ?? deps.now(), typed: k.typed, expected: k.expected, dt: clampDt(k.dt) };
      keysQueue = [...keysQueue.filter((x) => x.match !== k.match), entry];
      sessionKeys.set(k.match, entry);
      players.add(player);
      schedule();
    } catch {
      // см. log
    }
  }

  /** Результат `work` не позже чем через `ms`; дольше — `fallback` и событие `kind` (работа дойдёт до конца в очереди). */
  function withTimeout<T>(work: Promise<T>, ms: number, fallback: T, kind: string): Promise<T> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        tell(kind);
        resolve(fallback);
      }, ms);
      void work.then((v) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
  }

  /** Журнал для файла выгрузки (design §6); игрок — только его записи. Дольше 3 с или сбой → `null` и событие. */
  function dump(player?: string): Promise<JournalDump | null> {
    const read = async (): Promise<JournalDump | null> => {
      await flush();
      return exec(
        async () => {
          const b = await backend();
          return {
            jv: 1 as const,
            records: (await b.all('records', player)) as JournalRecord[],
            keys: (await b.all('keys', player)) as KeysLog[],
          };
        },
        null,
      );
    };
    return withTimeout(read(), DUMP_TIMEOUT_MS, null, 'journal-dump-timeout');
  }

  /**
   * Слияние журнала из файла (014-Р7, 018-Р7): ничего не удаляется, побеждает полнее. `only` — игроки, чьё сохранение
   * загружено. Число записанных; дольше 3 с — 0 (слияние доделается в очереди), отказ — 0.
   */
  function importFile(file: unknown, only?: readonly string[]): Promise<number> {
    if (!isObj(file) || file.jv !== 1 || !Array.isArray(file.records) || !Array.isArray(file.keys)) return Promise.resolve(0);
    const want = (p: string): boolean => only === undefined || only.includes(p);
    const records = file.records.filter(okRecord).filter((r) => want(r.player));
    const keys = file.keys.filter(okKeys).filter((k) => want(k.player));
    const merge = exec(async () => {
      const b = await backend();
      const plan = mergeJournal({ records: (await b.all('records')) as JournalRecord[], keys: (await b.all('keys')) as KeysLog[] }, { records, keys });
      if (plan.records.length > 0) await b.put('records', plan.records);
      if (plan.keys.length > 0) await b.put('keys', plan.keys);
      return plan.records.length + plan.keys.length;
    }, 0);
    return withTimeout(merge, IMPORT_TIMEOUT_MS, 0, 'journal-import-timeout');
  }

  async function close(): Promise<void> {
    if (trimTimer !== null) {
      clearTimeout(trimTimer);
      trimTimer = null;
    }
    await flush();
    if (be !== null) {
      try {
        (await be).close();
      } catch {
        // уже закрыта
      }
    }
  }

  return { log, logKeys, flush, trimOnce, dump, importFile, close, usingMemory: (): boolean => onMemory };
}

export type Journal = ReturnType<typeof createJournal>;
