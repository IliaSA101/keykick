/**
 * Что экрану матча v2 нужно, кроме `MatchView` (спека 017, design §10): подписи, формы, задача пенальти.
 * Собирает `app/match/flow.ts`; тип описан здесь, слой `app` на компоненты не смотрит — совпадение по форме.
 */
import type { Kit } from '../../engine/kit';
import type { Layout } from '../../engine/keymap';
import type { Task } from '../../engine/tasks';

export interface MatchContext {
  lessonName: string;
  /** Новые клавиши урока («ыв»); пусто — не показывать. */
  newKeys: string;
  /** Совет тренера на этот матч; null — без совета. */
  tip: string | null;
  layout: Layout;
  /** Пороги урока без помощи: для правил во вступлении (во время матча мячи считает `MatchView.reserve`). */
  g: number;
  c: number;
  usName: string;
  rivalName: string;
  /** Формы на табло; null — без формы. */
  usKit: Kit | null;
  rivalKit: Kit | null;
  /** Задача пенальти (`kickTask`); null — удара не будет. */
  kickTask: Task | null;
  /** Длина минуты тренера, мс (`rules.coach.ms`). */
  coachMs: number;
  /** Вернулись после паузы ≥ 5 дней (`comebackDue`): на вступлении баннер «Капитан вернулся!». */
  comeback?: boolean;
  /** Матч идёт смягчённой копией (017-Р55): на вступлении строка о смягчении (Р57). */
  softened?: boolean;
}
