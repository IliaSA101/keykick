/**
 * Штрафной через стенку на экране (067 Т21, кадры Э4.34–36, 44, 46): связь движка `engine/base/games/free` с кадром — клавиша удара, ход серии по ударам
 * (ряд из 5 точек), слова мишеней, где летит мяч, итог серии с временем. Чистые функции: часы, зерно, день и разделы приходят снаружи.
 * Правил здесь нет: что считается голом — в движке; рекорд (больше голов, при равных — меньше время) и счётчик дня — `finishGame`.
 */
import cfg from '../../content/base.json';
import { wordLeft, type FreeState } from '../../engine/base/games/free';
import { isLetter } from '../../engine/typing/keymap';
import { ru } from '../../i18n/ru';
import { fill } from '../home/texts';
import { mmss } from '../learn/view';
import { endNote, finishGame, pressedChar, seriesResults, type FunEnd } from './play';
import { unitOf, type baseOf } from './run';

type Sections = Parameters<typeof baseOf>[0];

/** Сколько ударов в серии — из контента. */
export const freeShots: number = cfg.free.shots;

/** Секунд на слово — из контента (в правилах на старте). */
export const freeWordSeconds: number = cfg.free.wordMs / 1000;

/** Полоска отсчёта под текущей мишенью: доля оставшегося времени слова (1 → 0) и «тревога» в последние `warnMs` (тёплый цвет). Серия не идёт — полоски нет. */
export function freeWordBar(s: FreeState | null, now: number): { left: number; hot: boolean } | null {
  if (s === null || s.over) return null;
  const ms = wordLeft(s, now);
  return { left: ms / cfg.free.wordMs, hot: ms <= cfg.free.warnMs };
}

/** Клавиша удара: любая буква по месту клавиши (`code`); не та буква — промах, это решает движок. */
export const freeChar = (e: Parameters<typeof pressedChar>[0]): string | null => pressedChar(e, isLetter);

/** Исход каждого удара серии: `true` — гол, `false` — мяч в стенку (общий ход с Вратарём — `seriesResults`). */
export const freeResults = (res: readonly boolean[], prev: FreeState, next: FreeState): boolean[] => seriesResults(res, prev, next, next.goals > prev.goals);

/** Плашки «Твои клавиши» в порядке клавиатуры: сперва ряд ФЫВА ОЛДЖ слева направо, остальные буквы — как пришли; заглавные. */
export const freeKeyList = (pool: readonly string[]): string[] => {
  const rank = (k: string): number => (cfg.homeRow.includes(k) ? cfg.homeRow.indexOf(k) : cfg.homeRow.length);
  return [...pool].sort((a, b) => rank(a) - rank(b)).map((k) => k.toUpperCase());
};

/** Три мишени над воротами: слово текущего удара и два следующих (последние удары серии — меньше). */
export const freeBoards = (words: readonly string[], shot: number): string[] => words.slice(shot, shot + 3);

/** Какую долю дуги мяч уже пролетел: от ноги (0) до 0,72 к последней букве слова — по набранным буквам; на последней букве мяч уходит в сетку (удар сменился). */
export const freeFlight = (typed: number, len: number): number => (len === 0 ? 0 : 0.72 * Math.min(1, typed / len));

/** «4 из 5 · 0:21»: голы и время серии. */
export const freeScoreText = (goals: number, seconds: number): string => `${goals} ${fill(ru.base.freeTail, { shots: freeShots, time: mmss(seconds * 1000) })}`;

/** «4 гола из 5 · 0:21»: то же с единицей (итог серии, доска рекордов). */
export const freeResultText = (goals: number, seconds: number): string => fill(ru.base.freeBoard, { n: goals, goals: unitOf('free', goals), shots: freeShots, time: mmss(seconds * 1000) });

/** Рекорд на старте и в игре: «4 из 5 · 0:47» или «ещё нет». */
export const freeBestText = (best: { n: number; t?: number } | null): string => (best === null ? ru.base.recordNone : freeScoreText(best.n, best.t ?? 0));

/** Записать итог серии: счёт — голы, время — целые секунды (см. `finishGame`). */
export const finishFree = (sections: Sections, save: (patch: Record<string, unknown>) => { ok: boolean }, goals: number, seconds: number, run: string, day: string): FunEnd => finishGame('free', sections, save, goals, run, day, seconds);

/**
 * Строка итога под счётом: общая строка игр на интерес (`endNote`) для первого рекорда и незаписанного итога; побит — «было 4 из 5 · 0:47»,
 * не побит — «До рекорда 4 из 5 · 0:21» (рекорд — голы и время, разность одним числом не выразить, показываем сам рекорд).
 */
export function freeEndNote(end: FunEnd, why: string): string {
  const t = ru.base.keepy;
  // рекорда не было (первая серия без голов: запись 0 рекордом не считается) — только «монет нет», без «До рекорда 0 из 5 · 0:00»
  if (end.record === 'same' && end.prev === 0 && !end.unsaved) return t.noCoins;
  if (end.unsaved || end.record === 'first') return endNote(end, why, fill(ru.base.freeTail, { shots: freeShots, time: mmss((end.t ?? 0) * 1000) }));
  const line = end.record === 'beaten' ? fill(t.beaten, { n: freeScoreText(end.prev, end.prevT ?? 0) }) : fill(t.short, { n: freeScoreText(end.best, end.bestT ?? 0) });
  return `${line} ${t.noCoins}`;
}

/** Кадр стенда (только в разработке, фикстура `base.free`): серия «замерзла» на нужном ударе, итог — экран не тикает и ничего не пишет. */
export interface FreeStand {
  phase: 'start' | 'play' | 'end';
  /** Слова мишеней по порядку: кадр «игра» (у кадра «старт» слова даёт зерно). */
  words?: string[];
  /** Зерно кадра «старт»: слова на старте и в игре, которая начнётся с Enter, раздаст оно (067-Р261). */
  seed?: number;
  /** Игра: исходы сыгранных ударов, сколько букв текущего слова набрано, время серии на табло, секунды. */
  results?: boolean[];
  typed?: number;
  time?: number;
  end?: FunEnd;
}
