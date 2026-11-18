/**
 * Типы хранилища сохранения (063-Р4): результаты загрузки и записи, настройки, интерфейс `Store`.
 * Вынесены из `store.ts`, чтобы он оставался ≤ 300 строк; `store.ts` их реэкспортирует.
 */
import type { Device } from '../../engine/save/device';
import type { Envelope } from '../../engine/save/envelope';
import type { SectionDef } from '../../engine/save/section';
import type { CopyErr } from './copies';
import type { Hold, LocksApi } from './locks';
import type { Done, Got, KeyValue } from './storage';

export type DeviceLoaded =
  | { kind: 'ok'; device: Device }
  | { kind: 'absent' }
  | { kind: 'denied' }
  | { kind: 'newer'; raw: string }
  /** `quarantined` — сырое лежит в `quarantine.device.n`; `false` — места нет, поверх писать нельзя. */
  | { kind: 'broken'; raw: string; quarantined: boolean };

export type PlayerLoaded =
  /** `backup` — сырое до миграции сохранено в c1 (или миграции не было); `false` — копию сделать не удалось. */
  | { kind: 'ok'; env: Envelope; changed: boolean; backup: boolean }
  | { kind: 'absent' }
  | { kind: 'denied' }
  | { kind: 'newer'; raw: string; section?: string }
  | {
      kind: 'broken';
      raw: string;
      why: string[];
      sections?: string[];
      quarantined: boolean;
    };

export type SaveErr = 'conflict' | 'quota' | 'denied' | 'readonly';
export type Saved = Done<SaveErr> | { ok: false; err: 'invalid'; why: string[] };
export type BinErr = 'absent' | 'exists' | 'quota' | 'denied' | 'busy';

export interface StoreOptions {
  /** `prefix(major, channel)` из `engine/release/keys.ts`. */
  prefix: string;
  local: KeyValue;
  /** Хранилище вкладки; нет — `tabPid` недоступен. */
  session?: KeyValue;
  locks?: LocksApi;
  /** Разделы сборки; по умолчанию — реестр `sections.ts`. */
  defs?: readonly SectionDef<unknown>[];
}

export interface Store {
  loadDevice(): DeviceLoaded;
  saveDevice(device: Device, expectRev: number | null): Saved;
  loadPlayer(pid: string): PlayerLoaded;
  /**
   * `expectRev` — `rev`, с которым игрок был загружен; `null` — игрока ещё нет на диске (создание).
   * Перед записью: игрок не только для чтения, разделы прошли `check`, на диске тот же `rev`.
   * Исключение — битый игрок, чьё сырое уже в карантине: `expectRev = null` пишет поверх, пока на диске то же сырое (063-Р53).
   */
  savePlayer(pid: string, env: Envelope, expectRev: number | null): Saved;
  /**
   * Конверт — в копии игрока (c1 со сдвигом кольца), основной ключ не тронут: проигравший при импорте `clash` (060 design §4).
   * Чужой `pid` в конверте — `invalid`; нет места даже после уступки старших копий — `quota`.
   */
  putCopy(pid: string, env: Envelope): Done<CopyErr | 'invalid'>;
  /** Сырые версии из карантина владельца (pid игрока или `device`), свежая первой: в выгрузку полем `quarantine` (063-Р10). */
  quarantined(owner: string): string[];
  /** Замок игрока. Занят другой вкладкой — запись этого игрока отказывает `readonly`, пока замок не взят. */
  hold(pid: string): Promise<Hold>;
  /** Игрока держит другая вкладка (`hold` дал `busy`) — `busy`, ничего не тронуто. */
  trash(pid: string): Done<BinErr>;
  restore(pid: string): Done<BinErr>;
  /**
   * Конверт игрока из корзины — в копии (c1 со сдвигом кольца) и снят из корзины: игрок вернулся из файла, а не из корзины (063-Р64).
   * Копия не легла (`quota`/`denied`) — корзина не тронута, ничего не потеряно.
   */
  trashToCopy(pid: string): Done<BinErr | CopyErr>;
  /** Стирает корзину и хвосты её игроков (копии, карантин). Возвращает число стёртых конвертов. */
  emptyTrash(): Got<number, 'denied'>;
  trashed(): Got<string[], 'denied'>;
  /** `pid` всех файлов игроков на диске (ключи `player.<pid>`, без копий): сироты — тех, кого нет ни в списке, ни в корзине, ищет `bin.settle` (063-Р65). */
  playerPids(): Got<string[], 'denied'>;
  /** Сырой конверт игрока из корзины как лежит (не открывается и не мигрирует): имя для строки корзины (063-Р62). */
  peekTrash(pid: string): Got<string>;
  tabPid(): string | undefined;
  setTabPid(pid: string): Done;
}
