/**
 * Вход фактов выпуска (`PaperIn`) из разделов сеанса (068 Т7): одно место, откуда Дом, Музей и стенд кадров берут числа газеты.
 * Чистая функция: Vue и DOM не нужны — разделы и семя приходят снаружи.
 */
import type { CourseProgress } from '../../engine/course/reconcile';
import { cupDef, seedOf, type Cup } from '../../engine/cup';
import { emptyDay, type Day } from '../../engine/day/section';
import type { Stadium } from '../../engine/home/section';
import { emptySchool, type School } from '../../engine/school/section';
import { storyDef, type Story } from '../../engine/story';
import type { PaperIn } from './paperFacts';

export interface PaperSections {
  story: Story;
  cup: Cup;
  school: School;
  stadium: Stadium;
  day: Day;
  course: CourseProgress;
  /** Семя Кубка игрока (`seedOf`). */
  seed: number;
}

/** Лучшая скорость клуба — лучший `best` по урокам курса; уроков с результатом нет — 0. */
export const bestSpeedOf = (course: CourseProgress): number => Object.values(course.lessons).reduce((m, l) => Math.max(m, l.best ?? 0), 0);

export function paperInOf(s: PaperSections): PaperIn {
  return { story: s.story, cup: s.cup, school: s.school, fans: s.stadium.fans, goals: s.stadium.goals, played: s.day.played, bestSpeed: bestSpeedOf(s.course), seed: s.seed };
}

/** Разделы выпуска из сеанса: `data` — чтение раздела игрока (`useHomeInput`), `pid` — игрок (семя Кубка). Одно место для входа на Дом, окна выпуска и стенда. */
export function paperSectionsOf(data: <T>(name: string, empty: T) => T, pid: string): PaperSections {
  return {
    story: data<Story>(storyDef.name, storyDef.empty()),
    cup: data<Cup>(cupDef.name, cupDef.empty()),
    school: data<School>('school', emptySchool()),
    stadium: data<Stadium>('stadium', { fans: 0, goals: 0 }),
    day: data<Day>('day', emptyDay()),
    course: data<CourseProgress>('course:ru', { current: '', lessons: {}, archive: {}, leaguesDone: {} }),
    seed: seedOf(pid),
  };
}
