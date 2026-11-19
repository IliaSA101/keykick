/**
 * Музей клуба (067 Т11, ТЗ-5.10, 3.10): что стоит на полках зала. Чистые функции: данные поставщика (`app/museum/provide.ts`,
 * наполняет 068 Т7) и покупки Двора → числа и флаги для экрана. Газеты и кубок на тумбе добавляет 068 — здесь их нет.
 */
import yard from '../../content/yard.json';
import { LEAGUES, type League } from '../nav/leagues';
import { IDS } from '../shop/section';
import { PAPER_COUNT } from '../story/section';

/** Лиг на стенде «Кубки лиг» — по порядку Пути клуба (`LEAGUES`); подписи — `ru.league.names` (067-Р60). */
export const LEAGUES_TOTAL = LEAGUES.length;
/** Роликов на полке «Видео» (ТЗ-3.14: по одному на ступень). */
export const VIDEOS_TOTAL = 4;

/** От поставщика (`app/museum/provide.ts`): роликов открыто и Кубок двора взят. */
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

/** Ячейка стенда газет: выпуск вышел (`have`) — миниатюра, нет — силуэт; `fresh` — метка «свежий» (ТЗ-5.10). */
export interface PaperCell {
  n: number;
  have: boolean;
  fresh: boolean;
}

/** Стенд газет (ТЗ-5.10, 049-Р25): все восемь выпусков сеткой, вышедшие — миниатюрами; `fresh` — номер свежего выпуска (метка только на нём). */
export function papersShelf(released: readonly number[], fresh: number | null): { cells: PaperCell[]; have: number; of: number; last: number | null } {
  const got = new Set(released.filter((n) => n >= 1 && n <= PAPER_COUNT));
  const cells = Array.from({ length: PAPER_COUNT }, (_, i) => ({ n: i + 1, have: got.has(i + 1), fresh: fresh === i + 1 && got.has(i + 1) }));
  return { cells, have: got.size, of: PAPER_COUNT, last: got.size === 0 ? null : Math.max(...got) };
}

/** Роликов на полке «Видео» (ТЗ-3.14, макет Э2К): по одному на ступень Двора (каждые `museum.lessonsPerVideo` уроков в `yard.json`, до трёх) и четвёртый — за Кубок двора. */
export function videosOpen(cur: number, cupWon: boolean): number {
  return Math.min(VIDEOS_TOTAL - 1, Math.max(0, Math.floor(cur / yard.museum.lessonsPerVideo))) + (cupWon ? 1 : 0);
}
