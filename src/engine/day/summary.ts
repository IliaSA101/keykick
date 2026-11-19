/**
 * Итог дня (068 Т3, ТЗ-10.3; story.md §3): когда пора и что показать — непоказанный выпуск вместо полосы или «полоса дня»:
 * заголовок — старшее событие дня, пункты — остальные (≤ 3, «что выучил» всегда), «завтра — урок N». Чистые функции:
 * факты дня собирает app, тексты — `src/i18n`.
 */
import { unshownPaper } from '../story/papers';
import type { Story } from '../story/section';
import type { Day } from './section';

/** Матчей дня и минут печати, с которых пора итог дня (ТЗ-10.3). */
export const SUMMARY_MATCHES = 3;
export const SUMMARY_MS = 40 * 60 * 1000;

/** События дня по старшинству (story.md §3): ключ i18n заголовка и параметры (числа, имена из контента). */
export const EVENTS = ['return', 'cup', 'control', 'letters', 'stage', 'record', 'medal', 'stars', 'train'] as const;
export type DayEvent = (typeof EVENTS)[number];

export interface DayFact {
  key: DayEvent;
  params?: Record<string, string | number>;
}

/** Что случилось за день — собирает app из разделов; нет события — нет записи. */
export interface DayFacts {
  /** События дня (любой порядок — старшинство берём из `EVENTS`). Звёзды — `stars` с `params.n` (+n за день). */
  events: DayFact[];
  /** Последний пройденный за день урок — пункт «Пройден: урок N»; нет — пункта нет. */
  passed?: { n: number };
  /** Номер урока на завтра; `null` — Двор пройден. */
  next: number | null;
}

export type Summary = { kind: 'paper'; n: number } | { kind: 'strip'; head: DayFact; items: SummaryItem[]; next: number | null };
export type SummaryItem = DayFact | { key: 'passed'; params: { n: number } };

/** Пора ли итог дня: 3-й доигранный матч или 40 мин печати за день `today`. */
export const summaryDue = (d: Day, today: string): boolean => d.today === today && (d.todayN >= SUMMARY_MATCHES || (d.msDay === today && (d.todayMs ?? 0) >= SUMMARY_MS));

const rank = (f: DayFact): number => EVENTS.indexOf(f.key);
/** Звёзды: заголовком — только +2 и больше (строка 8), пунктом — при любых новых. */
const starsN = (f: DayFact): number => Number(f.params?.n ?? 0);

/** Итог дня: непоказанный выпуск (по номеру) — вместо полосы; иначе полоса из фактов дня. */
export function daySummary(story: Story, facts: DayFacts): Summary {
  const n = unshownPaper(story);
  if (n !== null) return { kind: 'paper', n };
  const events = facts.events.filter((f) => f.key !== 'stars' || starsN(f) >= 1).sort((a, b) => rank(a) - rank(b));
  const head = events.find((f) => f.key !== 'stars' || starsN(f) >= 2) ?? { key: 'train' as const };
  const rest: SummaryItem[] = events.filter((f) => f !== head && f.key !== 'train');
  const passed: SummaryItem[] = facts.passed === undefined ? [] : [{ key: 'passed', params: { n: facts.passed.n } }];
  // «Пройден» — последним пунктом (068-Р93, как в макете Э6.36) и всегда: остальным остаётся место на два
  return { kind: 'strip', head, items: [...rest.slice(0, 3 - passed.length), ...passed], next: facts.next };
}
