/**
 * Раздел `path` (067 design §7): сколько раз игрок входил в Путь клуба из Дома, по лигам (054-Р11, 063-Р28).
 * Растёт на входе из Дома до `NAV.fullEntries`; с Карты не растёт. Часы не нужны — чистые функции.
 */
import { NAV } from '../nav/config';
import { isLeague, type League } from '../nav/leagues';
import { isInt, isRecord, type SectionDef } from '../save/section';

export interface Path {
  entries: Partial<Record<League, number>>;
}

export const pathDef: SectionDef<Path> = {
  name: 'path',
  v: 1,
  empty: () => ({ entries: {} }),
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    if (!isRecord(d.entries)) return ['entries'];
    const bad = Object.entries(d.entries).some(([l, n]) => !isLeague(l) || !isInt(n) || n < 0 || n > NAV.fullEntries);
    return bad ? ['entries'] : [];
  },
};
