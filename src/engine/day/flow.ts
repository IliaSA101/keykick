/**
 * Что день говорит после матча (068 Т8, ТЗ-9.9, 10.3, 10.4; story.md §3–4): строка тренера и пора ли итог дня. Чистая функция:
 * разделы до и после свистка и игровой день приходят снаружи, тексты — `src/i18n`. Строку отмечаем показанной сразу (С5: совет и
 * «пальцы устали» — один раз в игровой день, перезагрузка на итоге не повторяет).
 */
import type { Story } from '../story/section';
import { coachLine, markCoachLine, tiredNorm, type CoachLine } from './advice';
import type { Day } from './section';
import { summaryDue } from './summary';

export interface AfterMatch {
  /** Раздел `story` с отметкой показанной строки (тот же объект, если строки нет). */
  story: Story;
  /** Строка тренера над итогом: совет, «пальцы устали» или ничего. */
  line: CoachLine | null;
  /** Этот матч довёл день до итога (3-й доигранный матч или 40 мин печати): итог дня — следом. Раз в день: порог пересекается один раз. */
  summary: boolean;
  /** Раздел `day` с отметкой долга итога (`summaryMissed`, 068-Р70) — только если отметка изменилась; нет — день не менять. */
  day?: Day;
  /** Числа строки «пальцы устали» (точность двух последних и норма ступени, %), посчитанные на свистке: экран не пересчитывает по несохранённому дню. */
  tired: { acc: number; norm: number } | null;
  /** Матч — первый после паузы ≥ 5 дней (событие «Капитан вернулся» итога дня); решает свисток по `day.last` до матча. */
  returned?: boolean;
}

/**
 * `before` — день до свистка, `after` — после (`playedMatch`, `addTyped`, `addAcc` уже применены); `stage` — ступень урока матча;
 * `shows` — карточка итога покажет строку (в «Застрял» и при помощи её нет: тогда не считаем и не помечаем, 068-Р64);
 * `summaryShows` — карточка покажет «Итог дня» (по умолчанию как `shows`; у Кубка строки нет, а итог дня есть, 068-Р71);
 * `returned` — матч первый после паузы ≥ 5 дней (свисток решает `isComeback` по `day.last` до матча): идёт в журнал дня.
 * Итог дня пора на пересечении порога и, если пересечение пришлось на матч без итога («Застрял»), — на следующем матче того же дня (068-Р70, `day.summaryMissed`).
 */
export function afterMatch(before: Day, after: Day, story: Story, today: string, stage: number, shows = true, summaryShows = shows, returned = false): AfterMatch {
  const line = shows ? coachLine({ day: after, story }, today, stage) : null;
  const owed = after.summaryMissed === today;
  const summary = summaryDue(after, today) && (!summaryDue(before, today) || owed);
  const missed = summary && !summaryShows ? today : summary ? null : (after.summaryMissed ?? null);
  return {
    story: line === null ? story : markCoachLine(story, line, after.days),
    line,
    summary,
    ...((after.summaryMissed ?? null) === missed ? {} : { day: { ...after, summaryMissed: missed } }),
    tired: line === 'tired' ? tiredNorm(after, stage) : null,
    returned,
  };
}
