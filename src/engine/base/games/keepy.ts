/**
 * Чеканка (036-Р6, 067 design §8): над мячом буква из выученных; нажал, пока мяч в зоне удара, — +1. Промах — неверная
 * клавиша или мяч упал; промахов `lives` (по 036-Р6 — три: «Промахи можно ещё 2»), счёт — касаний подряд. Слишком ранняя верная клавиша
 * (мяч ещё не в зоне) игнорируется без штрафа. Мяч падает всё быстрее до предела.
 */
import cfg from '../../../content/base.json';
import { createRandom, randomInt } from '../../random';
import { seedAt, type FunInput } from './input';

const K = cfg.keepy;

export interface KeepyState {
  /** Выученные клавиши — буквы над мячом. */
  pool: string[];
  seed: number;
  touches: number;
  misses: number;
  /** Буква над мячом; `null` — игра окончена. */
  letter: string | null;
  /** Когда мяч начал падать, мс. */
  since: number;
  over: boolean;
}

/** Сколько мяч падает до земли при `touches` касаниях, мс. */
export const fallMs = (touches: number): number => Math.max(K.minFallMs, K.fallMs - K.speedUpMs * touches);

function nextLetter(pool: string[], seed: number, n: number, prev: string | null): string {
  const letter = pool[randomInt(createRandom(seedAt(seed, n)), pool.length)] ?? '';
  if (letter !== prev || pool.length < 2) return letter;
  return pool[(pool.indexOf(letter) + 1) % pool.length] ?? letter;
}

export function startKeepy(ctx: { keys: string[] }, seed: number, t = 0): KeepyState {
  const pool = [...new Set(ctx.keys)];
  const over = pool.length === 0;
  return { pool, seed, touches: 0, misses: 0, letter: over ? null : nextLetter(pool, seed, 0, null), since: t, over };
}

function miss(s: KeepyState, t: number): KeepyState {
  const misses = s.misses + 1;
  if (misses >= K.lives) return { ...s, misses, letter: null, over: true };
  return { ...s, misses, letter: nextLetter(s.pool, s.seed, s.touches + misses, s.letter), since: t };
}

export function stepKeepy(s: KeepyState, input: FunInput, t: number): KeepyState {
  if (s.over || s.letter === null) return s;
  const fall = fallMs(s.touches);
  const late = t - s.since > fall;
  if (input.kind === 'tick') return late ? miss(s, t) : s;
  if (late) return miss(s, t);
  if (input.key !== s.letter) return miss(s, t);
  if (t - s.since < fall * (1 - K.zone)) return s;
  const touches = s.touches + 1;
  return { ...s, touches, letter: nextLetter(s.pool, s.seed, touches + s.misses, s.letter), since: t };
}

export const scoreKeepy = (s: KeepyState): number => s.touches;
