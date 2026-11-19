/**
 * Кнопки итога Кубка и «Итог дня» (068-Р71): что делает главная кнопка на каждом шаге — окно титула, окно награды, карточка —
 * и куда ведёт «Ещё матч» в полосе. Чистые функции: экран только исполняет ответ. Если матч довёл день до итога, любой уход с итога
 * (включая «Сыграть финал ещё раз» после серебра) идёт сначала через «Итог дня».
 */
import { ru } from '../../i18n/ru';
import type { ResultGo } from '../result/card';
import type { CupAward } from './awards';

/** Что исполнить: следующий шаг титула, окно награды по номеру, открыть «Итог дня» или уйти. */
export type CupStep = { kind: 'title' } | { kind: 'award'; at: number } | { kind: 'summary' } | { kind: 'go'; to: ResultGo };

export interface CupStepIn {
  /** Титульный ролик или окно: `more` — есть следующий шаг титула, `last` — титул кончается, `null` — титула нет. */
  title: 'more' | 'last' | null;
  /** Окна наград (серебро или формы) и номер показанного: `-1` — карточка ещё впереди. */
  awards: readonly CupAward[];
  at: number;
  /** Куда ведёт главная кнопка карточки Кубка. */
  cardGo: 'next' | 'replay';
  /** Матч довёл день до итога и он ещё не открыт. */
  summary: boolean;
}

/** Куда ведёт «Ещё матч» полосы и уход с карточки: Карта после победы (раунд сыгран — повторять нечего) или повтор (поражение, серебро). */
export const cupMoreGo = (cardGo: 'next' | 'replay', awards: readonly CupAward[]): ResultGo => (awards[0]?.primaryGo === 'replay' || cardGo === 'replay' ? 'replay' : 'map');

/** Вторая кнопка полосы «Итог дня» и выпуска вместо неё: маршрут и подпись — одно решение (068-Р99). Не Кубок — повтор матча; Кубок — по `cupMoreGo`: Карта после победы («На карту»), повтор после поражения и серебра («Ещё матч»). */
export function stripMoreAct(cup: { cardGo: 'next' | 'replay'; awards: readonly CupAward[] } | null): { go: ResultGo; label: string } {
  const go: ResultGo = cup === null ? 'replay' : cupMoreGo(cup.cardGo, cup.awards);
  return { go, label: go === 'map' ? ru.home.doneAction : ru.day.act.more };
}

export function cupStep(i: CupStepIn): CupStep {
  const out = (to: ResultGo): CupStep => (i.summary ? { kind: 'summary' } : { kind: 'go', to });
  if (i.title !== null) return i.title === 'more' ? { kind: 'title' } : out('home');
  const a = i.awards[i.at];
  if (a !== undefined && a.primaryGo === 'replay') return out('replay');
  if (a !== undefined) return i.at + 1 < i.awards.length ? { kind: 'award', at: i.at + 1 } : out(cupMoreGo(i.cardGo, i.awards));
  return i.awards.length > 0 && i.at < 0 ? { kind: 'award', at: 0 } : out(cupMoreGo(i.cardGo, i.awards));
}
