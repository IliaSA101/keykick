/**
 * Куда вести игрока, когда `current` не годится (063 design §2, «`current` вне `order`»): закрытый пакет не загружен
 * или урок снят. Сохранение не правится — выбор делается на лету и только для показа (Дом, Т7).
 */
import type { CourseProgress, LessonMark } from './reconcile';

const passed = (m: LessonMark | undefined): boolean => m !== undefined && (m.stars > 0 || m.done !== undefined);

/**
 * Урок, с которого продолжать: `current`, если он в `order`; иначе первый непройденный урок `order`;
 * все пройдены — первый (повторять есть что); `order` пуст — `null`. Вход не меняется.
 */
export function resumeLesson(progress: Pick<CourseProgress, 'current' | 'lessons'>, order: readonly string[]): string | null {
  if (order.includes(progress.current)) return progress.current;
  const lessons = progress.lessons;
  const open = order.find((id) => !passed(Object.hasOwn(lessons, id) ? lessons[id] : undefined));
  return open ?? order[0] ?? null;
}
