/**
 * Матч v2 (спека 017, Т5а, design §14): быстрые проверки для разработки — прыжок к фазе матча по адресу
 * `#/match?at=<фаза>&lesson=<id>`. Строки «набирает» сам поток (`MatchFlow.press`), как ребёнок, но с ходовыми
 * часами; хранилище — в памяти, в браузер и сохранение ничего не пишется. Только DEV: подключается из экрана
 * `/match` с `at`; в выпуске охрана входа (`app/firstRun/entry.ts`) уводит такой адрес на карту (019-Р33).
 */
import { saveExists } from '../../engine/match/score';
import { expectedHit } from '../../engine/typing';
import type { CourseLesson } from '../../engine/course/model';
import { DAY_MS } from '../../engine/matchResult/played';
import type { PendingSecond } from '../../engine/match/resume';
import type { MatchState } from '../../engine/match/machine';
import { keymap } from '../keymap';
import { createMatchFlow, type MatchFlow } from './flow';
import { matchRules } from './load';
import { memoryMatchStore, type MatchData, type ReadableMatchStore } from './store';

export const JUMPS = [
  'warmup', 'half1', 'kick', 'decisive', 'break', 'extra', 'coach', 'stuck3', 'stuck5', 'reserve', 'win', 'loss', 'draw', 'comeback', 'resume',
] as const;
export type Jump = (typeof JUMPS)[number];

export const isJump = (v: unknown): v is Jump => typeof v === 'string' && (JUMPS as readonly string[]).includes(v);

/** Адрес → место и урок; ни одного знакомого `at` — null (обычный матч со вступления). */
export function jumpQuery(q: Record<string, unknown>): { at: Jump; lessonId: string | null } | null {
  const first = (v: unknown): unknown => (Array.isArray(v) ? (v as unknown[])[0] : v);
  const at = first(q.at);
  if (!isJump(at)) return null;
  const lesson = first(q.lesson);
  return { at, lessonId: typeof lesson === 'string' ? lesson : null };
}

type Half = 'half1' | 'half2' | 'extra';
/** Сколько ошибок вставить в атаку (тайм, номер атаки с 0). */
type Plan = (half: Half, attack: number) => number;

const SEED = 7;
const clean: Plan = () => 0;

/** Нажатие ожидаемого знака (`ok`) или заведомо неверное; время подставляет поток. */
function keyPress(state: MatchState, ok: boolean): Parameters<MatchFlow['press']>[0] {
  const t = state.typing;
  return {
    code: ok && t ? (expectedHit(keymap, t)?.key.code ?? '') : '',
    key: ok && t ? (t.text[t.pos] ?? '') : '§',
    repeat: false,
    mod: false,
    caps: false,
    time: 0,
  };
}

/** Печатает за ребёнка, пока не выполнится `stop`; пенальти не бьёт («Не бить»). */
export function drive(flow: MatchFlow, stop: (s: MatchState) => boolean, plan: Plan = clean): void {
  const planted = new Set<string>();
  for (let guard = 0; guard < 30000; guard++) {
    const s = flow.state();
    if (stop(s)) return;
    if (s.phase === 'kick') {
      flow.skipKick();
      continue;
    }
    const t = s.typing;
    if (!t) return;
    const key = `${s.phase}${s.attack}`;
    const half: Half = s.phase === 'extra' ? 'extra' : s.half === 1 ? 'half1' : 'half2';
    // Первое неверное нажатие тайма прощается, поэтому ошибки — после первого верного знака первой строки атаки.
    if (t.pos === 1 && s.row === 0 && (s.phase === 'half1' || s.phase === 'half2' || s.phase === 'extra') && !planted.has(key)) {
      planted.add(key);
      for (let i = plan(half, s.attack); i > 0; i--) flow.press(keyPress(flow.state(), false));
    }
    flow.press(keyPress(flow.state(), true));
  }
  throw new Error('jump: the match did not reach the requested phase');
}

/** Проигранный тайм: в каждой атаке `c` ошибок — гол соперника. */
const lose = (c: number): Plan => () => c;

/** Матч на нужном месте и его память. `live` — таймеры и диалог закрытия вкладки (в тесте без DOM — `false`). */
export function jumpWith(
  at: Jump,
  lesson: CourseLesson,
  live = true,
  /** Обёртка над хранилищем в памяти (страница матча считает по ней монеты и верные нажатия). */
  wrap: (s: ReadableMatchStore) => ReadableMatchStore = (s) => s,
): { flow: MatchFlow; store: ReadableMatchStore } {
  const { g, c } = lesson;
  const A = lesson.attacks.length;
  const failsBefore = at === 'coach' ? 1 : at === 'stuck3' || at === 'reserve' ? 2 : at === 'stuck5' ? 4 : 0;
  const init: Partial<MatchData> = { lessons: failsBefore ? { [lesson.id]: { best: 0, fails: failsBefore } } : {} };
  const wall = Date.now();
  if (at === 'comeback') {
    init.played = { byLeague: {}, lastFinishedAt: wall - 6 * DAY_MS };
  }
  if (at === 'resume') {
    const pending: PendingSecond = {
      lessonId: lesson.id,
      seed: SEED,
      started: true,
      reason: 'break',
      first: { correct: 200, errors: 0, ms: 60_000, score: { typed: A, kick: 0, conceded: 0 } },
    };
    init.pending = pending;
  }
  // Ходовые часы: до конца прыжка время идёт по 100 мс на вызов, после — настоящее (разрыв считается паузой).
  let fake = wall - 10 * 60_000;
  let running = true;
  const clock = (): number => (running ? (fake += 100) : Date.now());
  const store = wrap(memoryMatchStore(matchRules, init));
  const flow = createMatchFlow({ lesson, store, clock, seed: () => SEED, live });
  const toBreak = (plan: Plan = clean): void => drive(flow, (s) => s.phase === 'break', plan);
  const toHalf2 = (plan: Plan = clean): void => {
    flow.start();
    toBreak(plan);
    flow.toSecondHalf();
  };
  const finishes = (s: MatchState): boolean => s.phase === 'result' || s.phase === 'coach';

  switch (at) {
    case 'warmup': flow.start(); break;
    case 'half1': flow.start(); drive(flow, (s) => s.phase === 'half1'); break;
    case 'break': flow.start(); toBreak(); break;
    case 'kick': toHalf2(); drive(flow, (s) => s.phase === 'kick', clean); break;
    case 'decisive':
      toHalf2(lose(c));
      drive(flow, (s) => s.phase === 'half2' && s.attack === A - 1);
      break;
    case 'extra': // 1-й тайм чистый, во 2-м соперник забивает каждую атаку → ничья
      toHalf2(); drive(flow, (s) => s.phase === 'extra', (h) => (h === 'half2' ? c : 0)); break;
    case 'draw': // 2-й тайм проигран подчистую, а в доп. время вратарь отбивает (сейв) → ничья; без сейва в уроке ничьей не бывает
      toHalf2();
      drive(flow, finishes, (h) => (h === 'half2' ? c : h === 'extra' ? (saveExists(g, c) ? g + 1 : c) : 0));
      break;
    case 'win': toHalf2(); drive(flow, finishes); break;
    case 'coach':
    case 'loss':
    case 'stuck3':
    case 'stuck5':
      toHalf2(lose(c)); drive(flow, finishes, lose(c)); break;
    case 'reserve': // «тайм с запасом» (017-Р46): после третьего провала выбрано «С запасом» — 1-й тайм с меткой помощи
      toHalf2(lose(c));
      drive(flow, finishes, lose(c));
      flow.choose('reserve');
      break;
    case 'comeback': break;
    case 'resume': break;
  }
  running = false;
  return { flow, store };
}

export const jumpFlow = (at: Jump, lesson: CourseLesson, live = true): MatchFlow => jumpWith(at, lesson, live).flow;
