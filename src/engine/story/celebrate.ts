/**
 * Праздник после итога и на входе в Дом (068 Т3, звено `celebrate` цепочки 067 К-Б, ТЗ-10.11, 068-Р15): по старшинству
 * титул → эмблема 10/10 → «Стадион засиял» → ступень → золото ступени → веха → форма → ранг. После итога — не больше одного,
 * на входе — не больше двух; остальные — метка «новое» на здании (окон у них нет, кроме титула).
 */
export const CELEBRATIONS = ['title', 'emblem', 'stadium', 'stage', 'gold', 'milestone', 'kit', 'rank'] as const;
export type Celebration = (typeof CELEBRATIONS)[number];

/** Какие праздники накопились (поставщики — разделы подсистем; здесь только «есть или нет»). */
export type CelebrateFacts = Partial<Record<Celebration, boolean>>;

/** Сколько праздников подряд на входе в Дом (023-Р11). */
export const ENTRY_LIMIT = 2;

const pending = (f: CelebrateFacts): Celebration[] => CELEBRATIONS.filter((c) => f[c] === true);

/** Праздник после итога матча: самый старший, один; нет — `null` (звено цепочки пропускается). */
export const celebration = (f: CelebrateFacts): Celebration | null => pending(f)[0] ?? null;

/** Вход в Дом: `show` — окна (≤ 2, по старшинству), `news` — остальные, меткой «новое». */
export function entryCelebrations(f: CelebrateFacts): { show: Celebration[]; news: Celebration[] } {
  const all = pending(f);
  return { show: all.slice(0, ENTRY_LIMIT), news: all.slice(ENTRY_LIMIT) };
}
