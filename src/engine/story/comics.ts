/**
 * Комиксы Двора (068 Т3, story.md §1, §4а): какой комикс пора показать на входе в Дом и отметка «показан».
 * «Завязка» — первый вход на Дом (068-Р7); «Выход из группы», «Финал», «Финал — серебро» — по вехам Кубка.
 * Победа после серебра — комикс «Финал» (серебряный показан один раз и не повторяется).
 */
import type { Milestones } from './papers';
import type { ComicId, Story } from './section';

/** Первый непоказанный комикс по порядку «Завязка → группа → финал/серебро»; `null` — нечего показывать. */
export function dueComic(story: Story, cup: Milestones): ComicId | null {
  const wanted: ComicId[] = ['intro'];
  if (cup.group) wanted.push('group');
  if (cup.final === 'gold') wanted.push('final');
  if (cup.final === 'silver') wanted.push('silver');
  return wanted.find((id) => story.comics[id] === undefined) ?? null;
}

/** Флаг ставится при открытии окна (перезагрузка — не повтор). */
export const markComicShown = (story: Story, id: ComicId, day: number): Story => (story.comics[id] === undefined ? { ...story, comics: { ...story.comics, [id]: day } } : story);
