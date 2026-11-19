/**
 * «Лист лиги» (ТЗ-1.8, 068-Р17; кадры Э2.29, Э2.30/.37): четыре строки — звёзды, альбом, эмблема двора, права на компьютер.
 * До урока 17 лист говорит «сделано N / M», с урока 17 — «ещё K»; число «ещё» — остаток до полного. Чистая функция: числа
 * приходят готовыми из разделов (звёзды — `homeView`, альбом — `album.packs`, эмблема — маска школы, права — бронзовые игры).
 * Макет-образец — `tools/mock-map/league-extra.mjs` (`leagueSheet`).
 */

/** С какого урока лист показывает остаток («что осталось»), а не сделанное. */
export const SHEET_LEFT_FROM = 17;

export type SheetKey = 'stars' | 'album' | 'emblem' | 'rights';
/** Порядок строк листа. */
export const SHEET_KEYS: readonly SheetKey[] = ['stars', 'album', 'emblem', 'rights'];

export interface SheetPart {
  have: number;
  total: number;
}
export interface SheetInput {
  /** Текущий урок 1…33. */
  cur: number;
  parts: Readonly<Record<SheetKey, SheetPart>>;
}
export interface SheetRow {
  key: SheetKey;
  have: number;
  total: number;
  /** Сколько осталось до полного (не меньше 0). */
  left: number;
  /** Доля сделанного, 0…100: ширина полосы. */
  pct: number;
}
export interface LeagueSheet {
  /** Режим «осталось» (с урока 17); иначе «сделано». */
  left: boolean;
  cur: number;
  rows: SheetRow[];
}

export function leagueSheet(i: SheetInput): LeagueSheet {
  const rows = SHEET_KEYS.map((key): SheetRow => {
    const { total } = i.parts[key];
    const have = Math.min(Math.max(i.parts[key].have, 0), total);
    return { key, have, total, left: total - have, pct: total > 0 ? (have / total) * 100 : 0 };
  });
  return { left: i.cur >= SHEET_LEFT_FROM, cur: i.cur, rows };
}
