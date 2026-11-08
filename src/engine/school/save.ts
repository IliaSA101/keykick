/**
 * Раздел `school` (спека 018 design §3.1): Э1-минимум — «разобрано» битами и счёт «Знатока»; 024 расширяет.
 * Владелец — 024; в Э1 пишут 017 (пенальти по ходу матча, 017-Р11).
 */
import { defineSection, int, type SectionDef } from '../save/section';
import { parseSolved } from './solved';

export interface SchoolSave {
  /** Битовая строка по номеру задачи (`solved.ts`). */
  solved: string;
  /** Счёт «Знатока»: верные задачи (туры, пенальти, «штрафные»), только растёт. */
  expert: number;
}

/** Потолок счёта «Знатока» — защита от мусора. */
export const EXPERT_MAX = 1_000_000;

const rec = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export const section: SectionDef<SchoolSave> = defineSection<SchoolSave>({
  name: 'school',
  owner: '024',
  parse: (raw) => {
    const r = rec(raw);
    return { solved: parseSolved(r.solved), expert: int(r.expert, 0, EXPERT_MAX) };
  },
  empty: () => ({ solved: '', expert: 0 }),
  // Образец: разобраны номера 1, 7 и 13.
  sample: () => ({ solved: 'BBB', expert: 3 }),
  // Потолок: разобраны все номера до taskNoMax — 1000 знаков.
  maxSample: (cat) => ({ solved: '_'.repeat(Math.ceil(cat.taskNoMax / 6)), expert: EXPERT_MAX }),
  counters: (s) => ({ expert: s.expert }),
  check: (s) => (parseSolved(s.solved) === s.solved ? [] : ['school.solved: not canonical base64url (bad chars, too long or trailing zeros)']),
});
