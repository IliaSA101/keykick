/**
 * Чеканка на экране (067 Т19, кадры Э4.27–29, 45): связь движка `engine/base/games/keepy` с кадром — буквы урока, клавиша события,
 * доля падения для рисунка, итог игры (рекорд, «осталось сегодня»), метка «видел». Чистые функции: часы, зерно, день и разделы приходят снаружи.
 * Правил здесь нет: промахи, зона и скорость — в движке; рекорд и счётчик дня — `finishFun`.
 */
import cfg from '../../content/base.json';
import { fallMs, type KeepyState } from '../../engine/base/games/keepy';
import { isLetter } from '../../engine/typing/keymap';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import { fill } from '../home/texts';
import { dayLine, endNote, finishGame, isRecord, lessonLetters, pressedChar, seenPatch, type FunEnd } from './play';
import type { baseOf } from './run';

type Sections = Parameters<typeof baseOf>[0];

/** Буквы над мячом — выученные клавиши урока (общее `lessonLetters`; имя оставлено для тестов Чеканки). */
export const keepyKeys = lessonLetters;

/** Буква события: нажатая клавиша Чеканки по `code` (только буквы выученных, знаки и пробел не берём). */
export const keepyChar = (e: Parameters<typeof pressedChar>[0]): string | null => pressedChar(e, isLetter);

/** Число «жизней» (промахов до конца игры) — из контента (067-Р23); `lives` в функциях ниже — для проверки другого числа. */
export const keepyLives: number = cfg.keepy.lives;

/** Сколько промахов ещё можно: «можно ещё N» и число целых мячей-«жизней». */
export const keepyLeft = (misses: number, lives: number = keepyLives): number => Math.max(0, lives - misses);

/** Строка «N промаха — …» с числом из контента: правило на старте и заголовок итога. */
const missesLine = (line: string, lives: number): string => fill(line, { n: lives, unit: plural(lives, ru.learn.side.misses) });
export const keepyRules = (lives: number = keepyLives): string[] => ru.base.keepy.rules.map((r) => missesLine(r, lives));
export const keepyOver = (lives: number = keepyLives): string => missesLine(ru.base.keepy.over, lives);

/** Сколько мяч уже падает: 0 — только начал, 1 — упал. */
export const keepyProgress = (s: KeepyState, t: number): number => Math.max(0, Math.min(1, (t - s.since) / fallMs(s.touches)));

/** Мяч в зоне удара (последняя доля падения, `keepy.zone`): верная клавиша сейчас засчитывается. */
export const keepyInZone = (s: KeepyState, t: number): boolean => keepyProgress(s, t) >= 1 - cfg.keepy.zone;

/** Итог доигранной партии для окна итога (общий вид игр на интерес — `FunEnd`). */
export type KeepyEnd = FunEnd;

/** Новый рекорд — только записанный (см. `isRecord`). */
export const keepyIsRecord = isRecord;

/** Строка итога под счётом (см. `endNote`). */
export const keepyEndNote = endNote;

/** Кадр стенда (только в разработке, фикстура `base.keepy`): фаза, мяч в ходе и итог — экран не тикает и ничего не пишет. В игре поставщика нет. */
export interface KeepyStand {
  phase: 'start' | 'play' | 'end';
  /** Игра: буква над мячом, касания, промахи и доля падения. */
  letter?: string;
  touches?: number;
  misses?: number;
  progress?: number;
  end?: KeepyEnd;
}

export { seenPatch };

/** Строка «Сегодня: игра N из 2» (см. `dayLine`). */
export const keepyDay = dayLine;

/** Записать итог партии Чеканки: счёт — касания подряд (см. `finishGame`). */
export const finishKeepy = (sections: Sections, save: (patch: Record<string, unknown>) => { ok: boolean }, score: number, run: string, day: string): KeepyEnd => finishGame('keepy', sections, save, score, run, day);
