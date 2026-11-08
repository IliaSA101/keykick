/**
 * Матч v2 (спека 017, design §1, §10): вид для экрана (`MatchView`) и контракт хранилища (`MatchStore`).
 * Экран и компоненты знают только вид и действия машины; запись — через `applyEffects`.
 */
import type { CourseLesson } from '../course/model';
import type { Keymap } from '../keymap';
import type { KeyPress, TypingStats } from '../typing';
import type { MatchRules } from './rules';
import type { Kick, KickResult } from './kick';
import { printPhases } from './machine';
import type { FormPress, PressSource } from '../matchResult/form';
import type { HalfPrint, PendingSecond } from './resume';
import { isDecisive, reserveView, type AttackOutcome, type MatchScore, type ReserveView } from './score';
import type { Help, LessonKind, Offer, StuckOffer, Verdict } from './verdict';
import type { TypingState } from '../typing';
import { withHelp } from './lessonCopy';

export type Phase = 'intro' | 'warmup' | 'half1' | 'break' | 'half2' | 'kick' | 'extra' | 'coach' | 'result' | 'quit';

/** Тексты снаружи (обёртки над `makeCourse*`); в тесте — подставные строки. */
export interface MatchTexts {
  /** Разминка: блоки строк. */
  warmup(seed: number): string[][];
  /** Тайм: текст на каждую атаку (строки — `wrapRows` по ширине урока). */
  half(seed: number, second: boolean): string[];
  /** Доп. время: одна атака. */
  extra(seed: number): string;
  /** Строка минуты тренера на клавишах `keys`. */
  coachLine(keys: string, seed: number): string;
}

export interface MatchConfig {
  /** Урок (возможно, смягчённая копия); помощь накладывается поверх (`state.help`). */
  lesson: CourseLesson;
  softened: boolean;
  kind: LessonKind;
  /** Лучшие звёзды по уроку до матча. */
  best: number;
  /** Урок оплачивается (`isPaid`). */
  paid: boolean;
  rules: MatchRules;
  map: Keymap;
  texts: MatchTexts;
  /** Задача пенальти на 2-й тайм по его зерну (`kickTask`); null — пенальти не будет. Переигровка — новое зерно. */
  kickTask(seed: number, solved: readonly string[]): string | null;
  /** Решённые задачи («Знаток»). */
  solved: readonly string[];
}

export interface MatchState {
  cfg: MatchConfig;
  phase: Phase;
  paused: boolean;
  half: 1 | 2;
  seed: number;
  help: Help;
  /** Провалы подряд до этого матча. */
  fails: number;
  /** Переигровка 2-го тайма. */
  replay: boolean;
  banner: 'continue2' | null;
  /** Вход после перерыва (перезагрузка или выход): в журнале `begin.resumed`. */
  resumed: boolean;
  /** Задача пенальти этого 2-го тайма. */
  kickId: string | null;
  /** Сколько атак матча уже сыграно (место `at` в журнале 018). */
  done: number;
  /** Время паузы: минута тренера её не ест. */
  pausedAt: number | null;
  /** Журнал `open` уже написан. */
  opened: boolean;
  now: number;
  warm: string[][];
  block: number;
  texts: string[];
  attack: number;
  rows: string[];
  row: number;
  attackErrors: number;
  typing: TypingState | null;
  /** Счётчики текущей фазы (разминка, тайм, доп. время, тренер) и их значение на начало блока. */
  stats: TypingStats;
  base: TypingStats;
  presses: FormPress[];
  /** Последнее принятое нажатие печати (верное или ошибка): строка могла закончиться на нём, и `typing` уже другой. Журнал нажатий (018-Р24) берёт знак отсюда. */
  lastKey: { typed: string; expected: string } | null;
  score: MatchScore;
  firstScore: MatchScore;
  first: HalfPrint | null;
  second: HalfPrint | null;
  extra: HalfPrint | null;
  keyErrors: Readonly<Record<string, number>>;
  last: { outcome: AttackOutcome; errors: number } | null;
  kick: Kick | null;
  lastKick: KickResult | null;
  kickTaken: boolean;
  solved: readonly string[];
  result: MatchResultInfo | null;
  coach: { keys: string; startedAt: number | null; n: number } | null;
  coachDone: boolean;
}



export interface MatchResultInfo {
  verdict: Verdict;
  score: MatchScore;
  outcome: 'win' | 'loss';
  fails: number;
  /** null — матч пройден. */
  offer: StuckOffer | null;
  accuracy: number;
  /** Верные и ошибочные нажатия матча без разминки: из них — тысячные точности в сохранении. */
  correct: number;
  errors: number;
  cpm: number;
}

export type Effect =
  | { kind: 'begin'; lessonId: string; seed: number; g: number; c: number; attacks: number[]; fails: number; help: Help; softened: boolean; replay: boolean; resumed: boolean; at: number }
  | {
      kind: 'block';
      source: PressSource;
      correct: number;
      errors: number;
      keyErrors: Record<string, number>;
      presses: FormPress[];
      paid: boolean;
      league: string;
      /** Время (мс) последнего нажатия блока. */
      time: number;
      /** Место в матче по 018: сколько атак сыграно к концу блока (разминка и тренер — на момент блока). */
      at: number;
      half: 1 | 2;
      /** Номер атаки тайма с 1; у разминки и тренера 0. */
      attack: number;
      /** Исход атаки; у разминки и тренера null. */
      outcome: AttackOutcome | null;
      /** Счётное время печати блока, мс. */
      ms: number;
      /** Счёт матча после блока. */
      score: MatchScore;
    }
  | { kind: 'toBreak'; pending: PendingSecond }
  | { kind: 'half2Started' }
  | { kind: 'kick'; taskId: string; result: KickResult; expert: number; at: number }
  | { kind: 'abandon'; phase: Phase; half: 1 | 2; attack: number; at: number }
  | {
      kind: 'finish';
      lessonId: string;
      league: string;
      result: MatchResultInfo;
      help: Help;
      softened: boolean;
      session: 'match' | 'replay';
      /** Урок или кубок (`kind` занят видом записи). */
      lessonKind: LessonKind;
      /** Ожидающая переигровка 2-го тайма; null — снять. */
      pending: PendingSecond | null;
      at: number;
    };

export type Action =
  | { type: 'start'; now: number }
  | { type: 'press'; press: KeyPress }
  | { type: 'kickAnswer'; result: 'scored' | 'missed' }
  | { type: 'skipKick' }
  | { type: 'toSecondHalf'; now: number; seed?: number }
  | { type: 'choose'; offer: Offer; seed: number; now: number }
  /** `now` — время паузы/возврата: минута тренера её не ест. */
  | { type: 'pause'; now?: number }
  | { type: 'resume'; now?: number }
  | { type: 'quit'; now: number }
  | { type: 'tick'; now: number };

export interface Step {
  state: MatchState;
  effects: Effect[];
}

export interface MatchView {
  phase: Phase;
  paused: boolean;
  half: 1 | 2;
  /** Номер атаки тайма с 1 и сколько атак (в доп. времени — 1 из 1). */
  attack: number;
  attacks: number;
  score: MatchScore;
  /** Строки текущей атаки (разминки, строки тренера), номер текущей и курсор в ней. */
  rows: string[];
  row: number;
  cursor: number;
  typing: TypingState | null;
  /** Мячи запаса текущей атаки; в разминке, на перерыве и у тренера — нет. */
  reserve: ReserveView | null;
  decisive: boolean;
  /** Помощь матча (017-Р46): «С запасом» / «С тренером» — метка у счётчика ошибок; `none` — метки нет. */
  help: Help;
  /** `continue2` — «Продолжить 2-й тайм»; `kick` — «все мячи целы — пенальти!». */
  banner: 'continue2' | 'kick' | null;
  /** Идёт переигровка 2-го тайма. */
  replay: boolean;
  /** Исход только что сыгранной атаки (для анимации). */
  lastOutcome: { outcome: AttackOutcome; errors: number } | null;
  kick: Kick | null;
  lastKick: KickResult | null;
  /** Счёт 1-го тайма на перерыве и в «Продолжить». */
  firstScore: MatchScore | null;
  result: MatchResultInfo | null;
  offer: StuckOffer | null;
  /** Минута тренера: клавиши и сколько осталось (null — ещё не начали печатать). */
  coach: { keys: string; leftMs: number | null } | null;
  /** Включать диалог браузера при закрытии вкладки (фазы печати, не на паузе). */
  beforeUnload: boolean;
}

export function matchView(s: MatchState): MatchView {
  const l = withHelp(s.cfg.lesson, s.help);
  const typingPhase = s.phase === 'half1' || s.phase === 'half2' || s.phase === 'extra';
  const attacks = s.phase === 'extra' ? 1 : s.texts.length;
  const attack = s.phase === 'extra' ? 1 : s.attack + 1;
  const errors = s.attackErrors + (s.typing?.lineErrors ?? 0);
  const half = s.phase === 'extra' ? 'extra' : s.half;
  const coach = s.coach;
  return {
    phase: s.phase,
    paused: s.paused,
    half: s.half,
    attack,
    attacks,
    score: s.score,
    rows: s.phase === 'warmup' ? (s.warm[s.block] ?? []) : s.rows,
    row: s.row,
    cursor: s.typing?.pos ?? 0,
    typing: s.typing,
    reserve: typingPhase ? reserveView(errors, l.g, l.c) : null,
    help: s.help,
    decisive: typingPhase && isDecisive({ half, attack, attacks }, s.score),
    replay: s.replay,
    banner: s.phase === 'kick' ? 'kick' : s.phase === 'break' ? s.banner : null,
    lastOutcome: s.last,
    kick: s.kick,
    lastKick: s.lastKick,
    firstScore: s.first ? s.firstScore : null,
    result: s.result,
    offer: s.result?.offer ?? null,
    coach: coach ? { keys: coach.keys, leftMs: coach.startedAt === null ? null : Math.max(0, s.cfg.rules.coach.ms - (s.now - coach.startedAt)) } : null,
    beforeUnload: printPhases.includes(s.phase) && !s.paused,
  };
}

type Of<K extends Effect['kind']> = Extract<Effect, { kind: K }>;

/** Что матч просит записать (design §10); память — `memoryMatchStore` (Т5а), сохранение — Т5б. */
export interface MatchStore {
  /** Журнал `open` со старта матча. */
  begin(e: Of<'begin'>): void;
  /** Запись по концу блока: монеты, верные по лиге, ошибки клавиш, окно формы, `at`. */
  block(e: Of<'block'>): void;
  toBreak(pending: PendingSecond): void;
  half2Started(): void;
  kick(e: Of<'kick'>): void;
  abandon(e: Of<'abandon'>): void;
  /** Итог: урок, звёзды, `fails`, смягчение, `played`, ранги, ожидающий 2-й тайм, закрытие журнала. */
  finish(e: Of<'finish'>): void;
}

export function applyEffects(store: MatchStore, effects: readonly Effect[]): void {
  for (const e of effects) {
    switch (e.kind) {
      case 'begin': store.begin(e); break;
      case 'block': store.block(e); break;
      case 'toBreak': store.toBreak(e.pending); break;
      case 'half2Started': store.half2Started(); break;
      case 'kick': store.kick(e); break;
      case 'abandon': store.abandon(e); break;
      case 'finish': store.finish(e); break;
    }
  }
}

/**
 * Задержки экрана (017-Р27): иначе лишний знак, Пробел или Enter после последнего удара пролистывает то, что ребёнок
 * должен увидеть. Время приходит снаружи — функции чистые.
 */
export const screenDelay = {
  /** Поле с последним ударом держится до итога. */
  shotMs: 1400,
  /** Итог: фокус и Enter включаются не сразу (как `HOLD_MS` пенальти). */
  resultMs: 600,
  /** Перерыв: Enter включается не сразу (как `READY_GUARD_MS` перерыва v1). */
  breakMs: 500,
} as const;

/** Прошла ли защитная пауза `ms` с момента `since` (оба в мс одних часов). */
export const guardOpen = (since: number, now: number, ms: number): boolean => now - since >= ms;

/**
 * Держать ли поле с последним ударом перед итогом: только когда итог наступил сразу после печатной атаки
 * (2-й тайм или доп. время). После пенальти, минуты тренера и при входе на готовый итог — сразу.
 */
export const holdsResult = (from: Phase | undefined, to: Phase): boolean => to === 'result' && (from === 'half2' || from === 'extra');
