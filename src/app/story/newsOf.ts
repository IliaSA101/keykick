/**
 * Вид выпуска газеты из разделов игрока (068 Т7, 068-Р45): факты выпуска (`paperFacts`) и признак «первый выпуск со званием Знаток» (`firstTitleIn`, 068-Р31) → `paperView`.
 * Чистая функция: сеанс и Vue не нужны — `useNewsView` только читает разделы и имена, тест гоняет подключение «Знаток Двора!» без браузера.
 */
import type { Cup } from '../../engine/cup';
import { firstTitleIn, PAPER_COUNT, type Story } from '../../engine/story';
import { paperFacts } from './paperFacts';
import { paperInOf, type PaperSections } from './paperIn';
import { paperView, type PaperView } from './paperView';

/** Кто и где: клуб, город, игрок, тренер и названия уроков. */
export interface NewsWho {
  club: string;
  city: string;
  player: string;
  coach: string;
  lessonName: (n: number) => string;
}

/** Вид выпуска `n`; `archive` — выпуск из архива Музея. */
export function newsViewOf(n: number, sections: PaperSections, who: NewsWho, archive = false): PaperView {
  return paperView(paperFacts(n, paperInOf(sections)), { ...who, firstTitle: firstTitleIn(sections.story, n), ...(archive ? { archive: true } : {}) });
}

/**
 * Открывать ли выпуск на Доме как архивный (068-Р55): выпуск 8 вышел серебряным (снимок `facts.silver`), а Кубок потом взят —
 * «сыграть финал снова» уже не про него. Выпуск без снимка и вышедший чемпионским — обычные.
 */
export const homePaperIsArchive = (n: number | null, story: Story, cup: Cup): boolean =>
  n === PAPER_COUNT && cup.title === 'gold' && story.papers[String(n)]?.facts?.silver === true;
