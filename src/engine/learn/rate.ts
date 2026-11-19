/** Ставка учебной игры (ТЗ-3.3): медиана скорости последних матчей × 0,8 × норма игры в минутах / 20, в пределах 1–6. */
import cfg from '../../content/learn.json';

/** Медиана чисел (чётное число — среднее двух средних); общая для ставки игры и нормы «пальцы устали» (`engine/day/advice`). */
export const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * Ставка в сотых монеты (дробный остаток копится, ТЗ-3.3): 100…600. `speeds` — зн/мин доигранных матчей, старые первыми
 * (учитываются последние `window`); матчей нет — `first` монет. Норму игры задаёт каталог (`norm`, минуты).
 */
export function rateHundredths(speeds: readonly number[], norm: number): number {
  const last = speeds.filter((s) => Number.isFinite(s) && s >= 0).slice(-cfg.rate.window);
  if (last.length === 0) return cfg.rate.first * 100;
  const coins = (median(last) * cfg.rate.factor * norm) / cfg.rate.divisor;
  return Math.min(cfg.rate.max * 100, Math.max(cfg.rate.min * 100, Math.round(coins * 100)));
}
