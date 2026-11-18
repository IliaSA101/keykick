/**
 * Что записать при загрузке файла клуба (063-Р11, 060 design §4): из плана импорта, состояния игроков на диске и выбора родителя — списки шагов.
 * Чистая функция: хранилища нет, пишет адаптер (`app/save/transfer.ts`) в порядке «копии → игроки → устройство»:
 * проигравший уже лежит в копиях, когда победитель записывается; запись устройства — последней, чтобы в списке не было игрока без файла.
 */
import { withPlayer, type Device } from './device';
import { serializePlayer, type Envelope } from './envelope';
import type { ImportPlan } from './import';

/** Выбор родителя при совпадении `pid`: оставить игрока на компьютере или взять из файла. */
export type Pick = 'mine' | 'file';

/**
 * Что лежит на диске под `pid` игрока из файла (`store.loadPlayer`): открылся; файла нет; новее программы; нет доступа;
 * битый (`kept` — сырое лежит в карантине, поверх него писать можно).
 */
export type Disk = { kind: 'ok'; env: Envelope } | { kind: 'absent' | 'newer' | 'denied' } | { kind: 'broken'; kept: boolean };

export interface RestoreSteps {
  /** Конверты, которые уходят в копии игроков (`store.putCopy`): проигравшие и версии из файла, что писать нельзя. */
  copies: Envelope[];
  /**
   * Записи игроков (`store.savePlayer`): `expectRev` — `rev`, найденный на диске; `null` — файла нет или он битый (поверх — только после карантина).
   * Игрок, чей файл на диске уже равен файлу клуба, не пишется совсем (повтор после сбоя записи устройства).
   */
  puts: { env: Envelope; expectRev: number | null }[];
  /** Новая запись устройства (игроки из файла добавлены в список); `null` — устройство не меняется. */
  device: Device | null;
  /**
   * Игроки, которых в списке устройства не было и теперь есть / записанные из файла поверх прежнего (совпавшие и осиротевшие) / совпавшие,
   * чья версия из файла ушла только в копии. Считается по реальным изменениям: устаревший план (игроки уже в списке и равны файлу) даёт нули.
   */
  added: number;
  replaced: number;
  kept: number;
}

/**
 * `not-ok` — план не годен; `over-limit` — после загрузки было бы больше игроков (весь отказ, 063-Р11); `pick-missing` — по совпавшему игроку нет выбора;
 * `readonly` — игрок новее программы лежит на диске без записи в устройстве (сирота: нечитаемое не затираем); `denied` — диск не читается;
 * `quota` — битый игрок не лёг в карантин: без этого поверх него писать нельзя.
 */
export type Refusal = 'not-ok' | 'over-limit' | 'pick-missing' | 'readonly' | 'denied' | 'quota';

const sameFile = (a: Envelope, b: Envelope): boolean => {
  try {
    return serializePlayer(a) === serializePlayer(b);
  } catch {
    return false;
  }
};

/**
 * `here.device` — запись устройства (`null` — её нет или она битая: клуб восстанавливается на чистом списке, тогда `base` — пустое устройство);
 * `disk(pid)` — состояние файла игрока на диске для каждого `pid` плана (совпавшего и нового).
 * Правила по состоянию файла на диске:
 * - открылся: совпавший — по выбору (мой → версия из файла в копии; из файла → мой в копии, пишется файл с `rev = max + 1`, `expectRev` = мой);
 *   сирота (файл есть, в списке нет — сбой посреди прошлой загрузки или битый список) — как «из файла», выбора не требует, равный файлу не пишется;
 * - файла нет (`mine: null`) — пишется из файла; битый — пишется поверх после карантина (`kept`), выбор «оставить мой» — версия в копии;
 * - новее: совпавший — версия из файла в копии (перезаписать нечитаемое нельзя), сирота — отказ `readonly`; нет доступа — отказ `denied`.
 */
export function restoreSteps(
  plan: ImportPlan,
  here: { device: Device | null },
  disk: (pid: string) => Disk,
  picks: Readonly<Record<string, Pick>>,
  base: Device,
): RestoreSteps | { refused: Refusal } {
  if (plan.kind !== 'ok') return { refused: 'not-ok' };
  if (plan.overLimit) return { refused: 'over-limit' };
  if (plan.clash.some((c) => c.mine !== null && picks[c.pid] === undefined)) return { refused: 'pick-missing' };
  const copies: Envelope[] = [];
  const puts: RestoreSteps['puts'] = [];
  const count = { added: 0, replaced: 0, kept: 0 };

  /** Файл игрока вместо найденного на диске: `wrote` — запись поставлена (равный файлу не пишется); `refused` — причина отказа. */
  const overwrite = (theirs: Envelope, d: Disk): { wrote: boolean } | { refused: Refusal } => {
    if (d.kind === 'ok') {
      if (sameFile(d.env, theirs)) return { wrote: false };
      copies.push(d.env);
      puts.push({ env: { ...theirs, rev: Math.max(d.env.rev, theirs.rev) + 1 }, expectRev: d.env.rev });
      return { wrote: true };
    }
    if (d.kind === 'absent' || (d.kind === 'broken' && d.kept)) {
      puts.push({ env: theirs, expectRev: null });
      return { wrote: true };
    }
    return { refused: d.kind === 'broken' ? 'quota' : d.kind === 'denied' ? 'denied' : 'readonly' };
  };

  for (const c of plan.clash) {
    const d = disk(c.pid);
    if (d.kind === 'denied') return { refused: 'denied' };
    // Версия из файла только в копии: родитель оставил своё, либо моё нечитаемо новее — перезаписать его нельзя.
    if (picks[c.pid] === 'mine' || d.kind === 'newer') {
      copies.push(c.file);
      count.kept++;
      continue;
    }
    const done = overwrite(c.file, d);
    if ('refused' in done) return done;
    if (done.wrote) count[d.kind === 'absent' ? 'added' : 'replaced']++;
  }
  const start = here.device ?? base;
  for (const env of plan.add) {
    const done = overwrite(env, disk(env.pid));
    if ('refused' in done) return done;
    if (!start.players.some((p) => p.pid === env.pid)) count.added++;
    else if (done.wrote) count.replaced++;
  }
  // Устройство пишется, только если список изменился: устаревший план (другая вкладка уже дописала этих игроков) не даёт `invalid ['rev']`.
  let device = start;
  for (const env of plan.add) device = withPlayer(device, env.pid);
  return { copies, puts, device: device !== start || here.device === null ? device : null, ...count };
}
