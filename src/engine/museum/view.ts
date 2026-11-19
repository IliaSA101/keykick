/**
 * Музей клуба (067 Т11, ТЗ-5.10, 3.10): что стоит на полках зала. Чистые функции: данные поставщика (`app/museum/provide.ts`,
 * наполняет 068 Т7) и покупки Двора → числа и флаги для экрана. Газеты и кубок на тумбе добавляет 068 — здесь их нет.
 */
import { LEAGUES, type League } from '../nav/leagues';
import { IDS } from '../shop/section';

/** Лиг на стенде «Кубки лиг» — по порядку Пути клуба (`LEAGUES`); подписи — `ru.league.names` (067-Р60). */
export const LEAGUES_TOTAL = LEAGUES.length;
/** Роликов на полке «Видео» (ТЗ-3.14: по одному на ступень). */
export const VIDEOS_TOTAL = 4;

/** От поставщика: пока нет источника — пусто (`app/museum/provide.ts`). */
export interface MuseumData {
  /** Роликов открыто, 0…`VIDEOS_TOTAL`. */
  videos: number;
  /** Кубок двора взят. */
  cupWon: boolean;
}

export interface MuseumView {
  /** Стадион Двора: куплено вещей каталога из всех. */
  bought: number;
  boughtOf: number;
  videos: number;
  videosOf: number;
  /** По одной записи на лигу: взят ли её кубок (золотая ячейка); у остальных — силуэт. */
  leagues: { id: League; won: boolean }[];
}

/** Вид полок: число купленных — только из каталога (чужие id в списке не считаем), роликов — не больше предела. */
export function museumView(bought: readonly string[], data: MuseumData): MuseumView {
  const known = new Set(IDS);
  const videos = Math.max(0, Math.min(VIDEOS_TOTAL, Math.trunc(data.videos)));
  return {
    bought: new Set(bought.filter((id) => known.has(id))).size,
    boughtOf: known.size,
    videos,
    videosOf: VIDEOS_TOTAL,
    leagues: LEAGUES.map((id, i) => ({ id, won: i === 0 && data.cupWon })),
  };
}
