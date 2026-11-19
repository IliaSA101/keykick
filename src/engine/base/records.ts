/** Рекорды игр на интерес (ТЗ-7.10: награда — рекорд, 0 монет). Рекорд — счёт `n` (и время `t`) на игру; лучше — по `better` из `base.json`. */
import { FUN_GAMES } from './open';

export type RecordKind = 'first' | 'beaten' | 'same';

/** Побит ли рекорд: `first` — прежнего нет, `beaten` — лучше прежнего, `same` — не лучше. Ноль (ни одного касания, ни одного хода) рекордом не станет. */
export function judge(id: string, score: number, prev: number | undefined, t?: number, prevT?: number): RecordKind {
  const g = FUN_GAMES.find((x) => x.id === id);
  if (!g || score <= 0) return 'same';
  if (prev === undefined) return 'first';
  if (score !== prev) return (g.better === 'high' ? score > prev : score < prev) ? 'beaten' : 'same';
  // Равный счёт: у игр со временем (Штрафной — «голов из 5 и время», 036-Р6) рекорд — меньшее время
  return t !== undefined && prevT !== undefined && t < prevT ? 'beaten' : 'same';
}
