/**
 * Прогресс игрока, который играет в этой вкладке: reactive-обёртка над движком сохранения
 * (src/engine/save.ts). Смена игрока подменяет прогресс без перезагрузки страницы (app/roster).
 * Рядом — общая на компьютер часть (shared): часы перерыва и его настройки.
 * Хранилище — через app/storage: недоступно — игра идёт дальше, просто без сохранения.
 *
 * Снаружи прогресс только читают; меняют — функциями ниже, каждая сразу сохраняет.
 */
import { reactive, ref } from 'vue';
import { buyBoots, shopIds, wearBoots, wornBootsOf, type Boots } from '../engine/boots';
import type { Club } from '../engine/club';
import type { Kit } from '../engine/kit';
import { applyCupMatch, openCupOnPass, restartCup, type CupStage, type League } from '../engine/cup';
import type { Lesson } from '../engine/lessons';
import { openPack } from '../engine/rewards';
import {
  applyFirstHalf,
  applyHalf,
  applyHandsHelpSeen,
  applyLessonBest,
  applyMinigame,
  applyPack,
  applyPenalty,
  applyPuzzleRecord,
  applySetLesson,
  buyPack,
  emptySave,
  fillPenalty,
  kicksToFill,
  matchKit,
  parseSave,
  wearKit,
  type HalfResult,
  type LessonBest,
  type SaveData,
} from '../engine/save';
import {
  applyBreakSettings,
  clockOf,
  finishBreakIfOver,
  parseShared,
  recordAction,
  startBreakIfDue,
  type BreakClock,
  type BreakSettings,
  type SessionData,
  type SharedSession,
} from '../engine/session';
import { pickSeries } from '../engine/tasks';
import { emptyStats, type TypingStats } from '../engine/typing';
import { boots } from './boots';
import { kits } from './kits';
import { lessons } from './lessons';
import { players, playingId } from './players';
import { SHARED_KEY, onKeyChange, readJson, saveKey, writeJson } from './storage';
import { tasks } from './tasks';
import { plan } from './unlocks';

/** id уроков по порядку: по ним сохранение хранит урок игрока (спека 007). */
const lessonIds = lessons.map((l) => l.id);

const context = {
  kitIds: kits.map((k) => k.id),
  bootIds: shopIds(boots),
  lessonIds,
  taskIds: tasks.map((t) => t.id),
};

/** Сохранение игрока из хранилища; нет или битое — чистое. Для карточек «Кто играет?» и родителя. */
export function peekSave(id: string): SaveData {
  const raw = readJson(saveKey(id));
  return parseSave(raw === undefined ? null : raw, context);
}

/**
 * Чей прогресс в памяти: выбранный в этой вкладке, а пока выбора нет (игроков двое и больше) —
 * последний выбранный. Экраны игры до выбора не открываются (страж роутера).
 */
const activeRef = ref<string | null>(playingId.value ?? players.current);

/** Чьё сохранение сейчас в progress; null — игроков нет. */
export function activeId(): string | null {
  return activeRef.value;
}

/** Ключ сохранения игрока в progress; null — игроков нет. */
export function currentSaveKey(): string | null {
  return activeRef.value === null ? null : saveKey(activeRef.value);
}

const state = reactive<SaveData>(activeRef.value === null ? emptySave() : peekSave(activeRef.value));

/** Только чтение: менять прогресс можно лишь функциями ниже. */
export const progress: Readonly<SaveData> = state;

const sharedState = reactive<SharedSession>(parseShared(readJson(SHARED_KEY)));

/** Общая на компьютер часть: часы перерыва и его настройки. Только чтение. */
export const shared: Readonly<SharedSession> = sharedState;

function persist(data: SaveData): void {
  const key = currentSaveKey();
  // Хранилище отказало — играем без сохранения, ребёнку об этом знать не нужно.
  if (key !== null) writeJson(key, data);
}

function persistShared(): void {
  writeJson(SHARED_KEY, { clock: { ...sharedState.clock }, breakSettings: { ...sharedState.breakSettings } });
}

// Другая вкладка начала или сняла перерыв — он общий, видим его и здесь.
onKeyChange(SHARED_KEY, () => {
  Object.assign(sharedState, parseShared(readJson(SHARED_KEY)));
});

/**
 * Подменить прогресс в памяти. Object.assign не убирает полей, которых в next нет, — а необязательный
 * lessonId другого игрока, оставшись, перевесил бы номер урока (чистое сохранение его не несёт).
 */
function replaceState(next: SaveData): void {
  Object.assign(state, next);
  if (next.lessonId === undefined) delete state.lessonId;
}

function commit(next: SaveData): void {
  replaceState(next);
  persist(next);
}

/**
 * Подменить прогресс в памяти сохранением игрока id (смена игрока, удаление; app/roster).
 * fresh — чистый лист, не читая хранилище (сброс: ключ мог и не удалиться).
 */
export function loadPlayer(id: string | null, fresh = false): void {
  activeRef.value = id;
  replaceState(id === null || fresh ? emptySave() : peekSave(id));
}

/** Клуб без reactive-обёрток; имя и номер на спине — только если они есть. */
function copyClub(club: Club): Club {
  const out: Club = { name: club.name, kit: { ...club.kit } };
  // Явные цвета шорт и гетр (палитры клубов, спека 004) — тоже без обёрток.
  if (club.kit.shorts) out.kit.shorts = { ...club.kit.shorts };
  if (club.kit.socks) out.kit.socks = { ...club.kit.socks };
  if (club.shirtName !== undefined) out.shirtName = club.shirtName;
  if (club.shirtNumber !== undefined) out.shirtNumber = club.shirtNumber;
  return out;
}

/** Снимок без reactive-обёрток: движок получает обычные данные. */
function snapshot(): SaveData {
  return {
    ...state,
    club: state.club && copyClub(state.club),
    ownedKits: [...state.ownedKits],
    boughtBoots: [...state.boughtBoots],
    keyErrors: { ...state.keyErrors },
    solvedTasks: [...state.solvedTasks],
    penalty: state.penalty && {
      kicks: state.penalty.kicks,
      tasks: [...state.penalty.tasks],
      results: [...state.penalty.results],
    },
    days: { ...state.days },
    cups: Object.fromEntries(Object.entries(state.cups).map(([l, c]) => [l, { ...c }])),
    puzzleBest: { ...state.puzzleBest },
    lessonBest: Object.fromEntries(Object.entries(state.lessonBest).map(([id, b]) => [id, { ...b }])),
  };
}

/** Сеанс для движка: общие часы перерыва и время по дням этого игрока. */
function sessionNow(): SessionData {
  return { ...sharedState.clock, days: state.days };
}

function sameClock(a: BreakClock, b: BreakClock): boolean {
  return (
    a.lastAction === b.lastAction &&
    a.sinceBreak === b.sinceBreak &&
    a.breakDue === b.breakDue &&
    a.breakUntil === b.breakUntil
  );
}

/**
 * Сеанс меняется на каждое действие ребёнка: подменяем только его части, чтобы экраны,
 * которые читают клуб и формы, не перерисовывались от каждого нажатия. Время по дням —
 * в сохранение игрока, часы перерыва — в общую часть. Движок возвращает тот же объект,
 * если менять нечего, — тогда и не пишем.
 */
function commitSession(cur: SessionData, next: SessionData): void {
  if (next === cur) return;
  if (next.days !== cur.days) {
    state.days = next.days;
    persist(snapshot());
  }
  const clock = clockOf(next);
  if (!sameClock(clock, sharedState.clock)) {
    sharedState.clock = clock;
    persistShared();
  }
}

/** Урок по lessonIndex; после последнего урок повторяется. */
export function currentLesson(): Lesson {
  return lessonAt(state.lessonIndex);
}

/** Урок по номеру из сохранения (карточки игроков, родитель). */
export function lessonAt(index: number): Lesson {
  const lesson = lessons[Math.min(index, lessons.length - 1)];
  if (!lesson) throw new Error('no lessons');
  return lesson;
}

/** Пустые счётчики с ошибками по клавишам из сохранения — для подстройки генератора. */
export function typingStats(): TypingStats {
  return { ...emptyStats, keyErrors: { ...state.keyErrors } };
}

/** Первый тайм матча: пак, голы и ошибки клавиш — до перерыва (applyFirstHalf). */
export function recordFirstHalf(r: Pick<HalfResult, 'goals' | 'stats' | 'penalties'>): void {
  commit(applyFirstHalf(snapshot(), r));
}

/**
 * Второй, решающий тайм — конец матча: звёзды, урок, серия пенальти (applyHalf).
 * Зачтён последний урок курса — финал кубка его лиги открыт (openCupOnPass, finalOpen).
 */
export function recordHalf(r: HalfResult): void {
  const next = applyHalf(snapshot(), r, lessonIds);
  commit(openCupOnPass(next, lessons, plan, r.lessonId, r.stars));
}

/**
 * Второй тайм матча кубка: звёзды, монеты, серия пенальти — как обычно, урок не сдвигается;
 * итог раунда — в кубок (applyCupMatch: проход, трофей и пак за финал).
 */
export function recordCupHalf(r: HalfResult, league: League, stage: CupStage, advanced: boolean): void {
  const next = applyHalf(snapshot(), r, lessonIds, false);
  commit(applyCupMatch(next, lessons, plan, league, stage, advanced));
}

/**
 * Рекорд урока после матча — и обычного, и кубкового (003-Р4): пишется, только если он лучше
 * и матч с зачётом (applyLessonBest); иначе хранилище не трогаем.
 */
export function recordLessonBest(lessonId: string, stars: number, best: LessonBest): void {
  const cur = snapshot();
  const next = applyLessonBest(cur, lessonId, stars, best);
  if (next !== cur) commit(next);
}

/** «Сыграть кубок снова»: пройденный кубок — снова с 1/8. */
export function replayCup(league: League): void {
  commit(restartCup(snapshot(), league));
}

/**
 * Серия без задач (только что заработана или из старого сохранения) — выбрать их и сразу
 * сохранить: перезагрузка экрана пенальти показывает те же задачи. Зерно — снаружи.
 */
export function fillPenaltySeries(seed: number): void {
  const s = state.penalty;
  const need = kicksToFill(s);
  if (!s || need === 0) return;
  const picked = pickSeries(tasks, seed, state.solvedTasks, need, s.tasks);
  commit(
    fillPenalty(
      snapshot(),
      picked.map((t) => t.id),
    ),
  );
}

/**
 * Родитель ставит урок игроку id (applySetLesson, пишет и id урока): играющему в этой вкладке —
 * сразу в память.
 */
export function setLessonOf(id: string, index: number): void {
  if (id === activeRef.value) {
    commit(applySetLesson(snapshot(), index, lessonIds));
    return;
  }
  writeJson(saveKey(id), applySetLesson(peekSave(id), index, lessonIds));
}

/** Время «Собери клавиатуру» для рекорда: ключ задания (engine/keyboardPuzzle) и миллисекунды. */
export interface PuzzleTime {
  key: string;
  ms: number;
}

/** Доделанное задание перерыва — монеты (applyMinigame), у «Собери клавиатуру» — и рекорд, одной записью. */
export function recordMinigame(puzzle?: PuzzleTime): void {
  const paid = applyMinigame(snapshot());
  commit(puzzle ? applyPuzzleRecord(paid, puzzle.key, puzzle.ms) : paid);
}

/** Удар серии; повторный ответ на ту же задачу ничего не меняет (applyPenalty). */
export function recordPenalty(taskId: string, correct: boolean): void {
  commit(applyPenalty(snapshot(), taskId, correct));
}

/** Страж маршрута матча: без своего клуба — сначала экран клуба (docs/design.md, «Свой клуб»). */
export function clubFirst(): true | '/club' {
  return state.club ? true : '/club';
}

/** Справка «Как держать руки» показана: перед следующим матчем сама не откроется. */
export function markHandsHelpSeen(): void {
  if (!state.handsHelpSeen) commit(applyHandsHelpSeen(snapshot()));
}

export function setClub(club: Club): void {
  commit({ ...snapshot(), club: copyClub(club) });
}

/** «Надеть» в шкафчике: null или id домашней — своя домашняя; неполученную надеть нельзя (wearKit). */
export function wear(kitId: string | null): void {
  const next = wearKit(snapshot(), kitId);
  if (next.wornKit !== state.wornKit) commit(next);
}

/** Форма команды на матч: надетая или домашняя клуба; без клуба — null (matchKit). */
export function ourKit(): Kit | null {
  return matchKit(state, kits);
}

/**
 * «Купить» бутсы в шкафчике (buyBoots): пара и монеты — одной записью. false — не хватило монет,
 * уже куплены или не из лавки; повторный щелчок «Да» ничего не спишет.
 */
export function buyBootsNow(id: string): boolean {
  const cur = snapshot();
  const next = buyBoots(cur, boots, id);
  if (next === cur) return false;
  commit(next);
  return true;
}

/** «Надеть» бутсы: только пару во владении (wearBoots); обычные — null. */
export function wearBootsNow(id: string): void {
  const cur = snapshot();
  const next = wearBoots(cur, boots, id);
  if (next !== cur) commit(next);
}

/** Бутсы на матч: надетые во владении, иначе обычные (wornBootsOf). */
export function ourBoots(): Boots {
  return wornBootsOf(state, boots);
}

export interface PackResult {
  kitId: string;
  /** false — дубль: форма уже была. */
  isNew: boolean;
  /** Монеты за повтор; у новой формы — 0. */
  coins: number;
}

/**
 * Открыть один пак. Зерно — из прогресса, а не Math.random: перезагрузка страницы
 * посреди анимации не даёт «перекрутить» пак.
 */
export function openPendingPack(): PackResult | null {
  if (state.pendingPacks <= 0) return null;
  // Остаток паков в зерне — чтобы два дубля подряд после одного матча не были одной формой.
  const seed = state.matches * 1000 + state.ownedKits.length * 10 + (state.pendingPacks % 10);
  const kitId = openPack(kits, state.ownedKits, seed);
  const isNew = !state.ownedKits.includes(kitId);
  const before = state.coins;
  commit(applyPack(snapshot(), kitId, kits.find((k) => k.id === kitId)?.rarity));
  return { kitId, isNew, coins: state.coins - before };
}

/** Пак за монеты в шкафчике; false — не хватило монет или коллекция собрана. */
export function buyPackForCoins(): boolean {
  const next = buyPack(snapshot(), kits.length);
  if (next.pendingPacks === state.pendingPacks) return false;
  commit(next);
  return true;
}

/** Чаще не пишем: промежуток короче всё равно войдёт в следующий, счёт не теряется. */
const ACTION_WRITE_MS = 2000;

/** Действие ребёнка (нажатие, клик): копит время игры и назначает перерыв. */
export function noteAction(now: number, today: string): void {
  const { lastAction: last, breakUntil } = sharedState.clock;
  if (last !== null && now >= last && now - last < ACTION_WRITE_MS && breakUntil === null) return;
  const cur = sessionNow();
  commitSession(cur, recordAction(cur, now, today, sharedState.breakSettings));
}

/** Переход экрана: назначенный перерыв начинается. */
export function beginDueBreak(now: number): void {
  const cur = sessionNow();
  commitSession(cur, startBreakIfDue(cur, now, sharedState.breakSettings));
}

/** Перерыв кончился — снять. */
export function endBreakIfOver(now: number): void {
  const cur = sessionNow();
  commitSession(cur, finishBreakIfOver(cur, now, sharedState.breakSettings));
}

/** Настройки перерыва — общие на компьютер, как и сам перерыв. */
export function setBreakSettings(next: BreakSettings): void {
  const settings = { ...next };
  sharedState.breakSettings = settings;
  sharedState.clock = clockOf(applyBreakSettings(sessionNow(), settings));
  persistShared();
}
