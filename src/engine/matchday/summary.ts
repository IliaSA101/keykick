/**
 * Итог матча для цепочки матчдэя (спека 019, design §7.1, В6): что случилось в матче и что было до него.
 * Входы — из 017 (`MatchResultInfo`, `ResultModel`) и снимок курса до матча. Чистая функция.
 */
import type { ResultKind, ResultModel } from '../matchResult/resultModel';
import type { MatchResultInfo } from '../match/view';

export interface MatchSummary {
  lessonId: string;
  league: string;
  kind: ResultKind;
  outcome: 'win' | 'loss';
  /** Урок зачтён (`offer === null`). */
  passed: boolean;
  /** Лучшие звёзды урока до и после матча (0…3). */
  starsBefore: number;
  starsAfter: number;
  /** Урок зачтён впервые (пак, ТЗ-5.1). */
  firstPass: boolean;
  /** Первый доигранный матч сегодня (ТЗ-10.9). */
  firstMatchToday: boolean;
  coins: number;
  /** Время финального свистка. */
  at: number;
}

/** Снимок до матча: берёт поток матча при `begin`. */
export interface MatchBefore {
  lessonId: string;
  league: string;
  /** Урок был в `course.passed`. */
  wasPassed: boolean;
  /** Лучшие звёзды урока до матча. */
  stars: number;
  /** День последнего доигранного матча (`YYYY-MM-DD`); null — не было. */
  lastDay: string | null;
}

/**
 * Снимок до матча из данных хранилища: лучшие звёзды урока и время последнего доигранного матча.
 * Урок был зачтён, если у него есть звёзды (зачёт всегда даёт ≥ 1 звезды). `dayOf` — местные сутки, их даёт приложение.
 */
export function beforeOf(
  lesson: { id: string; league: string },
  best: number,
  lastFinishedAt: number | null,
  dayOf: (t: number) => string,
): MatchBefore {
  return {
    lessonId: lesson.id,
    league: lesson.league,
    wasPassed: best > 0,
    stars: best,
    lastDay: lastFinishedAt === null ? null : dayOf(lastFinishedAt),
  };
}

export function summaryOf(
  info: MatchResultInfo,
  model: ResultModel,
  before: MatchBefore,
  today: string,
  at: number,
): MatchSummary {
  const passed = info.offer === null;
  return {
    lessonId: before.lessonId,
    league: before.league,
    kind: model.kind,
    outcome: info.outcome,
    passed,
    starsBefore: before.stars,
    starsAfter: passed ? Math.max(before.stars, model.stars) : before.stars,
    firstPass: passed && !before.wasPassed,
    firstMatchToday: before.lastDay !== today,
    coins: model.coins.coins,
    at,
  };
}
