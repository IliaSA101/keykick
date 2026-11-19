/**
 * Условия входа на Дом (068 Т7, 068-Р45): когда вход вообще считается и что `enterHome` получает на вход. Чистая функция: сеанс, часы и разделы приходят снаружи,
 * Vue — только в `useStoryEntry`. Не считаем (`null`): стенд кадров (`off`), вход уже сделан (`done`), входа правил или игрока ещё нет, вторая вкладка (сеанс не `ok`).
 */
import { cupMilestones } from '../../engine/cup';
import type { HomeInput } from '../../engine/home';
import type { EntryCtx } from './entry';
import { numbersOf } from './paperFacts';
import { paperInOf, type PaperSections } from './paperIn';

export interface EntryAsk {
  off: boolean;
  done: boolean;
  /** Статус сеанса игрока (`ok` — пишет, иначе только смотрит). */
  status: string;
  pid: string | undefined;
  input: Pick<HomeInput, 'cur' | 'day'> | null;
  /** Разделы игрока — читаются только когда вход считается. */
  sections: () => PaperSections;
}

/** Вход для `enterHome` или `null` — вход не считаем. Числа клуба на день входа (`facts`) идут в выходящие выпуски (068-Р30). */
export function entryCtxOf(a: EntryAsk): { ctx: EntryCtx; sections: PaperSections } | null {
  if (a.off || a.done || a.input === null || a.pid === undefined || a.status !== 'ok') return null;
  const sections = a.sections();
  return { ctx: { cur: a.input.cur, cup: cupMilestones(sections.cup), day: a.input.day, facts: numbersOf(paperInOf(sections)) }, sections };
}
