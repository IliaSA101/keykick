/**
 * Хранилище сохранения (060 design §3, 059 С-18, С-19): устройство, игроки, кольцо копий, карантин, корзина.
 * Всё, что может отказать, возвращает результат, а не бросает. Чужие ключи (другой префикс, другие сайты) не читаются
 * и не стираются: `keys()` всегда спрашивается с префиксом сборки. Часы не нужны; хранилище и замки внедряются.
 * - сырое не теряется: `broken` — в карантин, `newer` — только чтение; основной ключ остаётся как был; перед первой
 *   записью после миграции сырое — в c1 (загрузка не смогла — `savePlayer` пробует снова и без копии не пишет: `quota`);
 * - две вкладки: замок (`hold`) и всегда — сверка `rev` на диске перед записью;
 * - список игроков в `device` ведёт вызывающий: `withoutPlayer`/`withPlayer` (`engine/save/device.ts`) + `saveDevice`;
 * - кольцо копий — `copies.ts`, карантин — `quarantine.ts`, типы — `types.ts` (063-Р4).
 */
import { DEVICE_FMT, DEVICE_KIND, deviceProblems, type Device } from '../../engine/save/device';
import { ENVELOPE_FMT, envelopeProblems, serializePlayer, validPid } from '../../engine/save/envelope';
import { openPlayer, type Opened } from '../../engine/save/open';
import { isInt } from '../../engine/save/section';
import { COPIES_LIMIT, createCopies } from './copies';
import { holdLock } from './locks';
import { QUARANTINE_MAX, createQuarantine } from './quarantine';
import { SECTIONS } from './sections';
import type { DeviceLoaded, Saved, Store, StoreOptions } from './types';

export type { BinErr, DeviceLoaded, PlayerLoaded, SaveErr, Saved, Store, StoreOptions } from './types';

// Тип и константы устройства живут в движке (их берёт и снимок клуба); здесь — для прежних импортов.
export { DEVICE_FMT, DEVICE_KIND, type Device };
// Здесь, а не в движке: тест подменяет `DEVICE_FMT` и ждёт, что новая запись несёт подменённое.
export const newDevice = (): Device => ({
  kind: DEVICE_KIND,
  fmt: DEVICE_FMT,
  rev: 0,
  players: [],
  uiLang: 'ru',
  sound: {},
  parent: { gate: 'none' },
});
export { COPIES_LIMIT, QUARANTINE_MAX };

const isObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

type Disk =
  { kind: 'rev'; rev: number } | { kind: 'absent' } | { kind: 'newer' } | { kind: 'unreadable' } | { kind: 'denied' };

export function createStore(opts: StoreOptions): Store {
  const { prefix: p, local: kv, session } = opts;
  if (p === '') throw new Error('createStore: empty prefix');
  const defs = opts.defs ?? SECTIONS;

  const deviceKey = `${p}device`;
  const playerKey = (pid: string) => `${p}player.${pid}`;
  const trashKey = (pid: string) => `${p}trash.${pid}`;
  const copies = createCopies(kv, p);
  const quar = createQuarantine(kv, p, copies);

  /** Игрок только для чтения: новее программы или битый. */
  const readOnly = new Set<string>();
  /** Игрока держит другая вкладка; отдельно от `readOnly`, чтобы загрузка одного не снимала другое. */
  const busy = new Set<string>();
  /** Загружен после миграции, а сырое в c1 не сохранилось: первая запись сначала повторит копию. */
  const unbacked = new Set<string>();
  let deviceNewer = false;
  /** Битый device, сырое которого лежит в карантине: поверх него `saveDevice(…, null)` разрешён, пока на диске то же. */
  let deviceBroken: string | undefined;
  /** Битый игрок, сырое которого лежит в карантине: поверх него `savePlayer(…, null)` разрешён, пока на диске то же (загрузка файла клуба, 063-Р53). */
  const brokenRaw = new Map<string, string>();

  const writeRelieved: typeof copies.writeRelieved = (k, v, pid) => copies.writeRelieved(k, v, pid);

  /** `maxFmt` — потолок формата для ключа: у устройства и у игрока он свой. */
  function readDisk(key: string, maxFmt: number): Disk {
    const got = kv.read(key);
    if (!got.ok) return got.err === 'absent' ? { kind: 'absent' } : { kind: 'denied' };
    try {
      const parsed: unknown = JSON.parse(got.value);
      if (!isObject(parsed) || !isInt(parsed.rev) || parsed.rev < 0) return { kind: 'unreadable' };
      if (isInt(parsed.fmt) && parsed.fmt > maxFmt) return { kind: 'newer' };
      return { kind: 'rev', rev: parsed.rev };
    } catch {
      return { kind: 'unreadable' };
    }
  }

  /** Запись с проверкой `rev` на диске: ровно то, что ждали, иначе `conflict`. */
  function guardedWrite(
    key: string,
    raw: string,
    newRev: number,
    expectRev: number | null,
    pid: string | null,
    maxFmt: number,
    /** Последний шаг перед записью, когда сверка прошла; `false` — писать нельзя (`quota`). */
    before?: () => boolean,
  ): Saved {
    if (expectRev !== null && newRev <= expectRev) return { ok: false, err: 'invalid', why: ['rev'] };
    const disk = readDisk(key, maxFmt);
    if (disk.kind === 'denied') return { ok: false, err: 'denied' };
    if (disk.kind === 'newer') return { ok: false, err: 'readonly' };
    if (disk.kind === 'unreadable') return { ok: false, err: 'conflict' };
    if (disk.kind === 'absent' ? expectRev !== null : disk.rev !== expectRev) return { ok: false, err: 'conflict' };
    if (before && !before()) return { ok: false, err: 'quota' };
    const done = writeRelieved(key, raw, pid);
    return done.ok ? done : { ok: false, err: done.err === 'quota' ? 'quota' : 'denied' };
  }

  return {
    loadDevice() {
      const brokenDevice = (raw: string): DeviceLoaded => {
        deviceNewer = false;
        const quarantined = quar.put('device', raw, null);
        deviceBroken = quarantined ? raw : undefined;
        return { kind: 'broken', raw, quarantined };
      };
      const got = kv.read(deviceKey);
      if (!got.ok) return { kind: got.err === 'absent' ? 'absent' : 'denied' };
      let parsed: unknown;
      try {
        parsed = JSON.parse(got.value);
      } catch {
        return brokenDevice(got.value);
      }
      if (!isObject(parsed) || parsed.kind !== DEVICE_KIND || !isInt(parsed.fmt) || parsed.fmt < 1) {
        return brokenDevice(got.value);
      }
      if (parsed.fmt > DEVICE_FMT) {
        deviceNewer = true;
        return { kind: 'newer', raw: got.value };
      }
      if (deviceProblems(parsed)) return brokenDevice(got.value);
      deviceNewer = false;
      deviceBroken = undefined;
      return { kind: 'ok', device: parsed as unknown as Device };
    },

    saveDevice(device, expectRev) {
      if (deviceNewer) return { ok: false, err: 'readonly' };
      let raw: string;
      try {
        if (device.kind !== DEVICE_KIND || device.fmt !== DEVICE_FMT || deviceProblems({ ...device })) {
          return { ok: false, err: 'invalid', why: ['device'] };
        }
        raw = JSON.stringify(device);
      } catch {
        return { ok: false, err: 'invalid', why: ['device'] };
      }
      // Выход из тупика: битый device уже в карантине и на диске всё ещё он — новый пишется поверх.
      if (deviceBroken !== undefined && expectRev === null) {
        const disk = kv.read(deviceKey);
        if (disk.ok && disk.value === deviceBroken) {
          const done = writeRelieved(deviceKey, raw, null);
          if (done.ok) deviceBroken = undefined;
          return done.ok ? done : { ok: false, err: done.err === 'quota' ? 'quota' : 'denied' };
        }
      }
      return guardedWrite(deviceKey, raw, device.rev, expectRev, null, DEVICE_FMT);
    },

    loadPlayer(pid) {
      if (!validPid(pid)) return { kind: 'absent' };
      const got = kv.read(playerKey(pid));
      if (!got.ok) return { kind: got.err === 'absent' ? 'absent' : 'denied' };
      const read = openPlayer(got.value, defs);
      // Конверт с чужим pid под этим ключом: первая запись бросила бы (`savePlayer`), поэтому — битый, сырое в карантин.
      const opened: Opened =
        read.kind === 'ok' && read.env.pid !== pid ? { kind: 'broken', raw: got.value, why: ['pid'] } : read;
      if (opened.kind === 'newer') {
        readOnly.add(pid);
        unbacked.delete(pid);
        brokenRaw.delete(pid);
        return opened.section === undefined
          ? { kind: 'newer', raw: opened.raw }
          : { kind: 'newer', raw: opened.raw, section: opened.section };
      }
      if (opened.kind === 'broken') {
        readOnly.add(pid);
        unbacked.delete(pid);
        const quarantined = quar.put(pid, opened.raw, pid);
        if (quarantined) brokenRaw.set(pid, opened.raw);
        else brokenRaw.delete(pid);
        return opened.sections === undefined
          ? { kind: 'broken', raw: opened.raw, why: opened.why, quarantined }
          : {
              kind: 'broken',
              raw: opened.raw,
              why: opened.why,
              sections: opened.sections,
              quarantined,
            };
      }
      readOnly.delete(pid);
      brokenRaw.delete(pid);
      const backup = opened.changed ? copies.put(pid, got.value).ok : true;
      if (backup) unbacked.delete(pid);
      else unbacked.add(pid);
      return { kind: 'ok', env: opened.env, changed: opened.changed, backup };
    },

    savePlayer(pid, env, expectRev) {
      if (!validPid(pid)) return { ok: false, err: 'denied' };
      if (env.pid !== pid) throw new Error(`savePlayer: envelope of ${env.pid} written under ${pid}`);
      const overBroken = readOnly.has(pid) && expectRev === null && brokenRaw.has(pid);
      if ((readOnly.has(pid) && !overBroken) || busy.has(pid)) return { ok: false, err: 'readonly' };
      const why = envelopeProblems(env, defs);
      if (why.length > 0) return { ok: false, err: 'invalid', why };
      let raw: string;
      try {
        raw = serializePlayer(env);
      } catch {
        return { ok: false, err: 'invalid', why: ['serialize'] };
      }
      // Выход из тупика (как у устройства): битое уже в карантине и на диске всё ещё оно — новый конверт пишется поверх.
      if (overBroken) {
        const disk = kv.read(playerKey(pid));
        if (!disk.ok || disk.value !== brokenRaw.get(pid)) return { ok: false, err: 'conflict' };
        const done = writeRelieved(playerKey(pid), raw, pid);
        if (done.ok) {
          brokenRaw.delete(pid);
          readOnly.delete(pid);
        }
        return done.ok ? done : { ok: false, err: done.err === 'quota' ? 'quota' : 'denied' };
      }
      // Загрузка не смогла сохранить сырое до миграции: без копии первая запись не идёт (исходного нет ни в одном ключе).
      const ensureBackup = unbacked.has(pid)
        ? () => {
            const disk = kv.read(playerKey(pid));
            return !disk.ok || copies.put(pid, disk.value).ok;
          }
        : undefined;
      const saved = guardedWrite(playerKey(pid), raw, env.rev, expectRev, pid, ENVELOPE_FMT, ensureBackup);
      if (saved.ok) unbacked.delete(pid);
      return saved;
    },

    putCopy(pid, env) {
      if (!validPid(pid) || env.pid !== pid) return { ok: false, err: 'invalid' };
      let raw: string;
      try {
        raw = serializePlayer(env);
      } catch {
        return { ok: false, err: 'invalid' };
      }
      return copies.put(pid, raw);
    },

    quarantined(owner) {
      return quar.list(owner);
    },

    async hold(pid) {
      const hold = await holdLock(playerKey(pid), opts.locks);
      if (hold.kind === 'busy') busy.add(pid);
      else busy.delete(pid);
      return hold;
    },

    trash(pid) {
      if (!validPid(pid)) return { ok: false, err: 'absent' };
      if (busy.has(pid)) return { ok: false, err: 'busy' };
      const got = kv.read(playerKey(pid));
      if (!got.ok) return got;
      if (kv.read(trashKey(pid)).ok) return { ok: false, err: 'exists' };
      const put = writeRelieved(trashKey(pid), got.value, pid);
      if (!put.ok) return put;
      if (!kv.remove(playerKey(pid)).ok) {
        kv.remove(trashKey(pid));
        return { ok: false, err: 'denied' };
      }
      readOnly.delete(pid);
      unbacked.delete(pid);
      return { ok: true };
    },

    restore(pid) {
      if (!validPid(pid)) return { ok: false, err: 'absent' };
      const got = kv.read(trashKey(pid));
      if (!got.ok) return got;
      if (kv.read(playerKey(pid)).ok) return { ok: false, err: 'exists' };
      const put = writeRelieved(playerKey(pid), got.value, pid);
      if (!put.ok) return put;
      // Ключ корзины не стёрся — игрок был бы и там, и тут: возврат отменяется, только что записанный файл убирается.
      if (!kv.remove(trashKey(pid)).ok) {
        kv.remove(playerKey(pid));
        return { ok: false, err: 'denied' };
      }
      return { ok: true };
    },

    trashToCopy(pid) {
      if (!validPid(pid)) return { ok: false, err: 'absent' };
      const got = kv.read(trashKey(pid));
      if (!got.ok) return got;
      const put = copies.put(pid, got.value);
      if (!put.ok) return put;
      kv.remove(trashKey(pid));
      return { ok: true };
    },

    emptyTrash() {
      const listed = kv.keys(`${p}trash.`);
      if (!listed.ok) return listed;
      let removed = 0;
      let denied = false;
      for (const key of listed.value) {
        const pid = key.slice(`${p}trash.`.length);
        if (!kv.remove(key).ok) {
          denied = true;
          continue;
        }
        removed++;
        if (kv.read(playerKey(pid)).ok) continue; // игрок снова на месте — его хвосты не наши
        copies.drop(pid);
        quar.drop(pid);
      }
      return denied ? { ok: false, err: 'denied' } : { ok: true, value: removed };
    },

    trashed() {
      const listed = kv.keys(`${p}trash.`);
      if (!listed.ok) return listed;
      return {
        ok: true,
        value: listed.value.map((k) => k.slice(`${p}trash.`.length)),
      };
    },

    playerPids() {
      const listed = kv.keys(`${p}player.`);
      if (!listed.ok) return listed;
      // Копии (`player.<pid>.c1`) и всё с точкой в pid — не файлы игроков.
      return { ok: true, value: listed.value.map((k) => k.slice(`${p}player.`.length)).filter(validPid) };
    },

    peekTrash(pid) {
      return validPid(pid) ? kv.read(trashKey(pid)) : { ok: false, err: 'absent' };
    },

    tabPid() {
      const got = session?.read(`${p}tab`);
      return got?.ok ? got.value : undefined;
    },

    setTabPid(pid) {
      return session ? session.write(`${p}tab`, pid) : { ok: false, err: 'denied' };
    },
  };
}
