/**
 * Очередь окон входа на Дом (068 Т3, ТЗ-10.11; 067 К-Б): за вход — одно сюжетное окно (комикс, выпуск, «Права на компьютер»),
 * затем праздники. Чистые функции от разделов; «Права» — поставщик волны 4 (067 ТЗ-7.6), сюда приходит флагом.
 */
import { dueComic } from './comics';
import { unshownPaper, type Milestones } from './papers';
import type { ComicId, Story } from './section';

export type EntryWindow = { kind: 'comic'; id: ComicId } | { kind: 'paper'; n: number } | { kind: 'rights' };

export interface EntryInput {
  story: Story;
  cup: Milestones;
  /** «Права на компьютер» ждут показа (067 ТЗ-7.6). */
  rights?: boolean;
}

/** Сюжетное окно входа: комикс раньше выпуска, выпуск раньше «Прав»; нет — `null`. Не больше одного (С1). */
export function entryWindow(i: EntryInput): EntryWindow | null {
  const comic = dueComic(i.story, i.cup);
  if (comic !== null) return { kind: 'comic', id: comic };
  const paper = unshownPaper(i.story);
  if (paper !== null) return { kind: 'paper', n: paper };
  return i.rights === true ? { kind: 'rights' } : null;
}
