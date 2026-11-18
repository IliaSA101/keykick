/**
 * Звёзды урока и точность итога (ТЗ-4.1, 2.6, 2.18; 017 §3). Звёзды — только печатью: гол пенальти ни победу,
 * ни «всухую» не делает. Точность в тысячных — одна функция для звёзд и для строки итога (ТЗ-2.18).
 */
import cfg from '../../content/match.json';
import type { TypingStats } from '../typing/typing';
import type { MatchResult } from './types';

export type Stars = 0 | 1 | 2 | 3;

/** Точность в тысячных (вниз: 96,9 % не превращается в 97 %); до первого нажатия — 1000. */
export function permille(stats: Pick<TypingStats, 'correct' | 'errors'>): number {
  const total = stats.correct + stats.errors;
  return total === 0 ? 1000 : Math.floor((stats.correct * 1000) / total);
}

/** Помощь урока при матче: без неё, «с запасом» или «с тренером» (ТЗ-2.9). */
export type Assist = 'none' | 'reserve' | 'coach';

export interface StarOpts {
  assist?: Assist;
  /** Урок идёт смягчённой копией (после прохода предыдущего с помощью, 017-Р8): не выше ★★. */
  softened?: boolean;
  /** Матч чемпионата звёзд не даёт (ТЗ-4.1). */
  championship?: boolean;
  /** Порог ★★★ в долях; по умолчанию — `match.json`. */
  threeStar?: number;
}

/** Потолок звёзд при помощи: «с запасом» и смягчение — ★★, «с тренером» — ★ (ТЗ-2.9). */
export function starCap(assist: Assist, softened = false): Stars {
  const caps = [assist === 'coach' ? cfg.help.coachCap : 3, assist === 'reserve' ? cfg.help.reserveCap : 3, softened ? cfg.help.softenCap : 3];
  return Math.min(...caps) as Stars;
}

/**
 * Звёзды матча: ★ — победа печатью, ★★ — всухую, ★★★ — всухую и точность печати не ниже порога; потолок помощи сверху.
 * Победа только с пенальти (1:1 + гол = 2:1) — пройден, звёзд 0.
 */
export function starsOf(result: Pick<MatchResult, 'score' | 'play'>, opts: StarOpts = {}): Stars {
  if (opts.championship) return 0;
  const { score, play } = result;
  if (score.me <= score.opp) return 0;
  const threshold = Math.round((opts.threeStar ?? cfg.threeStar) * 1000);
  const raw: Stars = score.opp > 0 ? 1 : permille(play) < threshold ? 2 : 3;
  return Math.min(raw, starCap(opts.assist ?? 'none', opts.softened)) as Stars;
}

/** Новые звёзды сверх лучшего результата урока (ТЗ-4.1); лучшее не убывает. */
export const newStars = (stars: Stars, best: number): number => Math.max(0, stars - best);
