/**
 * Точная модель победы в матче (011, `method-v1-smooth-sim`): без случайности и доп. времени.
 * Допущения: ошибки на знак независимы (вероятность p = 1 − точность), атака из L знаков — гол при ≤ g ошибках,
 * гол соперника при ≥ c ошибках, иначе сейв; победа — голов за два тайма больше. Оба тайма — с теми же `attacks`.
 *
 * Допустимые входы: длины атак ≥ 1, 0 ≤ g < c (целые), точность — в [0, 1]. `accuracyFor` ищет ошибку в 0,05–30 %
 * (точность 70–99,95 %): шанс, который лежит вне этого коридора, вернёт край, а не точное значение.
 */

export interface OddsShape {
  attacks: readonly number[];
  g: number;
  c: number;
}

/** Исход одной атаки из L знаков при вероятности ошибки p: гол и гол соперника (отрицательное биномиальное). */
function attackOdds(len: number, p: number, g: number, c: number): { goal: number; conceded: number } {
  let pk = Math.pow(1 - p, len);
  let cdf = 0;
  let goal = 0;
  for (let k = 0; k < c; k++) {
    if (k === g) goal = cdf + pk;
    cdf += pk;
    pk = (pk * (len + k) * p) / (k + 1);
  }
  return { goal, conceded: 1 - cdf };
}

/** Распределение разницы голов за один тайм. */
function halfDiff(lens: readonly number[], p: number, g: number, c: number): Map<number, number> {
  let dist = new Map<number, number>([[0, 1]]);
  for (const len of lens) {
    const { goal, conceded } = attackOdds(len, p, g, c);
    const next = new Map<number, number>();
    const add = (k: number, v: number) => next.set(k, (next.get(k) ?? 0) + v);
    for (const [k, v] of dist) {
      add(k + 1, v * goal);
      add(k - 1, v * conceded);
      add(k, v * (1 - goal - conceded));
    }
    dist = next;
  }
  return dist;
}

/** Вероятность победы за два тайма при точности `accuracy` (0–1). */
export function winChance(l: OddsShape, accuracy: number): number {
  const p = 1 - accuracy;
  const half = halfDiff(l.attacks, p, l.g, l.c);
  let win = 0;
  for (const [i, u] of half) for (const [j, v] of half) if (i + j > 0) win += u * v;
  return win;
}

/** Точность (0–1), при которой вероятность победы равна `chance`; A80 = `accuracyFor(l, 0.8)`. */
export function accuracyFor(l: OddsShape, chance: number): number {
  let lo = 0.0005;
  let hi = 0.3;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (winChance(l, 1 - mid) > chance) lo = mid;
    else hi = mid;
  }
  return 1 - (lo + hi) / 2;
}
