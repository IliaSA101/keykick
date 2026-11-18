/**
 * Точка входа схем контента: типы для других подсистем и проверки под именами по файлам
 * (у каждой схемы своя `check`, поэтому наружу — с префиксом).
 */
export type { Layout, LayoutKey, LayoutOs, Finger } from './layout';
export type { Course } from './course';
export type { LeagueFrame, LeagueStatus, Layer } from './leagues';
export type { CourseText, LeagueText } from './text';
export type { Registry } from './ids';
export { check as checkIds, ID_RE } from './ids';
export { check as checkLayout, FINGERS } from './layout';
export { check as checkCourse } from './course';
export { check as checkLeagues, checkFrame as checkLeagueFrame, LAYERS, STATUSES } from './leagues';
export { check as checkCourseText } from './text';
export type { Pack, PackAccess, PackLesson, PackLessons, PackManifest, PackText } from './pack';
export { check as checkPackManifest, checkLessons as checkPackLessons, checkText as checkPackText, ACCESS } from './pack';
