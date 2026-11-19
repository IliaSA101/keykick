/**
 * Карточки перерыва матча без Vue (067 Т18, кадры Э4.15–20, 48): что показать вместо «Второго тайма» одним — две игры очереди
 * (ТЗ-7.3, 7.4), «побей рекорд», «после игры» и «Права на компьютер» (ТЗ-7.6). Чистые функции: очередь — `engine/learn/queue`,
 * ставка и итог — `app/learn/view`, тексты — `ru.learn.brk`, подстановки делает вызывающий.
 */
import { breakCards, GAMES, gameOf, type Card, type LearnCtx } from '../../engine/learn/queue';
import type { Learn } from '../../engine/learn/section';
import type { RightsCard, Step } from '../../engine/learn/steps';
import { ru } from '../../i18n/ru';
import { gameName, SCHOOL_KIND, stakeOf, type EndModel } from '../learn/view';

/** Карточка очереди: что показать на ней (кадры Э4.15, 18, 19). */
export interface CardView {
  id: string;
  /** `record` — «побей рекорд» золотой игры (0 монет). */
  kind: 'game' | 'record';
  name: string;
  /** Что учит игра: «галочки», «стрелки ← ↑ → ↓». */
  skill: string;
  /** «к «Школе»: …» у тренажёров 5–8; у остальных пусто. */
  school: string;
  step: Step;
  /** Игра открыта и ещё не играна: метка «новое». */
  isNew: boolean;
  /** Ставка за игру, монет; у «побей рекорд» 0. */
  stake: number;
  /** Лучшее время, мс (рекорд золотой игры). */
  best: number | null;
}

/** Что сказать над карточками: обычные две / одна не на золоте и одна «побей рекорд» / все на золоте. */
export type BreakLead = 'play' | 'oneGold' | 'allGold';

/** Слово вида ответа «Школы» у игры 5–8 (`ru.school.parts` короче, `kinds` — полное); у игр 1–4 свои слова `ru.learn.brk.skill`. */
const kindWord = (id: string, long: boolean): string | undefined => {
  const k = SCHOOL_KIND[id];
  return k === undefined ? undefined : ((long ? undefined : ru.school.parts[k]) ?? ru.school.kinds[k]);
};
export const skillOf = (id: string, long = false): string => kindWord(id, long) ?? ru.learn.brk.skill[id] ?? '';

export function cardView(c: Card, learn: Learn, ctx: LearnCtx): CardView {
  const g = gameOf(learn, c.id);
  const kind = SCHOOL_KIND[c.id];
  const school = c.kind === 'game' && c.toSchool && kind !== undefined ? ru.learn.schoolLink.replace('{kind}', ru.school.kinds[kind] ?? '') : '';
  return {
    id: c.id,
    kind: c.kind === 'record' ? 'record' : 'game',
    name: gameName(c.id),
    skill: skillOf(c.id),
    school,
    step: g.step as Step,
    isNew: c.kind === 'game' && g.plays === 0,
    stake: c.kind === 'record' ? 0 : stakeOf(ctx, learn, c.id),
    best: g.best,
  };
}

/** Слова над карточками по их виду; нет карточек — `null` (сразу «Второй тайм»). */
export function breakLead(cards: readonly Pick<CardView, 'kind'>[]): BreakLead | null {
  if (cards.length === 0) return null;
  const records = cards.filter((c) => c.kind === 'record').length;
  return records === 0 ? 'play' : records === cards.length ? 'allGold' : 'oneGold';
}

export interface BreakPlan {
  cards: CardView[];
  lead: BreakLead | null;
}

/** Карточки перерыва по разделу `learn` и фактам игрока; `ok` — сеанс годен для записи (нет — карточек нет: монеты записать некуда). */
export function breakPlan(learn: Learn, ctx: LearnCtx, ok: boolean): BreakPlan {
  const cards = ok ? breakCards(learn, ctx).map((c) => cardView(c, learn, ctx)) : [];
  return { cards, lead: breakLead(cards) };
}

/** Что осталось от только что сыгранной игры, пока окно закрыто: итог на карточке «после игры» (Э4.17). */
export interface AfterGame {
  id: string;
  end: EndModel;
}

/** «Ещё игра»: первая карточка очереди, кроме только что сыгранной (она ушла в хвост); других нет — кнопки нет. */
export const nextAfter = (cards: readonly Pick<CardView, 'id'>[], playedId: string): string | null => cards.find((c) => c.id !== playedId)?.id ?? null;

/** Строка удостоверения (Э4.20): умение, ступень, замок — «нужно к «Школе», тур N» только у тренажёров 5–8, у остальных «ещё нет ступени». */
export interface RightRow {
  id: string;
  skill: string;
  step: Step;
  /** Это умение получено только что: метка «новое». */
  fresh: boolean;
  /** Нет ступени и игра открывается туром «Школы»: номер тура; иначе `null`. */
  tour: number | null;
}

export function rightRows(card: RightsCard, freshId: string): RightRow[] {
  return card.items.map((r) => ({ id: r.id, skill: skillOf(r.id, true), step: r.step as Step, fresh: r.id === freshId, tour: r.have ? null : r.tour }));
}

/** Сколько умений из всех получено. */
export const rightsGot = (card: RightsCard): { n: number; of: number } => ({ n: card.items.filter((r) => r.have).length, of: GAMES.length });

/** Ступень для медали (1–3): ступень 0 медали не имеет, её вызывающий не рисует. */
export const medalTier = (step: number): 1 | 2 | 3 => (step >= 3 ? 3 : step === 2 ? 2 : 1);

/** «Права на компьютер», ждущие показа, и «Второй тайм», нажатый раньше них (ТЗ-7.6, 067-Р190). */
export interface RightsFlow {
  rights: { card: RightsCard; fresh: string } | null;
  /** «Второй тайм» нажат, пока «Права» впереди: после их закрытия матч идёт дальше. */
  held: boolean;
}

export type RightsEvent =
  /** Игра закончилась: `rights` — новая карточка, если умение получено именно ею. */
  | { do: 'played'; game: string; rights: RightsCard | null }
  /** «Второй тайм» из окна игры. */
  | { do: 'second' }
  /** «Права» закрыты (Enter, «Дальше», 10 с). */
  | { do: 'closeRights' };

export const NO_RIGHTS: RightsFlow = { rights: null, held: false };

/**
 * Шаг перерыва с «Правами» (067-Р190): новое умение не стирает непоказанное старое (вторая игра без умения — права остаются);
 * «Второй тайм» при непоказанных «Правах» откладывается до их закрытия; `go` — матч идёт дальше сейчас.
 */
export function rightsStep(s: RightsFlow, e: RightsEvent): { state: RightsFlow; go: boolean } {
  if (e.do === 'played') return { state: { ...s, rights: e.rights === null ? s.rights : { card: e.rights, fresh: e.game } }, go: false };
  if (e.do === 'second') return s.rights === null ? { state: s, go: true } : { state: { ...s, held: true }, go: false };
  return { state: NO_RIGHTS, go: s.held };
}
