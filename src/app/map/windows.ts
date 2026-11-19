/**
 * Окна поверх Карты (068-Р17): открытое окно берётся из адреса (`/map?win=sheet|club`: перезагрузка и «назад» не теряют окно,
 * стенд кадров ставит его фикстурой), числа «Листа лиги» — из разделов сеанса. Подсчёт — в `engine/map/sheet.ts`.
 */
import { PACKS_YARD } from '../../engine/album/order';
import type { Album } from '../../engine/album/section';
import { GAMES } from '../../engine/learn/queue';
import { learnDef, type Learn } from '../../engine/learn/section';
import { bronzeCount } from '../../engine/learn/steps';
import { leagueSheet, type LeagueSheet } from '../../engine/map';
import { EMBLEM_FULL, emblemN } from '../../engine/school/medal';
import type { School } from '../../engine/school/section';
import type { useHomeInput } from '../home/useHomeInput';

export type MapWindow = 'sheet' | 'club';
/** Окно из значения адреса или стенда; чужое — `null` (окна нет). */
export const windowOf = (v: unknown): MapWindow | null => (v === 'sheet' || v === 'club' ? v : null);

/** Лист лиги: звёзды — из вида Дома (`hv.stars`), остальное — из разделов `album`, `school`, `learn`. */
export function sheetOf(data: ReturnType<typeof useHomeInput>['data'], cur: number, stars: { n: number; of: number }): LeagueSheet {
  return leagueSheet({
    cur,
    parts: {
      stars: { have: stars.n, total: stars.of },
      album: { have: data<Album>('album', { packs: 0, shown: 0, worn: null, prize: [] }).packs, total: PACKS_YARD },
      emblem: { have: emblemN(data<School | null>('school', null)?.emblem ?? 0), total: EMBLEM_FULL },
      rights: { have: bronzeCount(data<Learn>(learnDef.name, learnDef.empty())), total: GAMES.length },
    },
  });
}
