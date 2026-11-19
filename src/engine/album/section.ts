/**
 * Раздел `album` (067 design §7): паки, показ пака, надетая форма, призы. `packs` растёт только через кассу
 * (награда `lesson-pack`); `shown` двигает показ пака на итоге (перезагрузка посреди — показ снова, 067 §6).
 * «Надета — собранная» (ТЗ-5.2): `worn` — форма, собранная по `packs`, или призовая из `prize`; `wear` не пускает остальное.
 */
import { isId, isInt, isRecord, type SectionDef } from '../save/section';
import { isCollected, PACKS_YARD, PRIZE_IDS } from './order';

export interface Album {
  /** Паков выдано всего (только касса). */
  packs: number;
  /** Паков показано; не больше `packs`. */
  shown: number;
  /** Надетая форма — id; `null` — клубная. */
  worn: string | null;
  /** Id полученных призов (фольга и т. п.), без повторов. */
  prize: string[];
}

export const albumDef: SectionDef<Album> = {
  name: 'album',
  v: 1,
  empty: () => ({ packs: 0, shown: 0, worn: null, prize: [] }),
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const why: string[] = [];
    if (!isInt(d.packs) || d.packs < 0 || d.packs > PACKS_YARD) why.push('packs');
    if (!isInt(d.shown) || d.shown < 0 || (isInt(d.packs) && d.shown > d.packs)) why.push('shown');
    if (d.worn !== null && (!isId(d.worn) || !(isInt(d.packs) && isCollected(d.packs, d.worn)) && !(Array.isArray(d.prize) && d.prize.includes(d.worn)))) why.push('worn');
    if (!Array.isArray(d.prize) || !d.prize.every(isId) || new Set(d.prize).size !== d.prize.length || !d.prize.every((p) => PRIZE_IDS.includes(p))) why.push('prize');
    return why;
  },
};
