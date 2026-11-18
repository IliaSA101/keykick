/**
 * Конверт игрока (059-Р2 а, Р8; 060 design §3): один ключ хранилища, внутри — разделы.
 * `fmt` — версия только формы конверта; у каждого раздела своя `v` и своя цепочка миграции.
 */
import type { SectionDef } from './section';

/** Версия формы конверта. Конверт с большей — «новее программы» (только чтение). */
export const ENVELOPE_FMT = 1;
/** Версия программы, записавшей конверт. */
export const APP_VERSION = '2.0.0';
export const PLAYER_KIND = 'keykick-player';

/** Раздел в конверте: версия формы и данные. Незнакомые ядру разделы лежат здесь же и не меняются. */
export interface Section {
  v: number;
  data: unknown;
}

export interface Envelope {
  kind: typeof PLAYER_KIND;
  fmt: number;
  /** Растёт на каждой записи (059 С-18): по нему две вкладки замечают друг друга. */
  rev: number;
  app: string;
  pid: string;
  name: string;
  course: string;
  explain: string;
  sections: Record<string, Section>;
}

/** pid без точки: ключи копий и карантина разбираются по точке; `device` занят карантином устройства. */
export function validPid(pid: string): boolean {
  return pid !== 'device' && /^[A-Za-z0-9_-]{1,64}$/.test(pid);
}

/** Новый игрок: rev 0, у каждого известного раздела — `empty()` текущей версии. */
export function createPlayer(
  init: { pid: string; name: string; course?: string; explain?: string },
  defs: readonly SectionDef<unknown>[],
): Envelope {
  if (init.pid === '') throw new Error('createPlayer: empty pid');
  const sections: Record<string, Section> = {};
  for (const def of defs) sections[def.name] = { v: def.v, data: def.empty() };
  return {
    kind: PLAYER_KIND,
    fmt: ENVELOPE_FMT,
    rev: 0,
    app: APP_VERSION,
    pid: init.pid,
    name: init.name,
    course: init.course ?? 'ru',
    explain: init.explain ?? 'ru',
    sections,
  };
}

/**
 * Запись: rev+1, `data` указанных разделов заменены (их `v` остаётся — открытый конверт уже на текущей).
 * Остальные разделы, в том числе незнакомые ядру, переходят в новый конверт теми же объектами — JSON не меняется.
 * Раздела нет в конверте или `data === undefined` — ошибка программиста (его добавляет `openPlayer`; undefined JSON
 * теряет — раздел остался бы без `data`, а игрок стал бы битым).
 */
export function writePlayer(env: Envelope, patch: Record<string, unknown>): Envelope {
  const sections: Record<string, Section> = { ...env.sections };
  for (const [name, data] of Object.entries(patch)) {
    const old = Object.hasOwn(sections, name) ? sections[name] : undefined;
    if (!old) throw new Error(`writePlayer: unknown section ${name}`);
    if (data === undefined) throw new Error(`writePlayer: undefined data for section ${name}`);
    sections[name] = { v: old.v, data };
  }
  return { ...env, rev: env.rev + 1, app: APP_VERSION, sections };
}

/** Строка для хранилища. */
export function serializePlayer(env: Envelope): string {
  return JSON.stringify(env);
}

/**
 * Что не так с конвертом перед записью: у каждого известного раздела есть данные, версия текущая, `check` пуст.
 * Пусто — годен. Исключение из `check` — тоже причина, а не падение.
 */
export function envelopeProblems(env: Envelope, defs: readonly SectionDef<unknown>[]): string[] {
  const why: string[] = [];
  for (const def of defs) {
    const sec = Object.hasOwn(env.sections, def.name) ? env.sections[def.name] : undefined;
    if (!sec) {
      why.push(`section:${def.name}:missing`);
      continue;
    }
    if (sec.v !== def.v) why.push(`section:${def.name}:version`);
    try {
      why.push(...def.check(sec.data).map((c) => `section:${def.name}:${c}`));
    } catch {
      why.push(`section:${def.name}:check-failed`);
    }
  }
  return why;
}
