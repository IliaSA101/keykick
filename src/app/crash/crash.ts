/**
 * Перехват сбоев (ТЗ-12.14): `error` окна (то же, что `onerror`), `unhandledrejection` и `errorHandler` Vue —
 * всё в журнал; на экран — всё, кроме безвредного. Среда и часы — снаружи, поэтому фабрика проверяется тестом.
 * Окно рисует тот, кто подписался через `setPresenter`; сбой раньше подписки не теряется — окно появится при подписке.
 */
import { AGAIN_WINDOW_MS, crashStep, describeError, isHarmless, pushEvent, type EventKind, type EventRecord } from './log';

export interface CrashTarget {
  addEventListener(type: string, fn: (e: never) => void): void;
}

export interface CrashEnv {
  now: () => number;
  origin: string;
  /** «На главную»: адрес Дома и перезагрузка (в игре — `location`, в тесте — заглушка). */
  goHome: () => void;
}

export interface CrashView {
  step: 1 | 2;
  events: readonly EventRecord[];
}

interface ErrorLike {
  message?: string;
  filename?: string;
  error?: unknown;
}

export function createCrash(env: CrashEnv) {
  let log: EventRecord[] = [];
  let view: CrashView | null = null;
  let lastHomeAt: number | null = null;
  let presenter: ((v: CrashView) => void) | null = null;
  const saveHandlers: Array<(events: readonly EventRecord[]) => void> = [];

  function report(kind: EventKind, err: unknown, filename = ''): void {
    const d = describeError(err);
    log = pushEvent(log, { t: env.now(), kind, ...d });
    if (isHarmless(d.text, filename, env.origin)) return;
    view = { step: crashStep(env.now(), lastHomeAt), events: log };
    presenter?.(view);
  }

  /** Запись в журнал событий без окна сбоя: ребёнку не мешаем (отказ журнала матчей, 065-Р40). */
  function note(kind: EventKind, err: unknown): void {
    log = pushEvent(log, { t: env.now(), kind, ...describeError(err) });
  }

  return {
    report,
    note,
    /** Слушатели окна: ставится один раз, при оценке модуля `boot.ts` — до App.vue и роутера. */
    listen(target: CrashTarget): void {
      target.addEventListener('error', (e: ErrorLike) => report('error', e.error ?? e.message ?? '', e.filename ?? ''));
      target.addEventListener('unhandledrejection', (e: { reason?: unknown }) => report('rejection', e.reason));
    },
    crashed: (): boolean => view !== null,
    current: (): CrashView | null => view,
    events: (): readonly EventRecord[] => log,
    /** Подписка окна; сбой, случившийся раньше, показывается сразу. */
    setPresenter(fn: (v: CrashView) => void): void {
      presenter = fn;
      if (view) fn(view);
    },
    /** «На главную»: запоминаем время (повторный сбой скоро после — «Позови взрослого») и уходим. */
    goHome(): void {
      lastHomeAt = env.now();
      env.goHome();
    },
    /** Время последнего «На главную» — для памяти между перезагрузками (запись в хранилище — задача Т11). */
    lastHomeAt: (): number | null => lastHomeAt,
    restoreLastHome(t: number | null): void {
      lastHomeAt = t;
    },
    /** Кнопка «Сохранить файл ошибки» — пока событие для подписчика; сам файл выгружает Т11. */
    onSaveFile(fn: (events: readonly EventRecord[]) => void): void {
      saveHandlers.push(fn);
    },
    requestSaveFile(): void {
      for (const fn of saveHandlers) fn(log);
    },
    againWindowMs: AGAIN_WINDOW_MS,
  };
}

export type Crash = ReturnType<typeof createCrash>;
