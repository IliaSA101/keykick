/**
 * Конец учебной игры (ТЗ-7.1, 7.5, 3.3; 067 К-Г): ступень, рекорд, последние игры и монеты по ставке — только через кассу
 * (`learn-coins`, страж С1). На «золоте» (ступень до игры = 3) монет нет — только рекорд. Повтор того же запуска
 * (двойной Enter) — сохранение без изменений. Часы и день приходят снаружи.
 */
import { credit, isPaid, type Wallet } from '../rewards/cash';
import type { Stadium } from '../home/section';
import type { School } from '../school/section';
import { GAMES, gameOf, type LearnCtx } from './queue';
import { rateHundredths } from './rate';
import { RECENT_MAX, type Learn } from './section';
import { rightsCard, stepOf, type LearnRun, type Moment, type RightsCard, type Step } from './steps';

/** Разделы игрока, которые меняет конец игры. */
export interface LearnSave {
  learn: Learn;
  wallet: Wallet;
  school: School;
  stadium: Stadium;
}

/** Имя раздела в конверте → данные: то, что отдают `session.save(patch)`. */
export const learnPatch = (s: LearnSave): Record<string, unknown> => ({ learn: s.learn, wallet: s.wallet });

export interface LearnView {
  /** Ступень за эту игру и лучшая после неё. */
  step: Step;
  stepAll: Step;
  /** Монеты за игру («+1…+6»); на «золоте» 0. */
  coins: number;
  /** Время игры, мс, и лучшее после неё; `record` — побит рекорд времени. */
  ms: number;
  best: number;
  record: boolean;
  /** Карточка «Права на компьютер», если пора (ТЗ-7.6). */
  rights: RightsCard | null;
}

export function finishLearn(save: LearnSave, run: LearnRun, ctx: LearnCtx, moment: Moment = 'break'): { save: LearnSave; view: LearnView | null } {
  const step = stepOf(run);
  const def = GAMES.find((g) => g.id === run.game);
  if (step === null || def === undefined || run.ms === null || isPaid(save.wallet, run.id)) return { save, view: null };
  const prev = gameOf(save.learn, run.game);
  const stepAll = Math.max(prev.step, step) as Step;
  const best = prev.best === null ? run.ms : Math.min(prev.best, run.ms);

  // монеты: на «золоте» — 0, остаток копится в сотых и переходит дальше (ТЗ-3.3)
  const paying = prev.step < 3;
  const total = (save.learn.rest ?? 0) + (paying ? rateHundredths(ctx.speeds, def.norm) : 0);
  const coins = paying ? Math.floor(total / 100) : 0;
  const purse = credit({ wallet: save.wallet, school: save.school, stadium: save.stadium }, 'learn-coins', coins, run.id);

  const games = { ...save.learn.games, [run.game]: { step: stepAll, plays: prev.plays + 1, best, last: ctx.day } };
  const recent = [...save.learn.recent.filter((id) => id !== run.game), run.game].slice(-RECENT_MAX);
  const learn: Learn = { games, recent, rest: paying ? total % 100 : (save.learn.rest ?? 0) };
  const view: LearnView = {
    step,
    stepAll,
    coins: purse.gain,
    ms: run.ms,
    best,
    record: prev.best === null || run.ms < prev.best,
    rights: rightsCard(learn, prev.step === 0, moment),
  };
  return { save: { ...save, learn, wallet: purse.purse.wallet }, view };
}
