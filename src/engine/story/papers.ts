/**
 * Выпуски газеты Двора (068 Т3, ТЗ-9.3, 10.3; story.md §2): веха → выход в игровой день вехи, показ один раз,
 * метка «свежий». Чистые функции: день приходит снаружи, вехи Кубка — от `cupMilestones` (К-А).
 */
import cfg from '../../content/story-yard.json';
import type { CupMilestones } from '../cup/types';
import { PAPER_COUNT, type PaperFixed, type Story } from './section';

/** Вехи Кубка — часть `cupMilestones` из `engine/cup` (К-А): сыгран первый матч, группа пройдена, полуфинал выигран, финал. */
export type Milestones = Pick<CupMilestones, 'first' | 'group' | 'semi' | 'final'>;

export interface PaperCtx {
  /** Текущий урок Двора, 1…32; 33 — пройден (урок N пройден ⇔ cur > N). */
  cur: number;
  cup: Milestones;
  /** Игровой день (`Day.days`). */
  day: number;
  /** Числа клуба на этот день (068-Р30): записываются в выходящие выпуски; не передали — выпуск без снимка. */
  facts?: PaperFixed;
}

type Trigger = { lesson: number } | { cup: 'first' | 'group' | 'semi' | 'final' };

function reached(t: Trigger, c: PaperCtx): boolean {
  if ('lesson' in t) return c.cur > t.lesson;
  return t.cup === 'final' ? c.cup.final !== null : c.cup[t.cup];
}

/** Выпуски, вехи которых наступили, а самих выпусков в разделе ещё нет: выходят в день `ctx.day`. Уже вышедшие не трогаем. */
export function releasePapers(story: Story, ctx: PaperCtx): Story {
  let papers = story.papers;
  for (const p of cfg.papers) {
    if (papers[String(p.n)] !== undefined || !reached(p.trigger as Trigger, ctx)) continue;
    papers = { ...papers, [String(p.n)]: { day: ctx.day, shown: false, ...(ctx.facts === undefined ? {} : { facts: ctx.facts }) } };
  }
  return papers === story.papers ? story : { ...story, papers };
}

/** Номера вышедших выпусков по возрастанию. */
export const releasedPapers = (story: Story): number[] =>
  Array.from({ length: PAPER_COUNT }, (_, k) => k + 1).filter((n) => story.papers[String(n)] !== undefined);

/** Непоказанный выпуск с наименьшим номером (050-Р33: по номеру, по одному на вход и на итог); `null` — все показаны. */
export const unshownPaper = (story: Story): number | null => releasedPapers(story).find((n) => story.papers[String(n)]?.shown === false) ?? null;

/** Флаг «показан» — при открытии окна, повтор безвреден (С2). */
export function markPaperShown(story: Story, n: number): Story {
  const p = story.papers[String(n)];
  return p === undefined || p.shown ? story : { ...story, papers: { ...story.papers, [String(n)]: { ...p, shown: true } } };
}

/** Звание «Знаток» в выпуске n получено впервые (068-Р31): в нём оно есть, а в прошлых вышедших выпусках — нет. Крупное поздравление — только в таком выпуске. */
export const firstTitleIn = (story: Story, n: number): boolean =>
  story.papers[String(n)]?.facts?.title === true && !releasedPapers(story).some((k) => k < n && story.papers[String(k)]?.facts?.title === true);

/** Данные для Дома (`HomeExtras`): сколько выпусков вышло и в какой день вышел последний — метка «свежая газета». */
export function storyExtras(story: Story): { papers: number; paperDay: number | null } {
  const days = releasedPapers(story).map((n) => story.papers[String(n)]!.day);
  return { papers: days.length, paperDay: days.length === 0 ? null : Math.max(...days) };
}

/** Музей открыт с первого показанного выпуска (ТЗ-10.3). */
export const museumOpen = (story: Story): boolean => Object.values(story.papers).some((p) => p.shown);
