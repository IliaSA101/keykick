/**
 * Дом «на середине Двора» для витрины (063-Р61, Т12б): вход правил Дома из выдуманного прогресса — первые `lesson − 1` уроков
 * пройдены, текущий — `lesson`. Тот же `homeInputOf`, что у настоящего игрока и у фона первого запуска; сохранение не читается
 * и не пишется (чистая функция: порядок уроков и «сегодня» приходят снаружи).
 */
import type { ClubKit } from '../../engine/club/section';
import { emptyDay } from '../../engine/day/section';
import type { HomeInput } from '../../engine/home';
import { homeInputOf, type HomeSections } from './input';
import { providedExtras } from './provide';

/** Звёзды за первые 16 уроков — как на принятом кадре Дома (Э2.04: 24 из 48 после 16 уроков). */
const STARS: readonly (0 | 1 | 2 | 3)[] = [3, 3, 2, 1, 2, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1];
/** Рекорд текущего урока — 24 знака, как на кадре. */
const BEST = 24;
/** Форма выдуманного клуба: зелёное с белым (023-Р30); от неё — цвет людей на трибуне. */
export const PREVIEW_KIT: ClubKit = { pattern: 'plain', body: '#2f9a27', sleeves: '#ffffff', trim: '#ffffff' };

const HOUR_MS = 3_600_000;

/** Разделы выдуманного игрока: `lesson − 1` пройденных уроков по порядку пакета, девятый день, 31 матч, 89 монет. */
export function previewSections(order: readonly string[], lesson: number, today: string): HomeSections {
  const lessons: HomeSections['course']['lessons'] = {};
  order.slice(0, lesson - 1).forEach((id, i) => {
    lessons[id] = { stars: STARS[i % STARS.length]!, best: 0, tries: 1, done: today, fails: 0 };
  });
  const current = order[lesson - 1] ?? '';
  if (current !== '') lessons[current] = { stars: 0, best: BEST, tries: 1, fails: 0 };
  return {
    course: { current, lessons, archive: {}, leaguesDone: {} },
    day: { ...emptyDay(), played: 31, days: 9, today, todayN: 1, last: Date.parse(`${today}T12:00:00Z`) - HOUR_MS },
    wallet: { coins: 89, rest: 0, paid: [] },
    stadium: { fans: 11780, goals: 0 },
  };
}

/** Вход Дома выдуманного игрока на уроке `lesson` — через тот же `homeInputOf`, что у настоящего. */
export function previewInputOf(order: readonly string[], lesson: number, today: string): HomeInput {
  return homeInputOf(previewSections(order, lesson, today), { order, friendly: new Set() }, providedExtras(), today);
}
