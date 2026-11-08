/**
 * Матч v2 (спека 017, design §4–5, §11): копии урока — помощь, смягчение, минута тренера.
 * Генератор текста (`course/attack.ts`) читает `attacks`, `rows`, `ladder`, `focus`, `material`, но не `g`, `c`;
 * поэтому копия обязана держать лесенку в согласии с атаками (`attacks.length === ladder.length`, `model.ts`).
 */
import type { CourseLesson } from '../course/model';
import type { Help } from './verdict';

/** Помощь застрявшему: «с запасом» — c + 1, «с тренером» — g + 1 и c + 1; атаки и лесенка те же. */
export function withHelp(l: CourseLesson, help: Help): CourseLesson {
  if (help === 'none') return l;
  return { ...l, g: help === 'coach' ? l.g + 1 : l.g, c: l.c + 1 };
}

/**
 * Смягчение (017-Р8): после прохода урока N с помощью следующий урок идёт копией — буквы, фокус и материал N+1,
 * длины, строки и пороги N (не ниже, чем у N+1; без надбавок помощи). Срок — до прохода N+1.
 * Лесенка N+1 обрезана по числу атак N; если атак стало больше, недостающие ступени берёт генератор из `material`.
 */
export function soften(next: CourseLesson, passed: CourseLesson): CourseLesson {
  return {
    ...next,
    attacks: [...passed.attacks],
    rows: passed.rows,
    g: Math.max(next.g, passed.g),
    c: Math.max(next.c, passed.c),
    ladder: next.ladder.slice(0, passed.attacks.length),
  };
}

/**
 * Минута тренера (контракт 016-Р10): пары на самых ошибочных клавишах, одна строка длиной `rowWidth`,
 * лесенка из одной ступени. Поля `coach.len` нет.
 */
export function coachLesson(l: CourseLesson, keys: string): CourseLesson {
  return { ...l, focus: keys, focusWeak: 0, material: 'pairs', ladder: ['pairs'], noWords: true, attacks: [l.rowWidth], rows: 1 };
}
