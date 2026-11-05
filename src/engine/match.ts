/**
 * Счёт матча: каждая строка тайма — атака. Решение (docs/design.md, 04.11):
 * строка без ошибок — гол; 1–2 ошибки — вратарь соперника отбил; 3 и больше — контратака
 * и гол в наши ворота. Скорость на счёт не влияет: важнее точность.
 * Матч — два тайма; последние атаки второго тайма — решающая серия: по ней решается зачёт урока
 * (спека 008). Длина серии и запас ошибок — от лиги урока: во дворе одна атака и 2 ошибки,
 * в районе и городе — две атаки и 3 ошибки на обе.
 * Пенальти по ходу матча (спека 005, engine/midPenalty) — гол в счёт, но не атака: звёзды и зачёт
 * от него не зависят.
 */
import type { League } from './cup';
import { accuracy, type TypingStats } from './typing';

export type AttackResult = 'goal' | 'save' | 'conceded';

/** Пенальти по ходу матча: пробито (верно или мимо; «Не бить» — не удар) и забито. */
export interface PenaltyCount {
  taken: number;
  scored: number;
}

export interface MatchScore {
  /** Все наши голы: с атак и с пенальти. */
  goals: number;
  conceded: number;
  attacks: readonly AttackResult[];
  penalties: PenaltyCount;
}

/** Таймов в матче. Решающая атака — последняя в последнем тайме. */
export const MATCH_HALVES = 2;

/** Ошибок в строке, после которых соперник забивает. */
export const CONCEDE_FROM = 3;

/** Ошибок в решающей атаке двора — не больше: тогда урок зачтён и открыт следующий. */
export const DECISIVE_MAX_ERRORS = 2;

/**
 * Правила решающей у лиги (спека 008): series — сколько последних атак второго тайма в серии,
 * maxErrors — общий запас ошибок на всю серию (+1 за строку, журнал 04.11).
 */
export interface LeagueRules {
  series: number;
  maxErrors: number;
}

/**
 * Правила по лигам — правило игры, а не контент (008-Р3). Областной в коде нет, пока нет лиги (008-Р13).
 */
export const LEAGUE_RULES: Readonly<Record<League, LeagueRules>> = {
  yard: { series: 1, maxErrors: DECISIVE_MAX_ERRORS },
  district: { series: 2, maxErrors: 3 },
  city: { series: 2, maxErrors: 3 },
};

/** Правила лиги урока (lesson.league — строка из контента); незнакомая лига — как двор. */
export function leagueRules(league: string): LeagueRules {
  return Object.hasOwn(LEAGUE_RULES, league) ? LEAGUE_RULES[league as League] : LEAGUE_RULES.yard;
}

/**
 * Урок со своей лигой — для «Новое!» у правила серии (008-Р6): первый урок лиги, где серия длиннее,
 * чем у прошлой. Без поля сохранения — по порядку уроков.
 */
export function seriesIsNew(lessons: readonly { id: string; league: string }[], lessonId: string): boolean {
  const i = lessons.findIndex((l) => l.id === lessonId);
  const lesson = lessons[i];
  const before = lessons[i - 1];
  if (!lesson || !before || before.league === lesson.league) return false;
  return leagueRules(lesson.league).series > leagueRules(before.league).series;
}
/** Третья звезда: решающая без ошибок и точность матча (оба тайма, без разминки) не ниже. */
export const THREE_STAR_ACCURACY = 0.97;

export const emptyScore: MatchScore = { goals: 0, conceded: 0, attacks: [], penalties: { taken: 0, scored: 0 } };

export function attackResult(lineErrors: number): AttackResult {
  if (lineErrors === 0) return 'goal';
  return lineErrors >= CONCEDE_FROM ? 'conceded' : 'save';
}

export function addAttack(score: MatchScore, lineErrors: number): MatchScore {
  const result = attackResult(lineErrors);
  return {
    goals: score.goals + (result === 'goal' ? 1 : 0),
    conceded: score.conceded + (result === 'conceded' ? 1 : 0),
    attacks: [...score.attacks, result],
    penalties: score.penalties,
  };
}

/** Пробитое пенальти по ходу матча: забито — гол в счёт (005-Р8, в кубке тоже); атакой не считается. */
export function addPenalty(score: MatchScore, scored: boolean): MatchScore {
  const { taken, scored: hits } = score.penalties;
  return {
    ...score,
    goals: score.goals + (scored ? 1 : 0),
    penalties: { taken: taken + 1, scored: hits + (scored ? 1 : 0) },
  };
}

/** Первая строка решающей серии (с 0): строк меньше серии — решающий весь тайм. */
export function seriesFrom(lines: number, series: number): number {
  return lines - Math.min(series, lines);
}

/** Решающая ли атака: одна из series последних строк последнего тайма. half — с 1, line — с 0. */
export function isDecisive(half: number, line: number, lines: number, series: number): boolean {
  return half === MATCH_HALVES && line >= seriesFrom(lines, series) && line < lines;
}

function sumCounts<K extends string>(list: readonly Readonly<Partial<Record<K, number>>>[]): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const counts of list) {
    for (const [k, n] of Object.entries(counts) as [K, number | undefined][]) {
      if (n !== undefined) out[k] = (out[k] ?? 0) + n;
    }
  }
  return out;
}

/**
 * Счётчики матча из счётчиков таймов: точность, скорость и ровность — за оба тайма.
 * Промежутки идут подряд; перерыв между таймами в них не входит — как и удары между строками.
 */
export function matchStats(halves: readonly TypingStats[]): TypingStats {
  const starts = halves.map((s) => s.startedAt).filter((t): t is number => t !== null);
  const ends = halves.map((s) => s.lastAt).filter((t): t is number => t !== null);
  return {
    correct: halves.reduce((n, s) => n + s.correct, 0),
    errors: halves.reduce((n, s) => n + s.errors, 0),
    keyErrors: sumCounts(halves.map((s) => s.keyErrors)),
    fingerErrors: sumCounts(halves.map((s) => s.fingerErrors)),
    startedAt: starts.length > 0 ? Math.min(...starts) : null,
    lastAt: ends.length > 0 ? Math.max(...ends) : null,
    intervals: halves.flatMap((s) => s.intervals),
  };
}

/**
 * Зачёт урока (решение 04.11, как в «СОЛО»): ошибок во всей решающей серии — не больше запаса лиги.
 * decisiveErrors — сумма по атакам серии.
 */
export function lessonPassed(decisiveErrors: number, rules: LeagueRules): boolean {
  return decisiveErrors <= rules.maxErrors;
}

/**
 * Запас ошибок в решающей серии (спека 003, мячи в строке статуса): сколько ещё можно ошибиться
 * и не потерять зачёт; errors — уже сделанные в серии. Запас кончился — печать идёт дальше (003-Р2).
 */
export function decisiveReserve(errors: number, rules: LeagueRules): number {
  return Math.max(0, rules.maxErrors - errors);
}

/**
 * Звёзды за доигранный матч: 1 — без зачёта, 2 — зачёт, 3 — решающая серия без ошибок
 * и точность матча (оба тайма, matchStats) не ниже THREE_STAR_ACCURACY.
 * Две и больше — следующий урок (save.ts, applyHalf).
 */
export function starsFor(stats: TypingStats, decisiveErrors: number, rules: LeagueRules): 1 | 2 | 3 {
  if (!lessonPassed(decisiveErrors, rules)) return 1;
  return decisiveErrors === 0 && accuracy(stats) >= THREE_STAR_ACCURACY ? 3 : 2;
}

export type Outcome = 'win' | 'draw' | 'loss';

export function outcome(score: MatchScore): Outcome {
  if (score.goals > score.conceded) return 'win';
  return score.goals === score.conceded ? 'draw' : 'loss';
}
