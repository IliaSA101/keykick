/**
 * Матч как чистый редьюсер (060-Т9б, 059 С-24): типы событий, состояния и эффектов.
 * Часы и случайность — только из событий и семени; в состоянии нет ничего, что нельзя восстановить переигровкой.
 */
import type { Attack, Phase } from '../plan';
import type { CourseLesson, Dictionary } from '../plan/lesson';
import type { Hint, TypingState, TypingStats } from '../typing/typing';
import type { Keymap, Layout } from '../typing/keymap';

/** Правила матча. На `start` снимаются в состояние (059 С-25): правка настроек посреди матча его не меняет. */
export interface MatchRules {
  /** Атака с ошибками не больше этого числа — гол (ТЗ-2.23: 0). */
  goalMax: number;
  /** Атака с ошибками не меньше этого числа — гол соперника (ТЗ-2.23: 3); между порогами — сейв. */
  concedeMin: number;
  /** Сколько мс перерыв точно длится: «Второй тайм» (`half2`) раньше — без действия (защита от Enter из печати, 060-Р21). */
  breakMs: number;
}

/** Исход атаки тайма или доп. времени. */
export type Outcome = 'goal' | 'save' | 'concede';

export interface Score {
  me: number;
  opp: number;
}

/** Фазы матча по ТЗ-2.3, 2.5: разминка → тайм 1 → перерыв → тайм 2 → доп. время → итог. */
export type MatchPhase = 'warmup' | 'half1' | 'break' | 'half2' | 'penalty' | 'extra' | 'result';

/** Ответ на пенальти (ТЗ-2.7): `hit` — задача решена верно (гол), `miss` — промах, `skip` — «Не бить». */
export type PenaltyAnswer = 'hit' | 'miss' | 'skip';

/** Пенальти матча: предлагался ли и забит ли (одно на матч, ТЗ-2.7). */
export interface PenaltyState {
  offered: boolean;
  scored: boolean;
}

/** Нажатие основной клавиши для формы (ТЗ-2.10): ожидаемый знак (строчный) и верно ли. Разминка не пишется (017 §8). */
export interface Press {
  ch: string;
  ok: boolean;
}

export type Verdict = 'win' | 'draw' | 'loss';

/** Что переигрывать, если матч не выигран (ТЗ-2.8): 2-й тайм (1-й не проигран, его счёт сохраняется) или оба. */
export type Replay = 'half2' | 'both';

export interface MatchResult {
  verdict: Verdict;
  /** Счёт печатью: голы тайма 1, тайма 2 и доп. времени вместе. Гол пенальти сюда не входит (звёзды — только печатью, ТЗ-2.6). */
  score: Score;
  /** Счёт с пенальти: печать плюс гол пенальти; по нему — победа, доп. время и переигровка (ТЗ-2.6). */
  total: Score;
  penalty: PenaltyState;
  half1: Score;
  half2: Score;
  extra: Score;
  /** Какой тайм переигрывать; `null` — победа. */
  replay: Replay | null;
  /** Товарищеский засчитывается всегда (ТЗ-2.4), остальные — только победа. */
  counted: boolean;
  /** Счётчики всего матча, с разминкой. */
  stats: TypingStats;
  /** Счётчики без разминки: по ним точность и скорость итога и звёзды (ТЗ-2.18, 4.1; 017 §3). */
  play: TypingStats;
  /** Нажатия основных клавиш без разминки — для формы клавиш. */
  presses: readonly Press[];
}

/** Строка журнала атак: что случилось в каждой атаке (у разминки исхода нет). */
export interface AttackLog {
  phase: Phase;
  index: number;
  errors: number;
  outcome: Outcome | null;
}

export type SoundName = 'key' | 'miss' | 'goal' | 'concede' | 'save' | 'whistle';

/** Факт матча — для наград и газеты Э1; сам редьюсер из него ничего не делает. */
export type Fact =
  | { fact: 'attack'; phase: Phase; index: number; errors: number; outcome: Outcome | null }
  | { fact: 'half'; half: 1 | 2; me: number; opp: number }
  | { fact: 'penalty'; answer: PenaltyAnswer }
  | { fact: 'match'; verdict: Verdict; replay: Replay | null };

export type Effect =
  | { kind: 'sound'; sound: SoundName }
  | { kind: 'goal'; side: 'me' | 'opp'; phase: Phase; index: number }
  | { kind: 'hint'; hint: Hint }
  /** Предложить пенальти (одно на матч, после первой чистой атаки 2-го тайма): экран показывает задачу и шлёт `penalty`. */
  | { kind: 'penalty' }
  | { kind: 'fact'; fact: Fact };

export interface StartEvent {
  type: 'start';
  seed: number;
  rules: Partial<MatchRules>;
  lesson: CourseLesson;
  /** Словарь и карта клавиатуры сборки, статистика ошибок игрока — то, что нужно `planLesson` (Т9а). */
  dict: Dictionary;
  keymap: Keymap;
  stats?: TypingStats;
}

export interface KeyEvent {
  type: 'key';
  code: string;
  key: string;
  /** Время нажатия, мс (часы — снаружи). */
  t: number;
  repeat?: boolean;
  mod?: boolean;
  caps?: boolean;
}

export interface TickEvent {
  type: 'tick';
  t: number;
}

/** Enter «Второй тайм» в перерыве; раньше `breakMs` после свистка — без действия (065-Р4). */
export interface HalfTwoEvent {
  type: 'half2';
  t: number;
}

/** Ответ на пенальти; вне фазы `penalty` не действует. */
export interface PenaltyEvent {
  type: 'penalty';
  t: number;
  answer: PenaltyAnswer;
}

export type MatchEvent = StartEvent | KeyEvent | TickEvent | HalfTwoEvent | PenaltyEvent | { type: 'pause' } | { type: 'resume' };

/** Матч не начат (до `start`). */
export interface IdleMatch {
  phase: 'idle';
}

export interface RunningMatch {
  phase: MatchPhase;
  seed: number;
  lessonId: string;
  friendly: boolean;
  /** Правила, снятые на `start`. */
  rules: Readonly<MatchRules>;
  keymap: Keymap;
  layout: Layout;
  /** План урока от `planLesson`: разминка, тайм 1, тайм 2, доп. атака — по порядку. */
  plan: readonly Attack[];
  /** Индекс текущей (в перерыве — следующей) атаки в плане. */
  at: number;
  /** Индекс строки в текущей атаке. */
  row: number;
  /** Строка, которую печатают; `null` в перерыве и после итога. */
  typing: TypingState | null;
  /** Ошибки уже набранных строк текущей атаки. */
  attackErrors: number;
  /** Счётчики печати через весь матч (в печати — копия лежит и в `typing.stats`). */
  stats: TypingStats;
  score: Score;
  half1: Score;
  half2: Score;
  extra: Score;
  penalty: PenaltyState;
  /** Счётчики на конец разминки: из них вычитается всё, что по правилам считается без неё. */
  warm: TypingStats | null;
  presses: readonly Press[];
  log: readonly AttackLog[];
  /** Время последнего события с часами, мс; `null` — ещё не было. */
  now: number | null;
  /** Начало перерыва, мс. */
  breakAt: number | null;
  paused: boolean;
  /** Время, на котором встали на паузу. */
  pausedAt: number | null;
  /** После `resume` — с какого времени шла пауза, пока следующее событие с часами не сдвинет таймеры. */
  resumeFrom: number | null;
  result: MatchResult | null;
}

export type MatchState = IdleMatch | RunningMatch;

export interface StepOut {
  state: MatchState;
  effects: Effect[];
}
