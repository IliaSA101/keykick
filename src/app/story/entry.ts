/**
 * Окно входа на Дом (068 Т7, ТЗ-10.11): выпуски вех выходят, из очереди берётся одно сюжетное окно (комикс, выпуск), флаг «показан»
 * ставится при открытии — перезагрузка с открытым окном не повторяет его. Чистая функция: разделы и игровой день приходят снаружи.
 * Дом читает результат один раз за вход (`useStoryEntry`); «Права на компьютер» (067 ТЗ-7.6) — поставщик волны 4, сюда приходит флагом.
 */
import { entryWindow, markComicShown, markPaperShown, releasePapers, unshownPaper, type EntryWindow, type Milestones, type PaperFixed, type Story } from '../../engine/story';

export interface EntryCtx {
  /** Текущий урок Двора, 1…32; 33 — пройден. */
  cur: number;
  /** Вехи Кубка (`cupMilestones`). */
  cup: Milestones;
  /** Игровой день входа (`gameDay`). */
  day: number;
  /** «Права» ждут показа (067 ТЗ-7.6). */
  rights?: boolean;
  /** Числа клуба на день входа: записываются в выходящие выпуски (068-Р30). */
  facts?: PaperFixed;
  /** Только выпуски: окна комиксов и «Прав» пока не рисует Дом — они не занимают очередь и не помечаются показанными. */
  paperOnly?: boolean;
}

export interface Entered {
  /** Раздел `story` после выхода выпусков и пометки показанного окна. */
  story: Story;
  /** Окно, которое открыть, — одно (С1); `null` — на этом входе окон нет. */
  window: EntryWindow | null;
}

/** Вход на Дом: выпускаем выпуски вех, берём одно окно, помечаем его показанным. Повторный вызов с результатом — окон нет (С1, С2). */
export function enterHome(story: Story, ctx: EntryCtx): Entered {
  const released = releasePapers(story, { cur: ctx.cur, cup: ctx.cup, day: ctx.day, ...(ctx.facts === undefined ? {} : { facts: ctx.facts }) });
  if (ctx.paperOnly === true) {
    const n = unshownPaper(released);
    return n === null ? { story: released, window: null } : { story: markPaperShown(released, n), window: { kind: 'paper', n } };
  }
  const window = entryWindow(ctx.rights === undefined ? { story: released, cup: ctx.cup } : { story: released, cup: ctx.cup, rights: ctx.rights });
  if (window === null) return { story: released, window };
  if (window.kind === 'comic') return { story: markComicShown(released, window.id, ctx.day), window };
  if (window.kind === 'paper') return { story: markPaperShown(released, window.n), window };
  return { story: released, window };
}
