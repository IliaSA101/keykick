/**
 * Матч v2 (спека 017, Т5б, design §10): итог матча → изменения разделов сохранения через `SectionTx`.
 * Чистые функции без Vue и DOM: игрок, часы и запись приходят снаружи (`app/match/saveStore.ts`).
 * Монеты — только `creditBlock` (касса); окна формы и `played` считают те же функции `matchResult/`, что и память.
 */
import type { MatchData } from '../journal/records';
import { section as courseSection, type CourseSave } from '../course/save';
import { addFans, creditBlock } from '../matchResult/coins';
import { pushPresses, settleForm, type FormState } from '../matchResult/form';
import { recordPlayed, type PlayedLog } from '../matchResult/played';
import type { DeepReadonly, SectionTx } from '../save/section';
import { EXPERT_MAX, section as schoolSection } from '../school/save';
import { addSolved, hasSolved } from '../school/solved';
import { permille } from '../save/section';
import type { PendingSecond } from './resume';
import type { MatchRules } from './rules';
import { COUNT_MAX, KEY_ERRORS_MAX, LEAGUES_MAX, PLAYED_PER_LEAGUE, WINDOW_MAX, formFingers, section as matchSection, type Half2, type MatchSave } from './save';
import { bestAfter } from './verdict';
import type { Effect } from './view';

type Of<K extends Effect['kind']> = Extract<Effect, { kind: K }>;
export type CommitRules = Pick<MatchRules, 'coinPer' | 'squad' | 'form' | 'speedMatches'>;

/** Что журнал знает о матче: один `id` на весь матч, место урока, накопленные итоги. */
export interface MatchLogCtx {
  id: string;
  lesson: string;
  league: string;
  n: number;
  attempt: number;
  signs: number;
  errors: number;
  ms: number;
  /** Атак сыграно к последнему блоку. */
  at: number;
  /** Итог закрытого матча: блоки после итога (минута тренера) пишутся, но журнал остаётся закрытым. */
  outcome: MatchData['outcome'];
}

const own = <T>(v: DeepReadonly<T>): T => structuredClone(v) as T;
const cap = (n: number, max: number): number => Math.min(max, Math.max(0, Math.floor(n)));

/** Запись журнала `match` (018-Р19) — ровно эти поля; `open` — не закрыт. */
export function logMatch(tx: SectionTx, c: MatchLogCtx): void {
  const data: MatchData = { lesson: c.lesson, league: c.league, n: c.n, attempt: c.attempt, outcome: c.outcome, at: c.at, signs: c.signs, errors: c.errors, ms: c.ms };
  tx.log({ kind: 'match', id: c.id, data });
}

// ───────────── переходники раздела ↔ типы движка ─────────────

export function formFromSave(f: DeepReadonly<MatchSave['form']>): FormState {
  return Object.fromEntries(
    formFingers.map((fg) => {
      const cand = f.candidate[fg] ?? { rank: 0, n: 0 };
      return [fg, { recent: [...(f.windows[fg] ?? '')].map((ch) => ch === '1'), maxRank: f.maxRank[fg] ?? 0, candidate: cand.n > 0 ? { rank: cand.rank, n: cand.n } : null }];
    }),
  );
}

function formToSave(form: FormState, was: MatchSave['form']): MatchSave['form'] {
  const out = own<MatchSave['form']>(was);
  for (const fg of formFingers) {
    const cur = form[fg];
    if (!cur) continue;
    out.windows[fg] = cur.recent.map((b) => (b ? '1' : '0')).join('').slice(-WINDOW_MAX);
    out.maxRank[fg] = Math.max(out.maxRank[fg], cur.maxRank);
    out.candidate[fg] = cur.candidate ?? { rank: 0, n: 0 };
  }
  return out;
}

export function playedFromSave(m: DeepReadonly<MatchSave>): PlayedLog {
  return { byLeague: structuredClone(m.played), lastFinishedAt: m.lastFinishedAt > 0 ? m.lastFinishedAt : null };
}

/** Ожидающий 2-й тайм → `half2` (018-Р22: `kick` в 1-м тайме 0, `started` — метка времени). */
export function half2FromPending(p: PendingSecond, started: number): Half2 {
  return { lessonId: p.lessonId, seed: p.seed, started, score: [p.first.score.typed, p.first.score.conceded], first: { correct: p.first.correct, errors: p.first.errors, ms: p.first.ms }, reason: p.reason, ...(p.help && p.help !== 'none' ? { help: p.help } : {}) };
}

export function pendingFromHalf2(h: DeepReadonly<Half2> | null): PendingSecond | null {
  if (!h) return null;
  return {
    lessonId: h.lessonId, seed: h.seed, started: h.started > 0, reason: h.reason, ...(h.help && h.help !== 'none' ? { help: h.help } : {}),
    first: { correct: h.first.correct, errors: h.first.errors, ms: h.first.ms, score: { typed: h.score[0] ?? 0, kick: 0, conceded: h.score[1] ?? 0 } },
  };
}

// ───────────── события матча ─────────────

/** Конец блока: монеты и остаток (касса), верные по лиге, ошибки клавиш, окно формы, журнал (`at`, итоги). */
export function commitBlock(tx: SectionTx, e: Of<'block'>, log: MatchLogCtx, rules: CommitRules): void {
  const m = own<MatchSave>(tx.get(matchSection));
  for (const [k, n] of Object.entries(e.keyErrors)) {
    if (k in m.keyErrors || Object.keys(m.keyErrors).length < KEY_ERRORS_MAX) m.keyErrors[k] = cap((m.keyErrors[k] ?? 0) + n, COUNT_MAX);
  }
  if (e.correct > 0 && (e.league in m.leagueHits || Object.keys(m.leagueHits).length < LEAGUES_MAX)) {
    m.leagueHits[e.league] = cap(addFans(m.leagueHits, e.league, e.correct)[e.league] ?? 0, COUNT_MAX);
  }
  m.form = formToSave(pushPresses(formFromSave(m.form), rules.squad, e.presses, e.source, rules.form), m.form);
  tx.set(matchSection, m);
  creditBlock(tx, e.correct, e.paid, rules.coinPer, log.id);
  log.signs += e.correct + e.errors;
  log.errors += e.errors;
  log.ms += e.ms;
  log.at = e.at;
  logMatch(tx, log);
}

/** Перерыв (или провал с переигровкой): ожидающий 2-й тайм. */
export function commitBreak(tx: SectionTx, pending: PendingSecond): void {
  tx.set(matchSection, { ...own<MatchSave>(tx.get(matchSection)), half2: half2FromPending(pending, 0) });
}

/**
 * Возврат после перерыва (017-Р55, design §7): текущий урок идёт смягчённой копией до прохода — тот же `match.soften`,
 * что ставит проход с помощью. Чужое смягчение (на другой урок) не трогаем: оно ещё не снято.
 */
export function commitSoften(tx: SectionTx, lessonId: string, from: string): void {
  const m = own<MatchSave>(tx.get(matchSection));
  // Пройденный урок не смягчаем: смягчение снимает только проход, а повторный проход ничего не снимет.
  if (m.soften !== null || tx.get(courseSection).passed.includes(lessonId)) return;
  m.soften = { lessonId, from };
  tx.set(matchSection, m);
}

/** Переигровка 2-го тайма началась (017-Р36): `half2.seed` — зерно её записи журнала, а не проигранного матча. */
export function commitReplayBegin(tx: SectionTx, seed: number): void {
  const m = own<MatchSave>(tx.get(matchSection));
  if (!m.half2) return;
  m.half2.seed = seed;
  tx.set(matchSection, m);
}

/** 2-й тайм начат: метка времени (> 0), перезагрузка дальше — провал без роста `fails`. */
export function commitHalf2Started(tx: SectionTx, now: number): void {
  const m = own<MatchSave>(tx.get(matchSection));
  if (!m.half2) return;
  m.half2.started = Math.max(1, Math.floor(now));
  tx.set(matchSection, m);
}

/** Пенальти: верный ответ по новой задаче — бит в `school.solved` и «Знаток» +1. `no` — постоянный номер задачи. */
export function commitKick(tx: SectionTx, expert: number, no: number | null): void {
  if (expert <= 0 || no === null) return;
  const s = own<{ solved: string; expert: number }>(tx.get(schoolSection));
  // Задачу уже разобрала другая вкладка: «Знаток» не растёт второй раз.
  if (hasSolved(s.solved, no)) return;
  tx.set(schoolSection, { solved: addSolved(s.solved, no), expert: cap(s.expert + expert, EXPERT_MAX) });
}

export interface FinishCtx {
  rules: CommitRules;
  /** Следующий урок курса после `lessonId` (null — последний). */
  next: string | null;
  /** Порядок уроков курса: `course.lesson` — первый непройденный. */
  order: readonly string[];
}

/** Итог: урок, звёзды, рекорды, `fails`, смягчение, `played`, ранги, ожидающий 2-й тайм, закрытие журнала. */
export function commitFinish(tx: SectionTx, e: Of<'finish'>, log: MatchLogCtx, ctx: FinishCtx): void {
  const r = e.result;
  const c = own<CourseSave>(tx.get(courseSection));
  const prev = c.lessons[e.lessonId] ?? { stars: 0, cpm: 0, acc: 0, fails: 0, help: 'none' as const, back: false };
  const acc = cap(permille(r.correct, r.correct + r.errors), 1000);
  const cpm = cap(r.cpm, 2000);
  const rec = { ...prev, stars: bestAfter(prev.stars, r.verdict.stars), cpm: Math.max(prev.cpm, cpm), acc: Math.max(prev.acc, acc), fails: cap(r.fails, 1000) };
  // Проход урока впервые: только он ставит смягчение (017-Р36); повтор пройденного с помощью его не ставит.
  const wasPassed = c.passed.includes(e.lessonId);
  if (r.verdict.passed) {
    // Чисто пройденный урок проходом с помощью не «грязнится»: `back` и `help` остаются от чистого прохода.
    if (!(wasPassed && !prev.back && e.help !== 'none')) {
      rec.help = e.help;
      rec.back = e.help !== 'none';
    }
    if (!wasPassed) c.passed.push(e.lessonId);
    c.lesson = ctx.order.find((id) => !c.passed.includes(id)) ?? (c.lesson === '' ? e.lessonId : c.lesson);
  }
  c.lessons[e.lessonId] = rec;
  tx.set(courseSection, c);

  const m = own<MatchSave>(tx.get(matchSection));
  const clean = r.verdict.passed && e.help === 'none';
  // Ставит только первый проход текущего урока (смягчения нет или оно на этом уроке), снимает только чистый проход смягчённого.
  if (r.verdict.passed && !wasPassed && e.help !== 'none' && (m.soften === null || m.soften.lessonId === e.lessonId)) {
    m.soften = ctx.next === null ? null : { lessonId: ctx.next, from: e.lessonId };
  } else if (clean && m.soften?.lessonId === e.lessonId) m.soften = null;
  m.half2 = e.pending ? half2FromPending(e.pending, 0) : null;
  m.form = formToSave(settleForm(formFromSave(m.form), ctx.rules.squad, ctx.rules.form), m.form);
  const keep = Math.min(ctx.rules.speedMatches, PLAYED_PER_LEAGUE);
  const rec2 = { at: e.at, lessonId: e.lessonId, league: e.league, kind: e.lessonKind, cpm, accuracy: acc, passed: r.verdict.passed, stars: r.verdict.stars, help: e.help };
  const played = recordPlayed(playedFromSave(m), e.session, rec2, keep);
  m.played = Object.fromEntries(Object.entries(played.byLeague).map(([l, list]) => [l, [...list]]));
  m.lastFinishedAt = played.lastFinishedAt ?? m.lastFinishedAt;
  tx.set(matchSection, m);

  log.outcome = r.outcome;
  logMatch(tx, log);
}
