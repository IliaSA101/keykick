/**
 * Лестница помощи застрявшему (ТЗ-2.9, 017 §4) и возврат после паузы (ТЗ-2.11). Чистые функции от счётчика провалов подряд:
 * сам счётчик лежит в отметке урока (`fails`, 065-Р9), пишет его касса матча (`finishMatch`).
 */
import cfg from '../../content/match.json';
import type { CourseLesson } from '../plan/lesson';
import type { Assist } from './stars';

/** Что предложить после `fails` провалов подряд: ничего, минуту тренера, «с запасом» или «с тренером». */
export type Help = 'none' | 'minute' | 'reserve' | 'coach';

export type HelpCfg = Pick<typeof cfg.help, 'coachAt' | 'reserveAt' | 'coachHelpAt'>;

/** 2-й провал — минута тренера; 3–4-й — «с запасом»; 5-й и дальше — «с тренером» (ТЗ-2.9). */
export function helpOf(fails: number, rules: HelpCfg = cfg.help): Help {
  if (fails >= rules.coachHelpAt) return 'coach';
  if (fails >= rules.reserveAt) return 'reserve';
  return fails >= rules.coachAt ? 'minute' : 'none';
}

/** Помощь, меняющая правила матча: минута тренера — отдельный блок, правила урока не трогает. */
export const assistOf = (help: Help): Assist => (help === 'reserve' || help === 'coach' ? help : 'none');

/** «На сегодня хватит» рядом с помощью: с 3-го провала (017 §4, 017-Р12). */
export const restOffered = (fails: number, rules: HelpCfg = cfg.help): boolean => fails >= rules.reserveAt;

/** Пороги урока при помощи: «с запасом» — c+1; «с тренером» — g+1 и c+1 (ТЗ-2.9). */
export function assistRules(lesson: Pick<CourseLesson, 'g' | 'c'>, assist: Assist): { g: number; c: number } {
  if (assist === 'none') return { g: lesson.g, c: lesson.c };
  return { g: lesson.g + (assist === 'coach' ? 1 : 0), c: lesson.c + 1 };
}

/** Счётчик провалов подряд после матча: проход сбрасывает, провал (в т. ч. переигровка тайма) добавляет. */
export const failsAfter = (fails: number, passed: boolean): number => (passed ? 0 : fails + 1);

/** Метка «вернуться за звёздами»: проход с помощью ставит, проход без помощи снимает, провал не меняет. */
export const backAfter = (back: boolean, assist: Assist, passed: boolean): boolean => (passed ? assist !== 'none' : back);

/** Смягчение следующего урока (017-Р8): буквы и материал свои, длины и пороги — не слабее пройденного с помощью. */
export function soften(next: CourseLesson, passed: CourseLesson): CourseLesson {
  return { ...next, attacks: passed.attacks, rows: passed.rows, g: Math.max(next.g, passed.g), c: Math.max(next.c, passed.c) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** «Капитан вернулся!» — прошло не меньше `comebackDays` суток с последнего доигранного матча (ТЗ-2.11). */
export const isComeback = (lastFinishedAt: number | null, now: number, days: number = cfg.comebackDays): boolean =>
  lastFinishedAt !== null && now - lastFinishedAt >= days * DAY_MS;
