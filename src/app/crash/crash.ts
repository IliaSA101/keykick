/**
 * Перехват ошибок (спека 014-Т5, design §7). Чистая часть: фабрика `createCrash` получает всё снаружи —
 * журнал, флаги вкладки, часы, перезагрузку и показ экрана, — поэтому проверяется тестом без браузера.
 * Настоящие зависимости и слушатели окна ставит `components/crash/installCrash.ts` (первый импорт `main.ts`).
 * Файл не читает хранилище и не тянет ничего, что читает его при оценке модуля.
 */
import type { EventKind } from '../../engine/save/backup';

/** Какой экран показать: сбой, «игра обновилась», «миграция бросила», карточка «хранилище переполнено». */
export type CrashKind = 'error' | 'newer' | 'migrate' | 'full';

/** `again` — повтор: кнопок «На главную» и «Обновить» нет, текст «Позови папу». */
export interface CrashView {
  kind: CrashKind;
  again: boolean;
}

export type Flag = (name: string, value?: string | null) => string | null;

export interface CrashDeps {
  now(): number;
  log(kind: EventKind, text: string, extra?: { stack?: string }): void;
  /** События слоя сохранения — в журнал (до записи самой ошибки). */
  flush(): void;
  /** Флаг вкладки (sessionStorage): без значения — прочитать, строка — записать, null — снять. */
  flag: Flag;
  reload(): void;
  /** Состояние слоя сохранения (читается при каждой проверке `check`). */
  status(): CrashStatus;
  /** Уйти на главную с перезагрузкой страницы (игра к этому времени снята). */
  home(): void;
  show(view: CrashView): void;
  /** Адреса, откуда берётся наш код (`origin + BASE_URL`): чужой файл — расширение браузера. */
  own: readonly string[];
}

/** Из состояния слоя сохранения экрану важны три признака. */
export interface CrashStatus {
  readOnly: boolean;
  migrateFailed: boolean;
  storageFull: boolean;
}

/** Что известно об ошибке. */
export interface ErrorInfo {
  text: string;
  stack?: string;
  filename?: string;
}

/** Окно между перезагрузками и между «На главную» и повторным сбоем. */
export const REPEAT_MS = 30_000;

export const FLAG_RELOADED = 'reloaded';
export const FLAG_HOME = 'crash.home';
export const FLAG_UPDATED = 'crash.updated';
export const FLAG_FULL = 'crash.full';

const TEXT_MAX = 300;
const STACK_MAX = 2048;

/** Безвредное: не повод пугать ребёнка. В журнал попадает всё равно. */
export function isHarmless(info: { text: string; filename?: string; stack?: string }, own: readonly string[]): boolean {
  if (info.text.includes('ResizeObserver loop')) return true;
  if (/^(Uncaught )?(\w*Error: )?Script error\.?$/.test(info.text)) return true;
  const file = info.filename ?? '';
  if (file !== '') return !own.some((p) => file.startsWith(p));
  return onlyExtensionStack(info.stack);
}

/** Отказ промиса без имени файла: безвреден, если все кадры стека с адресом — из расширения браузера. */
function onlyExtensionStack(stack: string | undefined): boolean {
  if (stack === undefined) return false;
  const frames = stack.split('\n').filter((l) => /^\s*at\s/.test(l) || l.includes('@'));
  const withUrl = frames.filter((l) => l.includes('://'));
  return withUrl.length > 0 && withUrl.every((l) => /(?:chrome|moz)-extension:\/\//.test(l));
}

/** Не загрузился чанк: старая вкладка после выпуска, а не сломанная игра. */
export function isChunkError(text: string): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(text);
}

/** Любое брошенное значение → текст и стек для журнала. */
export function describeError(err: unknown, filename?: string): ErrorInfo {
  let text: string;
  let stack: string | undefined;
  if (err instanceof Error) {
    text = `${err.name}: ${err.message}`;
    stack = err.stack;
  } else if (typeof err === 'string') {
    text = err;
  } else {
    try {
      text = JSON.stringify(err) ?? String(err);
    } catch {
      text = String(err);
    }
  }
  const info: ErrorInfo = { text: text.slice(0, TEXT_MAX) };
  if (stack !== undefined) info.stack = stack.slice(0, STACK_MAX);
  if (filename !== undefined && filename !== '') info.filename = filename;
  return info;
}

/** Окно или любой `EventTarget`: слушатели ставятся на него. */
export interface Listenable {
  addEventListener(type: string, fn: (ev: Event) => void): void;
}

interface MainApp {
  unmount(): void;
}

export function createCrash(d: CrashDeps) {
  let crashed = false;
  /** Страница уже перезагружается тихо: всё, что бросит умирающая страница, — только в журнал. */
  let reloading = false;
  /** Карточка «переполнено» показана в этой странице (флаг вкладки может не записаться). */
  let fullShown = false;
  let main: MainApp | null = null;

  /** Было ли событие флага меньше REPEAT_MS назад. */
  function recent(name: string): boolean {
    const n = Number(d.flag(name));
    return Number.isFinite(n) && n > 0 && Math.abs(d.now() - n) < REPEAT_MS;
  }

  /** Главное приложение снимается: сломанный рендер не должен тянуть экран сбоя. Ошибки снятия глотаем. */
  function dropMain(): void {
    try {
      main?.unmount();
    } catch {
      // Снимаем сломанное — ошибка снятия ничего не меняет.
    }
    main = null;
  }

  function present(view: CrashView): void {
    crashed = true;
    dropMain();
    d.show(view);
  }

  /** Тихая перезагрузка: один раз; была меньше REPEAT_MS назад — false (дальше экран). */
  function reloadOnce(): boolean {
    if (recent(FLAG_RELOADED)) return false;
    // Флаг не записался (хранилище вкладки закрыто) — значит, перезагрузка могла бы повторяться без конца: сразу экран.
    if (d.flag(FLAG_RELOADED, String(d.now())) === null) return false;
    reloading = true;
    d.reload();
    return true;
  }

  /**
   * Любая ошибка: в журнал; безвредная — только туда; сбой загрузки чанка — одна перезагрузка;
   * иначе экран сбоя (первый перехват; повторные только пишутся).
   */
  function report(err: unknown, source: string, opts: { filename?: string; chunk?: boolean } = {}): void {
    const info = describeError(err, opts.filename);
    d.flush();
    const harmless = isHarmless(info, d.own);
    d.log('error', `${source}${harmless ? ' (harmless)' : ''}: ${info.text}`, info.stack === undefined ? undefined : { stack: info.stack });
    if (harmless || reloading) return;
    if ((opts.chunk === true || isChunkError(info.text)) && reloadOnce()) return;
    if (crashed) return;
    present({ kind: 'error', again: recent(FLAG_HOME) });
  }

  /** Слушатели окна: `error`, `unhandledrejection`, `vite:preloadError`. */
  function listen(target: Listenable): void {
    target.addEventListener('error', (ev) => {
      const e = ev as Event & { message?: string; filename?: string; error?: unknown };
      report(e.error ?? e.message ?? 'error', 'window', e.filename === undefined ? {} : { filename: e.filename });
    });
    target.addEventListener('unhandledrejection', (ev) => {
      report((ev as Event & { reason?: unknown }).reason, 'promise');
    });
    target.addEventListener('vite:preloadError', (ev) => {
      ev.preventDefault();
      report((ev as Event & { payload?: unknown }).payload, 'preload', { chunk: true });
    });
  }

  /** Сохранение новее программы: «Обновить»; после уже нажатого «Обновить» — «Позови папу». */
  function showNewer(): void {
    d.flush();
    d.log('storage', 'show newer');
    present({ kind: 'newer', again: recent(FLAG_UPDATED) });
  }

  /** Цепочка миграций бросила: игра не монтируется. */
  function showMigrate(): void {
    d.flush();
    d.log('storage', 'show migrate-failed');
    present({ kind: 'migrate', again: true });
  }

  /** Хранилище переполнено: карточка ребёнку один раз за сеанс (вкладку), игра не снимается. */
  function showFullOnce(): boolean {
    if (crashed || fullShown || d.flag(FLAG_FULL) !== null) return false;
    fullShown = true;
    d.flag(FLAG_FULL, String(d.now()));
    d.log('storage', 'show storage-full');
    d.show({ kind: 'full', again: true });
    return true;
  }

  /**
   * Состояние слоя сохранения → экран: `migrateFailed` — «Позови папу», `readOnly` — «Игра обновилась»,
   * `storageFull` — карточка раз за сеанс. Зовётся при запуске и после каждого перехода роутера (`storageFull` не реактивен).
   * Экран сбоя уже показан — ничего. true — что-то показано.
   */
  function check(status: CrashStatus): boolean {
    if (crashed) return false;
    if (status.migrateFailed) showMigrate();
    else if (status.readOnly) showNewer();
    else return status.storageFull && showFullOnce();
    return true;
  }

  /** «На главную» с экрана сбоя: метка для проверки «сломалось сразу снова». */
  function goHome(): void {
    d.flag(FLAG_HOME, String(d.now()));
    d.home();
  }

  /** «Обновить» с экрана «Игра обновилась». */
  function update(): void {
    d.flag(FLAG_UPDATED, String(d.now()));
    d.reload();
  }

  return {
    report,
    listen,
    showNewer,
    showMigrate,
    showFullOnce,
    check,
    /** `check` по текущему состоянию слоя. */
    recheck: (): boolean => check(d.status()),
    goHome,
    update,
    /** Главное приложение, которое нужно снять при сбое. */
    attachMain: (app: MainApp): void => void (main = app),
    /** Экран сбоя уже показан (или игра не должна монтироваться). */
    crashed: (): boolean => crashed,
  };
}

export type Crash = ReturnType<typeof createCrash>;

let active: Crash | null = null;

/** Включить перехватчик приложения (зовёт installCrash). */
export function setActiveCrash(c: Crash | null): void {
  active = c;
}

/** Для мест, которые не владеют перехватчиком (роутер): ошибка идёт в него; его нет — в консоль. */
/** Роутер после перехода просит перепроверить слой сохранения; перехватчика нет — ничего. */
export function recheckStorage(): void {
  active?.recheck();
}

export function reportError(err: unknown, source: string): void {
  if (active) active.report(err, source);
  else console.error(source, err);
}
