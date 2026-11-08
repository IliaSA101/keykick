/**
 * Матч v2 (спека 017, design §14): пенальти по ходу матча. Одно на 2-й тайм — после первой атаки без ошибок
 * (ТЗ-2.7, 017-Р1; «первой чистой», не «первой по счёту»: так выходит 15–55 % матчей, К4). Верно — гол и «Знаток» +1 за новую задачу; монет за удар нет (ТЗ-3.5). Задача — `pickQuick` v1.
 */
import { pickQuick, type Task } from '../tasks';
import { addKick, type MatchScore } from './score';

export type KickResult = 'scored' | 'missed' | 'skipped';

export interface KickWhere {
  half: 1 | 2;
  /** Номер только что сыгранной атаки тайма, с 1, и сколько атак в тайме. */
  attack: number;
  attacks: number;
  errors: number;
  /** Пенальти этого тайма уже было (в том числе «Не бить»). */
  taken: boolean;
}

/**
 * Пенальти сейчас: только 2-й тайм, после чистой атаки (0 ошибок), одно на тайм. После последней атаки тайма
 * пенальти нет — дальше итог матча (как в v1: после последней строки тайма не бывает).
 */
export const kickDue = (w: KickWhere): boolean => w.half === 2 && w.attack < w.attacks && w.errors === 0 && !w.taken;

/** Задача для удара по зерну: проверенная и быстрая; нет подходящей — null (удара не будет). */
export function kickTask(tasks: readonly Task[], seed: number, solved: readonly string[]): Task | null {
  return pickQuick(tasks, seed, solved);
}

/** Удар на экране: задача и ответ (null — ещё не бил). */
export interface Kick {
  taskId: string;
  result: KickResult | null;
}

export interface KickOutcome {
  kick: Kick;
  score: MatchScore;
  /** «Знаток» +1: гол по задаче, которой ещё нет среди решённых. */
  expert: number;
  /** Монеты за удар — всегда 0, поровну при любом ответе. */
  coins: 0;
}

/** Ответ: засчитывается первый (двойной Enter, Esc после ответа — то же состояние). */
export function answerKick(kick: Kick, result: KickResult, score: MatchScore, solved: readonly string[]): KickOutcome {
  if (kick.result !== null) return { kick, score, expert: 0, coins: 0 };
  return {
    kick: { ...kick, result },
    score: addKick(score, result === 'scored'),
    expert: result === 'scored' && !solved.includes(kick.taskId) ? 1 : 0,
    coins: 0,
  };
}
