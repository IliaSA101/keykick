/**
 * Урок матча Кубка (ТЗ-8.3, 8.4, 068 К-Б): всё пройденное к якорю, слабые клавиши чаще (по рангам пальцев формы), строгость — как у якоря,
 * печати на 21–24 % больше. Матч группы — без доп. времени (`extraTime`, ТЗ-8.5, 068-Р3), плей-офф — с ним, затем серия. Чистая функция.
 */
import cfg from '../../content/match.json';
import { rank, type FormState } from '../form/rank';
import type { CourseLesson } from '../plan/lesson';
import { lettersOf, unique } from '../plan/lessonModel';
import { KO_ROUNDS } from './rounds';
import type { RoundKey } from './types';

/** Во сколько раз атаки Кубка длиннее атак урока-якоря: середина вилки 21–24 % (ТЗ-8.3). */
export const CUP_BOOST = 1.225;

/** Доп. время (и серия) — только в плей-офф; матч группы кончается ничьей (флаг `extra` старта матча). */
export const extraTime = (round: RoundKey): boolean => (KO_ROUNDS as readonly string[]).includes(round);

/** Клавиши двух самых слабых пальцев по рангу формы среди букв `letters`; все пальцы одного ранга — пусто (слабых нет). */
export function weakFingerKeys(form: FormState, letters: readonly string[]): string {
  const fingers = cfg.squad
    .map((p) => ({ keys: Array.from(p.keys).filter((c) => letters.includes(c)), rank: rank(form, p.finger) }))
    .filter((p) => p.keys.length > 0);
  if (fingers.length === 0) return '';
  const low = Math.min(...fingers.map((p) => p.rank));
  if (fingers.every((p) => p.rank === low)) return '';
  return fingers
    .filter((p) => p.rank === low)
    .slice(0, 2)
    .map((p) => p.keys.join(''))
    .join('');
}

/**
 * Урок матча по якорю `anchor` (номер урока в лиге, с 1): буквы всех пройденных уроков до якоря включительно, фокус — слабые пальцы плюс фокус якоря,
 * `g` и `c` не строже якоря, атаки ×`CUP_BOOST` (строк столько, чтобы они легли). Урока-якоря в курсе нет — `null`.
 */
export function cupLesson(anchor: number, course: readonly CourseLesson[], form: FormState): CourseLesson | null {
  const base = course.find((l) => l.n === anchor);
  if (base === undefined) return null;
  const keys = unique(course.filter((l) => l.n <= anchor).map((l) => l.keys).join('')).join('');
  const weak = weakFingerKeys(form, lettersOf({ keys }));
  const attacks = base.attacks.map((a) => Math.round(a * CUP_BOOST));
  const rows = Math.max(base.rows, Math.ceil(Math.max(...attacks) / base.rowWidth));
  return {
    ...base,
    id: `${base.id.replace(/\.[^.]+$/, '')}.cup-${anchor}`,
    friendly: false,
    control: false,
    keys,
    newKeys: '',
    focus: unique(weak + base.focus).join(''),
    focusWeak: Math.max(base.focusWeak, 2),
    attacks,
    rows,
    tips: [],
  };
}
