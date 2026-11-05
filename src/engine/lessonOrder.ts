/**
 * Урок игрока в сохранении (спека 007): до 007 он хранился только номером в списке уроков, и
 * любая вставка урока сдвинула бы игроков. Теперь рядом с номером пишется id (lessonId), а номер
 * выводится из него при разборе (007-Р1). Сохранения без id читаются по старому порядку.
 */

/**
 * Порядок уроков до 007 — 34 id, как в lessons.json на 05.11. Замороженный: не правится никогда,
 * даже если уроки вставят или переставят, — по нему читаются номера старых сохранений.
 */
export const LEGACY_ORDER: readonly string[] = Object.freeze([
  ...['yard-1', 'yard-2', 'yard-3', 'yard-4', 'yard-5', 'yard-6', 'yard-7', 'yard-8', 'yard-9', 'yard-10'],
  ...['yard-11', 'yard-12', 'district-1', 'district-2', 'district-3', 'district-4', 'district-5'],
  ...['district-6', 'district-7', 'district-8', 'district-9', 'district-10', 'district-11', 'district-12'],
  ...['city-1', 'city-2', 'city-3', 'city-4', 'city-5', 'city-6', 'city-7', 'city-8', 'city-9', 'city-10'],
]);

/** Что о месте игрока лежит в сохранении: id как есть (может быть мусором) и номер, уже целый и ≥ 0. */
export interface LessonPlace {
  lessonId: unknown;
  lessonIndex: number;
}

/**
 * Номер урока игрока в нынешнем списке lessonIds:
 * - id есть в списке — по id, номер не важен (id и номер расходятся — верим id);
 * - поля id нет (сохранение до 007) — номер старый: id берётся из LEGACY_ORDER, за пределом — последний старый;
 * - id чужой или битый, либо старого урока больше нет — по номеру с обрезкой до последнего.
 */
export function resolveLessonIndex(place: LessonPlace, lessonIds: readonly string[]): number {
  const last = Math.max(0, lessonIds.length - 1);
  const byNumber = Math.min(place.lessonIndex, last);
  if (place.lessonId === undefined) {
    const old = LEGACY_ORDER[Math.min(place.lessonIndex, LEGACY_ORDER.length - 1)];
    const at = old === undefined ? -1 : lessonIds.indexOf(old);
    return at >= 0 ? at : byNumber;
  }
  const at = typeof place.lessonId === 'string' ? lessonIds.indexOf(place.lessonId) : -1;
  return at >= 0 ? at : byNumber;
}
