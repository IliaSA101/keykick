/**
 * Запись устройства (060 design §3): порядок игроков, язык интерфейса, звук, замок родителя.
 * Один тип на хранилище (`app/save/store.ts`) и снимок клуба (`snapshot.ts`). Чистые функции: хранилища и часов нет.
 */
import { isInt } from './section';

export const DEVICE_KIND = 'keykick-device';
export const DEVICE_FMT = 1;

/** Устройство: список игроков и общие настройки (Э1 наполняет `sound` и `parent`). */
export interface Device {
  kind: typeof DEVICE_KIND;
  fmt: number;
  rev: number;
  players: { pid: string; order: number }[];
  uiLang: string;
  sound: Record<string, unknown>;
  /** `exported` — день последней выгрузки клуба `ГГГГ-ММ-ДД` (063-Р9: по нему родителю напоминают); поля нет — не выгружали. */
  parent: { gate: string; exported?: string };
  /** Корзина (063-Р62): `pid` удалённого игрока → день удаления `ГГГГ-ММ-ДД`. Правда о том, кто в корзине, — ключи `trash.*`; здесь только дата для строки «Корзина: Миша — 18.11». Поля нет — корзина пуста. */
  bin?: Record<string, string>;
}

const isObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Запись устройства негодна по форме (читается и из диска, и перед записью). Незнакомые поля не мешают. */
export function deviceProblems(d: Record<string, unknown>): boolean {
  if (!isInt(d.rev) || d.rev < 0 || typeof d.uiLang !== 'string') return true;
  if (!isObject(d.sound) || !isObject(d.parent) || !Array.isArray(d.players)) return true;
  return d.players.some((x: unknown) => !isObject(x) || typeof x.pid !== 'string' || x.pid === '' || !isInt(x.order));
}

/** Запись устройства с новым списком и днями корзины; пустая корзина — без поля `bin`. */
function next(device: Device, players: Device['players'], bin: Record<string, string>): Device {
  const out: Device = { ...device, rev: device.rev + 1, players };
  if (Object.keys(bin).length > 0) out.bin = bin;
  else delete out.bin;
  return out;
}

/**
 * Корзина (059-В10), сторона устройства: игрок уходит из списка — конверт в корзине лежит под `trash.<pid>`
 * (`store.trash`), а запись устройства новая (`rev + 1`), порядок остальных не меняется. Игрока нет в списке — тот же `device`.
 * `day` — день удаления (часы снаружи): по нему строка корзины. Записать результат — `store.saveDevice(next, device.rev)`.
 */
export function withoutPlayer(device: Device, pid: string, day?: string): Device {
  if (!device.players.some((p) => p.pid === pid)) return device;
  return next(device, device.players.filter((p) => p.pid !== pid), { ...(device.bin ?? {}), ...(day === undefined ? {} : { [pid]: day }) });
}

/** Восстановление из корзины: игрок — в конец списка (`order` = следующий за наибольшим), день корзины стёрт. Уже в списке — тот же `device`. */
export function withPlayer(device: Device, pid: string): Device {
  if (device.players.some((p) => p.pid === pid)) return device;
  const order = device.players.reduce((max, p) => Math.max(max, p.order + 1), 0);
  return next(device, [...device.players, { pid, order }], Object.fromEntries(Object.entries(device.bin ?? {}).filter(([k]) => k !== pid)));
}

/** Корзина очищена: дни стёрты (`rev + 1`). Дней и так нет — тот же `device`. */
export function withBinCleared(device: Device): Device {
  return device.bin === undefined ? device : next(device, device.players, {});
}

/** День корзины для игрока, которого в списке не было (сирота, подобранный в корзину, 063-Р65): `rev + 1`. Тот же день уже записан — тот же `device`. */
export function withBinDay(device: Device, pid: string, day: string): Device {
  if (device.bin?.[pid] === day) return device;
  return next(device, device.players, { ...(device.bin ?? {}), [pid]: day });
}
