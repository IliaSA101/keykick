/**
 * План импорта снимка клуба (060 design §4, 059 С-21). Вход — недоверенный текст файла: любой мусор даёт `bad`
 * с причинами (английские коды), а не исключение. Функция ничего не пишет: решает родитель (Э1), пишет адаптер (Т6).
 * Всё или ничего: плохой или «новее» игрок делает плохим или «новее» весь снимок — частичного импорта нет.
 */
import type { Registry } from '../../content/schema/ids';
import { reconcile, type CourseProgress } from '../course/reconcile';
import { DEVICE_KIND, type Device } from './device';
import { PLAYER_KIND, validPid, type Envelope } from './envelope';
import { openPlayer } from './open';
import type { SectionDef } from './section';
import { SNAPSHOT_FMT, SNAPSHOT_KIND, summarize, type Summary } from './snapshot';

/** Игроков на устройстве не больше (059 П-8). */
export const MAX_PLAYERS = 4;
/** Потолок текста файла, символов: клуб из четверых по сотне килобайт — с запасом. */
export const MAX_IMPORT_CHARS = 2_000_000;
/** Игроков в снимке не больше — иначе это не клуб, и открывать каждого не нужно. */
export const MAX_SNAPSHOT_PLAYERS = 16;
const MAX_NAME = 64;
const MAX_SHORT = 32;
/** Глубже в дереве файла ничего честного нет (разделы — 6–8 уровней); глубже — не разбираем, а не роняем стек. */
const MAX_DEPTH = 100;

/** Реестр и порядок уроков курса — для `reconcile` курсового раздела `course:<id>`. */
export interface CourseContext {
  reg: Registry;
  order: readonly string[];
}

/** `mine: null` — pid записан в устройстве, но конверта открыть не удалось (на диске новее или битый): сводки нет, выбирает родитель. */
export interface Clash {
  pid: string;
  mine: Summary | null;
  theirs: Summary;
  /** Конверт игрока из файла (открыт и смигрирован): запись «взять из файла» и копия проигравшего берут его (`restoreSteps`). */
  file: Envelope;
}

export type ImportPlan =
  | { kind: 'bad'; why: string[] }
  | { kind: 'newer' }
  | {
      kind: 'ok';
      /** Игроки снимка, которых на устройстве нет: открыты, смигрированы и сверены с реестром. */
      add: Envelope[];
      /** Игроки с тем же `pid`, что уже есть на устройстве: выбирает родитель, проигравший уходит в копии. */
      clash: Clash[];
      /** После импорта игроков стало бы больше `MAX_PLAYERS`. */
      overLimit: boolean;
      /** Чем сделан файл: версия программы и ISO-время снимка, как записаны (проверены на строку) — для окна «Что изменится» (063-Р46). */
      file: { app: string; made: string };
    };

const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
const isStr = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;

/**
 * Обход дерева недоверенного JSON: `proto-key` — есть ключ `__proto__`; `depth` — глубина больше `MAX_DEPTH`.
 * Итеративно: глубина не должна ронять стек, а `JSON.stringify` игрока — падать RangeError.
 */
function scanTree(root: unknown): 'proto-key' | 'depth' | null {
  const stack: { node: unknown; depth: number }[] = [{ node: root, depth: 0 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    const isArr = Array.isArray(node);
    if (!isArr && !isObj(node)) continue;
    if (depth > MAX_DEPTH) return 'depth';
    // Не `push(...node)`: массив в миллион элементов превысил бы предел аргументов.
    if (isArr) for (const item of node) stack.push({ node: item, depth: depth + 1 });
    else {
      for (const key of Object.keys(node)) {
        if (key === '__proto__') return 'proto-key';
        stack.push({ node: node[key], depth: depth + 1 });
      }
    }
  }
  return null;
}

function isProgress(x: unknown): x is CourseProgress {
  return isObj(x) && typeof x.current === 'string' && isObj(x.lessons) && isObj(x.archive) && isObj(x.leaguesDone);
}

/**
 * Сверка курсового раздела с реестром. Делается, только если курс известен вызывающему (`courses`), раздел
 * `course:<id>` есть и его знают `defs` (значит, прошёл `check`). Не изменилось ничего — тот же конверт (байт в байт).
 */
function reconcileEnv(env: Envelope, known: ReadonlySet<string>, courses: Readonly<Record<string, CourseContext>>): Envelope | string {
  const name = `course:${env.course}`;
  if (!known.has(name) || !Object.hasOwn(courses, env.course) || !Object.hasOwn(env.sections, name)) return env;
  const section = env.sections[name]!;
  if (!isProgress(section.data)) return `section:${name}:progress-shape`;
  const ctx = courses[env.course]!;
  let done: ReturnType<typeof reconcile>;
  try {
    done = reconcile(section.data, ctx.reg, ctx.order);
  } catch {
    // Слабая `check` раздела пропустила форму, на которой сверка спотыкается (отметка `null` и т. п.): это битый файл, не сбой программы.
    return `section:${name}:reconcile-failed`;
  }
  const { progress, changes } = done;
  if (changes.length === 0) return env;
  return { ...env, sections: { ...env.sections, [name]: { v: section.v, data: progress } } };
}

/** Игроки недоверенного снимка → открытые конверты; `bad` и `newer` останавливают разбор. */
function openAll(items: readonly unknown[], defs: readonly SectionDef<unknown>[], courses: Readonly<Record<string, CourseContext>>): Envelope[] | ImportPlan {
  const known = new Set(defs.map((d) => d.name));
  const out: Envelope[] = [];
  const why: string[] = [];
  const pids = new Set<string>();
  let newer = false;
  items.forEach((item, i) => {
    const at = `player:${i}`;
    try {
      const res = openPlayer(JSON.stringify(item), defs);
      if (res.kind === 'newer') {
        newer = true;
        return;
      }
      if (res.kind === 'broken') {
        why.push(...res.why.map((w) => `${at}:${w}`));
        return;
      }
      const env = res.env;
      const before = why.length;
      if (!validPid(env.pid)) why.push(`${at}:pid-chars`);
      if (pids.has(env.pid)) why.push(`${at}:pid-duplicate`);
      pids.add(env.pid);
      if (!isStr(env.name, MAX_NAME)) why.push(`${at}:name-length`);
      for (const key of ['app', 'course', 'explain'] as const) if (!isStr(env[key], MAX_SHORT)) why.push(`${at}:${key}-length`);
      if (why.length > before) return;
      const sure = reconcileEnv(env, known, courses);
      if (typeof sure === 'string') why.push(`${at}:${sure}`);
      else out.push(sure);
    } catch {
      // Страховка К17 «не бросает на любом тексте»: что бы ни случилось с одним игроком, это его `bad`, а не исключение наружу.
      why.push(`${at}:unreadable`);
    }
  });
  if (why.length > 0) return { kind: 'bad', why };
  return newer ? { kind: 'newer' } : out;
}

/**
 * `text` — файл выгрузки; `here` — что уже на устройстве (запись устройства и открытые конверты игроков);
 * `defs` — разделы этой сборки; `courses` — реестр и порядок уроков по коду курса (нет курса — `reconcile` для него не делается; «без сверки» — явный `{}`).
 * Порядок решения: не текст, слишком большой, не JSON, чужой `kind`, дерево с `__proto__` или глубже `MAX_DEPTH` — `bad`; `snap` новее — `newer`;
 * дальше каждый игрок через `openPlayer` (миграции), курсовой раздел — через `reconcile`; `bad` игрока сильнее `newer`.
 */
export function planImport(
  text: string,
  here: { device: Pick<Device, 'players'>; players: readonly Envelope[] },
  defs: readonly SectionDef<unknown>[],
  courses: Readonly<Record<string, CourseContext>>,
): ImportPlan {
  if (typeof text !== 'string') return { kind: 'bad', why: ['text'] };
  if (text.length > MAX_IMPORT_CHARS) return { kind: 'bad', why: ['too-big'] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'bad', why: ['json'] };
  }
  if (!isObj(parsed) || parsed.kind !== SNAPSHOT_KIND) return { kind: 'bad', why: ['kind'] };
  if (typeof parsed.snap !== 'number' || !Number.isSafeInteger(parsed.snap) || parsed.snap < 1) return { kind: 'bad', why: ['snap'] };
  if (parsed.snap > SNAPSHOT_FMT) return { kind: 'newer' };

  const why: string[] = [];
  const tree = scanTree(parsed);
  if (tree !== null) why.push(tree);
  for (const key of ['app', 'made', 'from'] as const) if (!isStr(parsed[key], 256)) why.push(`meta:${key}`);
  if (!isObj(parsed.device) || parsed.device.kind !== DEVICE_KIND) why.push('device');
  if (!Array.isArray(parsed.players)) why.push('players');
  else if (parsed.players.length > MAX_SNAPSHOT_PLAYERS) why.push('players-count');
  if (why.length > 0 || !Array.isArray(parsed.players)) return { kind: 'bad', why };

  const opened = openAll(parsed.players, defs, courses);
  if (!Array.isArray(opened)) return opened;

  const mine = new Map(here.players.filter((p) => p.kind === PLAYER_KIND).map((p) => [p.pid, p]));
  const add: Envelope[] = [];
  // pid, записанные в устройстве, но без открытого конверта (на диске новее или битый): тот же pid в файле — тоже совпадение (design §4).
  const listed = new Set(here.device.players.map((p) => p.pid));
  const clash: Clash[] = [];
  for (const env of opened) {
    const own = mine.get(env.pid);
    if (own) clash.push({ pid: env.pid, mine: summarize(own), theirs: summarize(env), file: env });
    else if (listed.has(env.pid)) clash.push({ pid: env.pid, mine: null, theirs: summarize(env), file: env });
    else add.push(env);
  }
  // Занятые места: записанные в устройстве (даже без конверта), открытые на нём и новые из снимка; совпавшие считаются один раз.
  const taken = new Set<string>([...listed, ...mine.keys(), ...add.map((e) => e.pid)]);
  return { kind: 'ok', add, clash, overLimit: taken.size > MAX_PLAYERS, file: { app: String(parsed.app), made: String(parsed.made) } };
}
