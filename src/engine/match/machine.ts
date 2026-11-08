/**
 * Матч v2 (спека 017, design §1, §1.1, §6): машина состояний. Чистая: `next(состояние, действие)` →
 * новое состояние и список «что записать» (`Effect`). Хранилища нет, часы и случайность приходят снаружи
 * (время — в нажатии и действии, зерно — в действии); тексты атак — функцией `MatchTexts`.
 */
import { wrapRows } from '../course/attack';
import type { CourseLesson } from '../course/model';
import { weakKeys } from '../stats';
import {
  countedInterval,
  emptyStats,
  isDone,
  startLine,
  step,
  type KeyPress,
  type TypingStats,
} from '../typing';
import type { PressSource } from '../matchResult/form';
import type { Action, Effect, MatchResultInfo, MatchState, Phase, Step } from './view';
import { answerKick, kickDue, type KickResult } from './kick';
import { withHelp } from './lessonCopy';
import { firstHalfKept, pendingOf, type HalfPrint } from './resume';
import { addOutcome, attackOutcome, emptyScore, matchResult, type AttackOutcome } from './score';
import {
  matchAccuracy,
  nextFails,
  stuckOffer,
  verdict,
  type Help,
  type Offer,
} from './verdict';

export type { MatchConfig, MatchState, MatchTexts } from './view';
export { initMatch } from './resume';

/** Фазы печати: в них работают пауза и `beforeunload`. */
export const printPhases: readonly Phase[] = ['warmup', 'half1', 'half2', 'extra', 'coach'];

const lessonOf = (s: MatchState): CourseLesson => withHelp(s.cfg.lesson, s.help);

const printOf = (st: TypingStats): HalfPrint => ({
  correct: st.correct,
  errors: st.errors,
  ms: st.intervals.reduce((a, b) => a + countedInterval(b), 0),
});

function mergeKeys(a: Readonly<Record<string, number>>, b: Readonly<Partial<Record<string, number>>>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, n] of Object.entries(b)) out[k] = (out[k] ?? 0) + (n ?? 0);
  return out;
}

function openLog(s: MatchState, fx: Effect[]): MatchState {
  if (s.opened) return s;
  const l = lessonOf(s);
  fx.push({
    kind: 'begin', lessonId: l.id, seed: s.seed, g: l.g, c: l.c, attacks: l.attacks, fails: s.fails,
    help: s.help, softened: s.cfg.softened, replay: s.replay, resumed: s.resumed, at: s.now,
  });
  return { ...s, opened: true };
}

/** Блок кончился: одной записью верные, ошибки клавиш и нажатия для формы (design §6, 017-Р3). */
function flush(s: MatchState, source: PressSource, fx: Effect[], outcome: AttackOutcome | null = null): MatchState {
  const keyErrors: Record<string, number> = {};
  for (const [k, n] of Object.entries(s.stats.keyErrors)) {
    const d = (n ?? 0) - (s.base.keyErrors[k] ?? 0);
    if (d > 0) keyErrors[k] = d;
  }
  const own = s.stats.intervals.slice(s.base.intervals.length);
  const inAttack = source === 'attack' || source === 'extra';
  fx.push({
    kind: 'block', source, correct: s.stats.correct - s.base.correct, errors: s.stats.errors - s.base.errors,
    keyErrors, presses: s.presses, paid: s.cfg.paid, league: s.cfg.lesson.league, time: s.now, at: s.done,
    half: s.half, attack: inAttack ? s.attack + 1 : 0, outcome, ms: own.reduce((a, b) => a + countedInterval(b), 0),
    score: s.score,
  });
  return { ...s, base: s.stats, presses: [] };
}

const fresh = (s: MatchState): MatchState => ({ ...s, stats: emptyStats, base: emptyStats, presses: [], typing: null });

function startWarmupRow(s: MatchState, joined: boolean): MatchState {
  const text = s.warm[s.block]?.[s.row] ?? '';
  return { ...s, typing: startLine(text, s.cfg.lesson.layout, s.stats, joined) };
}

function startWarmup(s: MatchState): MatchState {
  const warm = s.cfg.texts.warmup(s.seed).filter((b) => b.length > 0);
  if (warm.length === 0) return startHalf(s, 1, s.seed);
  return startWarmupRow({ ...fresh(s), phase: 'warmup', warm, block: 0, row: 0 }, false);
}

function startAttack(s: MatchState, text: string, forgive?: boolean): MatchState {
  const rows = wrapRows(text, s.cfg.lesson.rowWidth);
  return { ...s, rows, row: 0, attackErrors: 0, typing: startLine(rows[0] ?? text, s.cfg.lesson.layout, s.stats, false, forgive) };
}

function startHalf(s: MatchState, half: 1 | 2, seed: number): MatchState {
  const texts = s.cfg.texts.half(seed, half === 2);
  const n: MatchState = {
    ...fresh(s), phase: half === 1 ? 'half1' : 'half2', half, seed, texts, attack: 0, kick: null, lastKick: null,
    kickTaken: false, last: null, banner: null, done: half === 1 ? 0 : s.cfg.lesson.attacks.length,
    kickId: half === 2 ? s.cfg.kickTask(seed, s.solved) : null,
  };
  return startAttack(n, texts[0] ?? '');
}

function finishMatch(s: MatchState, fx: Effect[]): MatchState {
  const { rules } = s.cfg;
  const prints = [s.first, s.second, s.extra].filter((p): p is HalfPrint => p !== null);
  const accuracy = matchAccuracy(prints);
  const v = verdict(
    { score: s.score, friendly: s.cfg.lesson.friendly, accuracy, help: s.help, softened: s.cfg.softened, kind: s.cfg.kind, best: s.cfg.best },
    rules,
  );
  const fails = nextFails(s.fails, v.passed);
  const offer = v.passed ? null : stuckOffer(fails, firstHalfKept(s.firstScore), rules);
  const ms = prints.reduce((a, p) => a + p.ms, 0);
  const correct = prints.reduce((a, p) => a + p.correct, 0);
  const result: MatchResultInfo = {
    verdict: v, score: s.score, outcome: s.score.typed + s.score.kick > s.score.conceded ? 'win' : 'loss', fails, offer,
    accuracy, correct, errors: prints.reduce((a, p) => a + p.errors, 0), cpm: ms < 1000 ? 0 : Math.round((correct * 60000) / ms),
  };
  fx.push({
    kind: 'finish', lessonId: s.cfg.lesson.id, league: s.cfg.lesson.league, result, help: s.help, softened: s.cfg.softened,
    session: s.replay ? 'replay' : 'match', lessonKind: s.cfg.kind, at: s.now,
    pending: offer?.options.includes('replay2') ? pendingOf(s, 'replay') : null,
  });
  const layout = s.cfg.lesson.layout;
  const keys = offer?.coachMinute
    ? weakKeys(s.keyErrors, s.cfg.map, layout, rules.coach.keys)
        .map((w) => s.cfg.map.byCode.get(w.code)?.chars?.[layout][0] ?? '')
        .join('')
    : '';
  const done: MatchState = { ...s, opened: false, result, typing: null, kick: null };
  if (keys === '') return { ...done, phase: 'result', coachDone: false };
  return startCoachRow({ ...fresh(done), phase: 'coach', coach: { keys, startedAt: null, n: 0 } }, false);
}

function startCoachRow(s: MatchState, joined: boolean): MatchState {
  const c = s.coach;
  if (!c) return s;
  const rows = wrapRows(s.cfg.texts.coachLine(c.keys, s.seed + 7919 * (c.n + 1)), s.cfg.lesson.rowWidth);
  return { ...s, rows, row: 0, typing: startLine(rows[0] ?? '', s.cfg.lesson.layout, s.stats, joined) };
}

/** Конец печати (после доп. времени — тоже) → разбор счёта. */
function decide(s: MatchState, fx: Effect[]): MatchState {
  if (s.phase === 'half2' && matchResult(s.score) === 'draw') {
    // `last` не сбрасываем: удар решающей атаки 2-го тайма виден, пока идёт переход в доп. время (017-Р27).
    const n: MatchState = { ...fresh(s), phase: 'extra' };
    return startAttack(n, s.cfg.texts.extra(s.seed));
  }
  return finishMatch(s, fx);
}

function attackDone(s: MatchState, fx: Effect[]): MatchState {
  const l = lessonOf(s);
  const source: PressSource = s.phase === 'extra' ? 'extra' : 'attack';
  const outcome = attackOutcome(s.attackErrors, l.g, l.c);
  const scored = { ...s, done: s.done + 1, score: addOutcome(s.score, outcome) };
  const n = { ...flush(scored, source, fx, outcome), last: { outcome, errors: s.attackErrors } };
  if (n.phase === 'extra') return finishMatch({ ...n, extra: printOf(n.stats), keyErrors: mergeKeys(n.keyErrors, n.stats.keyErrors) }, fx);
  const due = kickDue({ half: n.half, attack: n.attack + 1, attacks: n.texts.length, errors: n.attackErrors, taken: n.kickTaken });
  if (due && n.kickId !== null) {
    return { ...n, phase: 'kick', typing: null, kick: { taskId: n.kickId, result: null } };
  }
  return nextAttack(n, fx, false);
}

/** Следующая атака тайма, а если атак больше нет — конец тайма. */
function nextAttack(s: MatchState, fx: Effect[], afterKick: boolean): MatchState {
  if (s.attack + 1 < s.texts.length) {
    return startAttack({ ...s, attack: s.attack + 1 }, s.texts[s.attack + 1] ?? '', afterKick ? true : undefined);
  }
  const print = printOf(s.stats);
  const keyErrors = mergeKeys(s.keyErrors, s.stats.keyErrors);
  if (s.half === 1) {
    const n: MatchState = { ...s, first: print, firstScore: s.score, keyErrors, phase: 'break', typing: null };
    fx.push({ kind: 'toBreak', pending: pendingOf(n, 'break') });
    return n;
  }
  return decide({ ...s, second: print, keyErrors, phase: 'half2' }, fx);
}

function rowDone(s: MatchState, fx: Effect[]): MatchState {
  const t = s.typing;
  if (!t) return s;
  if (s.phase === 'warmup') {
    if (s.row + 1 < (s.warm[s.block]?.length ?? 0)) return startWarmupRow({ ...s, row: s.row + 1 }, true);
    const n = flush(s, 'warmup', fx);
    if (s.block + 1 < s.warm.length) return startWarmupRow({ ...n, block: s.block + 1, row: 0 }, false);
    return startHalf(n, 1, s.seed);
  }
  if (s.phase === 'coach') {
    const n = flush(s, 'coach', fx);
    const c = n.coach;
    if (!c) return n;
    if (c.startedAt !== null && n.now - c.startedAt >= s.cfg.rules.coach.ms) {
      return { ...n, phase: 'result', coach: null, coachDone: true, typing: null };
    }
    return startCoachRow({ ...n, coach: { ...c, n: c.n + 1 } }, true);
  }
  const errors = s.attackErrors + t.lineErrors;
  if (s.row + 1 < s.rows.length) {
    return { ...s, attackErrors: errors, row: s.row + 1, typing: startLine(s.rows[s.row + 1] ?? '', t.layout, s.stats, true) };
  }
  return attackDone({ ...s, attackErrors: errors }, fx);
}

function onPress(s: MatchState, p: KeyPress, fx: Effect[]): MatchState {
  const t = s.typing;
  if (!t || s.paused || !printPhases.includes(s.phase)) return s;
  const expected = t.text[t.pos];
  const after = step(s.cfg.map, t, p);
  let n: MatchState = { ...s, now: p.time, typing: after, stats: after.stats };
  if (n.phase === 'coach' && n.coach && n.coach.startedAt === null) n = { ...n, coach: { ...n.coach, startedAt: p.time } };
  if (expected !== undefined && (after.last === 'ok' || after.last === 'error')) {
    n = { ...n, presses: [...n.presses, { char: expected, ok: after.last === 'ok' }], lastKey: { typed: p.key.length === 1 ? p.key : '·', expected } };
  }
  return isDone(after) ? rowDone(n, fx) : n;
}

function onKick(s: MatchState, result: KickResult, fx: Effect[]): MatchState {
  if (s.phase !== 'kick' || !s.kick) return s;
  const out = answerKick(s.kick, result, s.score, s.solved);
  fx.push({ kind: 'kick', taskId: s.kick.taskId, result, expert: out.expert, at: s.now });
  const solved = out.expert > 0 ? [...s.solved, s.kick.taskId] : s.solved;
  const n: MatchState = { ...s, phase: 'half2', score: out.score, kick: out.kick, lastKick: result, kickTaken: true, solved };
  return nextAttack(n, fx, true);
}

/** Выбор на итоге: «ещё раз» с новым зерном, с помощью, переигровка 2-го тайма, выход. */
function onChoose(s: MatchState, offer: Offer, seed: number, now: number, fx: Effect[]): MatchState {
  if (s.phase !== 'result' || !s.result) return s;
  // Только «хватит» или вариант, который показан на итоге.
  if (offer !== 'quit' && !s.result.offer?.options.includes(offer)) return s;
  const n0: MatchState = { ...s, now, seed, fails: s.result.fails, resumed: false };
  if (offer === 'quit') return { ...n0, phase: 'quit' };
  if (offer === 'replay2') {
    const n = openLog({ ...n0, replay: true, score: s.firstScore, second: null, extra: null, result: null, coachDone: false }, fx);
    fx.push({ kind: 'half2Started' });
    return startHalf(n, 2, seed);
  }
  const help: Help = offer === 'reserve' ? 'reserve' : offer === 'coach' ? 'coach' : s.help;
  const reset: MatchState = {
    ...n0, help, replay: false, score: emptyScore, firstScore: emptyScore, first: null, second: null, extra: null,
    keyErrors: {}, result: null, coachDone: false,
  };
  return startHalf(openLog(reset, fx), 1, seed);
}

export function next(s: MatchState, a: Action): Step {
  const fx: Effect[] = [];
  const done = (state: MatchState): Step => ({ state, effects: fx });
  switch (a.type) {
    case 'start': {
      if (s.phase !== 'intro') return done(s);
      return done(startWarmup(openLog({ ...s, now: a.now }, fx)));
    }
    case 'press':
      return done(onPress(s, a.press, fx));
    case 'kickAnswer':
      return done(onKick(s, a.result, fx));
    case 'skipKick':
      return done(onKick(s, 'skipped', fx));
    case 'toSecondHalf': {
      if (s.phase !== 'break') return done(s);
      const open = openLog({ ...s, now: a.now }, fx);
      fx.push({ kind: 'half2Started' });
      return done(startHalf(open, 2, a.seed ?? s.seed));
    }
    case 'choose':
      return done(onChoose(s, a.offer, a.seed, a.now, fx));
    case 'pause': {
      if (!printPhases.includes(s.phase) || s.paused) return done(s);
      return done({ ...s, paused: true, pausedAt: a.now ?? s.now });
    }
    case 'resume': {
      if (!s.paused) return done(s);
      // Минута тренера не ест паузу: старт сдвигается на её длину.
      const c = s.coach;
      const shift = a.now !== undefined && s.pausedAt !== null ? Math.max(0, a.now - s.pausedAt) : 0;
      const coach = c && c.startedAt !== null ? { ...c, startedAt: c.startedAt + shift } : c;
      return done({ ...s, paused: false, pausedAt: null, coach, now: a.now ?? s.now });
    }
    case 'quit': {
      if (s.phase === 'quit') return done(s);
      if (s.opened) fx.push({ kind: 'abandon', phase: s.phase, half: s.half, attack: s.attack, at: a.now });
      return done({ ...s, phase: 'quit', paused: false, typing: null, opened: false, now: a.now });
    }
    case 'tick':
      // Минута тренера стартует по первому нажатию (`onPress`), не по часам; на паузе время стоит.
      return done(s.paused ? s : { ...s, now: a.now });
  }
}
