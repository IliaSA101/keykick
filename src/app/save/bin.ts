/**
 * Корзина игроков на странице родителя (063-Р62, 059-В10): удалить в корзину, вернуть, очистить вводом имени.
 * Запись — только через `Store` с замками: игрока, которого держит другая вкладка, не удалить (`busy`, как в `transfer.apply`).
 * Часы приходят снаружи (`day`, `today`). Чистая часть — `engine/save/bin.ts`; Vue здесь нет, строит корзину только мост сеанса.
 *
 * Порядок записи (контракт 063-Р31): удаление — конверт в корзину, затем устройство без игрока; не легло — конверт назад (`restore`).
 * Возврат — конверт из корзины, затем устройство с игроком; не легло — конверт снова в корзину. Оборвалось посреди (перезагрузка):
 * удаление — игрок ещё в списке, а конверт уже в корзине (`settle` дописывает устройство); возврат — файл игрока без записи в списке,
 * осиротевший, но целый (загрузка файла его узнаёт).
 */
import { binEntries, trashName, canDelete, clearConfirmed, halfDeleted, restoreCheck, type BinEntry } from '../../engine/save/bin';
import { withBinCleared, withBinDay, withoutPlayer, withPlayer, type Device } from '../../engine/save/device';
import { createPlayer } from '../../engine/save/envelope';
import type { SectionDef } from '../../engine/save/section';
import type { Hold } from './locks';
import { SECTIONS } from './sections';
import { newDevice } from './store';
import type { Store } from './types';

export type BinWhy = 'busy' | 'last' | 'absent' | 'limit' | 'listed' | 'conflict' | 'quota' | 'denied' | 'readonly' | 'empty' | 'phrase';
export type BinResult = { ok: true; count?: number } | { ok: false; why: BinWhy; name?: string };

/** Выход из тупика (063-Р65): отказ «Начать заново» и «Новый клуб». `healthy` — не битое, стирать нечего; `busy` — игрока держит другая вкладка; `binned` — ключа нет, а конверт в корзине (оборванное удаление): пустой игрок лёг бы поверх прогресса. */
export type RepairWhy = 'busy' | 'absent' | 'healthy' | 'binned' | 'readonly' | 'quota' | 'denied' | 'conflict';
export type RepairResult = { ok: true } | { ok: false; why: RepairWhy };
const repairFail = (why: RepairWhy): RepairResult => ({ ok: false, why });

export interface Bin {
  /**
   * «Начать заново» битого игрока из списка (063-Р65): сырой конверт — в карантин (`loadPlayer`), игрок пишется пустым с тем же `pid`
   * и именем из лежащего конверта (`fallbackName` — когда имя не читается или ключа нет). Здоровый игрок — `healthy`, «новее» — `readonly`, ключа нет, а конверт в корзине — `binned`.
   */
  restart(pid: string, fallbackName: string): Promise<RepairResult>;
  /**
   * «Новый клуб» поверх битого устройства (063-Р65): `saveDevice(новое, null)` поверх карантина, файлы прежних игроков тут же —
   * в корзину (`settle(day)`, день — сегодня). Устройство читается — `healthy`, «новее» — `readonly`.
   */
  newClub(day: string): Promise<RepairResult>;
  /** Что в корзине (по ключам `trash.*`), свежее выше. `today` — день `ГГГГ-ММ-ДД`. */
  list(today: string): BinEntry[];
  /** Игрок — в корзину; `day` — день удаления. */
  remove(pid: string, day: string): Promise<BinResult>;
  /** Игрок — из корзины в конец списка. */
  restore(pid: string): BinResult;
  /** Очистка: `typed` — введённое имя (имена); совпало — конверты и их копии стёрты насовсем. */
  empty(typed: string): BinResult;
  /**
   * Дописывает оборванное удаление (конверт в корзине, игрок ещё в списке) и подбирает сирот в корзину (063-Р65).
   * `day` — сегодня (часы снаружи). Вернуло `true` — устройство или корзина изменились. Игроков под замком другой вкладки не трогает (063-Р71).
   */
  settle(day: string): Promise<boolean>;
}

export interface BinDeps {
  store: Store;
  /** Игрока держит эта вкладка (замок уже наш): его второй раз не берём. */
  own?: (pid: string) => boolean;
  /** Разделы сборки для пустого игрока «Начать заново»; по умолчанию — реестр `sections.ts`. */
  defs?: readonly SectionDef<unknown>[];
}

const fail = (why: BinWhy, name?: string): BinResult => (name === undefined ? { ok: false, why } : { ok: false, why, name });
/** Отказ хранилища → причина для экрана. */
const WHY = { absent: 'absent', exists: 'listed', quota: 'quota', denied: 'denied', busy: 'busy' } as const;

export function createBin({ store, own, defs = SECTIONS }: BinDeps): Bin {
  function pids(): string[] {
    const got = store.trashed();
    return got.ok ? got.value : [];
  }

  /** Файлы игроков на диске, которых нет ни в списке `device`, ни в корзине. */
  function orphans(device: Device): string[] {
    const disk = store.playerPids();
    if (!disk.ok) return [];
    const trashed = pids();
    return disk.value.filter((pid) => !device.players.some((p) => p.pid === pid) && !trashed.includes(pid));
  }

  function nameOf(pid: string): string {
    const got = store.loadPlayer(pid);
    return got.kind === 'ok' ? got.env.name : '';
  }

  function list(today: string): BinEntry[] {
    const d = store.loadDevice();
    const raws: Record<string, string | undefined> = {};
    const listed = pids();
    for (const pid of listed) {
      const got = store.peekTrash(pid);
      raws[pid] = got.ok ? got.value : undefined;
    }
    return binEntries(listed, raws, d.kind === 'ok' ? d.device : {}, today);
  }

  const api: Bin = {
    list,

    async remove(pid, day) {
      let hold: (Hold & { kind: 'held' }) | undefined;
      if (!own?.(pid)) {
        const got = await store.hold(pid);
        if (got.kind === 'busy') return fail('busy', nameOf(pid));
        if (got.kind === 'held') hold = got;
      }
      try {
        // Устройство читаем после замка: пока ждали, другая вкладка могла его записать (иначе conflict на ровном месте).
        const d = store.loadDevice();
        if (d.kind === 'newer') return fail('readonly');
        if (d.kind !== 'ok') return fail(d.kind === 'denied' ? 'denied' : 'absent');
        if (!d.device.players.some((p) => p.pid === pid)) return fail('absent');
        if (!canDelete(d.device)) return fail('last');
        // Игрок и в списке, и в корзине (дубль после обрыва, 063-Р66): старый конверт уходит в копии, иначе `trash` откажет `exists`.
        // Копия не легла — конверт остаётся в корзине, `trash` ниже отказывает `listed`: ничего не стёрто.
        if (store.peekTrash(pid).ok) store.trashToCopy(pid);
        const put = store.trash(pid);
        if (!put.ok) return fail(WHY[put.err], put.err === 'busy' ? nameOf(pid) : undefined);
        const listed = store.saveDevice(withoutPlayer(d.device, pid, day), d.device.rev);
        if (!listed.ok) {
          store.restore(pid); // игрок не должен остаться в списке без файла
          return fail(listed.err === 'invalid' ? 'denied' : listed.err);
        }
        return { ok: true };
      } finally {
        hold?.release();
      }
    },

    restore(pid) {
      const d = store.loadDevice();
      if (d.kind === 'newer') return fail('readonly');
      if (d.kind !== 'ok') return fail(d.kind === 'denied' ? 'denied' : 'absent');
      const check = restoreCheck(d.device, pid);
      if (check !== 'ok') return fail(check);
      const back = store.restore(pid);
      if (!back.ok) return fail(WHY[back.err]);
      const listed = store.saveDevice(withPlayer(d.device, pid), d.device.rev);
      if (!listed.ok) {
        store.trash(pid); // не вышло вернуть в список — конверт снова в корзине, а не потерян
        return fail(listed.err === 'invalid' ? 'denied' : listed.err);
      }
      return { ok: true };
    },

    empty(typed) {
      const d = store.loadDevice();
      if (d.kind === 'newer') return fail('readonly'); // устройство новее: дни в нём не поправить, чистить корзину не начинаем
      const entries = list('');
      if (entries.length === 0) return fail('empty');
      if (!clearConfirmed(entries, typed)) return fail('phrase');
      const gone = store.emptyTrash();
      if (!gone.ok) return fail('denied');
      // Дни в устройстве — лишь подпись: не легло, корзина всё равно пуста (правда — ключи `trash.*`).
      if (d.kind === 'ok') store.saveDevice(withBinCleared(d.device), d.device.rev);
      return { ok: true, count: gone.value };
    },

    async restart(pid, fallbackName) {
      let hold: (Hold & { kind: 'held' }) | undefined;
      if (!own?.(pid)) {
        const got = await store.hold(pid);
        if (got.kind === 'busy') return repairFail('busy');
        if (got.kind === 'held') hold = got;
      }
      try {
        const d = store.loadDevice();
        if (d.kind === 'newer') return repairFail('readonly');
        if (d.kind !== 'ok') return repairFail(d.kind === 'denied' ? 'denied' : 'absent');
        if (!d.device.players.some((p) => p.pid === pid)) return repairFail('absent');
        // `loadPlayer` кладёт битое сырое в карантин (если места нет — `quarantined: false`, поверх писать нельзя) и разрешает запись поверх него.
        const got = store.loadPlayer(pid);
        if (got.kind === 'ok') return repairFail('healthy'); // живого игрока так не стирают
        if (got.kind === 'newer') return repairFail('readonly');
        if (got.kind === 'denied') return repairFail('denied');
        if (got.kind === 'broken' && !got.quarantined) return repairFail('quota');
        // Оборванное удаление: ключа нет, прогресс лежит в корзине — не затираем пустым игроком, его вернёт «Вернуть» (063-Р65, ревью).
        if (got.kind === 'absent' && store.peekTrash(pid).ok) return repairFail('binned');
        const name = got.kind === 'broken' ? (trashName(got.raw) ?? fallbackName) : fallbackName; // ключа нет — имени взять неоткуда
        const put = store.savePlayer(pid, createPlayer({ pid, name }, defs), null);
        if (put.ok) return { ok: true };
        return repairFail(put.err === 'invalid' ? 'denied' : put.err);
      } finally {
        hold?.release();
      }
    },

    async newClub(day) {
      const d = store.loadDevice();
      if (d.kind === 'newer') return repairFail('readonly');
      if (d.kind === 'ok') return repairFail('healthy');
      if (d.kind === 'absent') return repairFail('absent'); // первый запуск, а не тупик
      if (d.kind === 'denied') return repairFail('denied');
      if (d.kind === 'broken' && !d.quarantined) return repairFail('quota');
      // Битое сырое уже в карантине; пустое устройство — поверх. Файлы прежних игроков остаются на диске сиротами: `settle` кладёт их в корзину.
      const put = store.saveDevice(newDevice(), null);
      if (!put.ok) return repairFail(put.err === 'invalid' ? 'denied' : put.err);
      await api.settle(day);
      return { ok: true };
    },

    async settle(day) {
      const first = store.loadDevice();
      if (first.kind !== 'ok') return false;
      // Чужого не трогаем (063-Р71, Р74): игрока, которого держит другая вкладка (она пишет его сама — `create` берёт замок до записи файла
      // и держит до устройства, удаление — между корзиной и устройством), settle пропускает; остальных держит на время записи, как `remove` и `restart`.
      // Игрок этой вкладки замок уже держит — повторно не берём, но он «свой»: «Новый клуб» кладёт в корзину и его.
      const holds: (Hold & { kind: 'held' })[] = [];
      const free = new Set<string>();
      try {
        for (const pid of new Set([...halfDeleted(first.device, pids()), ...orphans(first.device)])) {
          if (own?.(pid)) {
            free.add(pid);
            continue;
          }
          const got = await store.hold(pid);
          if (got.kind === 'busy') continue;
          if (got.kind === 'held') holds.push(got);
          free.add(pid);
        }
        // Устройство читаем после замков: пока ждали, другая вкладка могла его записать (иначе conflict на ровном месте).
        const d = store.loadDevice();
        if (d.kind !== 'ok') return false;
        // Файл игрока ещё на диске (оборвалось между записью корзины и удалением ключа) — не трогаем: список и файл на месте.
        const stuck = halfDeleted(d.device, pids()).filter((pid) => free.has(pid) && store.loadPlayer(pid).kind === 'absent');
        let next = d.device;
        for (const pid of stuck) next = withoutPlayer(next, pid, next.bin?.[pid] ?? day);
        // Сироты (063-Р65): файл игрока есть, а в списке и в корзине его нет — след `create` без записи устройства или двойного отказа
        // при возврате. В корзину, а не стирать: ничего не теряется (свежий файл без данных тоже — проще, чем различать).
        let trashed = false;
        for (const pid of orphans(next)) {
          if (!free.has(pid) || !store.trash(pid).ok) continue;
          next = withBinDay(next, pid, day);
          trashed = true;
        }
        if (next === d.device) return false;
        // День — лишь подпись для строки корзины: не легло, конверты в корзине всё равно лежат (правда — ключи `trash.*`).
        return store.saveDevice(next, d.device.rev).ok || trashed;
      } finally {
        for (const h of holds) h.release();
      }
    },
  };
  return api;
}
