/**
 * Правила Дома (065-Т5, 065-Р11): перенос `tools/mock-map/home-rules.mjs` в чистые функции «вход → ключи и числа».
 * Равенство с макетом на всех состояниях `S` и `kids.json` держит `tests/home/rules.test.ts` (К5).
 * Главная кнопка — одна на экран: ранний неначатый раунд Кубка; иначе следующий урок; после 32 — «В Район» или «За звёздами».
 */
import cfg from '../../content/yard.json';
import type { CupCard, Dream, HomeInput, HouseId, HouseView, MainAction } from './input';
import { isAway, isControl, isHomeRound, lessonsOf, stageOf, streetOf, YARD_LESSONS } from './yard';

const starsOf = (i: HomeInput, lesson: number): number => i.stars[lesson] ?? 0;

/** Сколько звёзд не хватает двору, где ★★★ ещё нет: «приглашение к золоту» (ТЗ-4.8). */
export function goldHint(i: HomeInput): { missing: number; from: number; to: number } {
  const first = Array.from({ length: YARD_LESSONS }, (_, k) => k + 1).find((l) => starsOf(i, l) < 3) ?? 1;
  const ls = lessonsOf(stageOf(first));
  return { missing: ls.reduce((a, l) => a + 3 - Math.min(3, starsOf(i, l)), 0), from: ls[0]!, to: ls[ls.length - 1]! };
}

/** Какая карточка Кубка на Доме (ТЗ-1.5); `round` — раунд на главной кнопке. */
export function cupCard(i: HomeInput): CupCard {
  if (i.round !== null) return { key: 'flag', flag: i.round, final: i.round === cfg.rounds[cfg.rounds.length - 1], afterWarmup: i.pause5 };
  if (i.end) return { key: 'ours' };
  return i.extras.cup ? { key: 'provided', data: i.extras.cup } : { key: 'before' };
}

/** Главная кнопка Дома (023-Р32, Б1 с правкой pass3). */
export function mainAction(i: HomeInput): MainAction {
  const n = i.cur;
  if (i.round !== null && !i.pause5) {
    return { kind: 'round', flag: i.round, home: isHomeRound(i.round), street: streetOf(i.round), nextLesson: n > YARD_LESSONS ? null : n };
  }
  if (n > YARD_LESSONS) {
    if (i.region) return { kind: 'region', cup: i.end ? 'ours' : i.extras.silver === true ? 'silver' : 'waits' };
    return { kind: 'stars', ...goldHint(i) };
  }
  return {
    kind: 'lesson',
    lesson: n,
    control: isControl(n),
    friendly: i.friendly,
    home: !isAway(n),
    street: streetOf(n),
    best: i.best,
    warm: i.pause5,
    waitingFlag: i.pause5 ? i.round : null,
  };
}

/** Мечта в шапке (ТЗ-10.1): в день 1 — наклейка; дальше ближайшая некупленная вещь дороже порога. */
export function dreamOf(i: HomeInput): Dream {
  const pick = i.day === 1 ? cfg.catalog[0] : cfg.catalog.find((c) => c.price > cfg.dream.above && !i.bought.includes(c.id));
  if (!pick) return { kind: 'done', pct: 100 };
  if (i.cur < pick.from) return { kind: 'locked', item: pick.id, from: pick.from, pct: 0 };
  if (i.coins >= pick.price) return { kind: 'buy', item: pick.id, pct: 100 };
  return { kind: 'save', item: pick.id, left: pick.price - i.coins, pct: Math.round((i.coins / pick.price) * 100) };
}

/** Свежий выпуск газеты — «вышел сегодня» (023-Р35а): живёт до конца дня вехи и после первого матча дня. */
export const paperFresh = (i: HomeInput): boolean => i.extras.paperDay != null && i.extras.paperDay === i.day && i.matchesToday >= 1;

/** Табличка здания (Б3, 35, 41, 42): замок ТЗ-1.9, «после матча», событие дня, эмблема, метка. */
export function houseState(id: HouseId, i: HomeInput): HouseView {
  const none: HouseView = { lock: null, sub: null, mark: '' };
  const ev = i.extras.events?.[id];
  const mt = i.matchesToday;
  if (id === 'school') {
    const { day, matches } = cfg.locks.school;
    if (i.day < day) return { ...none, lock: { key: 'matches', n: matches - i.played, alt: 'next' } };
    if (mt === 0) return { ...none, sub: { key: 'afterMatch' }, mark: i.day === cfg.locks.newMarkDay.school ? 'new' : '' };
    return { ...none, sub: ev ? { key: 'event', event: ev } : i.extras.tourWaits === true ? { key: 'tourWaits' } : { key: 'emblem', n: i.extras.emblemN ?? 0 } };
  }
  if (id === 'locker') return { ...none, sub: ev ? { key: 'event', event: ev } : null };
  if (id === 'base') {
    const { day, matches } = cfg.locks.base;
    const left = matches - i.played;
    if (i.day < day && left > 0) return { ...none, lock: { key: 'matches', n: left, alt: i.day < 2 ? 'day3' : 'next' } };
    return { ...none, sub: mt === 0 ? { key: 'afterMatch' } : ev ? { key: 'event', event: ev } : null, mark: i.day === cfg.locks.newMarkDay.base && mt >= 1 ? 'new' : '' };
  }
  if (i.end) return { ...none, sub: { key: 'goldAward' } };
  if ((i.extras.papers ?? 0) < 1) return { ...none, lock: { key: 'firstPaper', n: cfg.papers.firstCur - 1, alt: null } };
  return { ...none, sub: ev ? { key: 'event', event: ev } : null, mark: paperFresh(i) && i.cur < 31 ? 'freshPaper' : '' };
}

/** Замок ТЗ-1.9 одной функцией: «Школа» и «База» открыты. */
export const systemOpen = (id: 'school' | 'base', i: HomeInput): boolean => houseState(id, i).lock === null;
