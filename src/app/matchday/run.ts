/**
 * Ход матчдэя (спека 019, design §7): после итога матча — цепочка шагов, потом карта.
 * План живёт в памяти: F5 посреди цепочки — карта (выдача шага — в `commit`, показ — шагом, 019 §7).
 * Переход — через переданную функцию: в приложении это `router.push` (роутер подгружается при первом переходе,
 * чтобы тест хода не тянул весь роутер); тест подставляет свою.
 * В план и в маршруты попадают только простые объекты, не Proxy Vue: их увидит слой записи и `structuredClone`.
 */
import type { RouteLocationRaw } from 'vue-router';
import { planMatchday, type StepOffer } from '../../engine/matchday/queue';
import type { MatchSummary } from '../../engine/matchday/summary';
import { MAP_PATH } from '../map/go';
import { steps as registry, type AppStep } from './steps';

type Offer = StepOffer<RouteLocationRaw>;

export interface Matchday {
  /** Итог матча уже показан («Дальше»): собрать цепочку и открыть первый шаг (или карту, если шагов нет). */
  start(m: MatchSummary): void;
  /** Шаг закончен: следующий шаг или карта. Шаг, которого сейчас нет в плане, ничего не двигает (двойной щелчок). */
  done(id: string): void;
  /** Шаги сверх лимита и лишние праздники: «новое» на карте (используют 022, 040). */
  queued(): readonly Offer[];
}

export function createMatchday(defs: readonly AppStep[], go: (to: RouteLocationRaw) => void): Matchday {
  let rest: Offer[] = [];
  let queued: Offer[] = [];
  let active = false;

  const toMap = (): void => {
    rest = [];
    active = false;
    go(MAP_PATH);
  };

  function open(): void {
    const first = rest[0];
    if (first) go(first.route);
    else toMap();
  }

  return {
    start(m) {
      const offers = defs.map((d) => d.offer(m)).filter((o): o is Offer => o !== null);
      const plan = planMatchday(offers);
      rest = [...plan.steps];
      queued = [...plan.queued];
      active = true;
      open();
    },
    done(id) {
      // Плана нет (F5 посреди цепочки) — карта; шаг не тот, что сейчас, — холостой вызов.
      if (!active) return toMap();
      if (rest[0]?.id !== id) return;
      rest.shift();
      open();
    },
    queued: () => queued,
  };
}

/** Переход приложения: роутер подгружается лениво, `router.ts` сам ничего из матчдэя не знает. */
const goRouter = (to: RouteLocationRaw): void => {
  void import('../router').then(({ router }) => router.push(to));
};

const day = createMatchday(registry, goRouter);

/** Зовёт итог матча на «Дальше». */
export const startMatchday = (m: MatchSummary): void => day.start(m);
/** Зовёт шаг, когда закончен. */
export const stepDone = (id: string): void => day.done(id);
export const matchdayQueued = (): readonly Offer[] => day.queued();
