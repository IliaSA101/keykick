/**
 * Виды строки тренера и полосы дня (068 Т8, story.md §3–4): из движка (`coachLine`, `daySummary`) и строк `ru.day` — готовый текст.
 * Чистые функции, без Vue: часы, названия уроков и числа приходят снаружи.
 */
import type { CoachLine } from '../../engine/day/advice';
import type { DayFact, Summary } from '../../engine/day/summary';
import { ADVICE_FROM_DAY } from '../../engine/day/advice';
import { ru } from '../../i18n/ru';
import { fill, rivalName } from '../home/texts';

const t = ru.day;

/** Текст строки тренера: `next` — урок на завтра (`null` — Двор пройден); `days` — игровой день; для «устали» — точности в процентах. */
export function coachText(line: CoachLine, o: { days: number; next: number | null; acc?: number; norm?: number }): string {
  if (line === 'tired') return fill(t.coach.tired, { acc: o.acc ?? 0, norm: o.norm ?? 0 });
  if (o.next === null) return t.coach.adviceEnd;
  return fill(o.days < ADVICE_FROM_DAY ? t.coach.advice1 : t.coach.advice2, { n: o.next });
}

export interface StripView {
  kick: string;
  head: string;
  items: string[];
  /** Зачин пункта «Пройден» — полоса выделяет его жирным (Э6.36); пункт начинается с этих слов. */
  passedLead: string;
  tomorrow: string;
}

/** Буквы «ыв» → «Ы, В» (пробелы и повторы не показываем). */
const lettersText = (s: string): string => [...new Set([...s.toUpperCase()].filter((c) => c.trim() !== ''))].join(', ');

/** Заголовок и пункт — одна строка (068-Р93); отдельная форма пункта — только у звёзд (`item.stars`). */
const factText = (f: DayFact, form: 'head' | 'item', o: { club: string; lessonName: (n: number) => string }): string => {
  const p = f.params ?? {};
  const h = t.strip.head;
  if (f.key === 'return') return h.return;
  if (f.key === 'cup') return fill(h.cup, { a: p.a ?? 0, b: p.b ?? 0, rival: rivalName(String(p.street ?? '')), club: o.club });
  if (f.key === 'control') return fill(h.control, { name: o.lessonName(Number(p.n)) });
  if (f.key === 'letters') return fill(h.letters, { letters: lettersText(String(p.letters ?? '')) });
  if (f.key === 'stage') return fill(h.stage, { stage: ru.home.steps[String(p.id)] ?? '' });
  if (f.key === 'medal') return fill(h.medal, { n: p.n ?? 0 });
  if (f.key === 'record') return fill(h.record, { n: `${p.n ?? 0} ${ru.result.perMinute}` });
  if (f.key === 'stars') return fill(form === 'head' ? h.stars : t.strip.item.stars, p);
  return h.train;
};

/** Полоса: `club`, `day` — шапка; `lessonName` — название урока по номеру. Выпуск (`kind: 'paper'`) рисует газета, не полоса. */
export function stripView(s: Extract<Summary, { kind: 'strip' }>, o: { club: string; day: number; lessonName: (n: number) => string }): StripView {
  return {
    kick: fill(t.strip.kick, { club: o.club, day: o.day }),
    head: factText(s.head, 'head', o),
    items: s.items.map((i) => (i.key === 'passed' ? fill(t.strip.item.passed, { lead: t.strip.item.passedLead, n: Number(i.params.n), name: o.lessonName(Number(i.params.n)) }) : factText(i, 'item', o))),
    passedLead: t.strip.item.passedLead,
    tomorrow: s.next === null ? t.strip.tomorrowEnd : fill(t.strip.tomorrow, { n: s.next, name: o.lessonName(s.next) }),
  };
}
