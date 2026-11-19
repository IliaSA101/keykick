/**
 * Поставщик данных Музея (068 Т11, 067-Р1 в): раздел `cup` (титул) и урок → числа полок. Чистая функция: сеанс и Vue не нужны.
 * Газеты (`releasedPapers`) и их вид (`useNewsViews`) берёт экран из раздела `story`; ролик титула — `yardTitleVideoUrl` (`app/art/storyArt.ts`).
 */
import type { Cup } from '../../engine/cup';
import { videosOpen, type MuseumData } from '../../engine/museum';

/** Кубок двора взят — только золотой титул; серебро — не победа (ТЗ-8.13, 038-Р10). */
export const cupWonOf = (cup: Cup): boolean => cup.title === 'gold';

export const museumDataOf = (cup: Cup, cur: number): MuseumData => ({ videos: videosOpen(cur, cupWonOf(cup)), cupWon: cupWonOf(cup) });
