/**
 * Тексты Дома из вида (`homeView`): ключи и числа → строки i18n. Чистые функции: экран подставляет готовое и ничего не считает.
 * Правила — `tools/mock-map/home-rules.mjs` (главная кнопка, замки), `home-parts.mjs` (табло, замок). Склонения — `i18n/plural`.
 */
import yard from '../../content/yard.json';
import type { HomeInput, HouseView } from '../../engine/home';
import type { HomeView } from '../../engine/home/view';
import { streetName, streetOf } from '../../engine/home';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const t = ru.home;
const NB = ' ';
const num = (n: number): string => n.toLocaleString('ru-RU').replace(/\s/g, NB);

/** Подстановка `{x}` в строку i18n. */
export const fill = (s: string, vars: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** «двор на <улица>» с неразрывным пробелом после «двор»: подпись не рвётся после первого слова. `street` — улица в родительном падеже. */
export const rivalName = (street: string): string => fill(t.rival, { street }).replace(' ', NB);
const whereOf = (home: boolean, street: number): string => fill(home ? t.homeGame : t.away, { rival: rivalName(streetName(street)) });

export interface MainText {
  /** Лента над кнопкой; вторая строка — метка вида урока. */
  lead: string;
  tag: { text: string; kind: '' | 'nt' } | null;
  action: string;
  where: string;
  /** Рекорд — отдельной строкой. */
  record: string;
}

/** Текст главной карточки по `MainAction`; `lessonName` — название урока из пакета. */
export function mainText(v: HomeView, lessonName: (n: number) => string): MainText {
  const m = v.main;
  const none = { tag: null, record: '' };
  if (m.kind === 'round') {
    const where = whereOf(m.home, m.street);
    const flag = t.flags[m.flag] ?? '';
    return { ...none, lead: fill(t.cupLead, { flag }), action: t.go, where: m.nextLesson === null ? where : `${where}${NB}·${NB}${fill(t.thenLesson, { n: m.nextLesson })}` };
  }
  if (m.kind === 'region') return { ...none, lead: fill(t.regionLead, { cup: m.cup === 'ours' ? '' : m.cup === 'silver' ? t.cupSilver : t.cupWaits }), action: t.region, where: t.regionWhere };
  if (m.kind === 'stars') return { ...none, lead: t.starsLead, action: t.stars2, where: fill(t.starsWhere, { missing: m.missing, from: m.from, to: m.to }) };
  const where = whereOf(m.home, m.street);
  const record = m.best > 0 ? fill(t.record, { n: m.best, signs: plural(m.best, t.signs) }) : '';
  const flag = m.waitingFlag === null ? '' : (t.flags[m.waitingFlag] ?? '');
  const tag = m.control ? { text: t.control, kind: '' as const } : m.friendly ? { text: t.friendly, kind: 'nt' as const } : null;
  return { lead: fill(t.lesson, { n: m.lesson, name: lessonName(m.lesson) }), tag, action: t.go, where: m.warm ? (flag === '' ? t.warm : fill(t.warmCup, { flag })) : where, record: m.warm ? '' : record };
}

/** Карточка Кубка: название, состояние, строка. */
export function cupText(v: HomeView): { state: string; sub: string } {
  const c = v.cup;
  if (c.key === 'flag') return { state: c.final ? t.cup.waitsFinal : fill(t.cup.waitsFlag, { flag: t.flags[c.flag] ?? '' }), sub: c.afterWarmup ? t.cup.afterWarm : t.cup.mainButton };
  if (c.key === 'ours') return { state: t.cup.ours, sub: t.cup.again };
  if (c.key === 'provided') return { state: c.data.key, sub: String(c.data.params?.sub ?? '') };
  return { state: t.cup.before, sub: t.cup.look };
}

/** Подписи таблички здания: строки и метка. */
export function houseText(h: HouseView): { rows: string[]; mark: string } {
  const mark = h.mark === 'new' ? t.markNew : h.mark === 'freshPaper' ? t.markPaper : '';
  if (h.lock) {
    if (h.lock.key === 'firstPaper') return { rows: [fill(t.firstPaper, { n: h.lock.n })], mark };
    const alt = h.lock.alt === 'day3' ? t.lockDay3 : t.lockNext;
    const n = h.lock.n;
    return { rows: fill(t.lockMatches, { n, matches: plural(n, t.matchesForms), alt }).split('|'), mark };
  }
  const s = h.sub;
  if (!s) return { rows: [], mark };
  const rows = s.key === 'afterMatch' ? [t.afterMatch] : s.key === 'tourWaits' ? [t.tourWaits] : s.key === 'emblem' ? [fill(t.emblem, { n: s.n ?? 0 })] : s.key === 'goldAward' ? [t.goldAward] : [s.event?.key ?? ''];
  return { rows, mark };
}

/** Строка табличке стадиона: что дальше, и подпись к табло. */
export function stadiumText(v: HomeView, i: HomeInput): { line: string; note: string } {
  const g = v.stadium.ghost;
  const line = i.end ? t.built : g ? fill(t.next, { name: t.steps[g.id] ?? '', n: g.lesson }) : t.nextOpening;
  const tb = v.stadium.tablo;
  if (tb.kind === 'none') return { line, note: '' };
  const goal = tb.goal;
  const note = tb.kind === 'fans' ? (goal ? fill(t.tabloFansGoal, { n: num(tb.n) }) : t.tabloFans) : goal ? fill(t.tabloOverGoal, { n: num(tb.n) }) : t.tabloOver;
  return { line, note };
}

/** Мечта в шапке: подсказка и доля копилки. */
export function dreamText(v: HomeView): { text: string; pct: number } {
  const d = v.dream;
  if (d.kind === 'done') return { text: t.dream.done, pct: 100 };
  const name = t.items[d.item] ?? d.item;
  if (d.kind === 'locked') return { text: fill(t.dream.locked, { name, from: d.from }), pct: 0 };
  if (d.kind === 'buy') return { text: fill(t.dream.buy, { name }), pct: 100 };
  return { text: fill(t.dream.save, { name, left: d.left }), pct: d.pct };
}

/** Улица двора-соперника урока — для окна «что построят» и подсказок. */
export const streetOfLesson = (lesson: number): string => streetName(streetOf(lesson));
export const stepsOf = yard.steps;

/** Надпись на экране табло (макет compose_layers: «КУБОК» у пройденного Двора, счёт «3:1» с купленной анимацией гола, иначе число). */
export function tabloLine(tb: HomeView['stadium']['tablo'], cur: number): string {
  if (cur >= 33) return t.tabloCup;
  if (tb.goal) return t.tabloGoal;
  return `${tb.kind === 'over' ? '+' : ''}${num(tb.n)}`;
}
