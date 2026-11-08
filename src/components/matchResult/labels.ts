/**
 * Подписи итога матча v2 (спека 017, Т7): кнопка предложения и «чего не хватило» из данных `resultModel`.
 * Отдельно от .vue, чтобы тест видел дословные подписи (потолок звёзд в кнопке помощи, 017-Р12).
 */
import type { ResultButton, ResultWhy } from '../../engine/matchResult/resultModel';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const t = ru.match2Result;

/** Подпись кнопки (одна строка, ≤ 20 знаков): «С запасом ★★», «С тренером ★», «Переиграть тайм», «Дальше». */
export function buttonLabel(b: ResultButton): string {
  if (b.id === 'next') return t.next;
  return t.offers[b.id].replace('{stars}', '★'.repeat(b.stars));
}

/** Пояснение под звёздами: чего не хватило до победы или до следующей звезды; null — нечего сказать. */
export function whyText(w: ResultWhy | null): string | null {
  if (!w) return null;
  const s = t.shortfall;
  switch (w.kind) {
    case 'goals': return s.goals.replace('{n}', String(w.n)).replace('{w}', plural(w.n, s.words));
    case 'nextTry': return s.nextTry;
    case 'typedOnly': return s.typedOnly;
    case 'couldBeBetter': return s.couldBeBetter;
    case 'toTwo': return s.toTwo;
    case 'toThree': return s.toThree.replace('{n}', String(w.percent));
    case 'capHelp': return t.cap.help.replace('{stars}', '★'.repeat(w.cap));
    case 'capSoften': return t.cap.soften.replace('{stars}', '★'.repeat(w.cap));
  }
}

/** «верное» / «верных» к числу: «1 верное → 0 монет», «21 верное», «512 верных». */
export const correctWord = (n: number): string => plural(n, t.coins.correctWords);

/** «Ещё 8 верных — и монета» (копилка, ТЗ-2.12): сколько верных нажатий до следующей монеты. */
export const coinLeft = (k: number): string => t.coins.left.replace('{k}', String(k)).replace('{w}', correctWord(k));

/** Пояснение под кнопкой помощи: «звёзды: до ★★» (потолок звёзд, 017-Р49); у остальных кнопок нет. */
export const buttonNote = (b: ResultButton): string | null =>
  b.stars > 0 ? t.stuck.starsNote.replace('{stars}', '★'.repeat(b.stars)) : null;

/** Строка заработанного (017-Р34): монеты — крупно; копилка «Ещё K верных» — только если за матч монет 0; иначе «монет нет». */
export type EarnedLine =
  | { kind: 'coins'; coins: number; word: string }
  | { kind: 'piggy'; text: string }
  | { kind: 'unpaid'; text: string };

export function earnedLine(c: { paid: boolean; coins: number; left: number }): EarnedLine {
  if (!c.paid) return { kind: 'unpaid', text: t.coins.unpaid };
  if (c.coins > 0) return { kind: 'coins', coins: c.coins, word: plural(c.coins, t.coins.words) };
  return { kind: 'piggy', text: coinLeft(c.left) };
}

/** Для экранного диктора: «512 болельщиков» (на экране — значок и число). */
export const fansLabel = (n: number): string => `${n} ${plural(n, t.fans.words)}`;
