/**
 * Открытие конверта игрока (060 design §3): разбор, миграция разделов, проверка. Чистая функция.
 * Сырое никогда не теряется: «новее» и «битое» возвращают строку как пришла, незнакомые разделы — без изменений.
 */
import { ENVELOPE_FMT, PLAYER_KIND, type Envelope, type Section } from './envelope';
import { isInt, migrateSection, type SectionDef } from './section';

export type Opened =
  | { kind: 'ok'; env: Envelope; changed: boolean }
  /** Формат или раздел новее программы: игрок только для чтения, `raw` цел. */
  | { kind: 'newer'; raw: string; section?: string }
  /**
   * Не разобрался или раздел не прошёл `check`: `raw` — в карантин, `why` — коды причин.
   * `sections` — имена битых разделов (только если дело в разделах): имена содержат «:», из строк `why` их не вычленить.
   */
  | { kind: 'broken'; raw: string; why: string[]; sections?: string[] };

function isObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x !== '';
}

/** Ошибки формы конверта (кроме `sections` и `fmt`, их разбирает `openPlayer`). */
function shapeProblems(o: Record<string, unknown>): string[] {
  const why: string[] = [];
  if (!isInt(o.rev) || o.rev < 0) why.push('rev');
  if (!isNonEmptyString(o.pid)) why.push('pid');
  for (const key of ['app', 'name', 'course', 'explain']) {
    if (typeof o[key] !== 'string') why.push(key);
  }
  if (!isObject(o.sections)) why.push('sections');
  return why;
}

/** Известный раздел: версия новее — `newer`; иначе миграция и проверка. Незнакомые разделы сюда не попадают. */
type SectionResult =
  | { kind: 'ok'; section: Section; changed: boolean }
  | { kind: 'newer' }
  | { kind: 'broken'; why: string[] };

function openSection(def: SectionDef<unknown>, stored: unknown): SectionResult {
  if (!isObject(stored) || !isInt(stored.v) || stored.v < 1 || !('data' in stored)) {
    return { kind: 'broken', why: [`section:${def.name}:shape`] };
  }
  if (stored.v > def.v) return { kind: 'newer' };
  const moved = migrateSection(def, stored.v, stored.data);
  if (!moved.ok) return { kind: 'broken', why: [`section:${def.name}:${moved.why}`] };
  let problems: string[];
  try {
    problems = def.check(moved.data);
  } catch {
    // Бросающая проверка — тот же карантин, не исключение наружу (сырое не теряется).
    return { kind: 'broken', why: [`section:${def.name}:check-failed`] };
  }
  if (problems.length > 0) {
    return { kind: 'broken', why: problems.map((p) => `section:${def.name}:${p}`) };
  }
  return { kind: 'ok', section: { v: def.v, data: moved.data }, changed: stored.v !== def.v };
}

/**
 * `raw` — строка из хранилища; `defs` — разделы этой сборки.
 * Раздел, которого нет в сохранении, добавляется пустым (`changed`); раздел, которого нет в `defs`, не трогается.
 * Порядок решения: не JSON или чужой `kind` — `broken`; `fmt` новее — `newer`; раздел новее — `newer`; иначе `broken` или `ok`.
 */
export function openPlayer(raw: string, defs: readonly SectionDef<unknown>[]): Opened {
  const names = new Set<string>();
  for (const def of defs) {
    if (names.has(def.name)) throw new Error(`openPlayer: duplicate section def ${def.name}`);
    if (!isInt(def.v) || def.v < 1) throw new Error(`openPlayer: bad version of section def ${def.name}`);
    names.add(def.name);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'broken', raw, why: ['json'] };
  }
  if (!isObject(parsed) || parsed.kind !== PLAYER_KIND) return { kind: 'broken', raw, why: ['kind'] };
  if (!isInt(parsed.fmt) || parsed.fmt < 1) return { kind: 'broken', raw, why: ['fmt'] };
  if (parsed.fmt > ENVELOPE_FMT) return { kind: 'newer', raw };

  const why = shapeProblems(parsed);
  if (why.length > 0 || !isObject(parsed.sections)) return { kind: 'broken', raw, why };

  const stored = parsed.sections;
  const sections: Record<string, Section> = { ...(stored as Record<string, Section>) };
  const problems: string[] = [];
  const brokenSections: string[] = [];
  let changed = false;
  for (const def of defs) {
    if (!Object.hasOwn(stored, def.name)) {
      sections[def.name] = { v: def.v, data: def.empty() };
      changed = true;
      continue;
    }
    const res = openSection(def, stored[def.name]);
    if (res.kind === 'newer') return { kind: 'newer', raw, section: def.name };
    if (res.kind === 'broken') {
      problems.push(...res.why);
      brokenSections.push(def.name);
    } else {
      sections[def.name] = res.section;
      changed ||= res.changed;
    }
  }
  if (problems.length > 0) return { kind: 'broken', raw, why: problems, sections: brokenSections };

  return { kind: 'ok', env: { ...(parsed as unknown as Envelope), sections }, changed };
}
