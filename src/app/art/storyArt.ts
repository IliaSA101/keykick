/**
 * Графика Кубка и сюжета (068 Т4): манифест `content/story-art.json` (имя → файл в `public/`). Грузится по требованию
 * экраном Кубка, газетой и комиксами — в первую загрузку Дома не входит (тест веса `tests/art/art.test.ts`).
 */
import manifest from '../../content/story-art.json';

export type StoryArtKey = keyof typeof manifest.files;

/** Полный адрес картинки с учётом подраздела /keykick/ на GitHub Pages. */
export function storyArtUrl(key: StoryArtKey): string {
  return import.meta.env.BASE_URL + manifest.files[key];
}

/** Адрес ролика титула Двора (по запросу, ТЗ-9.7). */
export function yardTitleVideoUrl(): string {
  return import.meta.env.BASE_URL + manifest.video.yardTitle;
}
