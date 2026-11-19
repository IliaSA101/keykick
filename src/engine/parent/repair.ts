/**
 * Страница родителя (063-Р65): что показать про игроков и устройство, которые не открываются, и чем отвечать на отказ «Начать заново» / «Новый клуб».
 * Чистые функции: хранилища и Vue нет, входы приходят снаружи (структуры совпадают с `Here` из `app/save/transfer.ts`).
 */
import type { ImportPlan } from '../save/import';

/** Игрок из списка, которого не открыть (как `Stuck` моста переноса). */
export interface StuckPlayer {
  pid: string;
  kind: 'broken' | 'newer' | 'denied' | 'binned';
  /** Имя из лежащего конверта; не читается — `null`. */
  name: string | null;
}
/** Что с самим устройством (как `Here.state`). */
export type DeviceState = 'ok' | 'absent' | 'denied' | 'broken' | 'newer';

export type RepairAction = 'load' | 'restart' | 'newClub';
/** Строка «не открывается»: `pid` игрока (у устройства — `null`), причина и действия по ней. */
export interface TroubleRow {
  pid: string | null;
  kind: 'broken' | 'newer' | 'denied' | 'binned';
  name: string | null;
  actions: RepairAction[];
}

/** Битому — файл или пустой игрок; «новее», «нет доступа» и «в корзине» — ничего не стираем (063-Р65: «новее» — только текст, Р15; «в корзине» — вернуть в блоке «Корзина»). */
export const stuckRows = (stuck: readonly StuckPlayer[]): TroubleRow[] =>
  stuck.map((s) => ({ pid: s.pid, kind: s.kind, name: s.name, actions: s.kind === 'broken' ? ['load', 'restart'] : [] }));

/**
 * Устройство, которое не открыть: `broken` — файл или «Новый клуб», `newer` — только текст (просмотр, Р15), `denied` (хранилище недоступно, 063-Р72) —
 * только текст, без действий: писать некуда. `absent` — не здесь: первого запуска тупиком не зовём.
 */
export const deviceRow = (state: DeviceState): TroubleRow | null =>
  state === 'broken'
    ? { pid: null, kind: 'broken', name: null, actions: ['load', 'newClub'] }
    : state === 'newer' || state === 'denied'
      ? { pid: null, kind: state, name: null, actions: [] }
      : null;

/** Отказ «Начать заново» / «Новый клуб» → ключ строки (063-Р65). `busy` — с именем, `healthy` — «уже открывается», `binned` — «в корзине»; общие — как у корзины. */
export type RepairNote = 'busy' | 'conflict' | 'readonly' | 'healthy' | 'binned' | 'quota' | 'denied';
export function repairNoteKey(why: string): RepairNote {
  if (why === 'busy' || why === 'readonly' || why === 'healthy' || why === 'binned' || why === 'quota' || why === 'denied') return why;
  return 'conflict'; // absent (игрока или клуба уже нет), conflict и всё непредвиденное: «обновите страницу»
}

/** Имена игроков, чей прежний конверт остался в корзине после загрузки файла (063-Р64, `binLeft`); имени в плане нет — `fallback`. */
export const binLeftNames = (left: readonly string[], plan: ImportPlan, fallback: string): string[] =>
  left.map((pid) => (plan.kind === 'ok' ? plan.add.find((e) => e.pid === pid)?.name : undefined) ?? fallback);
