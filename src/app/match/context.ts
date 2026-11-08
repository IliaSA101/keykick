/**
 * Матч v2 (спека 017, Т5в): сборка того, что экрану нужно кроме `MatchView` — `MatchContext` для вступления,
 * табло и пенальти и `ResultExtras` для итога. Чистые функции: данные игрока и часы приходят параметрами,
 * сам поток их не знает. Слой `app` на компоненты не смотрит: `MatchContext` описан здесь по форме
 * `components/match/context.ts` (совпадение проверяет экран при передаче пропа).
 */
import { type Club, type ClubData } from '../../engine/club/names';
import { clubKit, pickRival } from '../../engine/club/kit';
import type { YardRival } from '../../engine/club/rival';
import type { Kit, KitColors } from '../../engine/kit';
import type { Layout } from '../../engine/keymap';
import type { CourseLesson } from '../../engine/course/model';
import { formGrowth } from '../../engine/matchResult/form';
import type { MatchState } from '../../engine/match/machine';
import type { ResultExtras } from '../../engine/matchResult/resultModel';
import type { MatchRules } from '../../engine/match/rules';
import type { Task } from '../../engine/tasks';
import type { MatchData } from './store';

/** Форма `components/match/context.ts` (design §10). */
export interface MatchCtx {
  lessonName: string;
  newKeys: string;
  tip: string | null;
  layout: Layout;
  g: number;
  c: number;
  usName: string;
  rivalName: string;
  usKit: Kit | null;
  rivalKit: Kit | null;
  kickTask: Task | null;
  coachMs: number;
  comeback?: boolean;
  softened?: boolean;
}

/** Кто играет: свой клуб и соперник (что есть в сохранении и данных клубов; чего нет — null). */
export interface Sides {
  usName: string;
  rivalName: string;
  usKit: Kit | null;
  rivalKit: Kit | null;
}

/**
 * Зерно соперника: от урока и клуба, а не от часов (017-Р43). Один матч — один соперник, и после F5 тоже;
 * на другом уроке выпадет другой. Строка → число 0…0x7ffffffe (FNV-1a), клуб без имени допустим.
 */
export function rivalSeed(lessonId: string, clubName: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${lessonId}|${clubName}`) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return h % 0x7fffffff;
}

/** Свой клуб (или «Мы» без клуба) и соперник по зерну: имя и форма от `pickRival`, чтобы не совпасть с формой своей команды. */
export function matchSides(o: { club: Club | null; usKit: Kit | null; usDefault: string; data: ClubData; seed: number }): Sides {
  const rival = pickRival(o.data, o.club, o.seed, o.usKit);
  return { usName: o.club?.name ?? o.usDefault, rivalName: rival.name, usKit: o.usKit, rivalKit: rival.kit };
}

/**
 * Стороны матча Двора (019-Т11): свой клуб v2 и «Двор на <улица>» его города. Форма — надетая из коллекции (`worn`),
 * иначе домашняя клуба; соперник подбирается против той формы, в которой выходим. `rivalOf` — `matchRival` с зерном.
 */
export function yardSides(o: { club: { name: string; kit: KitColors }; worn: Kit | null; rivalOf: (kit: KitColors) => YardRival }): Sides {
  const usKit = o.worn ?? clubKit({ name: o.club.name, kit: o.club.kit });
  const rival = o.rivalOf(usKit);
  return { usName: o.club.name, rivalName: rival.name, usKit, rivalKit: rival.kit };
}

/** Из состояния машины нужны только место пенальти и число провалов подряд. */
export type CtxState = Pick<MatchState, 'kick' | 'kickId' | 'fails'>;

export interface CtxInput {
  lesson: CourseLesson;
  rules: MatchRules;
  tasks: readonly Task[];
  sides: Sides;
  state: CtxState;
  /** Баннер «Капитан вернулся!» (`flow.comeback`). */
  comeback: boolean;
  /** Матч идёт смягчённой копией (`state.cfg.softened`): строка на вступлении. */
  softened?: boolean;
}

/**
 * Совет на матч: при каждом новом провале подряд — следующий (по кругу), чтобы повтор не читал то же самое.
 * Нет советов — null (вступление без блока).
 */
export function tipFor(tips: readonly string[], fails: number): string | null {
  if (tips.length === 0) return null;
  return tips[Math.max(0, fails) % tips.length] ?? null;
}

/** Задача пенальти текущего тайма: уже показанная (`kick`) или выбранная на тайм (`kickId`); неизвестный id и «нет удара» — null. */
export function kickTaskOf(tasks: readonly Task[], s: Pick<MatchState, 'kick' | 'kickId'>): Task | null {
  const id = s.kick?.taskId ?? s.kickId;
  return id === null ? null : (tasks.find((t) => t.id === id) ?? null);
}

export function matchCtx(i: CtxInput): MatchCtx {
  const { lesson } = i;
  return {
    lessonName: lesson.name,
    newKeys: lesson.newKeys,
    tip: tipFor(lesson.tips, i.state.fails),
    layout: lesson.layout,
    g: lesson.g,
    c: lesson.c,
    ...i.sides,
    kickTask: kickTaskOf(i.tasks, i.state),
    coachMs: i.rules.coach.ms,
    comeback: i.comeback,
    softened: i.softened ?? false,
  };
}

/** Что накопил матч с начала: данные хранилища до него и верные нажатия (`tally.ts`). */
export interface MatchTotals {
  before: MatchData;
  correct: number;
}

/** Итог: помощь и потолки из машины и правил; монеты и рост формы — разница хранилища до матча и сейчас. */
export function resultExtras(s: MatchState, after: MatchData, t: MatchTotals): ResultExtras {
  const { rules } = s.cfg;
  const paid = s.cfg.paid;
  return {
    help: s.help,
    softened: s.cfg.softened,
    rules,
    paid,
    correct: t.correct,
    coins: paid ? Math.max(0, after.wallet.coins - t.before.wallet.coins) : 0,
    carry: after.wallet.carry,
    growth: formGrowth(t.before.form, after.form, rules.squad, rules.form),
    report: s.cfg.lesson.control ? rules.squad.map((p) => ({ name: p.name, rank: after.form[p.finger]?.maxRank ?? 0 })) : null,
  };
}
