/**
 * «Путь клуба» (спека 019, design §6, ТЗ-1.3, 0.4, 1.2, 14.6): шесть мест лиг по пройденному.
 * Чистая функция без Vue и DOM; кубок и «Школа» в прохождении лиги не участвуют (ТЗ-0.4).
 */
import type { CourseLesson, League } from '../course/model';

export type PathState = 'done' | 'current' | 'building' | 'next' | 'fog';

export interface PathPlace {
  league: string;
  state: PathState;
  /** Число клавиш лиги — для подписи следующего и строящегося места; у остальных `null`. */
  keys: number | null;
  /** Сколько уроков лиги пройдено из скольких — только у текущего места с уроками в контенте (019-Р37); иначе `null`. */
  progress: { done: number; total: number } | null;
  /** Номер текущего урока лиги (первый не пройденный) — для кнопки «К уроку N»; иначе `null`. */
  lessonN: number | null;
  /** Кубок мира виден всегда, даже в тумане (ТЗ-1.3, 012-Р23). */
  alwaysVisible: boolean;
}

/** Лига пройдена ⇔ пройден её последний урок. Лига без уроков в контенте (`frame`) не пройдена. */
export function leagueDone(league: League, lessons: readonly CourseLesson[], passed: readonly string[]): boolean {
  const own = lessons.filter((l) => l.league === league.id);
  if (own.length === 0) return false;
  const last = own.reduce((a, b) => (b.n > a.n ? b : a));
  return passed.includes(last.id);
}

/** Сколько клавиш в наборе лиги: знаки без пробелов (точка у Города и цифры у Европы считаются). */
export function keyCount(league: League): number {
  return [...league.keys].filter((ch) => ch.trim() !== '').length;
}

/** Места пути, по одному на лигу, в порядке `leagues`.
 * Пока Район (заготовка) «строится», он и есть следующее место: «следующим» Город не показываем, он в тумане (019-Р37). */
export function pathModel(leagues: readonly League[], lessons: readonly CourseLesson[], passed: readonly string[]): PathPlace[] {
  const firstOpen = leagues.findIndex((l) => !leagueDone(l, lessons, passed));
  const firstState: PathState = firstOpen !== -1 && leagues[firstOpen]!.depth === 'frame' && firstOpen > 0 ? 'building' : 'current';
  return leagues.map((league, i) => {
    let state: PathState;
    if (firstOpen === -1 || i < firstOpen) state = 'done';
    else if (i === firstOpen) state = firstState;
    else if (i === firstOpen + 1 && firstState !== 'building') state = 'next';
    else state = 'fog';
    const own = state === 'current' ? lessons.filter((l) => l.league === league.id).sort((a, b) => a.n - b.n) : [];
    const open = own.find((l) => !passed.includes(l.id));
    return {
      league: league.id,
      state,
      keys: state === 'next' || state === 'building' ? keyCount(league) : null,
      progress: own.length > 0 ? { done: own.filter((l) => passed.includes(l.id)).length, total: own.length } : null,
      lessonN: open ? open.n : null,
      alwaysVisible: i === leagues.length - 1,
    };
  });
}
