/** Обрезка журнала (design §5, 018-Р6): `keys` — последние 300 матчей игрока. */

export const KEYS_KEEP = 300;
/** При квоте: `keys` до 100. */
export const KEYS_KEEP_QUOTA = 100;

export interface KeyEntry {
  key: string;
  t: number;
}

/**
 * Какие `keys` удалить: всё, кроме `keep` самых новых по `t` (при равных `t` новее тот, что позже в списке).
 * Только по ключам индекса, без значений. Возвращает ключи матчей, старые первыми.
 */
export function planTrim(list: readonly KeyEntry[], keep: number = KEYS_KEEP): string[] {
  const limit = Math.max(0, Math.floor(keep));
  if (list.length <= limit) return [];
  const sorted = list.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i);
  return sorted.slice(0, sorted.length - limit).map((x) => x.e.key);
}
