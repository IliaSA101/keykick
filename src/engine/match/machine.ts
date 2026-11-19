/**
 * Редьюсер матча (060-Т9б, 059 С-24): `step(state, event) → { state, effects }`.
 * Чистая функция: часы — только в `key.t` и `tick.t`, случайность — только семя `start` (через `planLesson`).
 * Печать строки — `engine/typing`; исход атаки — по порогам, снятым на `start` (059 С-25).
 */
import { planLesson } from '../plan';
import { emptyStats, isDone, startLine, step as typeStep, type KeyPress, type TypingState, type TypingStats } from '../typing/typing';
import { noPenalty, penaltyDue, penaltyScored } from './penalty';
import { attackOutcome, snapshotRules } from './rules';
import type { AttackLog, Effect, KeyEvent, MatchEvent, MatchState, Outcome, PenaltyAnswer, RunningMatch, Score, StartEvent, StepOut } from './types';
import { isDraw, makeResult, totalOf } from './verdict';

export const idleMatch: MatchState = { phase: 'idle' };

const none = (state: MatchState): StepOut => ({ state, effects: [] });
const zero = (): Score => ({ me: 0, opp: 0 });

/**
 * Начало матча: план от `planLesson` по семени; `event.stats` (ошибки прошлых матчей) идут только в план (слабые клавиши),
 * счётчики самого матча — с нуля. Первая атака плана: фаза — по плану. */
function begin(event: StartEvent): StepOut {
  const rules = snapshotRules(event.rules);
  const plan = planLesson(event.lesson, event.dict, event.keymap, event.seed, event.stats);
  const base: RunningMatch = {
    phase: 'warmup',
    seed: event.seed,
    lessonId: event.lesson.id,
    friendly: event.lesson.friendly,
    rules,
    keymap: event.keymap,
    layout: event.lesson.layout,
    plan,
    at: 0,
    row: 0,
    typing: null,
    attackErrors: 0,
    stats: emptyStats,
    score: zero(),
    half1: zero(),
    half2: zero(),
    extra: zero(),
    extraTime: event.extra ?? true,
    penalty: noPenalty(),
    warm: null,
    presses: [],
    log: [],
    now: null,
    breakAt: null,
    paused: false,
    pausedAt: null,
    resumeFrom: null,
    result: null,
  };
  const effects: Effect[] = [];
  return { state: plan.length === 0 ? finish(base, effects) : startAttack(base, 0, true), effects };
}

/** Встать на атаку `at`: фаза — из плана. `forgive` — первое неверное нажатие простится (начало разминки и 2-го тайма). */
function startAttack(s: RunningMatch, at: number, forgive: boolean): RunningMatch {
  const attack = s.plan[at];
  const first = attack?.rows[0];
  if (!attack || first === undefined) throw new Error(`no attack ${at} in the plan`);
  return {
    ...s,
    phase: attack.phase,
    at,
    row: 0,
    attackErrors: 0,
    typing: startLine(first, s.layout, s.stats, false, forgive),
  };
}

/**
 * Событие с часами: сдвигает перерыв на длину паузы и запоминает время. Нажатие после паузы промежутка не даёт:
 * паузу в темп и ровность не берём (пауза — решение игрока, а не медленная печать).
 */
function withClock(s: RunningMatch, t: number): RunningMatch {
  if (s.resumeFrom === null) return { ...s, now: t };
  const gap = Math.max(0, t - s.resumeFrom);
  const forget = (st: TypingStats): TypingStats => ({ ...st, lastAt: null });
  return {
    ...s,
    now: t,
    resumeFrom: null,
    breakAt: s.breakAt === null ? null : s.breakAt + gap,
    stats: forget(s.stats),
    typing: s.typing ? { ...s.typing, stats: forget(s.typing.stats) } : null,
  };
}

function finish(s: RunningMatch, effects: Effect[]): RunningMatch {
  const done: RunningMatch = { ...s, phase: 'result', typing: null };
  const result = makeResult(done);
  effects.push({ kind: 'sound', sound: 'whistle' }, { kind: 'fact', fact: { fact: 'match', verdict: result.verdict, replay: result.replay } });
  return { ...done, result };
}

/** Записать исход атаки: счёт, журнал, эффекты. Разминка исхода не имеет. */
function settle(s: RunningMatch, errors: number, effects: Effect[]): RunningMatch {
  const attack = s.plan[s.at];
  if (!attack) return s;
  const outcome: Outcome | null = attack.phase === 'warmup' ? null : attackOutcome(errors, s.rules);
  const log: AttackLog = { phase: attack.phase, index: attack.index, errors, outcome };
  effects.push({ kind: 'fact', fact: { fact: 'attack', phase: attack.phase, index: attack.index, errors, outcome } });
  if (outcome === null) return { ...s, log: [...s.log, log] };
  const bump = (sc: Score): Score => (outcome === 'goal' ? { ...sc, me: sc.me + 1 } : outcome === 'concede' ? { ...sc, opp: sc.opp + 1 } : sc);
  effects.push({ kind: 'sound', sound: outcome });
  if (outcome !== 'save') effects.push({ kind: 'goal', side: outcome === 'goal' ? 'me' : 'opp', phase: attack.phase, index: attack.index });
  const part = attack.phase === 'half1' ? 'half1' : attack.phase === 'half2' ? 'half2' : 'extra';
  return { ...s, log: [...s.log, log], score: bump(s.score), [part]: bump(s[part]) };
}

/**
 * После атаки: следующая атака, перерыв, доп. время (при ничьей по общему счёту с пенальти) или итог.
 * `forgive` — первое неверное нажатие следующей атаки простится (после пенальти руки ушли от клавиатуры, 005-Р7).
 */
function advance(s0: RunningMatch, effects: Effect[], forgive = false): RunningMatch {
  const cur = s0.plan[s0.at];
  const next = s0.plan[s0.at + 1];
  // Конец разминки: счётчики на этот миг — из них вычитается всё, что считается без разминки (ТЗ-2.3).
  const s: RunningMatch = cur?.phase === 'warmup' && next?.phase !== 'warmup' ? { ...s0, warm: s0.stats } : s0;
  if (cur?.phase === 'half1' && next?.phase !== 'half1') effects.push({ kind: 'fact', fact: { fact: 'half', half: 1, me: s.half1.me, opp: s.half1.opp } });
  if (cur?.phase === 'half2' && next?.phase !== 'half2') effects.push({ kind: 'fact', fact: { fact: 'half', half: 2, me: s.half2.me, opp: s.half2.opp } });
  if (!next) return finish(s, effects);
  if (cur?.phase === 'half1' && next.phase === 'half2') {
    effects.push({ kind: 'sound', sound: 'whistle' });
    return { ...s, phase: 'break', at: s.at + 1, row: 0, typing: null, attackErrors: 0, breakAt: s.now };
  }
  if (next.phase === 'extra' && (!s.extraTime || !isDraw(totalOf(s)))) return finish(s, effects);
  if (next.phase !== cur?.phase) effects.push({ kind: 'sound', sound: 'whistle' });
  return startAttack(s, s.at + 1, forgive);
}

function press(event: KeyEvent): KeyPress {
  return { code: event.code, key: event.key, repeat: event.repeat ?? false, mod: event.mod ?? false, caps: event.caps ?? false, time: event.t };
}

function onKey(state: RunningMatch, event: KeyEvent): StepOut {
  if (state.paused || !state.typing) return none(state);
  const s = withClock(state, event.t);
  const before = s.typing as TypingState;
  const typed = typeStep(s.keymap, before, press(event));
  const effects: Effect[] = [];
  // Основные клавиши для формы (ТЗ-2.10): засчитанные нажатия, разминка не пишется.
  const counted = (typed.last === 'ok' || typed.last === 'error') && s.phase !== 'warmup';
  const presses = counted ? [...s.presses, { ch: (before.text[before.pos] ?? '').toLowerCase(), ok: typed.last === 'ok' }] : s.presses;
  if (typed.last === 'ok') effects.push({ kind: 'sound', sound: 'key' });
  if (typed.last === 'error') effects.push({ kind: 'sound', sound: 'miss' });
  if (typed.hint !== null && typed.hint !== before.hint) effects.push({ kind: 'hint', hint: typed.hint });
  if (!isDone(typed)) return { state: { ...s, typing: typed, stats: typed.stats, presses }, effects };

  const errors = s.attackErrors + typed.lineErrors;
  const attack = s.plan[s.at];
  const nextRow = attack?.rows[s.row + 1];
  // Строки одной атаки идут без перерыва: промежуток между ними — темп (joined), простить ничего не нужно.
  if (nextRow !== undefined) {
    const line = startLine(nextRow, s.layout, typed.stats, true, false);
    return { state: { ...s, row: s.row + 1, attackErrors: errors, typing: line, stats: typed.stats, presses }, effects };
  }
  const settled = settle({ ...s, stats: typed.stats, typing: null, presses }, errors, effects);
  // Первая чистая атака 2-го тайма — пенальти: матч стоит на этой атаке, пока не придёт ответ (М2: раз за матч).
  if (attack && penaltyDue(settled, attack.phase, settled.log.at(-1)?.outcome ?? null)) {
    effects.push({ kind: 'penalty' });
    return { state: { ...settled, phase: 'penalty', penalty: { offered: true, scored: false } }, effects };
  }
  return { state: advance(settled, effects), effects };
}

/** Часы идут, перерыв сам не кончается: «Второй тайм» — только по Enter (`half2`, ТЗ-7.4, 065-Р4). */
function onTick(state: RunningMatch, t: number): StepOut {
  return state.paused ? none(state) : none(withClock(state, t));
}

/** Enter «Второй тайм»: не раньше `breakMs` после свистка. Руки с клавиатуры ушли — первое неверное нажатие тайма прощается. */
function onHalf2(state: RunningMatch, t: number): StepOut {
  if (state.paused || state.phase !== 'break') return none(state);
  const s = withClock(state, t);
  if (s.breakAt === null || t - s.breakAt < s.rules.breakMs) return none(s);
  return { state: startAttack({ ...s, breakAt: null }, s.at, true), effects: [{ kind: 'sound', sound: 'whistle' }] };
}

/** Ответ на пенальти: гол (+1 к общему счёту, не к печати) или нет; дальше — следующая атака 2-го тайма, доп. время или итог. */
function onPenalty(state: RunningMatch, t: number, answer: PenaltyAnswer): StepOut {
  if (state.paused || state.phase !== 'penalty') return none(state);
  const s = withClock(state, t);
  const scored = penaltyScored(answer);
  const effects: Effect[] = [{ kind: 'fact', fact: { fact: 'penalty', answer } }];
  if (scored) effects.push({ kind: 'sound', sound: 'goal' }, { kind: 'goal', side: 'me', phase: 'half2', index: s.plan[s.at]?.index ?? 0 });
  const back: RunningMatch = { ...s, phase: 'half2', penalty: { offered: true, scored } };
  return { state: advance(back, effects, true), effects };
}

/**
 * Один шаг матча. До `start` и после итога события игнорируются (кроме `start` — он начинает матч заново);
 * на паузе — тоже, кроме `resume`: пауза не меняет ни счёт, ни темп (интервал после неё считается без паузы).
 */
export function step(state: MatchState, event: MatchEvent): StepOut {
  if (event.type === 'start') return begin(event);
  if (state.phase === 'idle' || state.phase === 'result') return none(state);
  switch (event.type) {
    case 'pause':
      return state.paused ? none(state) : none({ ...state, paused: true, pausedAt: state.now });
    case 'resume':
      return state.paused ? none({ ...state, paused: false, resumeFrom: state.pausedAt, pausedAt: null }) : none(state);
    case 'tick':
      return onTick(state, event.t);
    case 'half2':
      return onHalf2(state, event.t);
    case 'penalty':
      return onPenalty(state, event.t, event.answer);
    case 'key':
      return onKey(state, event);
  }
}
