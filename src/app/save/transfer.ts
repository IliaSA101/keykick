/**
 * Перенос клуба файлом (063 Т11, К11): выгрузка снимка всех игроков устройства и загрузка файла в хранилище.
 * Чистая часть — `engine/save/{snapshot,import,restore}.ts`; здесь только чтение и запись через `Store`.
 * Строит перенос только мост сеанса (`session.transfer`, 063-Р5): экраны `createStore` и `Store` не трогают. Часы и адрес приходят снаружи.
 *
 * Порядок записи при загрузке (`restoreSteps`): отказы без записи (устройство новее или нечитаемо, игрок новее без записи в списке, чужая вкладка)
 * → копии проигравших → игроки → запись устройства. Не легло на любом шаге — стоп с причиной; уже записанные игроки без записи в списке
 * устройства — осиротевшие файлы, не потеря: повторная загрузка того же файла узнаёт их на диске и дописывает список (063-Р53).
 */
import { trashName } from '../../engine/save/bin';
import type { Device } from '../../engine/save/device';
import { PLAYER_KIND, type Envelope } from '../../engine/save/envelope';
import { planImport, type ImportPlan } from '../../engine/save/import';
import { restoreSteps, type Disk, type Pick, type Refusal } from '../../engine/save/restore';
import type { SectionDef } from '../../engine/save/section';
import { exportFileName, makeSnapshot, serializeSnapshot } from '../../engine/save/snapshot';
import type { Hold } from './locks';
import { SECTIONS } from './sections';
import { newDevice, type DeviceLoaded, type Store } from './store';

export interface TransferDeps {
  store: Store;
  /** Разделы сборки; по умолчанию — реестр `sections.ts`. */
  defs?: readonly SectionDef<unknown>[];
  /** Версия программы, записывается в файл. */
  app: string;
  /** Игрока держит эта вкладка (замок уже наш): его второй раз не берём — иначе вкладка «занята сама собой». */
  own?: (pid: string) => boolean;
}

/**
 * Игрок из списка устройства, которого не открыть (063-Р65): файл битый, новее программы, ключа нет (как `broken`, Р31) или нет доступа.
 * `binned` — ключа нет, а конверт лежит в корзине: оборванное удаление (063-Р65, ревью). Не поломка — «Начать заново» не предлагаем (оно писало бы
 * пустого игрока поверх несохранённого прогресса); родитель возвращает его из корзины, а `settle` при открытии страницы дописывает удаление.
 */
export interface Stuck {
  pid: string;
  kind: 'broken' | 'newer' | 'denied' | 'binned';
  /** Имя из лежащего конверта (у `binned` — из корзины); не читается или ключа нет — `null` (экран подставит «Игрок»). */
  name: string | null;
}

/**
 * Что есть на устройстве сейчас: запись устройства (`null` — нет или не читается), открытые конверты игроков
 * и те, кого открыть нельзя (`stuck`, в порядке списка) — страница родителя не пишет «нет игроков», когда игрок есть.
 * `state` — что с самим устройством: `broken`/`newer` — место для «Новый клуб» и тексту про новую версию (063-Р65).
 */
export interface Here {
  device: Device | null;
  players: Envelope[];
  stuck: Stuck[];
  state: DeviceLoaded['kind'];
}

export type ExportResult = { ok: true; name: string; text: string } | { ok: false; why: 'no-device' };
export type ApplyResult =
  /**
   * `written` — `pid` игроков, чей файл записан (сеанс перечитывает своего игрока, только если он среди них).
   * `binLeft` — игроки, чей прежний конверт остался в корзине: копия не легла (063-Р64), игрок и в списке, и в корзине до очистки; страница пишет «<Имя> остался в корзине» (`ru.parent.file.binLeft`).
   */
  | { ok: true; added: number; replaced: number; kept: number; written: string[]; binLeft: string[] }
  /** `busy` — игрока `name` держит другая вкладка: «<имя> играет в другой вкладке», ничего не записано. */
  | { ok: false; why: 'busy'; name: string; written?: never }
  /** `written` есть — отказ пришёл после первой записи игрока: на диске уже есть изменения, сеанс обязан перечитаться (устройство или игрока). */
  | { ok: false; why: Refusal | 'quota' | 'conflict' | 'invalid'; written?: string[] };

export interface Transfer {
  here(): Here;
  /**
   * Снимок клуба в текст. `made` — ISO-время (часы снаружи), `from` — origin + путь. `memory` — конверты игроков, что в памяти впереди диска
   * (запись не легла, `quota`): берутся вместо дисковых, чтобы файл не терял сыгранное. `only` — `pid` одного игрока: файл только его
   * («Скачать файл Миши» перед удалением, 063-Р62); игрока нет в списке — файл без игроков.
   */
  exportText(made: string, from: string, memory?: readonly Envelope[], only?: string): ExportResult;
  /** Файл выгрузки отмечен: `device.parent.exported` — день `ГГГГ-ММ-ДД` (напоминание родителю, 063-Р9). `false` — не записалось. */
  markExported(day: string): boolean;
  /** Разбор файла против устройства; ничего не пишет. */
  plan(text: string): ImportPlan;
  /** Запись плана; `picks` — выбор родителя по совпавшим игрокам. Берёт замки записываемых игроков (асинхронно). */
  apply(plan: ImportPlan, picks: Readonly<Record<string, Pick>>): Promise<ApplyResult>;
}

/** Запись устройства для файла одного игрока: только он в списке, дней корзины нет. */
function forOne(device: Device, listed: Device['players']): Device {
  const one: Device = { ...device, players: listed };
  delete one.bin;
  return one;
}

export function createTransfer(deps: TransferDeps): Transfer {
  const { store } = deps;
  const defs = deps.defs ?? SECTIONS;

  function here(): Here {
    const d = store.loadDevice();
    if (d.kind !== 'ok') return { device: null, players: [], stuck: [], state: d.kind };
    const players: Envelope[] = [];
    const stuck: Stuck[] = [];
    for (const { pid } of d.device.players) {
      const got = store.loadPlayer(pid);
      if (got.kind === 'ok') players.push(got.env);
      else if (got.kind === 'broken' || got.kind === 'newer') stuck.push({ pid, kind: got.kind, name: trashName(got.raw) });
      else if (got.kind === 'absent') {
        const bin = store.peekTrash(pid);
        stuck.push(bin.ok ? { pid, kind: 'binned', name: trashName(bin.value) } : { pid, kind: 'broken', name: null });
      } else stuck.push({ pid, kind: 'denied', name: null });
    }
    return { device: d.device, players, stuck, state: 'ok' };
  }

  /** Файл игрока на диске (`loadPlayer` заодно кладёт битое в карантин). */
  function diskOf(pid: string): Disk {
    const got = store.loadPlayer(pid);
    if (got.kind === 'ok') return { kind: 'ok', env: got.env };
    if (got.kind === 'broken') return { kind: 'broken', kept: got.quarantined };
    return { kind: got.kind };
  }

  return {
    here,
    exportText(made, from, memory = [], only) {
      const d = store.loadDevice();
      if (d.kind !== 'ok') return { ok: false, why: 'no-device' };
      const players: Envelope[] = [];
      const newer: { pid: string; raw: string }[] = [];
      // Файл одного игрока: без дней корзины других и без карантина устройства — это его файл, не клуба.
      const quarantine: Record<string, string[]> = only === undefined ? { device: store.quarantined('device') } : {};
      const listed = d.device.players.filter((p) => only === undefined || p.pid === only);
      for (const { pid } of listed) {
        const got = store.loadPlayer(pid);
        if (got.kind === 'ok') players.push(memory.find((m) => m.pid === pid && m.kind === PLAYER_KIND) ?? got.env);
        else if (got.kind === 'newer') newer.push({ pid, raw: got.raw });
        else if (got.kind === 'broken') quarantine[pid] = store.quarantined(pid);
      }
      const snap = makeSnapshot(only === undefined ? d.device : forOne(d.device, listed), players, { app: deps.app, made, from, newer, quarantine });
      return { ok: true, name: exportFileName(made), text: serializeSnapshot(snap) };
    },
    markExported(day) {
      const d = store.loadDevice();
      if (d.kind !== 'ok') return false;
      const next: Device = { ...d.device, rev: d.device.rev + 1, parent: { ...d.device.parent, exported: day } };
      return store.saveDevice(next, d.device.rev).ok;
    },
    plan(text) {
      const h = here();
      return planImport(text, { device: h.device ?? { players: [] }, players: h.players }, defs, {});
    },
    async apply(plan, picks) {
      if (plan.kind !== 'ok') return { ok: false, why: 'not-ok' };
      // Устройство, которое нельзя записать, — отказ до первой записи, а не «пусто» (после записи игроков список уже не дописать).
      const d = store.loadDevice();
      if (d.kind === 'newer') return { ok: false, why: 'readonly' };
      if (d.kind === 'denied') return { ok: false, why: 'denied' };
      if (d.kind === 'broken' && !d.quarantined) return { ok: false, why: 'quota' };
      const device = d.kind === 'ok' ? d.device : null;
      const disks = new Map([...plan.clash.map((c) => c.pid), ...plan.add.map((e) => e.pid)].map((pid) => [pid, diskOf(pid)]));
      const steps = restoreSteps(plan, { device }, (pid) => disks.get(pid) ?? { kind: 'absent' }, picks, newDevice());
      if ('refused' in steps) return { ok: false, why: steps.refused };
      const holds: (Hold & { kind: 'held' })[] = [];
      try {
        for (const { env } of steps.puts) {
          if (deps.own?.(env.pid)) continue;
          const got = await store.hold(env.pid);
          if (got.kind === 'busy') return { ok: false, why: 'busy', name: env.name };
          if (got.kind === 'held') holds.push(got);
        }
        for (const env of steps.copies) {
          const done = store.putCopy(env.pid, env);
          if (!done.ok) return { ok: false, why: done.err === 'quota' ? 'quota' : done.err === 'invalid' ? 'invalid' : 'denied' };
        }
        const written: string[] = [];
        const refuse = (why: Refusal | 'quota' | 'conflict' | 'invalid'): ApplyResult =>
          written.length > 0 ? { ok: false, why, written } : { ok: false, why };
        for (const { env, expectRev } of steps.puts) {
          const done = store.savePlayer(env.pid, env, expectRev);
          if (!done.ok) return refuse(done.err);
          written.push(env.pid);
        }
        if (steps.device) {
          const done = store.saveDevice(steps.device, device === null ? null : device.rev);
          if (!done.ok) return refuse(done.err);
        }
        // Игрок вернулся из файла (063-Р64): его конверт в корзине — в копии и из корзины, иначе он и в списке, и в корзине.
        // Копия не легла — корзина остаётся (ничего не теряется, только дубль до очистки), игрок — в `binLeft`: страница скажет (`ParentFile`, `ru.parent.file.binLeft`).
        const binLeft: string[] = [];
        for (const { pid } of plan.add) if (store.peekTrash(pid).ok && !store.trashToCopy(pid).ok) binLeft.push(pid);
        return { ok: true, added: steps.added, replaced: steps.replaced, kept: steps.kept, written, binLeft };
      } finally {
        for (const hold of holds) hold.release();
      }
    },
  };
}
