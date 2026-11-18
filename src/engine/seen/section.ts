/**
 * Раздел `seen` (063-Р6, 059 А-47, 010-Р4): что игрок уже видел.
 * - `news` — версия, до которой «Что нового» показано. У нового игрока — версия при создании (`APP_VERSION`):
 *   новичку чужих новостей нет; логика показа и подтягивания номера — Т11.
 * - `firsts` — первые входы на экраны («подсказка уже показана»): id → день `ГГГГ-ММ-ДД` (А-20: дни — строками).
 * Чистые функции: часы приходят снаружи.
 */
import { APP_VERSION } from '../save/envelope';
import { isDay, type SectionDef } from '../save/section';
import { isVersion } from '../versions/version';

export interface Seen {
  news: string;
  firsts: Record<string, string>;
}

export const FIRSTS_MAX = 64;
const FIRST_ID = /^[a-z][a-z0-9-]{0,31}$/;

const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

export const seenDef: SectionDef<Seen> = {
  name: 'seen',
  v: 1,
  empty: () => ({ news: APP_VERSION, firsts: {} }),
  up: {},
  check(d) {
    if (!isObj(d)) return ['shape'];
    const why: string[] = [];
    if (!isVersion(d.news)) why.push('news');
    if (!isObj(d.firsts)) why.push('firsts');
    else {
      const entries = Object.entries(d.firsts);
      if (entries.length > FIRSTS_MAX) why.push('firsts:count');
      if (entries.some(([id, day]) => !FIRST_ID.test(id) || !isDay(day))) why.push('firsts:entry');
    }
    return why;
  },
};
