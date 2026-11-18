/**
 * Снимок клуба (060 design §4, 059 С-20): все игроки устройства одним файлом — выгрузка, груз переноса, голден.
 * Чистые функции: часы (`made`) и адрес (`from`) приходят снаружи, ничего не пишется.
 */
import type { Device } from './device';
import { PLAYER_KIND, type Envelope } from './envelope';

export const SNAPSHOT_KIND = 'keykick-club';
/** Версия формы снимка. Снимок с большей — «новее программы» (`planImport` → `newer`). */
export const SNAPSHOT_FMT = 1;

export interface Snapshot {
  kind: typeof SNAPSHOT_KIND;
  snap: number;
  /** Версия программы, сделавшей снимок. */
  app: string;
  /** ISO-время снимка — часы снаружи. */
  made: string;
  /** Откуда снят: origin + путь. */
  from: string;
  device: Device;
  /**
   * Сырые конверты игроков как в хранилище: незнакомые разделы и `rev` целы. Игрок «новее программы» лежит тут же,
   * как на диске (не открыт, не смигрирован), а его `pid` — в `newer`.
   */
  players: (Envelope | RawPlayer)[];
  /** `pid` игроков, чей конверт записан версией новее этой программы (063-Р10); поля нет — таких нет. `planImport` читает такой снимок как «новее». */
  newer?: string[];
  /**
   * Карантин: сырые строки битого, `pid` игрока или `device` → версии, свежая первая (063-Р10). Только на память родителю
   * и разработчику: `planImport` это поле не читает, импорт всё-или-ничего (060-Р16) не меняется.
   */
  quarantine?: Record<string, string[]>;
  /** Журнал событий матча — формат определяет Э1 (060-Р8), здесь переносится как есть. */
  journal?: unknown;
}

/** Конверт игрока, разобранный из сырой строки как есть: форму знает только программа новее. */
export type RawPlayer = Record<string, unknown>;

/** Краткая сводка игрока для выбора при совпадении `pid`; нет раздела — `null`. */
export interface Summary {
  name: string;
  /** Id текущего урока курса игрока. */
  lesson: string | null;
  /** Сумма звёзд по отметкам уроков. */
  stars: number | null;
  /** Монеты из раздела `club`. */
  coins: number | null;
}

/**
 * Снимок из записи устройства и конвертов игроков. Конверты кладутся теми же объектами — JSON не меняется.
 * Одинаковые `pid` — ошибка программиста (в хранилище ключ один), снимок с ними не делается.
 */
export function makeSnapshot(
  device: Device,
  players: readonly Envelope[],
  meta: {
    app: string;
    made: string;
    from: string;
    journal?: unknown;
    /** Игроки «новее программы» (`store.loadPlayer` → `newer`): сырая строка с диска кладётся в `players` как есть (063-Р10). */
    newer?: readonly { pid: string; raw: string }[];
    /** Карантин (`store.quarantined`): владелец → сырые версии; пустые списки не пишутся. */
    quarantine?: Readonly<Record<string, readonly string[]>>;
  },
): Snapshot {
  const seen = new Set<string>();
  for (const p of players) {
    if (p.kind !== PLAYER_KIND) throw new Error('makeSnapshot: not a player envelope');
    if (seen.has(p.pid)) throw new Error(`makeSnapshot: duplicate pid ${p.pid}`);
    seen.add(p.pid);
  }
  const raws: RawPlayer[] = [];
  for (const { pid, raw } of meta.newer ?? []) {
    if (seen.has(pid)) throw new Error(`makeSnapshot: duplicate pid ${pid}`);
    seen.add(pid);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`makeSnapshot: newer ${pid} is not JSON`);
    }
    if (!isObj(parsed)) throw new Error(`makeSnapshot: newer ${pid} is not an object`);
    raws.push(parsed);
  }
  const snap: Snapshot = { kind: SNAPSHOT_KIND, snap: SNAPSHOT_FMT, app: meta.app, made: meta.made, from: meta.from, device, players: [...players, ...raws] };
  if (meta.journal !== undefined) snap.journal = meta.journal;
  if (raws.length > 0) snap.newer = (meta.newer ?? []).map((n) => n.pid);
  const held = Object.entries(meta.quarantine ?? {}).filter(([, list]) => list.length > 0);
  if (held.length > 0) snap.quarantine = Object.fromEntries(held.map(([owner, list]) => [owner, [...list]]));
  return snap;
}

export const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Имя файла выгрузки: `keykick-club-ГГГГ-ММ-ДД.json`; день — из ISO-времени снимка (без пересчёта пояса); не по форме — без даты. */
export function exportFileName(made: string): string {
  const day = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(made);
  return day ? `keykick-club-${day[1]}.json` : 'keykick-club.json';
}

/** Строка файла выгрузки. */
export function serializeSnapshot(snap: Snapshot): string {
  return JSON.stringify(snap);
}

export const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Доигранные матчи игрока — `day.played`; раздела `day` нет или поле не число — `null`. Один счёт для напоминания и страницы родителя (064-Р8). */
export function playedOf(env: Envelope): number | null {
  const day = Object.hasOwn(env.sections, 'day') ? env.sections['day']?.data : undefined;
  return isObj(day) ? num(day.played) : null;
}

/**
 * Сводка по уже открытому конверту. Ядро не знает разделов, но читает два по соглашению: `course:<курс игрока>`
 * (`current`, `lessons[*].stars`) и `wallet` (`coins`, 065-Р24: монеты живут в кассе, не в `club`). Формы не те или раздела нет — `null`, не ошибка.
 */
export function summarize(env: Envelope): Summary {
  const own = (name: string): unknown => (Object.hasOwn(env.sections, name) ? env.sections[name]?.data : undefined);
  const course = own(`course:${env.course}`);
  let lesson: string | null = null;
  let stars: number | null = null;
  if (isObj(course)) {
    if (typeof course.current === 'string') lesson = course.current;
    if (isObj(course.lessons)) {
      stars = 0;
      for (const mark of Object.values(course.lessons)) if (isObj(mark)) stars += num(mark.stars) ?? 0;
    }
  }
  const wallet = own('wallet');
  return { name: env.name, lesson, stars, coins: isObj(wallet) ? num(wallet.coins) : null };
}
