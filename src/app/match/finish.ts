/**
 * Свисток → сохранение и журнал (065 Т9, К-Б, К-В): единственное место, где экран матча пишет игрока. Запись — только после
 * свистка (запрет М3): брошенный матч (F5, «Выйти») не пишется. Повтор с тем же `matchId` (двойной Enter, повтор свистка) —
 * `finishMatch` отдаёт `view: null`, второй записи нет. Сохранение и журнал приходят параметрами — тест без браузера.
 */
import { finishMatch, matchPatch, type FinishCtx, type MatchSave, type ResultView } from '../../engine/match';
import type { MatchEvent } from '../../engine/match';
import { coachDef } from '../../engine/coach/section';
import { albumDef } from '../../engine/album/section';
import { ruCourseDef } from '../../engine/course/section';
import { dayDef } from '../../engine/day/section';
import { formDef } from '../../engine/form/section';
import { stadiumDef } from '../../engine/home/section';
import { schoolDef } from '../../engine/school/section';
import { walletOf } from '../save/sections';
import { isWhistle, type Run } from './run';

type Sections = Readonly<Record<string, { data: unknown } | undefined>> | undefined;

/** Разделы игрока для свистка (очередь п. 12): одно место, где экран матча собирает `MatchSave`, — тест ловит проводку
 *  кошелька (монеты из раздела игрока, а не пустой кошелёк) без браузера. Нет раздела — пустой по своему описанию. */
export function matchRead(sections: Sections): MatchSave {
  const sec = <T,>(def: { name: string; empty(): T }): T => (sections?.[def.name]?.data as T | undefined) ?? def.empty();
  return { course: sec(ruCourseDef), wallet: walletOf(sections), day: sec(dayDef), school: sec(schoolDef), form: sec(formDef), coach: sec(coachDef), stadium: sec(stadiumDef), album: sec(albumDef) };
}

export interface FinishDeps {
  /** Разделы игрока вкладки сейчас. */
  read(): MatchSave;
  /** `session.save`; не `ok` — игра не падает, итог показан, догонит следующая запись (063-Р31). */
  save(patch: Record<string, unknown>): { ok: boolean };
  journal: { put(matchId: string, rec: { seed: number; events: readonly MatchEvent[]; cpm?: number }): Promise<unknown> };
}

export type Finished = { kind: 'none' } | { kind: 'repeat' } | { kind: 'done'; view: ResultView; saved: boolean };

export function finishRun(run: Run, ctx: FinishCtx, deps: FinishDeps): Finished {
  if (!isWhistle(run) || run.state.result === null) return { kind: 'none' };
  const done = finishMatch(deps.read(), run.state.result, ctx);
  if (done.view === null) return { kind: 'repeat' };
  const saved = deps.save(matchPatch(done.save)).ok;
  void deps.journal.put(ctx.matchId, { seed: run.start.seed, events: run.events, cpm: done.view.cpm }); // скорость — для ставки учебных игр (067 Т17)
  return { kind: 'done', view: done.view, saved };
}
