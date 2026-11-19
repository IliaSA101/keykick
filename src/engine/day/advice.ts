/**
 * Строка тренера в итоге матча (068 Т3, ТЗ-9.9, 10.4; story.md §4): совет ритма или «пальцы устали». Чистые функции:
 * день приходит снаружи, ключи и числа — тексты в `src/i18n`. Раз в игровой день одна из двух строк (С5).
 */
import { median } from '../learn/rate';
import type { Story } from '../story/section';
import { ACC_KEEP, type Day } from './section';

/** Порог ТЗ-10.4: на столько ‰ точность ниже нормы (3 п. п.). */
export const TIRED_DROP = 30;
/** Игровой день, с которого совет — после второго матча (story.md §4). */
export const ADVICE_FROM_DAY = 5;

export type CoachLine = 'advice' | 'tired';

export interface AdviceSave {
  day: Day;
  story: Story;
}

/**
 * Точность последних двух матчей ступени и норма (медиана пяти последних матчей этой ступени, 068-Р18) для «пальцы устали»;
 * `null` — нормы нет (меньше пяти матчей ступени) или два последних матча не оба ≥ 3 п. п. ниже нормы. Два последних матча
 * входят в окно нормы — медиана почти не зависит от них, пока хотя бы три матча из пяти «обычные».
 */
export function tiredNorm(day: Day, stage: number): { acc: number; norm: number } | null {
  const w = day.acc?.[String(stage)] ?? [];
  if (w.length < ACC_KEEP) return null;
  const norm = median(w);
  const last2 = w.slice(-2);
  if (!last2.every((a) => a <= norm - TIRED_DROP)) return null;
  return { acc: Math.round((last2[0]! + last2[1]!) / 2 / 10), norm: Math.round(norm / 10) };
}

/**
 * Какая строка тренера после матча ступени `stage` в игровой день `today` (дата): `tired` — два последних доигранных матча
 * одного урока в этот день (серия `day.series`, через день счёт заново; первый матч урока — не серия) оба ≥ 3 п. п. ниже
 * нормы ступени, вместо совета; `advice` — дни 1–4 после 1-го матча дня, с 5-го после 2-го; `null` — не сегодня или уже было.
 */
export function coachLine(save: AdviceSave, today: string, stage: number): CoachLine | null {
  const d = save.day;
  if (d.today !== today || d.todayN < 1) return null;
  if (save.story.adviceDay === d.days || save.story.tiredDay === d.days) return null;
  if (d.series?.day === today && d.series.n >= 2 && tiredNorm(d, stage) !== null) return 'tired';
  return d.todayN >= (d.days < ADVICE_FROM_DAY ? 1 : 2) ? 'advice' : null;
}

/** Строка показана — день записан: повтора в этот игровой день нет. */
export const markCoachLine = (story: Story, line: CoachLine, days: number): Story => (line === 'advice' ? { ...story, adviceDay: days } : { ...story, tiredDay: days });
