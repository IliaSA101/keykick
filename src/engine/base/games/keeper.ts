/**
 * Вратарь ФЫВА ОЛДЖ (ТЗ-7.12, 036-Р6, Р15): 8 секторов ворот = клавиши ряда; невыученная клавиша — сектор закрыт, мяч туда
 * не летит. Мяч летит в открытый сектор; нажал его клавишу за `windowMs` — сейв. Пропуск — серый, без штрафа; неверная
 * клавиша игнорируется. Серия — `shots` ударов, счёт — отбитых (рекорд — сейвы из 20).
 */
import cfg from '../../../content/base.json';
import { createRandom, randomInt } from '../../random';
import { seedAt, type FunInput } from './input';

const K = cfg.keeper;

export interface KeeperState {
  /** Открытые сектора: клавиши ряда, которые ребёнок уже выучил. */
  open: string[];
  seed: number;
  /** Ударов уже было (включая текущий). */
  shot: number;
  saves: number;
  /** Сектор текущего удара; `null` — серия окончена. */
  cur: string | null;
  since: number;
  over: boolean;
}

/** Сектора ворот слева направо: клавиши ряда; закрытые — те, что не выучены. */
export const sectors = (keys: string[]): { key: string; open: boolean }[] => cfg.homeRow.map((key) => ({ key, open: keys.includes(key) }));

function aim(open: string[], seed: number, n: number): string | null {
  return open[randomInt(createRandom(seedAt(seed, n)), open.length)] ?? null;
}

export function startKeeper(ctx: { keys: string[] }, seed: number, t = 0): KeeperState {
  const open = cfg.homeRow.filter((k) => ctx.keys.includes(k));
  const cur = aim(open, seed, 0);
  return { open, seed, shot: cur === null ? 0 : 1, saves: 0, cur, since: t, over: cur === null };
}

function next(s: KeeperState, saves: number, t: number): KeeperState {
  if (s.shot >= K.shots) return { ...s, saves, cur: null, over: true };
  return { ...s, saves, shot: s.shot + 1, cur: aim(s.open, s.seed, s.shot), since: t };
}

export function stepKeeper(s: KeeperState, input: FunInput, t: number): KeeperState {
  if (s.over || s.cur === null) return s;
  if (t - s.since > K.windowMs) return next(s, s.saves, t);
  if (input.kind === 'key' && input.key === s.cur) return next(s, s.saves + 1, t);
  return s;
}

export const scoreKeeper = (s: KeeperState): number => s.saves;
