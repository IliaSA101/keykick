/**
 * Сохранение прогресса: формат, разбор и переходы. Без localStorage — он в src/app/progress.ts.
 *
 * Разбор никогда не падает: ребёнок не должен потерять игру из-за одного битого поля,
 * поэтому чиним по полям — плохое поле становится пустым, остальные живут.
 * Чужая версия (или не объект) — чистое состояние: миграции появятся вместе со второй версией.
 */
import { CLUB_KIT_ID, CLUB_NAME_MAX, checkShirtName, checkShirtNumber, clubKit, type Club } from './club';
import { parseCups, type Cups } from './cup';
import { isPuzzleKey, isPuzzleTime } from './keyboardPuzzle';
import { resolveLessonIndex } from './lessonOrder';
import { parseKitColors, type Kit, type KitColors, type KitRarity } from './kit';
import { MISS_COINS, penaltyCoins, scoredTasks, type MidKick } from './midPenalty';
import { DUP_COINS, MINIGAME_COINS, PACK_PRICE, PENALTY_COINS, STAR_COINS } from './rewards';
import { parseSession } from './session';
import { accuracy, charsPerMinute, type TypingStats } from './typing';

export const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  club: Club | null;
  /** Полученные формы коллекции; домашняя форма клуба сюда не входит — она своя всегда. */
  ownedKits: string[];
  /**
   * Форма на матч — id из полученных; null — своя домашняя. Поля нет в старых сохранениях,
   * id не из полученных или битый — тоже null: команда выходит в домашней.
   */
  wornKit: string | null;
  /**
   * Бутсы (engine/boots, спека 004): только купленные в лавке; обычные и кубковые выводятся.
   * Надетые — id или null (обычные); во владении ли — решает wornBootsOf. Полей нет — [] и null.
   */
  boughtBoots: string[];
  wornBoots: string | null;
  /** Номер текущего урока в списке уроков; при разборе выводится из lessonId (engine/lessonOrder). */
  lessonIndex: number;
  /**
   * id текущего урока (спека 007): вставка урока не сдвигает игрока. Пишется вместе с номером;
   * поля нет в сохранениях до 007 и в чистом — номер читается по старому порядку. Версия та же.
   */
  lessonId?: string;
  /** Ошибки по клавишам за прошлые таймы — для подстройки генератора. */
  keyErrors: Record<string, number>;
  matches: number;
  goals: number;
  /** Сыгранные, но ещё не открытые паки. */
  pendingPacks: number;
  /**
   * Серия пенальти после матча; null — серии нет. Старое поле penaltyReady (одно пенальти
   * на тайм, было до 04.11) читается как серия из одного удара.
   */
  penalty: PenaltySeries | null;
  solvedTasks: string[];
  /** Монеты за повторы из паков; тратятся на пак. Поля нет в старых сохранениях — 0. */
  coins: number;
  /**
   * Справка «Как держать руки» уже показана: сама она открывается только перед первым матчем
   * игрока, дальше — кнопкой. Поля нет в старых сохранениях — false (покажется один раз).
   */
  handsHelpSeen: boolean;
  /**
   * Активное время игрока по местным датам «ГГГГ-ММ-ДД», мс (engine/session). Перерыв и его
   * настройки — общие на компьютер, не здесь (parseShared). Сохранение до 04.11 держало время
   * в session.days — читается оттуда.
   */
  days: Record<string, number>;
  /** Кубки лиг (engine/cup): раунд и трофей. Поля нет в сохранениях до кубка — пусто. */
  cups: Cups;
  /**
   * Рекорды «Собери клавиатуру»: ключ задания (engine/keyboardPuzzle, puzzleKey) → лучшее время, мс.
   * Поля нет в старых сохранениях — пусто.
   */
  puzzleBest: Record<string, number>;
  /**
   * Личные рекорды уроков (спека 003): id урока → лучший матч с зачётом. Поля нет в старых
   * сохранениях — пусто; версия та же (как coins, cups).
   */
  lessonBest: Record<string, LessonBest>;
}

/** Лучший матч урока: скорость за оба тайма, знаков в минуту, и точность 0…1 (matchStats). */
export interface LessonBest {
  cpm: number;
  acc: number;
}

/** Быстрее не бывает: такая скорость — мусор, а не игра. */
export const LESSON_CPM_MAX = 2000;

/**
 * Серия пенальти. Задачи выбираются один раз и хранятся, итог удара пишется сразу:
 * перезагрузка посреди серии показывает ту же непробитую задачу и не даёт перебить пробитую.
 */
export interface PenaltySeries {
  /** Ударов в серии. */
  kicks: number;
  /** Задачи серии по порядку; пусто или меньше kicks — ещё не выбраны (fillPenalty). */
  tasks: string[];
  /** Итоги пробитых ударов по порядку: true — гол. Удар номер results.length — следующий. */
  results: boolean[];
}

/** Ударов в серии после матча. */
export const PENALTY_KICKS = 3;
/**
 * Потолок серии: недобитые удары прошлого матча переходят в новую серию (не пропадают),
 * но копятся не бесконечно — ребёнок, который всегда уходит с итога, не набьёт сотню.
 */
export const PENALTY_MAX = 6;

/** Что известно об игре на момент разбора: формы, уроки и задачи могли измениться с прошлой версии сайта. */
export interface SaveContext {
  kitIds?: readonly string[];
  /** id бутс лавки (shopIds): чужие в boughtBoots выбрасываются. */
  bootIds?: readonly string[];
  /** id уроков по порядку: номер урока выводится из lessonId, режется до последнего. */
  lessonIds?: readonly string[];
  taskIds?: readonly string[];
}

/**
 * Потолок ошибок на клавишу. Вместе с затуханием (KEY_ERROR_KEEP) держит подстройку
 * на свежих ошибках: старая ошибка без новых уходит за несколько таймов.
 */
export const KEY_ERROR_CAP = 20;
/** Доля старых ошибок, которая переходит в следующий тайм (остальное «забывается»). */
export const KEY_ERROR_KEEP = 0.75;
/** Длиннее имя клавиши или задачи не бывает: такие строки — мусор. */
const ID_MAX = 64;
/** Счётчики выше этого — мусор, а не игра (миллион матчей никто не сыграет). */
const COUNT_MAX = 1_000_000;
/** Монет больше не бывает: потолок от мусора, ребёнку столько не накопить. */
export const COINS_MAX = 100_000;

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    club: null,
    ownedKits: [],
    wornKit: null,
    boughtBoots: [],
    wornBoots: null,
    lessonIndex: 0,
    keyErrors: {},
    matches: 0,
    goals: 0,
    pendingPacks: 0,
    penalty: null,
    solvedTasks: [],
    coins: 0,
    handsHelpSeen: false,
    days: {},
    cups: {},
    puzzleBest: {},
    lessonBest: {},
  };
}

function count(v: unknown, max = COUNT_MAX): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 0;
  return Math.min(Math.floor(v), max);
}

function ids(v: unknown, known?: readonly string[]): string[] {
  if (!Array.isArray(v)) return [];
  const ok = v.filter(
    (x): x is string => typeof x === 'string' && x !== '' && x.length <= ID_MAX && (!known || known.includes(x)),
  );
  return [...new Set(ok)];
}

function keyErrors(v: unknown): Record<string, number> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(v as Record<string, unknown>)) {
    const c = count(n, KEY_ERROR_CAP);
    if (key !== '' && key.length <= ID_MAX && c > 0) out[key] = c;
  }
  return out;
}

/**
 * Клуб: без имени или с битой формой — нет клуба. Имя и номер на спине необязательны:
 * битые отбрасываются, клуб остаётся. Поле id (настоящий клуб, было 04.11) больше не читается —
 * такой клуб остаётся своим названием с теми же цветами.
 */
function club(v: unknown): Club | null {
  if (v === null || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.name !== 'string' || r.name.trim() === '' || r.name.length > CLUB_NAME_MAX) return null;
  let kit: KitColors;
  try {
    kit = parseKitColors(r.kit, 'save.club.kit');
  } catch {
    return null;
  }
  const out: Club = { name: r.name, kit };
  if (typeof r.shirtName === 'string') {
    const check = checkShirtName(r.shirtName);
    if (check.ok && check.name !== '') out.shirtName = check.name;
  }
  if (typeof r.shirtNumber === 'number') {
    const check = checkShirtNumber(String(r.shirtNumber));
    if (check.ok && check.number !== null) out.shirtNumber = check.number;
  }
  return out;
}

/**
 * Серия пенальти. Нет поля серии — смотрим старое penaltyReady: true — серия из одного удара
 * (заработанное пенальти не пропадает). Непробитые задачи, которых больше нет в игре, отбрасываются
 * с первой такой — экран выберет новые; пробитые остаются как есть (по ним только счёт серии).
 */
function penaltySeries(v: unknown, oldReady: unknown, known?: readonly string[]): PenaltySeries | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return oldReady === true ? { kicks: 1, tasks: [], results: [] } : null;
  }
  const r = v as Record<string, unknown>;
  const kicks = count(r.kicks, PENALTY_MAX);
  if (kicks === 0) return null;
  const tasks = ids(r.tasks).slice(0, kicks);
  const results = (Array.isArray(r.results) ? r.results : [])
    .filter((x): x is boolean => typeof x === 'boolean')
    .slice(0, tasks.length);
  const rest = tasks.slice(results.length);
  const gone = known ? rest.findIndex((id) => !known.includes(id)) : -1;
  return {
    kicks,
    tasks: [...tasks.slice(0, results.length), ...(gone < 0 ? rest : rest.slice(0, gone))],
    results,
  };
}

/** Время по дням: своё поле или старое session.days; разбор — как у сеанса. */
function playDays(r: Record<string, unknown>): Record<string, number> {
  if (r.days !== undefined) return parseSession({ days: r.days }).days;
  const old = r.session;
  return old !== null && typeof old === 'object' ? parseSession(old).days : {};
}

/** Рекорды мини-игры: чужие ключи и мусорное время (не число, ноль и меньше, дольше 10 минут) — прочь. */
function puzzleBest(v: unknown): Record<string, number> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [key, ms] of Object.entries(v as Record<string, unknown>)) {
    if (isPuzzleKey(key) && isPuzzleTime(ms)) out[key] = Math.max(1, Math.round(ms));
  }
  return out;
}

/** Рекорд урока годен: скорость — целое 1…LESSON_CPM_MAX, точность — 0…1. */
function isLessonBest(v: unknown): v is LessonBest {
  if (v === null || typeof v !== 'object') return false;
  const { cpm, acc } = v as Record<string, unknown>;
  return (
    typeof cpm === 'number' &&
    Number.isInteger(cpm) &&
    cpm >= 1 &&
    cpm <= LESSON_CPM_MAX &&
    typeof acc === 'number' &&
    acc >= 0 &&
    acc <= 1
  );
}

/** Рекорды уроков: битые ключи и записи отбрасываются, остальные живут. */
function lessonBest(v: unknown): Record<string, LessonBest> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, LessonBest> = {};
  for (const [id, rec] of Object.entries(v as Record<string, unknown>)) {
    if (id !== '' && id.length <= ID_MAX && isLessonBest(rec)) out[id] = { cpm: rec.cpm, acc: rec.acc };
  }
  return out;
}

/**
 * Урок игрока: со списком уроков — номер из id (resolveLessonIndex) и id по этому номеру, так что
 * первая же запись после чтения несёт id. Без списка — номер как есть, годный id — как есть.
 */
function lessonPlace(r: Record<string, unknown>, lessonIds?: readonly string[]): Pick<SaveData, 'lessonIndex' | 'lessonId'> {
  const index = count(r.lessonIndex);
  if (!lessonIds) {
    const id = ids([r.lessonId])[0];
    return id === undefined ? { lessonIndex: index } : { lessonIndex: index, lessonId: id };
  }
  return withLessonId(resolveLessonIndex({ lessonId: r.lessonId, lessonIndex: index }, lessonIds), lessonIds);
}

/** Номер урока и id по нему; списка уроков нет — только номер. */
function withLessonId(index: number, lessonIds: readonly string[]): Pick<SaveData, 'lessonIndex' | 'lessonId'> {
  const id = lessonIds[Math.min(index, lessonIds.length - 1)];
  return id === undefined ? { lessonIndex: index } : { lessonIndex: index, lessonId: id };
}

export function parseSave(raw: unknown, ctx: SaveContext = {}): SaveData {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptySave();
  const r = raw as Record<string, unknown>;
  if (r.version !== SAVE_VERSION) return emptySave();
  const ownedKits = ids(r.ownedKits, ctx.kitIds);
  return {
    version: SAVE_VERSION,
    club: club(r.club),
    ownedKits,
    wornKit: typeof r.wornKit === 'string' && ownedKits.includes(r.wornKit) ? r.wornKit : null,
    boughtBoots: ids(r.boughtBoots, ctx.bootIds),
    // Непустая строка до ID_MAX, иначе null; владение — в wornBootsOf (трофеи, контент).
    wornBoots: ids([r.wornBoots])[0] ?? null,
    ...lessonPlace(r, ctx.lessonIds),
    keyErrors: keyErrors(r.keyErrors),
    matches: count(r.matches),
    goals: count(r.goals),
    pendingPacks: count(r.pendingPacks),
    penalty: penaltySeries(r.penalty, r.penaltyReady, ctx.taskIds),
    solvedTasks: ids(r.solvedTasks),
    coins: count(r.coins, COINS_MAX),
    handsHelpSeen: r.handsHelpSeen === true,
    days: playDays(r),
    cups: parseCups(r.cups),
    puzzleBest: puzzleBest(r.puzzleBest),
    lessonBest: lessonBest(r.lessonBest),
  };
}

/**
 * Родитель ставит урок для проверки (страница #/parent): игрок сразу на уроке index. Кубки
 * пройденных лиг открываются сами (engine/cup смотрит на номер урока); голы, формы, монеты — как были.
 * Пишется и id урока (спека 007).
 */
export function applySetLesson(save: SaveData, index: number, lessonIds: readonly string[]): SaveData {
  const last = Math.max(0, lessonIds.length - 1);
  const at = Number.isInteger(index) ? Math.min(Math.max(index, 0), last) : save.lessonIndex;
  return { ...save, ...withLessonId(at, lessonIds) };
}

/** Справка «Как держать руки» показана: сама больше не откроется. */
export function applyHandsHelpSeen(save: SaveData): SaveData {
  return save.handsHelpSeen ? save : { ...save, handsHelpSeen: true };
}

/** Итог тайма — то, что экран матча отдаёт в прогресс. */
export interface HalfResult {
  lessonId: string;
  stars: 0 | 1 | 2 | 3;
  /** Все голы тайма — с атак и с пенальти посреди тайма (MatchScore.goals). */
  goals: number;
  stats: TypingStats;
  /** Пенальти посреди тайма (спека 005): монеты и решённые задачи пишутся вместе с таймом. */
  penalties?: readonly MidKick[];
}

/** Старые ошибки затухают, новые прибавляются, потолок на клавишу. Нули выкидываем. */
export function mergeKeyErrors(
  old: Readonly<Record<string, number>>,
  fresh: Readonly<Partial<Record<string, number>>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of new Set([...Object.keys(old), ...Object.keys(fresh)])) {
    const kept = Math.floor((old[key] ?? 0) * KEY_ERROR_KEEP);
    const n = Math.min(KEY_ERROR_CAP, kept + count(fresh[key]));
    if (n > 0) out[key] = n;
  }
  return out;
}

/**
 * Любой доигранный тайм: счётчик таймов (поле matches), голы, ошибки клавиш для подстройки,
 * монеты и решённые задачи с пенальти посреди тайма (повтор задачи — один раз, 005-Р5).
 * Пак — один за матч, в конце второго тайма (applyHalf): за урок — одна форма (решение 04.11).
 */
function countHalf(save: SaveData, half: Pick<HalfResult, 'goals' | 'stats' | 'penalties'>): SaveData {
  const kicks = half.penalties ?? [];
  const solved = scoredTasks(kicks).filter((id) => id.length <= ID_MAX && !save.solvedTasks.includes(id));
  return {
    ...save,
    keyErrors: mergeKeyErrors(save.keyErrors, half.stats.keyErrors),
    matches: save.matches + 1,
    goals: save.goals + count(half.goals),
    coins: Math.min(COINS_MAX, save.coins + penaltyCoins(kicks)),
    solvedTasks: solved.length > 0 ? [...save.solvedTasks, ...solved] : save.solvedTasks,
  };
}

/**
 * Первый тайм матча: голы и ошибки клавиш — сразу, до перерыва: второй тайм подстраивается
 * под ошибки первого, а перезагрузка посреди второго не отнимает голы. Звёзд и пака у первого
 * тайма нет — решающая атака и награда во втором; монеты — только за пенальти посреди тайма.
 */
export function applyFirstHalf(save: SaveData, half: Pick<HalfResult, 'goals' | 'stats' | 'penalties'>): SaveData {
  return countHalf(save, half);
}

/**
 * Решающий (второй) тайм — конец матча: пак, монеты за звёзды матча, серия пенальти
 * из PENALTY_KICKS ударов (задачи выберет экран пенальти). Две звезды на текущем уроке —
 * следующий урок; последний урок повторяется. advance: false — матч кубка: урок не сдвигается,
 * даже если кубок играется на текущем уроке (engine/cup).
 */
export function applyHalf(save: SaveData, half: HalfResult, lessonIds: readonly string[], advance = true): SaveData {
  const last = Math.max(0, lessonIds.length - 1);
  const current = Math.min(save.lessonIndex, last);
  const passed = advance && half.stars >= 2 && lessonIds[current] === half.lessonId;
  const counted = countHalf(save, half);
  return {
    ...counted,
    pendingPacks: save.pendingPacks + 1,
    coins: Math.min(COINS_MAX, counted.coins + STAR_COINS * half.stars),
    penalty: nextSeries(save.penalty),
    ...withLessonId(passed ? Math.min(current + 1, last) : current, lessonIds),
  };
}

/**
 * Серия после матча: недобитые удары прошлой серии (ушёл с итога «На главную») переходят в новую
 * вместе со своими задачами — удары и монеты не пропадают. Потолок — PENALTY_MAX.
 */
function nextSeries(old: PenaltySeries | null): PenaltySeries {
  const left = kicksLeft(old);
  const tasks = old ? old.tasks.slice(old.results.length, old.results.length + left) : [];
  return { kicks: Math.min(PENALTY_MAX, left + PENALTY_KICKS), tasks: tasks.slice(0, PENALTY_MAX), results: [] };
}

/** Задача следующего удара серии; null — серии нет, она пробита или задача ещё не выбрана. */
export function nextKick(series: PenaltySeries | null): string | null {
  if (!series || series.results.length >= series.kicks) return null;
  return series.tasks[series.results.length] ?? null;
}

/** Серия есть и пробита не вся. */
export function kicksLeft(series: PenaltySeries | null): number {
  return series ? Math.max(0, series.kicks - series.results.length) : 0;
}

/** Задач не хватает до числа ударов — экрану пенальти нужно выбрать столько новых. */
export function kicksToFill(series: PenaltySeries | null): number {
  return series ? Math.max(0, series.kicks - series.tasks.length) : 0;
}

/**
 * Выбранные задачи — в серию (повторы и лишние отбрасываются). Задач в игре меньше, чем ударов, —
 * серия укорачивается до них; совсем нет — серии нет.
 */
export function fillPenalty(save: SaveData, taskIds: readonly string[]): SaveData {
  const s = save.penalty;
  if (!s || kicksToFill(s) === 0) return save;
  const fresh = [...new Set(taskIds)].filter((id) => !s.tasks.includes(id));
  const tasks = [...s.tasks, ...fresh].slice(0, s.kicks);
  if (tasks.length === 0) return { ...save, penalty: null };
  return { ...save, penalty: { kicks: Math.min(s.kicks, tasks.length), tasks, results: [...s.results] } };
}

/** Доделанная мини-игра перерыва — монеты (MINIGAME_COINS). */
export function applyMinigame(save: SaveData): SaveData {
  return { ...save, coins: Math.min(COINS_MAX, save.coins + MINIGAME_COINS) };
}

/**
 * Время «Собери клавиатуру» по заданию key: хранится меньшее. Мусорное время или ключ —
 * сохранение не меняется (тот же объект). Пишет экран вместе с монетами и только при paid.
 */
export function applyPuzzleRecord(save: SaveData, key: string, ms: number): SaveData {
  if (!isPuzzleKey(key) || !isPuzzleTime(ms)) return save;
  const time = Math.max(1, Math.round(ms));
  const old = save.puzzleBest[key];
  if (old !== undefined && old <= time) return save;
  return { ...save, puzzleBest: { ...save.puzzleBest, [key]: time } };
}

/** Матч для рекорда урока: скорость и точность за оба тайма. */
export function lessonBestOf(stats: TypingStats): LessonBest {
  return { cpm: charsPerMinute(stats), acc: accuracy(stats) };
}

/** Лучше ли матч прежнего рекорда: быстрее, а при равной скорости — точнее (003-Р3). */
export function beatsBest(now: LessonBest, old: LessonBest | undefined): boolean {
  if (!old) return true;
  return now.cpm > old.cpm || (now.cpm === old.cpm && now.acc > old.acc);
}

/**
 * Рекорд урока после матча: только с зачётом (две звезды и больше — иначе рекорд звал бы
 * гнать с ошибками, 003-Р3) и только лучший. Не пишется — тот же объект.
 */
export function applyLessonBest(save: SaveData, lessonId: string, stars: number, now: LessonBest): SaveData {
  if (stars < 2 || lessonId === '' || lessonId.length > ID_MAX || !isLessonBest(now)) return save;
  if (!beatsBest(now, save.lessonBest[lessonId])) return save;
  return { ...save, lessonBest: { ...save.lessonBest, [lessonId]: { cpm: now.cpm, acc: now.acc } } };
}

/**
 * Что сказать о рекорде в итоге матча: first — рекорда не было (без праздника, 003-Р6),
 * fresh — побит (gain — прибавка скорости, при равной скорости 0), kept — не побит.
 * Без зачёта или без скорости — ничего.
 */
export type BestNote =
  | { kind: 'first'; cpm: number }
  | { kind: 'fresh'; cpm: number; gain: number }
  | { kind: 'kept'; cpm: number };

export function bestNote(old: LessonBest | undefined, now: LessonBest, stars: number): BestNote | null {
  if (stars < 2 || !isLessonBest(now)) return null;
  if (!old) return { kind: 'first', cpm: now.cpm };
  if (beatsBest(now, old)) return { kind: 'fresh', cpm: now.cpm, gain: now.cpm - old.cpm };
  return { kind: 'kept', cpm: old.cpm };
}

/**
 * Удар серии: одна попытка на задачу — итог пишется в любом случае (иначе после «Неверно»
 * и показанного решения перезагрузка давала бы ту же задачу). Верно — гол, монеты и решённая задача;
 * мимо — MISS_COINS (005-Р9, как посреди матча). Не та задача (повторный ответ, двойной Enter, серии нет) — сохранение не меняется.
 */
export function applyPenalty(save: SaveData, taskId: string, correct: boolean): SaveData {
  const s = save.penalty;
  if (!s || nextKick(s) !== taskId) return save;
  const penalty = { ...s, tasks: [...s.tasks], results: [...s.results, correct] };
  if (!correct) return { ...save, penalty, coins: Math.min(COINS_MAX, save.coins + MISS_COINS) };
  return {
    ...save,
    penalty,
    goals: save.goals + 1,
    coins: Math.min(COINS_MAX, save.coins + PENALTY_COINS),
    solvedTasks: save.solvedTasks.includes(taskId) ? save.solvedTasks : [...save.solvedTasks, taskId],
  };
}

/**
 * Открыт пак: минус пак, новая форма — в коллекцию; повтор коллекцию не меняет,
 * зато даёт монеты по редкости формы (DUP_COINS).
 */
export function applyPack(save: SaveData, kitId: string, rarity: KitRarity = 'common'): SaveData {
  const dup = save.ownedKits.includes(kitId);
  return {
    ...save,
    pendingPacks: Math.max(0, save.pendingPacks - 1),
    ownedKits: dup ? save.ownedKits : [...save.ownedKits, kitId],
    coins: dup ? Math.min(COINS_MAX, save.coins + DUP_COINS[rarity]) : save.coins,
  };
}

/**
 * Пак за монеты: можно, если монет хватает и в коллекции ещё есть что получить —
 * из полной коллекции пак даёт одни монеты, меньше цены.
 */
export function canBuyPack(save: SaveData, kitCount: number): boolean {
  return save.coins >= PACK_PRICE && save.ownedKits.length < kitCount;
}

/**
 * «Надеть» в шкафчике: null или id домашней — своя домашняя; полученная форма — она.
 * Неполученную надеть нельзя — сохранение не меняется.
 */
export function wearKit(save: SaveData, kitId: string | null): SaveData {
  const id = kitId === CLUB_KIT_ID ? null : kitId;
  if (id !== null && !save.ownedKits.includes(id)) return save;
  return id === save.wornKit ? save : { ...save, wornKit: id };
}

/**
 * Форма, в которой команда выходит на матч: надетая из коллекции, иначе домашняя клуба;
 * без клуба — null. Надетой нет среди форм игры (убрали с сайта) — тоже домашняя.
 */
export function matchKit(save: Pick<SaveData, 'club' | 'wornKit'>, kits: readonly Kit[]): Kit | null {
  const worn = save.wornKit === null ? undefined : kits.find((k) => k.id === save.wornKit);
  if (worn) return worn;
  return save.club ? clubKit(save.club) : null;
}

/** Купить пак: минус цена, плюс неоткрытый пак. Нельзя — сохранение не меняется. */
export function buyPack(save: SaveData, kitCount: number): SaveData {
  if (!canBuyPack(save, kitCount)) return save;
  return { ...save, coins: save.coins - PACK_PRICE, pendingPacks: save.pendingPacks + 1 };
}
