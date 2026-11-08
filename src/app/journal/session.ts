/**
 * Сеанс игры в журнале (спека 018 design §5, Т4): запись `session { start, end, minutes }` — сколько минут ушло
 * на матч, школу, игры, базу и перерыв. Один сеанс игрока — одна запись с постоянным `id`, перезаписывается при
 * смене маршрута и при уходе со страницы. Время на скрытой вкладке не считается. Чисто: часы и окно — снаружи.
 */
import type { Journal } from './journal';

export type Area = 'match' | 'school' | 'game' | 'base' | 'rest';
export const AREAS: readonly Area[] = ['match', 'school', 'game', 'base', 'rest'];

/**
 * Область каждого маршрута `router.ts` — явно: новый маршрут без строки здесь краснит тест «все имена классифицированы»
 * (иначе экран молча попал бы в `base`). Матч — `match`, перерыв — `rest`, остальное — `base`.
 */
export const ROUTE_AREA: Readonly<Record<string, Area>> = {
  match: 'match',
  parent: 'base',
  players: 'base',
  start: 'base',
  map: 'base',
  path: 'base',
};

/** Куда относится маршрут: по таблице; школа (`school*`) и кубок (`cup*`) — ещё нет в роутере — и перерыв — по имени; незнакомое — `base`. */
export function areaOf(routeName: unknown): Area {
  const n = typeof routeName === 'string' ? routeName : '';
  const known = ROUTE_AREA[n];
  if (known !== undefined) return known;
  if (n.startsWith('school')) return 'school';
  if (n.startsWith('cup')) return 'match'; // кубок v2 (037) — матч, как в v1
  if (n === 'break' || n === 'rest') return 'rest';
  return 'base';
}

export interface SessionData {
  start: number;
  end: number;
  minutes: Record<Area, number>;
}

export interface SessionSnapshot {
  player: string;
  /** Постоянный на сеанс игрока — перезапись, не новая запись. */
  id: string;
  data: SessionData;
}

const round2 = (min: number): number => Math.round(min * 100) / 100;

/** Счётчик минут по областям. `go` — вошёл в область (и/или сменился игрок), `pause`/`resume` — вкладка скрыта/видна. */
export function createSessionTracker(now: () => number, tab: string) {
  let player: string | null = null;
  let start = 0;
  let area: Area = 'base';
  let since: number | null = null;
  let hidden = false;
  let ms: Record<Area, number> = { match: 0, school: 0, game: 0, base: 0, rest: 0 };

  function accrue(): void {
    const t = now();
    if (since !== null) ms[area] += Math.max(0, t - since);
    if (since !== null) since = t;
  }

  function snapshot(): SessionSnapshot | null {
    if (player === null) return null;
    accrue();
    const total = AREAS.reduce((a, k) => a + ms[k], 0);
    if (total <= 0) return null;
    const minutes = Object.fromEntries(AREAS.map((k) => [k, round2(ms[k] / 60_000)])) as Record<Area, number>;
    return { player, id: `${player}.session.${start.toString(36)}.${tab}`, data: { start, end: now(), minutes } };
  }

  return {
    /** Вошёл в область; другой игрок — прежний сеанс закрыт (вернётся в `closed`), начат новый. */
    go(next: Area, who: string | null): { closed: SessionSnapshot | null } {
      let closed: SessionSnapshot | null = null;
      if (who !== player) {
        closed = snapshot();
        player = who;
        start = now();
        ms = { match: 0, school: 0, game: 0, base: 0, rest: 0 };
      } else accrue();
      area = next;
      if (!hidden) since ??= now();
      return { closed };
    },
    snapshot,
    pause(): void {
      accrue();
      since = null;
      hidden = true;
    },
    resume(): void {
      hidden = false;
      since ??= now();
    },
  };
}

export interface SessionWiring {
  journal: { log: Journal['log']; flush: Journal['flush'] };
  now(): number;
  tab: string;
  /** Игрок в этой вкладке; нет — нечего писать. */
  player(): string | null;
  /** Подписки окна. Каждая возвращает отписку. */
  onRoute(cb: (name: unknown) => void): () => void;
  onHidden(cb: () => void): () => void;
  onVisible(cb: () => void): () => void;
  onPageHide(cb: () => void): () => void;
  /** Начальный маршрут (на момент запуска). */
  route(): unknown;
  /** Вкладка скрыта уже при запуске (открыта в фоне): минуты не идут до первого `visible`. Нет — видна. */
  hidden?(): boolean;
}

/** Подключить сеанс: смена маршрута и игрока → запись, `hidden`/`pagehide` → запись и сброс очереди. Возвращает отключение. */
export function startSession(w: SessionWiring): () => void {
  const tracker = createSessionTracker(() => w.now(), w.tab);
  const write = (s: SessionSnapshot | null): void => {
    if (s !== null) w.journal.log([{ kind: 'session', id: s.id, data: s.data }], s.player);
  };
  const enter = (name: unknown): void => {
    const { closed } = tracker.go(areaOf(name), w.player());
    write(closed);
    write(tracker.snapshot());
  };
  const away = (): void => {
    write(tracker.snapshot());
    tracker.pause();
    void w.journal.flush();
  };
  if (w.hidden?.() === true) tracker.pause();
  enter(w.route());
  const offs = [
    w.onRoute(enter),
    w.onHidden(away),
    w.onPageHide(away),
    w.onVisible(() => {
      tracker.resume();
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
}
