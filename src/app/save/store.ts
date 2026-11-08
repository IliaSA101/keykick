/**
 * Слой сохранения игроков поверх хранилища (спека 014-Т3, design §0, §2, §4, §5).
 * Хранилище и часы приходят снаружи — иначе не проверить две «вкладки» и квоту.
 * Два режима:
 *  - `v1` (префикс `keykick.` — чужие ключи линии v1 на том же origin) — только чтение: `readOnly` с первой секунды,
 *    ничего не читается из чужого формата и не пишется (018-Т6б, К10);
 *  - `envelope` — конверт с `rev`, снимки, карантин, `pre.*`, освобождение места, `newer` без записи (`load.ts`).
 * Все изменения идут через `update(id, fn)`: чужой `rev` или пропавший ключ — применить ход к лежащему (Б2).
 */
import {
  classify,
  emptyEnvelope,
  nextEnvelope,
  parseSections,
  type SaveEnvelope,
} from '../../engine/save/format';
import { copyThenWrite, deleteName, planSingle, resetName, withPlayerName } from '../../engine/save/copies';
import { createLoader } from './load';
import { createSpace } from './space';
import type { Deps, Known, Sections, StoreEvent, StoreOptions, StoreStatus } from './types';

/** Ключи линии v1 — префикс `keykick.`: конверта и новых ключей там нет (В9); v2 их только не трогает. */
export function isV1Prefix(prefix: string): boolean {
  return prefix === 'keykick.';
}

export function createSaveStore(opts: StoreOptions) {
  const { prefix, channel, storage: io, ctx, sections: registry } = opts;
  const v1 = isV1Prefix(prefix);
  const mainKey = (id: string): string => `${prefix}save.${id}`;
  const known = new Map<string, Known>();
  const blocked = new Set<string>();
  const events: StoreEvent[] = [];
  // Чужие ключи v1 на том же origin (`keykick.`) не читаем и не пишем: слой только для чтения.
  const status: StoreStatus = { readOnly: v1, storageFull: false, migrateFailed: false, found: {} };
  let hasPlayer: (id: string) => boolean = opts.hasPlayer ? (id) => opts.hasPlayer?.(id) ?? true : () => true;
  let follower: { id: string; cb: (s: Sections) => void } | null = null;

  /** Игроки, чей `create` в этом слое не записался (место): их ключа нет не потому, что его удалили. */
  const unwritten = new Set<string>();
  /** Причины, уже попавшие в журнал: повтор той же причины на каждом ходу журнал не раздувает. */
  const seen = new Set<string>();
  const log = (text: string): void => {
    if (seen.has(text)) return;
    seen.add(text);
    events.push({ t: opts.now(), kind: 'storage', text });
  };
  /** Запись удалась — место есть; следующая нехватка места снова попадёт в журнал. */
  const spaceOk = (): void => {
    status.storageFull = false;
    seen.clear();
  };
  const emptySave = (): Sections => Object.fromEntries(registry.map((d) => [d.name, d.empty(ctx)]));
  const parseAll = (raw: Sections): Sections => parseSections(raw, ctx, registry);
  const { names, readOf, writeFree, trimCeiling, copyIoFor } = createSpace({
    prefix,
    channel,
    io,
    today: () => opts.today(),
    now: () => opts.now(),
    onFull: () => {
      status.storageFull = true;
      log('storage-full');
    },
  });

  /** Копия раньше основного ключа (Б1); true — основной ключ записан. */
  function copyThenMain(copyName: string, copyText: string, key: string, mainText: string): boolean {
    const res = copyThenWrite(copyIoFor(prefix + copyName), prefix + copyName, copyText, key, mainText);
    trimCeiling();
    if (res === 'ok') {
      spaceOk();
      return true;
    }
    log(`copy-${res}`);
    return false;
  }

  const deps: Deps = { opts, io, mainKey, known, blocked, status, log, emptySave, parseAll, names, readOf, writeFree, copyThenMain };
  const { readEnvelope, cleanText } = createLoader(deps);

  // ───────────── публичный слой ─────────────

  /** Разбор без записи: карточки игроков и родитель. Битое, чужое, нет — чистое. */
  function peek(id: string): Sections {
    const r = io.read(mainKey(id));
    if (!r.ok) return emptySave();
    if (v1) return emptySave();
    const d = classify(r.text);
    if (d.kind === 'ok' || d.kind === 'migrate') return parseAll(d.envelope.sections);
    return emptySave();
  }

  /** Загрузить игрока в память (первая загрузка за день — снимок, битое — карантин). */
  function load(id: string): Sections {
    if (v1) {
      const empty = emptySave();
      known.set(id, { rev: 0, save: empty });
      return empty;
    }
    const st = readEnvelope(id, true);
    const mem = st.kind === 'ok' || st.kind === 'held' ? st.save : emptySave();
    known.set(id, { rev: st.kind === 'ok' ? st.rev : 0, save: mem });
    return mem;
  }

  /**
   * Применить ход. Результат — новое сохранение (в памяти и, если можно, в хранилище); null — игрок удалён
   * в другой вкладке (в списке нет; ключ при этом может лежать или пропасть): не писать. Нечитаемое и полное хранилище — ход только в памяти;
   * `newer` — ход не применяется вовсе (память прежняя, `fn` не вызывается).
   */
  function update(id: string, fn: (s: Sections) => Sections): Sections | null {
    // Игрока нет в списке — его удалили в другой вкладке: не пишем ничего (ни ход, ни снимок, ни карантин), даже если ключ
    // ещё лежит (удаление не доделано: копия «до» не легла) или уже пропал (014-Р18). Игрок, чей `create` не записался,
    // ключа и не имел: «нет в списке» для него не значит «удалён».
    if (!unwritten.has(id) && !hasPlayer(id)) return null;
    // `newer` у любого игрока — слой только читает: проверка раньше `load`, который иначе писал бы копии (E).
    const before = known.get(id);
    if (status.readOnly) return before?.save ?? load(id);
    const mem = before ?? { rev: 0, save: load(id) };
    if (status.readOnly) return mem.save;
    const st = readEnvelope(id, false);
    if (st.kind === 'newer') return mem.save;
    if (st.kind === 'blocked' || st.kind === 'held') {
      // Хранилище не читается или копия «до» не легла: ключ не пишем, ход живёт в памяти (A).
      const kept = fn(mem.save);
      known.set(id, { rev: mem.rev, save: kept });
      return kept;
    }
    // Память новее лежащего, если ключ не менялся (`rev` тот же) или этот вызов только что записал копию и ключ
    // (ходы, пока ключ держали). Иначе лежит чужая запись — её не затираем (метки «держим» нет: она устаревала).
    const base = st.rev === mem.rev || st.wrote ? mem.save : st.save;
    const next = fn(base);
    if (next === base) {
      known.set(id, { rev: st.rev, save: base });
      return base;
    }
    const env: SaveEnvelope = nextEnvelope({ rev: st.rev }, { ...st.sections, ...next }, opts.app);
    if (writeFree(mainKey(id), JSON.stringify(env))) {
      spaceOk();
      unwritten.delete(id);
      known.set(id, { rev: env.rev, save: next });
    } else {
      known.set(id, { rev: st.rev, save: next });
    }
    return next;
  }

  /** Новый игрок: чистое сохранение (до записи в список — ключ с тем же id от удалённого не воскреснет). */
  function create(id: string): Sections {
    const save = emptySave();
    if (status.readOnly) return save;
    const prev = readOf(mainKey(id));
    const d = classify(prev);
    const rev = d.kind === 'ok' || d.kind === 'migrate' ? d.envelope.rev + 1 : 1;
    const env = { ...emptyEnvelope(opts.app, registry, ctx), sections: save, rev };
    const ok = writeFree(mainKey(id), JSON.stringify(env));
    known.set(id, { rev: ok ? rev : 0, save });
    if (ok) unwritten.delete(id);
    else unwritten.add(id);
    return save;
  }

  /**
   * Сброс прогресса: копия `pre.<id>.reset.<ms>`, затем чистый конверт с `rev + 1` (а не удаление ключа — открытая
   * игра продолжит от чистого).
   * null — отказ: сохранение новее программы, хранилище не читается или копия «до» не легла; память и ключ прежние (B).
   */
  function reset(id: string): Sections | null {
    if (status.readOnly) return null;
    const save = emptySave();
    const r = io.read(mainKey(id));
    if (!r.ok) return null;
    const prevText = r.text;
    const d = classify(prevText);
    const rev = (d.kind === 'ok' || d.kind === 'migrate' ? d.envelope.rev : (known.get(id)?.rev ?? 0)) + 1;
    if (prevText !== null) {
      const name = resetName(id, opts.now());
      if (!copyThenMain(name, prevText, mainKey(id), cleanText(rev))) return null;
      for (const old of planSingle(names(), id, 'reset', name)) io.remove(prefix + old);
      known.set(id, { rev, save });
      return save;
    }
    // Ключа нет — терять нечего: чистое в память, в хранилище, если место есть.
    known.set(id, { rev: writeFree(mainKey(id), cleanText(rev)) ? rev : (known.get(id)?.rev ?? 0), save });
    return save;
  }

  /**
   * Загрузка файла (014-Т4): разделы игрока из файла вместо лежащих. Копия «до» (`copyName`, лежащий текст читается
   * здесь же) — раньше основного ключа и с перечиткой (Б1); освобождение места копии `import` моложе суток
   * не удаляет (Р11). `copyName` null — копия не нужна (моложе суток уже есть). `rev + 1` от лежащего.
   * `ok` — основной ключ записан, память обновлена; иначе основной ключ не изменился: `readonly` (v1, `newer`/
   * `readOnly`), `unreadable` (хранилище не читается), `no-space` (копия или ключ не легли).
   */
  function restore(id: string, imported: Sections, copyName: string | null): 'ok' | 'readonly' | 'unreadable' | 'no-space' {
    if (status.readOnly) return 'readonly';
    const r = io.read(mainKey(id));
    if (!r.ok) return 'unreadable';
    const d = classify(r.text);
    if (d.kind === 'newer') {
      status.readOnly = true;
      log(`newer ${id}`);
      return 'readonly';
    }
    const rev = (d.kind === 'ok' || d.kind === 'migrate' ? d.envelope.rev : (known.get(id)?.rev ?? 0)) + 1;
    const text = JSON.stringify(nextEnvelope({ rev: rev - 1 }, imported, opts.app));
    if (copyName !== null && r.text !== null) {
      if (!copyThenMain(copyName, r.text, mainKey(id), text)) return 'no-space';
      for (const old of planSingle(names(), id, 'import', copyName)) io.remove(prefix + old);
    } else if (!writeFree(mainKey(id), text)) {
      return 'no-space';
    } else {
      spaceOk();
    }
    unwritten.delete(id);
    known.set(id, { rev, save: parseAll(imported) });
    return 'ok';
  }

  /**
   * Удаление игрока: копия `pre.<id>.delete.<ms>` (с именем игрока, если оно передано — 014-Р18), затем ключ.
   * Копия не влезла — ключ остаётся.
   */
  function remove(id: string, playerName?: string): boolean {
    known.delete(id);
    unwritten.delete(id);
    if (status.readOnly) return false;
    const prevText = readOf(mainKey(id));
    if (prevText === null) return true;
    const name = deleteName(id, opts.now());
    const copyText = playerName === undefined ? prevText : withPlayerName(prevText, playerName);
    const res = copyThenWrite(copyIoFor(prefix + name), prefix + name, copyText, mainKey(id), prevText);
    trimCeiling();
    if (res !== 'ok') return false;
    for (const old of planSingle(names(), id, 'delete', name)) io.remove(prefix + old);
    return io.remove(mainKey(id));
  }

  /** Проверка заголовков сохранений до `planStart`: новее программы — только чтение, список и общая часть не пишутся (В6). */
  function scanNewer(ids: readonly string[]): boolean {
    for (const id of ids) {
      const text = readOf(mainKey(id));
      if (classify(text).kind === 'newer') {
        status.readOnly = true;
        log(`newer ${id}`);
      }
    }
    return status.readOnly;
  }

  /** Следить за ключом игрока: другая вкладка записала — перечитать в память и сообщить. null — не следить. */
  function follow(id: string | null, cb: (s: Sections) => void = () => undefined): void {
    follower = id === null ? null : { id, cb };
  }

  function refresh(id: string): void {
    const mem = known.get(id);
    if (!mem || status.readOnly) return;
    const r = io.read(mainKey(id));
    if (!r.ok || r.text === null) return;
    const d = classify(r.text);
    if (d.kind === 'newer') {
      status.readOnly = true;
      log(`newer ${id}`);
      return;
    }
    if (d.kind !== 'ok') return;
    if (d.envelope.rev === mem.rev) return;
    const save = parseAll(d.envelope.sections);
    known.set(id, { rev: d.envelope.rev, save });
    if (follower?.id === id) follower.cb(save);
  }

  io.onChange?.((key) => {
    if (follower === null) return;
    if (key === null || key === mainKey(follower.id)) refresh(follower.id);
  });

  return {
    mode: v1 ? ('v1' as const) : ('envelope' as const),
    peek,
    load,
    update,
    create,
    reset,
    restore,
    remove,
    scanNewer,
    follow,
    /** Сохранение игрока, как его помнит слой (после reset — чистое, даже если ключ не обновился). */
    memory: (id: string): Sections | undefined => known.get(id)?.save,
    setHasPlayer: (fn: (id: string) => boolean): void => void (hasPlayer = fn),
    status: (): Readonly<StoreStatus> => status,
    events: (): readonly StoreEvent[] => events,
    /** Все ключи под префиксом: имя без префикса → текст (для файла и проверок). */
    dumpStorage: (): Record<string, string> =>
      Object.fromEntries(io.keys(prefix).map((k) => [k.slice(prefix.length), readOf(k) ?? ''])),
    /** Сохранения в памяти: игрок → данные (файл при `storageFull`). */
    memorySaves: (): Record<string, { rev: number; save: Sections }> =>
      Object.fromEntries([...known.entries()].map(([id, k]) => [id, { rev: k.rev, save: k.save }])),
  };
}

export type SaveStore = ReturnType<typeof createSaveStore>;
