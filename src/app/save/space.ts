/**
 * Место в хранилище (спека 014, design §4): запись с освобождением места и потолок копий канала `next`.
 * Порядок освобождения — планы движка (`planFree`): журнал → снимки и `repair` → (только `next`) старое.
 * Старое удаляется по одному имени, самое старое первым, и после каждого — повтор записи.
 */
import { EVENTS_KEEP_BYTES, EVENTS_NAME, overCeiling, planFree, type CopyIo } from '../../engine/save/copies';
import type { TextIo } from './types';

export interface SpaceOptions {
  prefix: string;
  channel: string;
  io: TextIo;
  today: () => string;
  now: () => number;
  /** Не влезло даже после освобождения места. */
  onFull: () => void;
}

/** Журнал событий режется с начала, пока не уложится в предел: это лог, а не прогресс. */
export function trimEvents(text: string): string {
  try {
    const log: unknown = JSON.parse(text);
    if (!Array.isArray(log)) return '[]';
    let cut = log;
    while (cut.length > 0 && JSON.stringify(cut).length > EVENTS_KEEP_BYTES) cut = cut.slice(Math.ceil(cut.length / 4));
    return JSON.stringify(cut);
  } catch {
    return '[]';
  }
}

export function createSpace({ prefix, channel, io, today, now, onFull }: SpaceOptions) {
  /** Имена под префиксом (без него). */
  const names = (): string[] => io.keys(prefix).map((k) => k.slice(prefix.length));

  const readOf = (key: string): string | null => {
    const r = io.read(key);
    return r.ok ? r.text : null;
  };

  const sizes = (list: readonly string[]): Record<string, number> =>
    Object.fromEntries(list.map((n) => [n, readOf(prefix + n)?.length ?? 0]));

  /**
   * Записать; не влезло — освобождать по плану и повторять. false — места нет (`onFull` сообщён).
   * `keep` — полный ключ копии текущей операции: её освобождение места не трогает (иначе «до» пропало бы
   * ради записи «после»). Копии `pre.*.import.*` моложе суток не трогает никто (Р11, `planFree`).
   */
  function writeFree(key: string, text: string, keep?: string): boolean {
    if (io.write(key, text)) return true;
    for (const planned of planFree(names(), sizes(names()), channel, today(), now())) {
      const step = { ...planned, remove: planned.remove.filter((n) => prefix + n !== keep) };
      if (step.kind === 'events') {
        const cur = readOf(prefix + EVENTS_NAME);
        if (cur !== null) {
          io.write(prefix + EVENTS_NAME, trimEvents(cur));
          if (io.write(key, text)) return true;
        }
      } else if (step.remove.length === 0) {
        continue;
      } else if (step.kind === 'old') {
        for (const n of step.remove) {
          io.remove(prefix + n);
          if (io.write(key, text)) return true;
        }
      } else {
        for (const n of step.remove) io.remove(prefix + n);
        if (io.write(key, text)) return true;
      }
    }
    onFull();
    return false;
  }

  /** Потолок копий канала `next`. */
  function trimCeiling(): void {
    const list = names();
    for (const n of overCeiling(list, sizes(list), channel, now())) io.remove(prefix + n);
  }

  /** Запись «копия, потом основной ключ»: копию, уже лежащую, освобождение места при записи основного ключа не удаляет. */
  const copyIoFor = (copyKey: string): CopyIo => ({
    write: (key, text) => writeFree(key, text, key === copyKey ? undefined : copyKey),
    read: readOf,
  });

  return { names, readOf, sizes, writeFree, trimCeiling, copyIoFor };
}
