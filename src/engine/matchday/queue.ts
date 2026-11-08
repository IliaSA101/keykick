/**
 * Каркас матчдэя (спека 019, design §7, ТЗ-10.11): очередь шагов после итога матча.
 * Порядок: пак → праздник (не больше одного) → школа → конец дня; лишнее уходит в `queued`.
 * Чистая функция; маршруты (`route`) и реестр шагов — в `app/matchday`.
 */
import type { MatchSummary } from './summary';

export type StepKind = 'pack' | 'celebration' | 'school' | 'dayEnd';

/** Порядок видов в цепочке. */
export const STEP_ORDER: readonly StepKind[] = ['pack', 'celebration', 'school', 'dayEnd'];

/** Не больше шагов до карты (итог матча — шаг 0 и сюда не входит). */
export const MAX_STEPS = 4;

/** Предложение шага; `R` — маршрут, его тип знает только `app` (движок не тянет vue-router). */
export interface StepOffer<R = unknown> {
  id: string;
  kind: StepKind;
  route: R;
}

/** Описание шага в реестре поставщика: предложить его по итогу матча или нет (null). */
export interface StepDef<R = unknown> {
  id: string;
  kind: StepKind;
  offer: (m: MatchSummary) => StepOffer<R> | null;
}

export interface MatchdayPlan<R = unknown> {
  steps: StepOffer<R>[];
  queued: StepOffer<R>[];
}

/**
 * План цепочки. Внутри вида — по id (первый по порядку выигрывает); праздник в цепочку берётся один, остальные
 * праздники — в `queued`; сверх `MAX_STEPS` позднее по порядку тоже в `queued`.
 */
export function planMatchday<R>(offers: readonly StepOffer<R>[]): MatchdayPlan<R> {
  const rank = (o: StepOffer<R>): number => STEP_ORDER.indexOf(o.kind);
  const sorted = offers
    .filter((o) => rank(o) >= 0)
    .sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const steps: StepOffer<R>[] = [];
  const queued: StepOffer<R>[] = [];
  let celebration = false;
  for (const o of sorted) {
    const isSecondCelebration = o.kind === 'celebration' && celebration;
    if (isSecondCelebration || steps.length >= MAX_STEPS) {
      queued.push(o);
      continue;
    }
    if (o.kind === 'celebration') celebration = true;
    steps.push(o);
  }
  return { steps, queued };
}
