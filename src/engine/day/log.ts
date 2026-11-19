/**
 * Что случилось за день (068 Т8, story.md §3): журнал дня на время сеанса — из него строится полоса «Итог дня». В сохранении дневных
 * событий нет (раздел `day` — счётчики, 068 design §3), поэтому после перезагрузки журнал пуст и полоса честно скромнее: «Тренировка дня».
 * Чистые функции: день и итог матча приходят снаружи.
 */
import { isControl, stepAfter } from '../home/yard';
import { medalTourOn } from '../school/medal';
import type { School } from '../school/section';
import type { DayFact, DayFacts } from './summary';

export interface DayLog {
  /** Игровой день `ГГГГ-ММ-ДД`, к которому относится журнал: другой день — журнал заново. */
  day: string;
  matches: number;
  /** Новые звёзды за день. */
  stars: number;
  /** Лучшая скорость рекордных матчей дня, знаков в минуту; `null` — рекордов не было. */
  record: number | null;
  /** Последний урок, пройденный за день. */
  passed: number | null;
  /** Последний матч Кубка за день (068-Р73): наш и чужой счёт, улица двора соперника (родительный падеж, «Заречной»; текст «двор на …» строит вид полосы); `null` — Кубка не было. */
  cup: { a: number; b: number; street: string } | null;
  /** Первый матч дня после паузы ≥ 5 дней («Капитан вернулся», story §3, строка 1). */
  returned: boolean;
  /** Последний контрольный урок (номер), пройденный за день; `null` — не было. */
  control: number | null;
  /** Новые буквы уроков, пройденных за день впервые (без повторов); `''` — не было. */
  letters: string;
  /** Последняя ступень стадиона, достроенная за день (id из `yard.json`); `null` — не было. */
  stage: string | null;
}

/** Итог одного матча для журнала: звёзды сверх прежних, скорость, если матч побил рекорд урока, и номер урока, если он пройден впервые. */
export interface MatchNote {
  newStars: number;
  recordCpm: number | null;
  passedLesson: number | null;
  /** Матч Кубка: счёт и соперник (у матча урока поля нет). */
  cup?: { a: number; b: number; street: string };
  /** Матч первый после паузы ≥ 5 дней (решает свисток: `isComeback` по `day.last` до матча). */
  returned?: boolean;
  /** Новые буквы урока матча (`newKeys`); учитываются, только если урок пройден впервые. */
  letters?: string;
}

export const emptyLog = (day: string): DayLog => ({ day, matches: 0, stars: 0, record: null, passed: null, cup: null, returned: false, control: null, letters: '', stage: null });

/** Матч в журнал дня `day`; журнал другого дня сбрасывается. */
export function noteMatch(log: DayLog | null, day: string, m: MatchNote): DayLog {
  const cur = log !== null && log.day === day ? log : emptyLog(day);
  const first = m.passedLesson; // «пройден впервые» — от него события «контрольный», «новые буквы» и «ступень»
  return {
    day,
    matches: cur.matches + 1,
    stars: cur.stars + m.newStars,
    record: m.recordCpm === null ? cur.record : Math.max(cur.record ?? 0, m.recordCpm),
    passed: m.passedLesson ?? cur.passed,
    cup: m.cup ?? cur.cup,
    returned: cur.returned || m.returned === true,
    control: first !== null && isControl(first) ? first : cur.control,
    letters: first === null ? cur.letters : [...new Set([...cur.letters, ...(m.letters ?? '')])].join(''),
    stage: first === null ? cur.stage : (stepAfter(first) ?? cur.stage),
  };
}

/**
 * Факты для `daySummary`: события дня из журнала; `next` — урок на завтра или `null` (Двор пройден); `allStars` — звёзд всего (пункт «+n ★ сегодня,
 * всего N»; `school` — раздел «Школа»: медаль тура берём из него, а не из журнала — тур сдаётся не на экране матча и переживает перезагрузку). Нет журнала за этот день — событий нет («Тренировка дня»).
 */
export function factsOfLog(log: DayLog | null, day: string, next: number | null, allStars: number, school: School | null = null): DayFacts {
  const cur = log !== null && log.day === day ? log : null;
  const events: DayFact[] = [];
  if (cur !== null && cur.returned) events.push({ key: 'return' });
  if (cur !== null && cur.control !== null) events.push({ key: 'control', params: { n: cur.control } });
  if (cur !== null && cur.letters !== '') events.push({ key: 'letters', params: { letters: cur.letters } });
  if (cur !== null && cur.stage !== null) events.push({ key: 'stage', params: { id: cur.stage } });
  const medal = school === null ? null : medalTourOn(school, day);
  if (medal !== null) events.push({ key: 'medal', params: { n: medal } });
  if (cur !== null && cur.cup !== null) events.push({ key: 'cup', params: { a: cur.cup.a, b: cur.cup.b, street: cur.cup.street } });
  if (cur !== null && cur.record !== null) events.push({ key: 'record', params: { n: cur.record } });
  if (cur !== null && cur.stars > 0) events.push({ key: 'stars', params: { n: cur.stars, all: allStars } });
  const passed = cur?.passed ?? null;
  return { events, ...(passed === null ? {} : { passed: { n: passed } }), next };
}
