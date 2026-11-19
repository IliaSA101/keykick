/**
 * Медаль тура по верным с первой попытки (ТЗ-6.4) и эмблема из 10 частей (ТЗ-6.7). Пороги — `content/school.json`.
 */
import cfg from '../../content/school.json';
import { KINDS, REPEAT_KIND } from './order';
import type { School } from './section';

/** Медаль 0…3: 0 — «тур сыгран» без медали, 1 бронза, 2 серебро, 3 золото. */
export type Medal = 0 | 1 | 2 | 3;

const TABLE = cfg.medals as Record<string, readonly number[]>;

/**
 * Медаль тура из `size` задач при `first` верных с первой попытки. Тур из 5: 3/4/5, из 4: 2/3/4, из 3: 2/3 — золота нет
 * (порог 0). Тур длиннее 5 считается по таблице пятёрки, короче 3 медали не даёт.
 */
export function medalOf(size: number, first: number): Medal {
  const row = TABLE[String(Math.min(size, 5))];
  if (row === undefined) return 0;
  const [bronze, silver, gold] = row as [number, number, number];
  if (gold > 0 && first >= gold) return 3;
  if (first >= silver) return 2;
  if (first >= bronze) return 1;
  return 0;
}

/** Бит эмблемы вида; -1 — у вида части нет (повтор, «прежние виды»). */
export const partOf = (kind: string): number => KINDS.findIndex((k) => k.id === kind);

/** Сколько частей собрано (0…10). */
export function emblemN(mask: number): number {
  let n = 0;
  for (let i = 0; i < KINDS.length; i++) if ((mask & (1 << i)) !== 0) n++;
  return n;
}

export const EMBLEM_FULL = KINDS.length;

/** Часть за первую медаль вида: один раз на вид; нет медали или вид без части — маска та же. */
export function addPart(mask: number, kind: string, medal: Medal): { mask: number; added: boolean } {
  const bit = partOf(kind);
  if (bit < 0 || medal < 1 || (mask & (1 << bit)) !== 0) return { mask, added: false };
  return { mask: mask | (1 << bit), added: true };
}

/** Номер тура «Школы» с медалью (бронза и выше), сданного в игровой день `day` (последний по журналу); нет — `null`. Тур-повтор не считается: номера у него нет. */
export function medalTourOn(school: School, day: string): number | null {
  const hit = school.tours.filter((t) => t.day === day && t.medal >= 1 && t.kind !== REPEAT_KIND).pop();
  return hit === undefined ? null : hit.n;
}
