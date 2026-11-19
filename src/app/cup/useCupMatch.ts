/**
 * Матч Кубка на экране матча (068 Т6): подготовка (`prepare`) и свисток (`whistle`), вынесенные из `MatchScreen.vue`.
 * Закрытый раунд (повтор после F5 уже записанного, чужой адрес) — на Дом. Часы (`now`, `today`) и семя передаёт экран.
 */
import { shallowRef, type ComputedRef } from 'vue';
import type { Router } from 'vue-router';
import { cupDef, weakFingerKeys, type Cup, type RoundKey, type SeriesResult } from '../../engine/cup';
import { formDef } from '../../engine/form/section';
import { storyDef, type Story } from '../../engine/story';
import { matchIdOf } from '../../engine/journal';
import type { CourseLesson } from '../../engine/plan/lesson';
import { matchJournal } from '../journal/app';
import { useHomeInput } from '../home/useHomeInput';
import { putFinished } from '../match/handoff';
import { dictionaryOf, startRun, type Run } from '../match/run';
import { frameRun, type FrameMatch } from '../match/frame';
import type { useSession } from '../save/session';
import type { KeyInput } from '../../engine/typing/keystep';
import { seriesFrameUi } from './frame';
import { cupMatchInfo, cupRead, cupStart, cupViewFor, finishCupRun, playableRound, type CupMatchInfo } from './run';
import { beginSeries, needsSeries, resultOf, seriesKey, type SeriesUi } from './seriesFlow';

/** Всё, что экран берёт из подготовленного матча Кубка. */
export interface CupPrepared {
  run: Run;
  lesson: CourseLesson;
  matchId: string;
}

/** Что свисток знает о матче: часы, id записи и урок (для следующего экрана). */
export interface WhistleCtx {
  now: number;
  matchId: string;
  lessonId: string;
  lessonNo: number;
}

interface Sections {
  [name: string]: { data: unknown } | undefined;
}

export function useCupMatch(o: {
  session: ReturnType<typeof useSession>;
  router: Router;
  player: ComputedRef<{ pid: string; env: { sections: Sections } } | null>;
  frame: FrameMatch | undefined;
  today: () => string;
}) {
  const home = useHomeInput();
  const round = shallowRef<RoundKey | null>(null);
  const info = shallowRef<CupMatchInfo | null>(null);
  /** Серия ударов после ничьей в плей-офф (Э5.30–.35): `null` — серии нет. Матч стоит на свистке, пока серия не кончилась. */
  const series = shallowRef<SeriesUi | null>(null);
  let lesson: CourseLesson | null = null;
  let pending: { run: Run; ctx: WhistleCtx } | null = null;
  const sec = <T>(def: { name: string; empty(): T }): T => (o.player.value?.env.sections[def.name]?.data as T | undefined) ?? def.empty();

  /** Матч раунда `r`: урок Кубка, соперник, ход. `null` — идти некуда (на Дом отправлено, если так нужно). */
  function prepare(r: RoundKey, lessons: CourseLesson[], t0: number): CupPrepared | null {
    const i = home.input.value;
    const p = o.player.value;
    if (!i || !p) return null;
    const toHome = (): null => {
      void o.router.replace('/home');
      return null;
    };
    const view = cupViewFor(sec<Cup>(cupDef), i, o.today(), p.pid);
    if (!o.frame && playableRound(view.next, true) !== r) return toHome();
    const item = view.path.find((x) => x.round === r);
    const built = item === undefined ? null : cupStart(r, item.flag, lessons, sec(formDef), o.frame?.seed ?? t0 % 2147483647, dictionaryOf());
    if (built === null) return toHome();
    const next = cupMatchInfo(view, r, weakFingerKeys(sec(formDef), [...built.lesson.keys]));
    if (next === null) return toHome();
    round.value = r;
    info.value = next;
    lesson = built.lesson;
    const spec = o.frame?.spec;
    const run = o.frame && spec ? frameRun(built.start, spec) : startRun(built.start).run;
    if (o.frame?.cup?.series) series.value = seriesFrameUi(o.frame.cup.series.shot, run, built.lesson, dictionaryOf());
    return { run, lesson: built.lesson, matchId: matchIdOf(p.pid, t0) };
  }

  /** Запись, журнал, передача итога экрану итога (`series` — исход серии или `null`). */
  function settle(r: Run, ctx: WhistleCtx, sr: SeriesResult | null): void {
    if (round.value === null) return;
    const done = finishCupRun(r, { now: ctx.now, day: o.today(), matchId: ctx.matchId, round: round.value }, {
      read: () => cupRead(o.player.value?.env.sections),
      readStory: () => sec<Story>(storyDef),
      save: (patch) => o.session.save(patch),
      journal: matchJournal(),
    }, sr);
    putFinished(done, { lesson: ctx.lessonId, no: ctx.lessonNo });
    void o.router.push('/result');
  }

  /**
   * Свисток матча Кубка: ничья в плей-офф — начинается серия (запись ждёт её конца, запрет М3), иначе запись и экран итога.
   * Не Кубок — `false`.
   */
  function whistle(r: Run, ctx: WhistleCtx): boolean {
    if (round.value === null) return false;
    if (lesson !== null && needsSeries(r, round.value)) {
      pending = { run: r, ctx };
      series.value = beginSeries(r, lesson, dictionaryOf());
      return true;
    }
    settle(r, ctx, null);
    return true;
  }

  /** Клавиша серии; серия кончилась — запись с её исходом и экран итога. Звуки — файлы по порядку (экран их играет). */
  function seriesPress(key: KeyInput, mute: boolean): string[] {
    const cur = series.value;
    if (cur === null || resultOf(cur) !== null) return [];
    const out = seriesKey(cur, key, mute);
    series.value = out.ui;
    const sr = resultOf(out.ui);
    if (sr !== null && pending !== null) {
      const p = pending;
      pending = null;
      settle(p.run, p.ctx, sr);
    }
    return out.sounds;
  }

  return { round, info, series, prepare, whistle, seriesPress };
}
