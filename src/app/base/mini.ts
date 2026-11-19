/**
 * Мини-футбол на экране (067 Т21, кадры Э4.21–25, 42, 43): связь движка `engine/base/games/mini` с кадром — клавиша события (буква или Пробел),
 * сила игрока по рангу клавиши, старт матча (серия на кон, 067-Р50), что случилось на шаге (для подсказки), заморозка часов на гол (067-Р52),
 * итог матча и рекорд. Чистые функции: часы, зерно, день и разделы приходят снаружи. Правил здесь нет: пас, удар, отбор — в движке; рекорд — `finishGame`.
 */
import cfg from '../../content/base.json';
import { TACTIC_IDS, beginMini, openTactics, scoreMini, startMini, type MiniState, won } from '../../engine/base/games/mini';
import { lastNumbered } from '../../engine/school/order';
import { schoolDef, type School } from '../../engine/school/section';
import { fingerOf, rank, type FormState } from '../../engine/form/rank';
import { formDef } from '../../engine/form/section';
import { isLetter } from '../../engine/typing/keymap';
import { mmss } from '../learn/view';
import { dataOf, finishGame, pressedChar, type FunEnd } from './play';
import { baseOf } from './run';

type Sections = Parameters<typeof baseOf>[0];
type Save = (patch: Record<string, unknown>) => { ok: boolean };

/** Сколько длится показ гола, мс: часы матча в это время стоят (067-Р52 «время подаётся после анимации гола»). */
export const GOAL_PAUSE_MS = 900;

/** Клавиша матча: буква выученной клавиши (пас) или Пробел (удар) — по месту клавиши (`code`); служебная и повтор — `null`. */
export const miniChar = (e: Parameters<typeof pressedChar>[0]): string | null => pressedChar(e, (ch) => isLetter(ch) || ch === ' ');

/** Ранг клавиши каждой буквы (0…4) по форме пальцев (`ctx.ranks` движка; ТЗ-7.13): буква без пальца или пустая форма — 0. */
export function miniRanks(sections: Sections, letters: readonly string[]): Record<string, number> {
  const form = dataOf<FormState>(sections, formDef);
  return Object.fromEntries(letters.map((ch) => [ch, rank(form, fingerOf(ch) ?? '')]));
}

/** Тактики, открытые ребёнку (067-Р22): по пройденным турам «Школы» — номер последнего тура нумерации (повторы не считаются); пусто — выбора нет. В сохранении ничего не пишем. */
export const tacticsOf = (sections: Sections): string[] => openTactics(lastNumbered(dataOf<School>(sections, schoolDef)));

/** Клавиша на экране выбора тактики: стрелки вправо/вниз и влево/вверх — соседняя открытая (на краю остаётся), цифры 1…4 — тактика по номеру, если открыта. Новая тактика или `null` — клавиша не наша или выбор не меняется. */
export function tacticKey(open: readonly string[], current: string, key: string): string | null {
  const i = open.indexOf(current);
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  const next = step !== 0 ? open[Math.min(open.length - 1, Math.max(0, i + step))] : /^[1-9]$/.test(key) ? TACTIC_IDS[Number(key) - 1] : undefined;
  return next !== undefined && next !== current && open.includes(next) ? next : null;
}

/** Старт матча: серия побед ставится на кон (`lastN.mini = 0`, лимит дня не тратится) и возвращается прежняя серия; отказ записи матч не отменяет. */
export function startMatch(sections: Sections, save: Save): number {
  const begun = beginMini({ base: baseOf(sections) });
  save({ base: begun.save.base });
  return begun.streak;
}

/** Время матча: «1:30» (длина из контента) и «0:52» (осталось на момент `t` от старта `s.startedAt`). */
export const matchLength = (): string => mmss(cfg.mini.matchMs);
export const matchLeft = (s: MiniState, t: number): string => mmss(Math.max(0, cfg.mini.matchMs - (t - s.startedAt)) + 999);

/** Что случилось на шаге: гол наших, гол соперника, мяч отобрали, удар взял вратарь; ничего заметного — `null`. */
export type MiniEvent = 'goal' | 'foeGoal' | 'steal' | 'saved';
export function miniEvent(prev: MiniState, next: MiniState): MiniEvent | null {
  if (next.us > prev.us) return 'goal';
  if (next.them > prev.them) return 'foeGoal';
  if (next.steals > prev.steals) return 'steal';
  if (next.shots > prev.shots) return 'saved';
  return null;
}

/** Гол (наш или соперника) замораживает часы матча на `GOAL_PAUSE_MS`; остальные события — нет. */
export const pauseOf = (e: MiniEvent | null): number => (e === 'goal' || e === 'foeGoal' ? GOAL_PAUSE_MS : 0);

/** Часы матча с заморозкой на гол (067-Р52): до каких часов страницы идёт показ гола и сколько показа уже вычтено из времени матча. */
export interface MiniClock {
  frozenUntil: number;
  paused: number;
}
export const freshClock = (): MiniClock => ({ frozenUntil: 0, paused: 0 });

/** Время матча на часах страницы `real` (за вычетом всех показов голов) и «стоят ли часы сейчас» (показ гола ещё идёт). */
export const clockAt = (c: MiniClock, real: number): { at: number; frozen: boolean } => ({ at: real - c.paused, frozen: real < c.frozenUntil });

/** Показ гола начался на часах страницы `real` и длится `wait` мс: часы матча стоят до `real + wait`, показ вычтен из времени матча. `wait` 0 — часы те же. */
export const freezeClock = (c: MiniClock, real: number, wait: number): MiniClock => (wait > 0 ? { frozenUntil: real + wait, paused: c.paused + wait } : c);

/** Состав матча по зерну — тот же, что возьмёт `startMini` (буквы перемешаны зерном, не первые по списку): им же рисуется старт, до матча. */
export const lineupOf = (keys: readonly string[], cur: number, seed: number): string[] => startMini({ keys: [...keys], cur }, seed).team;

/** Итог матча словами игры: победа, ничья, поражение. */
export const miniResult = (s: MiniState): 'win' | 'draw' | 'lose' => (won(s) ? 'win' : s.us === s.them ? 'draw' : 'lose');

/** Записать итог матча: счёт — серия побед после матча (победа — серия + 1, иначе 0), рекорд — больше (см. `finishGame`). */
export const finishMini = (sections: Sections, save: Save, score: number, run: string, day: string): FunEnd => finishGame('mini', sections, save, score, run, day);
export { scoreMini };

/** Кадр стенда (только в разработке, фикстура `base.mini`): матч «замерзает» на нужном месте, часы страницы стоят на `now`, итог — экран не тикает и ничего не пишет. */
export interface MiniStand {
  phase: 'start' | 'play' | 'end';
  /** Кадр выбора тактики перед матчем (Э4.50, 51): матч ещё не начался. */
  pick?: boolean;
  /** Зерно кадра «старт»: состав на старте и в матче, который начнётся с Enter, раздаст оно (067-Р261). */
  seed?: number;
  state?: MiniState;
  /** Часы матча кадра, мс. */
  now?: number;
  end?: FunEnd;
}
