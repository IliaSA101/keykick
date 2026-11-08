/**
 * Матч v2 (спека 017, Т5а): правила из `content/match.json`, тексты атак от генератора курса (016),
 * сборка `MatchConfig` для машины. Часы и случайность сюда не заходят: зерно приходит параметром.
 */
import clubsJson from '../../content/clubs.json';
import matchJson from '../../content/match.json';
import { parseStreets, yardRival, type YardRival } from '../../engine/club/rival';
import type { KitColors } from '../../engine/kit';
import { ru } from '../../i18n/ru';
import { coachLesson } from '../../engine/match/lessonCopy';
import { makeCourseHalf, makeCourseWarmup, makeExtraAttack } from '../../engine/course/attack';
import type { CourseLesson } from '../../engine/course/model';
import { kickTask } from '../../engine/match/kick';
import type { MatchConfig, MatchTexts } from '../../engine/match/machine';
import { parseMatchRules } from '../../engine/match/rules';
import { courseLessons, dictionary } from '../course/load';
import { clubData } from '../kits';
import { keymap } from '../keymap';
import { tasks } from '../tasks';

/** Правила матча; ошибка в JSON роняет загрузку с адресом поля. */
export const matchRules = parseMatchRules(matchJson, keymap);

/** Улицы соперников Двора (форма после «на»); ошибка в JSON роняет загрузку. */
export const yardStreets = parseStreets(clubsJson);

/**
 * Соперник матча: «Двор на <улица>» города клуба, форма не похожа на `kit` (ту, в которой играем). Одно зерно —
 * тот же соперник, поэтому «Ещё раз» в одном экране играет с ним же (019-Р17).
 */
export const matchRival = (club: { city: string; kit: KitColors }, seed: number): YardRival =>
  yardRival(clubData, yardStreets, club, seed, (street) => ru.match2.yardRival.replace('{street}', street));

export const lessonById = (id: string): CourseLesson | undefined => courseLessons.find((l) => l.id === id);

/** Тексты атак урока: обёртки над `makeCourse*`; тренер — на копии `coachLesson` (контракт 016-Р10). */
export function courseTexts(lesson: CourseLesson): MatchTexts {
  return {
    warmup: (seed) => makeCourseWarmup(lesson, dictionary, keymap, seed),
    half: (seed, second) => makeCourseHalf(lesson, dictionary, keymap, seed, undefined, second),
    extra: (seed) => makeExtraAttack(lesson, dictionary, keymap, seed),
    coachLine: (keys, seed) => makeCourseHalf(coachLesson(lesson, keys), dictionary, keymap, seed)[0] ?? '',
  };
}

export interface ConfigOptions {
  /** Лучшие звёзды по уроку до матча. */
  best?: number;
  /** Урок идёт смягчённой копией (017-Р8). */
  softened?: boolean;
  /** Матч кубка. */
  kind?: 'lesson' | 'cup';
  /** Урок оплачивается (`isPaid`); по умолчанию — да. */
  paid?: boolean;
  /** Решённые задачи пенальти («Знаток»). */
  solved?: readonly string[];
  /** Зерно выбора задачи пенальти. */
  seed: number;
  texts?: MatchTexts;
}

/** Настройка машины для урока; пенальти — задача `kickTask` (v1 `pickQuick`, до 024). */
export function matchConfig(lesson: CourseLesson, o: ConfigOptions): MatchConfig {
  const solved = o.solved ?? [];
  return {
    lesson,
    softened: o.softened ?? false,
    kind: o.kind ?? 'lesson',
    best: o.best ?? 0,
    paid: o.paid ?? true,
    rules: matchRules,
    map: keymap,
    texts: o.texts ?? courseTexts(lesson),
    kickTask: (seed, done) => kickTask(tasks, seed, done)?.id ?? null,
    solved,
  };
}
