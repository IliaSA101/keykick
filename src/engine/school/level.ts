/**
 * Класс и уровень (025 А7-Р1, Р2, Р4, Р5): класс игрока — `school.grade`; задача — класс, линия темы и уровень 1…3;
 * уровень линии растёт на 1 после двух туров этой линии подряд с медалью не ниже серебра и падает на 1 после двух без медали (серия — `school.streak`).
 * В банке пока нет полей `grade` и `line` (их заводит контент) — тогда задача годится любому классу, линия одна.
 */
import cfg from '../../content/school.json';
import { normalizeWord } from './answers';
import type { School } from './section';
import type { Task } from './tasks';

/** Задача с необязательными полями контента: класс 1…8 и линия темы. */
export type LineTask = Task & { grade?: number; line?: string };

export const DEFAULT_LINE = 'main';

export const lineOf = (t: Task): string => (t as LineTask).line ?? DEFAULT_LINE;

/** Класс задачи годится игроку: у задачи класса нет, у игрока класса нет или задача не старше его класса. */
export function gradeOk(t: Task, grade: number | null): boolean {
  const g = (t as LineTask).grade;
  return g === undefined || grade === null || g <= grade;
}

/** Класс 1…8 — вопрос Э3.08 один раз; вне диапазона — как есть, без изменения. */
export function setGrade(school: School, grade: number): School {
  return Number.isInteger(grade) && grade >= 1 && grade <= 8 ? { ...school, grade } : school;
}

/** Слово задачи не требует невыученных букв (ТЗ-6.11, Ш-З6); `letters` не задан — без проверки. */
export function lettersOk(t: Task, letters: string | undefined): boolean {
  if (letters === undefined || t.answer.kind !== 'text') return true;
  return t.answer.accepted.every((w) => [...normalizeWord(w)].every((c) => letters.includes(c)));
}

/**
 * Выученные буквы Двора (ТЗ-6.11): новые буквы ступеней до ступени текущего урока включительно — её буквы ребёнок уже видел.
 * Ступени — из пакета лиги (`stages`), номер ступени урока — `stageOf` Дома; сюда приходит числом, чтобы файл не знал Двора.
 */
export function lettersLearned(stages: readonly { n: number; newKeys: string }[], stage: number): string {
  return stages.filter((s) => s.n <= stage).map((s) => s.newKeys).join('');
}

export const levelOf = (school: School, line: string): number => school.level[line] ?? cfg.level.start;

/**
 * Шаг уровня линии после тура (А7-Р5): медаль тура копится в серии линии (не больше двух последних). Обе ≥ серебра — +1
 * (до 3), обе без медали — −1 (до 1), и серия начинается заново; иначе окно сдвигается — тур, уже решивший шаг, второй раз
 * не считается. Линии не смешиваются, длина журнала не важна.
 */
export function bumpLevel(school: School, line: string, medal: number): Pick<School, 'level' | 'streak'> {
  const cur = levelOf(school, line);
  const run = [...(school.streak?.[line] ?? []), medal].slice(-2);
  const up = run.length === 2 && run.every((m) => m >= cfg.level.upMedal);
  const down = run.length === 2 && run.every((m) => m === 0);
  const next = up ? Math.min(cfg.level.max, cur + 1) : down ? Math.max(1, cur - 1) : cur;
  const streak = { ...school.streak, [line]: up || down ? [] : run };
  return { level: next === cur ? school.level : { ...school.level, [line]: next }, streak };
}
