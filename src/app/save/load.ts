/**
 * Чтение ключа игрока в режиме конверта (спека 014-Т3, design §2): классификация, карантин, миграции, починка.
 * Состояние (память, `blocked`, `status`) приходит из фабрики через `Deps`.
 */
import {
  classify,
  emptyEnvelope,
  lostPaths,
  migrate,
  nextEnvelope,
  type SaveEnvelope,
} from '../../engine/save/format';
import { migrateName, planCopies, quarantineName, repairName } from '../../engine/save/copies';
import type { Deps, Read, ReadOk } from './types';

export function createLoader(d: Deps) {
  const { opts, io, status, blocked, names, writeFree, log, copyThenMain, emptySave, parseAll } = d;
  const prefix = opts.prefix;
  const registry = opts.sections;

  /** Чистый конверт с заданным `rev`. */
  function cleanText(rev: number): string {
    return JSON.stringify({ ...emptyEnvelope(opts.app, registry, opts.ctx), sections: emptySave(), rev });
  }

  /**
   * Прочитать ключ игрока. `newer` у любого игрока (`readOnly`) — только память: ни копий, ни карантина, ни снимков.
   * Копия не легла (`held`) — основной ключ не тронут, ход живёт в памяти, пока место не появится.
   */
  function readEnvelope(id: string, firstLoad: boolean): Read {
    const first = firstLoad && !status.readOnly;
    const key = d.mainKey(id);
    const r = io.read(key);
    if (!r.ok) {
      blocked.add(key);
      return { kind: 'blocked' };
    }
    blocked.delete(key);
    const c = classify(r.text);
    const empty = (rev: number): ReadOk => ({ kind: 'ok', save: emptySave(), rev, sections: {}, fresh: rev === 0, wrote: false });
    switch (c.kind) {
      case 'fresh': {
        if (first && names().some((n) => n.startsWith(`snap.${id}.`))) status.found[id] = 'fresh-with-snaps';
        return empty(0);
      }
      case 'newer':
        status.readOnly = true;
        log(`newer f${c.format} d${c.draft}`);
        return { kind: 'newer' };
      case 'broken':
      case 'stale-draft': {
        status.found[id] = 'broken';
        if (status.readOnly) return empty(0);
        if (copyThenMain(quarantineName(id, opts.now()), r.text ?? '', key, cleanText(1))) {
          log(`quarantine ${id}`);
          return { ...empty(1), wrote: true };
        }
        return { kind: 'held', save: emptySave() };
      }
      case 'migrate': {
        const done = migrate(c.envelope);
        if (!done.ok) {
          status.migrateFailed = true;
          log(`migrate-failed ${done.at}`);
          return { kind: 'blocked' };
        }
        const sections = parseAll(done.envelope.sections);
        if (status.readOnly) return fromEnvelope(id, done.envelope, r.text, false);
        const text = JSON.stringify(nextEnvelope(c.envelope, sections, opts.app));
        if (!copyThenMain(migrateName(id, c.from), r.text ?? '', key, text)) return { kind: 'held', save: sections };
        return { ...fromEnvelope(id, { ...done.envelope, rev: c.envelope.rev + 1 }, text, first), wrote: true };
      }
      case 'ok':
        return fromEnvelope(id, c.envelope, r.text, first);
    }
  }

  /** Разобрать разделы; при первой загрузке — починка (pre.*.repair) и снимок дня. */
  function fromEnvelope(id: string, env: SaveEnvelope, rawText: string | null, first: boolean): ReadOk {
    const save = parseAll(env.sections);
    if (first && rawText !== null) {
      const today = opts.today();
      const lost = registry.flatMap((def) =>
        env.sections[def.name] === undefined ? [] : lostPaths(env.sections[def.name], save[def.name], def.name),
      );
      const list = names();
      if (lost.length > 0 && !list.includes(repairName(id, today))) {
        writeFree(prefix + repairName(id, today), rawText);
        log(`repair ${id} ${lost.length}`);
      }
      const plan = planCopies(names(), id, today);
      for (const n of plan.write) writeFree(prefix + n, rawText);
      for (const n of plan.remove) io.remove(prefix + n);
    }
    return { kind: 'ok', save, rev: env.rev, sections: env.sections, fresh: false, wrote: false };
  }

  return { readEnvelope, fromEnvelope, cleanText };
}
