/**
 * Раздел `form` (065-Р9): окна нажатий по пальцам, ранг и кандидат на высокий ранг. Пишет только итог матча или минуты
 * тренера (через `applyPresses`); чистые функции.
 */
import { isInt, type SectionDef } from '../save/section';
import { emptyForm, type FormState } from './rank';

const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

export const formDef: SectionDef<FormState> = {
  name: 'form',
  v: 1,
  empty: emptyForm,
  up: {},
  check(d) {
    if (!isObj(d) || !isObj(d.fingers)) return ['shape'];
    for (const f of Object.values(d.fingers)) {
      if (!isObj(f) || typeof f.w !== 'string' || !/^[01]*$/.test(f.w) || f.w.length > 300) return ['finger:w'];
      if (!isInt(f.max) || f.max < 0 || f.max > 4) return ['finger:max'];
      if (!isObj(f.cand) || !isInt(f.cand.rank) || !isInt(f.cand.n) || f.cand.rank < 0 || f.cand.n < 0) return ['finger:cand'];
    }
    return [];
  },
};
