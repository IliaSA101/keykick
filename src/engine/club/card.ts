/**
 * Карточка клуба для окна «Клуб» (ТЗ-1.13, 5.13): числа из разделов сохранения, строка «На спине», трудные клавиши.
 * Чистые функции: ни хранилища, ни часов. Монеты и звёзды сюда не входят.
 */
import type { CourseProgress } from '../course/reconcile';

/** Сколько трудных клавиш показываем и сколько из них берёт «Минута тренера» (ТЗ-1.13, 7.11). */
export const HARD_SHOWN = 3;
export const HARD_MINUTE = 2;

export interface ClubCardInput {
  /** Доигранные матчи (`day.played`), голы (`stadium.goals`), решённые задачи (`school.solved.length`). */
  played: number;
  goals: number;
  solved: number;
  course: Pick<CourseProgress, 'lessons' | 'archive'>;
  /** Трудные клавиши от поставщика: в сохранении ошибок по клавишам нет (067 Т11). */
  hardKeys: readonly string[];
}

export interface ClubCard {
  matches: number;
  goals: number;
  tasks: number;
  /** Лучшая скорость, знаков в минуту, среди всех уроков; 0 — ещё не играл. */
  bestSpeed: number;
  /** До трёх клавиш заглавными, без повторов. */
  hard: string[];
  /** Клавиши для подписи «подтянет «Минута тренера»» — первые две. */
  minute: string[];
}

/** Лучшая скорость по отметкам уроков (основные и архивные). */
export function bestSpeed(course: Pick<CourseProgress, 'lessons' | 'archive'>): number {
  let best = 0;
  for (const m of [...Object.values(course.lessons), ...Object.values(course.archive)]) if (m.best > best) best = m.best;
  return best;
}

/** Не больше `HARD_SHOWN` разных непустых клавиш заглавными, порядок сохраняется. */
export function hardKeysOf(keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const key = k.trim().toUpperCase();
    if (key !== '' && !out.includes(key)) out.push(key);
  }
  return out.slice(0, HARD_SHOWN);
}

export function clubCard(i: ClubCardInput): ClubCard {
  const hard = hardKeysOf(i.hardKeys);
  return { matches: i.played, goals: i.goals, tasks: i.solved, bestSpeed: bestSpeed(i.course), hard, minute: hard.slice(0, HARD_MINUTE) };
}

/** Строка «На спине»: «САША · 7»; чего нет в клубе — части в строке нет; обоих нет — пустая строка. */
export function backLine(name: string, number: number): string {
  return [name.trim().toUpperCase(), number > 0 ? String(number) : ''].filter((p) => p !== '').join(' · ');
}

/** Смена тренера: новый id из четырёх; неизвестный или тот же — `null` (клуб не меняем). */
export function swapCoach(current: string, next: string, known: readonly string[]): string | null {
  return next !== current && known.includes(next) ? next : null;
}
