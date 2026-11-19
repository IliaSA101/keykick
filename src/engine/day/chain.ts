/**
 * Цепочка после итога матча (067 К-Б, ТЗ-10.11): какие звенья показать по порядку. Чистая функция.
 * Пак (если не весь показан) → не больше одного праздника (поставщик волны 5 — пока пусто) → если Школа открыта, «Тур ждёт»,
 * пока тур дня не взят (067-Р73: не только после первого матча — после поражения и победы приглашение не пропадает);
 * тур взят — после остальных матчей дня «штрафные» (ТЗ-6.1, 6.14).
 * Переходы и Esc (Дом, звено не теряется) ведёт `app/result/chain.ts`.
 */
import type { Album } from '../album/section';
import type { Day } from './section';

export type Step = 'pack' | 'celebrate' | 'tourWaits' | 'kicks';

/** Сохранение для цепочки: альбом и дни (после записи итога — `day.todayN` уже учитывает этот матч). */
export interface ChainSave {
  album: Pick<Album, 'packs' | 'shown'>;
  day: Pick<Day, 'todayN'>;
  /** Тур дня ещё не взят (`tourWaits` журнала Школы, 067-Р73, Р78). Нет сведений — по числу матчей дня: ждёт после первого. */
  tourWaits?: boolean;
}

export interface ChainFacts {
  /** Школа открыта (`systemOpen('school', …)`, ТЗ-1.9). */
  schoolOpen: boolean;
  /** Есть праздник к показу — поставщик волны 5; до неё не задаётся. */
  celebrate?: boolean;
}

/** `_now` — часы приходят снаружи по общему правилу движка; порядок звеньев от них не зависит. */
export function afterResult(save: ChainSave, facts: ChainFacts, _now: number): Step[] {
  const steps: Step[] = [];
  if (save.album.shown < save.album.packs) steps.push('pack');
  if (facts.celebrate === true) steps.push('celebrate');
  if (facts.schoolOpen) steps.push((save.tourWaits ?? save.day.todayN <= 1) ? 'tourWaits' : 'kicks');
  return steps;
}
