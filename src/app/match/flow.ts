/**
 * Матч v2 (спека 017, Т5а, design §1, §10): связка машины (`engine/match/machine.ts`) с реактивным `MatchView`.
 * Экран и компоненты видят только `view` и действия; запись — через `MatchStore`; тексты — `MatchTexts`;
 * часы (`clock`) и зерно (`seed`) приходят снаружи, поэтому поток проверяется без DOM и без реального времени.
 * Здесь же — то, что живёт во времени: тик минуты тренера и диалог браузера при закрытии вкладки.
 */
import { shallowRef, type ShallowRef } from 'vue';
import type { CourseLesson } from '../../engine/course/model';
import type { KeyPress } from '../../engine/typing';
import { initMatch, next, type MatchConfig, type MatchState } from '../../engine/match/machine';
import { comebackDue } from '../../engine/matchResult/played';
import { entryFor, type Entry } from '../../engine/match/resume';
import type { ResultModel } from '../../engine/matchResult/resultModel';
import { beforeOf, summaryOf, type MatchSummary } from '../../engine/matchday/summary';
import type { Offer } from '../../engine/match/verdict';
import { applyEffects, matchView, type Action, type MatchView } from '../../engine/match/view';
import { soften } from '../../engine/match/lessonCopy';
import { courseLessons } from '../course/load';
import { matchConfig, matchRules } from './load';
import type { ReadableMatchStore } from './store';

export interface FlowOptions {
  lesson: CourseLesson;
  store: ReadableMatchStore;
  /** Часы, мс (по умолчанию `Date.now`). Нажатия клавиш получают время отсюда же. */
  clock?: () => number;
  /** Новое зерно (по умолчанию из часов). */
  seed?: () => number;
  /** Готовая настройка машины (тесты подставляют свои тексты). */
  config?: Partial<Omit<MatchConfig, 'lesson'>>;
  /** Порядок уроков курса (для смягчения); по умолчанию — `courseLessons`. */
  lessons?: readonly CourseLesson[];
  /** Матч с места, которое считает вход в урок; по умолчанию — по ожидающему 2-му тайму в хранилище. */
  entry?: Entry;
  /** Таймеры и диалог закрытия вкладки; в тестах без DOM — `false`. */
  live?: boolean;
}

export interface MatchFlow {
  /** Вид для экрана; обновляется после каждого действия. */
  readonly view: Readonly<ShallowRef<MatchView>>;
  /** Состояние машины целиком — для тестов и быстрых проверок, экраны его не читают. */
  state(): MatchState;
  /** Возвращение после перерыва в 5 дней и больше — баннер вступления (ТЗ-2.11). */
  readonly comeback: boolean;
  /**
   * Итог матча для цепочки матчдэя (019-Т10); null — результата ещё нет. `dayOf` — местные сутки (их даёт приложение).
   * Снимок «до матча» взят при последнем `begin`, до записи итога; возвращается простой объект.
   */
  summary(model: ResultModel, dayOf: (t: number) => string): MatchSummary | null;
  start(): void;
  press(p: KeyPress): void;
  answerKick(result: 'scored' | 'missed'): void;
  skipKick(): void;
  toSecondHalf(): void;
  choose(offer: Offer): void;
  pause(): void;
  resume(): void;
  quit(): void;
  /** Экран закрывается: незаконченный матч — брошенный (запись `abandon`), таймеры сняты. */
  dispose(): void;
}

const TICK_MS = 250;

export function createMatchFlow(o: FlowOptions): MatchFlow {
  const clock = o.clock ?? Date.now;
  const seed = o.seed ?? (() => clock() % 0x7fffffff);
  const live = o.live ?? true;
  const entry = o.entry ?? entryFor(o.store.read().pending, o.lesson.id);
  const comeback = comebackDue(o.store.read().played, clock(), matchRules.comebackDays);
  const order = o.lessons ?? courseLessons;
  const at = order.findIndex((l) => l.id === o.lesson.id);
  const before0 = order[at - 1];
  // Возврат после перерыва (017-Р55): текущий непройденный урок смягчается до прохода — тем же `match.soften`.
  // Только на новом входе: матч с перерыва уже играл 1-й тайм по длинам обычного урока.
  if (comeback && entry.kind === 'fresh' && before0 && !o.lesson.friendly && (o.store.read().lessons[o.lesson.id]?.best ?? 0) <= 0) {
    o.store.soften?.(o.lesson.id, before0.id);
  }
  const data = o.store.read();
  // Смягчение (017-Р8): урок после пройденного с помощью идёт копией — длины, строки и пороги пройденного, потолок ★★.
  const from = data.softenFrom === null ? undefined : order.find((l) => l.id === data.softenFrom);
  const softened = from !== undefined && order[order.indexOf(from) + 1]?.id === o.lesson.id;
  const lesson = from !== undefined && softened ? soften(o.lesson, from) : o.lesson;
  const first = seed();
  const cfg: MatchConfig = {
    ...matchConfig(lesson, { best: data.lessons[lesson.id]?.best ?? 0, solved: data.solved, seed: first, softened }),
    ...o.config,
    lesson,
  };
  let state = initMatch(cfg, { seed: first, fails: data.lessons[lesson.id]?.fails ?? 0, entry });
  const view = shallowRef(matchView(state));
  // Снимок до матча (простые числа): обновляется на каждом `begin`, раньше записи, пока итог не изменил хранилище.
  const snap = (): { best: number; lastFinishedAt: number | null } => {
    const d = o.store.read();
    return { best: d.lessons[o.lesson.id]?.best ?? 0, lastFinishedAt: d.played.lastFinishedAt };
  };
  let before = { best: data.lessons[o.lesson.id]?.best ?? 0, lastFinishedAt: data.played.lastFinishedAt };
  let finishedAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let guarded = false;
  // Нажатия матча с его начала (журнал `keys`, 018-Р24): один знак — одно нажатие печати, верное или ошибочное.
  let typed = '';
  let expected = '';
  let dt: number[] = [];
  let lastKeyAt: number | null = null;

  /** Нажатие, которое машина приняла за печать (верное или ошибка), — в буфер журнала; знак берётся из состояния, а не из строки: она могла закончиться. */
  function noteKey(before: MatchState, after: MatchState, p: KeyPress): void {
    const k = after.lastKey;
    if (!k || k === before.lastKey) return;
    typed += k.typed;
    expected += k.expected;
    dt.push(lastKeyAt === null ? 0 : Math.max(0, p.time - lastKeyAt));
    lastKeyAt = p.time;
  }

  const warn = (e: BeforeUnloadEvent): void => {
    e.preventDefault();
    e.returnValue = '';
  };

  /** Тик нужен только пока минута тренера идёт; диалог закрытия — пока идёт печать. */
  function sync(): void {
    if (!live) return;
    const ticking = view.value.coach?.leftMs != null;
    if (ticking && timer === null) timer = setInterval(() => dispatch({ type: 'tick', now: clock() }), TICK_MS);
    if (!ticking && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (view.value.beforeUnload !== guarded) {
      guarded = view.value.beforeUnload;
      if (guarded) globalThis.addEventListener('beforeunload', warn);
      else globalThis.removeEventListener('beforeunload', warn);
    }
  }

  function dispatch(a: Action): void {
    const r = next(state, a);
    const prev = state;
    state = r.state;
    if (r.effects.some((e) => e.kind === 'begin')) {
      before = snap();
      typed = expected = '';
      dt = [];
      lastKeyAt = null;
    }
    if (a.type === 'press') noteKey(prev, state, a.press);
    // Нажатия уходят раньше записи блока и итога: журнал соберёт их в одну пачку с записью `match`.
    if (typed !== '' && r.effects.some((e) => e.kind === 'block' || e.kind === 'finish')) o.store.keys?.({ typed, expected, dt: [...dt] });
    for (const e of r.effects) if (e.kind === 'finish') finishedAt = e.at;
    applyEffects(o.store, r.effects);
    view.value = matchView(state);
    sync();
  }

  return {
    view,
    state: () => state,
    comeback,
    summary(model, dayOf) {
      const info = view.value.result;
      if (!info) return null;
      const b = beforeOf(o.lesson, before.best, before.lastFinishedAt, dayOf);
      return summaryOf(info, model, b, dayOf(clock()), finishedAt || clock());
    },
    start: () => dispatch({ type: 'start', now: clock() }),
    // Время нажатия — часы потока, а не события: так `now` в машине и время нажатий одной шкалы.
    press: (p) => dispatch({ type: 'press', press: { ...p, time: clock() } }),
    answerKick: (result) => dispatch({ type: 'kickAnswer', result }),
    skipKick: () => dispatch({ type: 'skipKick' }),
    // «Продолжить 2-й тайм» — новое зерно; обычный перерыв — зерно матча, чтобы тексты 1-го и 2-го тайма сошлись.
    toSecondHalf: () =>
      dispatch(state.banner === 'continue2' ? { type: 'toSecondHalf', now: clock(), seed: seed() } : { type: 'toSecondHalf', now: clock() }),
    choose: (offer) => dispatch({ type: 'choose', offer, seed: seed(), now: clock() }),
    pause: () => dispatch({ type: 'pause' }),
    resume: () => dispatch({ type: 'resume' }),
    quit: () => dispatch({ type: 'quit', now: clock() }),
    dispose() {
      if (state.phase !== 'quit') dispatch({ type: 'quit', now: clock() });
      if (timer !== null) clearInterval(timer);
      timer = null;
      if (guarded) globalThis.removeEventListener('beforeunload', warn);
      guarded = false;
    },
  };
}
