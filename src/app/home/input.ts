/**
 * Вход правил Дома из разделов сеанса (065 К-Д): единственное место, где собирается `HomeInput`. Чистая функция:
 * разделы, факты пакета, поставщики и «сегодня» приходят снаружи — ни хранилища, ни часов, ни Vue.
 * Номер урока — по порядку пакета: id устойчивы, номера нет (059-Р5); `current` вне порядка — первый непройденный (063 §2).
 */
import cfg from '../../content/yard.json';
import type { HomeExtras, HomeInput } from '../../engine/home';
import { emptyCup, type Cup } from '../../engine/cup';
import { emptyStory, storyExtras, type Story } from '../../engine/story';
import { cupHome } from '../cup/input';
import { titleFestive } from '../cup/title';
import type { CourseProgress } from '../../engine/course/reconcile';
import type { Day } from '../../engine/day/section';
import type { Stadium } from '../../engine/home/section';
import type { Wallet } from '../../engine/rewards/section';
import type { Shop } from '../../engine/shop/section';

export interface HomeSections {
  course: CourseProgress;
  day: Day;
  wallet: Wallet;
  stadium: Stadium;
  /** Купленное в Лавке (067 Т12); нет раздела — ничего не куплено. */
  shop?: Shop;
  /** Кубок Двора (068 Т5) и сюжет (выпуски газеты для замка Музея и метки «свежая»); нет раздела — пустой. */
  cup?: Cup;
  story?: Story;
  /** Семя Кубка — хэш id игрока (068-Р4); чужие матчи группы от него не зависят от входа Дома, но раунд соперника — да. */
  seed?: number;
}

/** Что Дому нужно от пакета: порядок уроков и товарищеские. */
export interface PackFacts {
  order: readonly string[];
  friendly: ReadonlySet<string>;
}

const DAY_MS = 86_400_000;
const dayNumber = (d: string): number => Date.parse(`${d}T00:00:00Z`) / DAY_MS;

/** Номер текущего урока 1…32; 33 — Двор пройден. */
export function currentLesson(course: CourseProgress, order: readonly string[]): number {
  const passed = (id: string): boolean => course.lessons[id]?.done !== undefined;
  const at = order.indexOf(course.current);
  const first = order.findIndex((id) => !passed(id));
  if (at < 0) return first < 0 ? order.length + 1 : first + 1;
  // Двор пройден: указатель стоит на последнем уроке, и он пройден
  if (at === order.length - 1 && passed(course.current)) return order.length + 1;
  return at + 1;
}

/** Игровой день по счёту (ТЗ-10.2): сегодня уже играли — `days`, иначе следующий по счёту. */
export const gameDay = (d: Day, today: string): number => (d.today === today ? d.days : d.days + 1);

/** Прошло ≥ 5 календарных дней с последнего матча (ТЗ-2.11): на главной разминка без счёта. Матчей ещё не было — нет. */
export const pausedLong = (d: Day, today: string): boolean => d.last !== null && dayNumber(today) - Math.floor(d.last / DAY_MS) >= cfg.pause.days;

export function homeInputOf(s: HomeSections, facts: PackFacts, extras: HomeExtras, today: string): HomeInput {
  const cur = currentLesson(s.course, facts.order);
  const stars: Record<number, number> = {};
  facts.order.forEach((id, i) => {
    const m = s.course.lessons[id];
    if (m !== undefined && m.stars > 0) stars[i + 1] = m.stars;
  });
  const curId = facts.order[cur - 1];
  const day = gameDay(s.day, today);
  const pause5 = pausedLong(s.day, today);
  const cupIn = cupHome(s.cup ?? emptyCup(), { cur, day: today, dayN: day, pause5, seed: s.seed ?? 0 });
  return {
    cur,
    day,
    matchesToday: s.day.today === today ? s.day.todayN : 0,
    played: s.day.played,
    stars,
    best: curId === undefined ? 0 : (s.course.lessons[curId]?.best ?? 0),
    coins: s.wallet.coins,
    fans: s.stadium.fans,
    bought: s.shop?.bought ?? [],
    friendly: curId !== undefined && facts.friendly.has(curId),
    round: cupIn.round,
    end: cupIn.end,
    // Района в Э1 нет (068-Р8): после титула главная — «За звёздами», а не «В Район»
    region: false,
    festive: titleFestive(s.cup ?? emptyCup(), today),
    pause5,
    extras: { ...storyExtras(s.story ?? emptyStory()), ...(cupIn.card === null ? {} : { cup: cupIn.card }), silver: cupIn.silver, ...extras },
  };
}
