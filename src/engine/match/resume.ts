/**
 * Матч v2 (спека 017, design §1.1): что делать при следующем входе в урок после перезагрузки или выхода.
 * Чистые функции без Vue и DOM; сам «ожидающий 2-й тайм» хранит 018 (раздел игрока), форму знает только машина.
 */
import { emptyStats } from '../typing';
import { emptyScore, type MatchScore } from './score';
import type { MatchConfig, MatchState } from './view';
import type { Help } from './verdict';

/** Печать тайма: верные, ошибки, мс (для точности и скорости итога). */
export interface HalfPrint {
  correct: number;
  errors: number;
  ms: number;
}

/** Ожидающий 2-й тайм (design §10): один на игрока, пишется на перерыве и при провале с переигровкой тайма. */
export interface PendingSecond {
  lessonId: string;
  /** Зерно матча (для тех же текстов 2-го тайма на перерыве). */
  seed: number;
  /** 2-й тайм уже начат: перезагрузка во 2-м тайме — провал без роста `fails`. */
  started: boolean;
  first: HalfPrint & { score: MatchScore };
  /** Откуда: перерыв или предложение «Переиграть 2-й тайм». */
  reason: 'break' | 'replay';
  /** Помощь матча (017-Р56); нет — `none`. После F5 метка и потолок звёзд те же. */
  help?: Help;
}

/** 1-й тайм не проигран (`typed1 ≥ conceded1`, §4): можно переигрывать или продолжать только 2-й. */
export const firstHalfKept = (score: MatchScore): boolean => score.typed >= score.conceded;

export type Entry =
  | { kind: 'fresh' }
  /** Снова перерыв: счёт и печать 1-го тайма целы, `fails` не меняется. */
  | { kind: 'break'; pending: PendingSecond }
  /** «Продолжить 2-й тайм (счёт 1-го a:b)» с новым зерном. */
  | { kind: 'continue2'; pending: PendingSecond };

/** Таблица §1.1 для входа в урок `lessonId`. Чужой урок или пустое — матч заново. */
export function entryFor(pending: PendingSecond | null, lessonId: string): Entry {
  if (!pending || pending.lessonId !== lessonId) return { kind: 'fresh' };
  // Обычный перерыв, не начатый: снова перерыв (зерно то же, текст кнопки «Второй тайм»).
  if (!pending.started && pending.reason === 'break') return { kind: 'break', pending };
  // Провал с «Переиграть тайм», F5 до его нажатия (017-Р4, Р36, Р37) — как после нажатия: «Продолжить 2-й тайм (a:b)», новое зерно.
  return firstHalfKept(pending.first.score) ? { kind: 'continue2', pending } : { kind: 'fresh' };
}

/**
 * Начальное состояние: с вступления, либо с перерыва по таблице §1.1 (`entry`). `help` — помощь, выбранная
 * приложением по `stuckOffer(fails)` (после «Застрял»): уходит в `begin` и действует потолок звёзд.
 * Перерыв после провала с `reason: 'replay'` берёт новое зерно, как `continue2` (не то же, что дало провал).
 */
export function initMatch(cfg: MatchConfig, o: { seed: number; fails: number; entry?: Entry; help?: Help }): MatchState {
  const base: MatchState = {
    cfg, phase: 'intro', paused: false, half: 1, seed: o.seed, help: o.help ?? 'none', fails: o.fails, replay: false,
    banner: null, resumed: false, kickId: null, done: 0, pausedAt: null, opened: false, now: 0, warm: [], block: 0,
    texts: [], attack: 0, rows: [], row: 0, attackErrors: 0, typing: null, stats: emptyStats, base: emptyStats,
    presses: [], lastKey: null, score: emptyScore, firstScore: emptyScore, first: null, second: null, extra: null, keyErrors: {},
    last: null, kick: null, lastKick: null, kickTaken: false, solved: cfg.solved, result: null, coach: null,
    coachDone: false,
  };
  const e = o.entry;
  if (!e || e.kind === 'fresh') return base;
  const { pending } = e;
  return {
    ...base,
    phase: 'break',
    half: 2,
    help: o.help ?? pending.help ?? 'none',
    seed: e.kind === 'break' && pending.reason === 'break' ? pending.seed : o.seed,
    banner: e.kind === 'continue2' ? 'continue2' : null,
    replay: pending.reason === 'replay',
    resumed: true,
    done: cfg.lesson.attacks.length,
    score: pending.first.score,
    firstScore: pending.first.score,
    first: { correct: pending.first.correct, errors: pending.first.errors, ms: pending.first.ms },
  };
}

/** Запись «ожидающий 2-й тайм» из состояния (перерыв или провал с переигровкой тайма). */
export function pendingOf(s: MatchState, reason: 'break' | 'replay'): PendingSecond {
  return {
    lessonId: s.cfg.lesson.id, seed: s.seed, started: false, reason, ...(s.help !== 'none' ? { help: s.help } : {}),
    first: { ...(s.first ?? { correct: 0, errors: 0, ms: 0 }), score: s.firstScore },
  };
}
