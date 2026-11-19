/**
 * Чистые правила листа газеты (068 Т7, 050-Р46/Р48): клавиши окна, «длинное имя», заголовок без имени, картинки «фото».
 * Vue и DOM тут нет — компонент передаёт события и числа, тест гоняет функции в обычном node.
 */
import { enterAllowed, ENTER_DELAY } from '../panel/focusCycle';
import { storyArtUrl, type StoryArtKey } from '../../app/art/storyArt';
import type { PaperView } from '../../app/story/paperView';
import { fill } from '../../app/home/texts';
import { ru } from '../../i18n/ru';

/** Имя клуба длиннее этого — шапка в две строки: «Газета клуба» мелко над именем, заголовок без имени (макет Э6.01). */
export const LONG_CLUB = 20;

export const isLongClub = (club: string): boolean => club.length > LONG_CLUB;

/** Клавиша окна газеты: Esc и Enter закрывают (Enter — не раньше паузы после открытия и не при удержании, как в окнах цепочки). */
export function newsKey(press: { key: string; repeat: boolean; openedAt: number; now: number }): 'close' | null {
  if (press.key === 'Escape') return 'close';
  if (press.key === 'Enter' && enterAllowed({ repeat: press.repeat, openedAt: press.openedAt, now: press.now, delay: ENTER_DELAY })) return 'close';
  return null;
}

/** Заголовок длинного клуба: имя в кавычках не повторяется (оно в шапке): «новый клуб «X»!» → «новый клуб!», иначе «X» → «Клуб». */
export function headWithoutClub(head: string, club: string): string {
  const quoted = `«${club}»`;
  const word = ru.parent.clubOf;
  const clubCap = ru.frame.menu.club;
  return head.replace(`${word} ${quoted}`, word).replace(quoted, clubCap);
}

/** Ключ картинки «фото» светлой выпечки: `ph-<id>-l-<ширина>`; широкая сцена берёт 1066 px, узкая — 562 px. */
export function photoKey(pic: Exclude<PaperView['pic'], 'title'>, wide: boolean): StoryArtKey {
  const id = pic === 'day1' ? 'Day1' : pic.charAt(0).toUpperCase() + pic.slice(1);
  return `storyPh${id}L${wide ? 1066 : 562}` as StoryArtKey;
}

const SHORT = new RegExp(`(?<=^|[\\s>;])(${ru.story.typo.short})\\s`, 'gi');

/** Короткие слова («в», «на», «к»…) не остаются в конце строки: после них неразрывный пробел; «—» держится за словом слева (как `nb` макета). */
export const nbText = (t: string): string => t.replace(SHORT, '$1\u00a0').replace(/\s·\s/g, '\u00a0·\u00a0').replace(/ — /g, '\u00a0— ');

/** Адрес светлого «фото» выпуска. */
export const photoUrl = (pic: Exclude<PaperView['pic'], 'title'>, wide: boolean): string => storyArtUrl(photoKey(pic, wide));

/**
 * Кнопки полочки окна выпуска (Э6.12): `close` — одна «{back} · Esc» (Дом, Музей); `home` — выпуск вместо полосы в итоге дня (068 Т8):
 * «Ещё матч» и главная «В Дом · Enter». Тексты — `src/i18n`.
 */
export interface NewsFoot {
  /** Кнопка «Ещё матч»; `null` — её нет. */
  more: string | null;
  /** Главная кнопка; подпись клавиши — только у «В Дом» (Enter), у «закрыть» она уже в тексте. */
  main: string;
  sub: string | null;
}

export function newsFoot(foot: 'close' | 'home', back: 'home' | 'museum'): NewsFoot {
  if (foot === 'home') return { more: ru.day.act.more, main: ru.result.home, sub: ru.result.enter };
  return { more: null, main: fill(ru.story.close, { to: back === 'museum' ? ru.story.museum : ru.frame.menu.home }), sub: null };
}
