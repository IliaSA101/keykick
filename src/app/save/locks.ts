/**
 * Замок игрока между вкладками (059 С-18; 060 design §3): единственное место с `navigator.locks`.
 * Нет Web Locks — `unsupported`: тогда вкладки различает только сверка `rev` перед записью (она в store всегда).
 */

/** Подмножество `LockManager`, годное для подмены в тесте. */
export interface LocksApi {
  request(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: unknown) => Promise<unknown> | undefined,
  ): Promise<unknown>;
}

export type Hold =
  /** Замок взят этой вкладкой; `release` отпускает (повторный вызов безвреден). */
  | { kind: 'held'; release: () => void }
  /** Игрока держит другая вкладка. */
  | { kind: 'busy' }
  /** Web Locks нет или сбой запроса: пишем с проверкой `rev`. */
  | { kind: 'unsupported' };

export function browserLocks(): LocksApi | undefined {
  try {
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : undefined;
  } catch {
    return undefined;
  }
}

/** Берёт замок `name` без ожидания. Не бросает и не отклоняется. */
export function holdLock(name: string, api: LocksApi | undefined): Promise<Hold> {
  if (!api) return Promise.resolve({ kind: 'unsupported' });
  return new Promise<Hold>((resolve) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => {
      release = r;
    });
    try {
      api
        .request(name, { ifAvailable: true }, (lock) => {
          if (lock === null || lock === undefined) {
            resolve({ kind: 'busy' });
            return undefined;
          }
          resolve({ kind: 'held', release });
          return held;
        })
        .catch(() => resolve({ kind: 'unsupported' }));
    } catch {
      resolve({ kind: 'unsupported' });
    }
  });
}
