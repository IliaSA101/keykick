/**
 * Подготовка тестов записи матча в сохранение (017-Т5б): две вкладки, живой матч прыжком, события `begin`/`finish`.
 */
import { courseLessons } from '../src/app/course/load';
import { jumpWith } from '../src/app/match/jump';
import { matchRules } from '../src/app/match/load';
import { createSaveMatchStore } from '../src/app/match/saveStore';
import { memoryMatchStore, type ReadableMatchStore } from '../src/app/match/store';
import type { JournalInput } from '../src/engine/journal/records';
import type { PendingSecond } from '../src/engine/match/resume';
import { verdict, type Help } from '../src/engine/match/verdict';
import type { Effect } from '../src/engine/match/view';
import { twoTabs } from './saveFixtures';

export type Tabs = ReturnType<typeof twoTabs>;
export type Got = Array<{ recs: JournalInput[]; player: string }>;
export const lesson = courseLessons.find((l) => l.league === 'yard' && !l.friendly)!;
export const lying = (t: Tabs, name: string, player = 'p1'): Record<string, unknown> | undefined =>
  (JSON.parse(t.data.get(t.key.replace('.p1', `.${player}`)) ?? 'null') as { sections: Record<string, Record<string, unknown>> }).sections[name];

/** Слой вкладки `a` как слой хранилища матча; журнал копится в `got`. */
export function saveOf(t: Tabs, got: Got = []) {
  t.a.setJournalSink((recs, player) => void got.push({ recs, player }));
  return createSaveMatchStore({ layer: t.a, player: () => t.cur.value, rules: matchRules, clock: () => 1_800_000_000_000 });
}

/** Память ведёт поток, запись идёт и в неё, и в сохранение. */
export const tee = (mem: ReadableMatchStore, save: ReadableMatchStore): ReadableMatchStore => ({
  read: () => mem.read(),
  soften: (l, f) => (mem.soften?.(l, f), save.soften?.(l, f)),
  begin: (e) => (mem.begin(e), save.begin(e)),
  block: (e) => (mem.block(e), save.block(e)),
  toBreak: (p) => (mem.toBreak(p), save.toBreak(p)),
  half2Started: () => (mem.half2Started(), save.half2Started()),
  kick: (e) => (mem.kick(e), save.kick(e)),
  abandon: (e) => (mem.abandon(e), save.abandon(e)),
  finish: (e) => (mem.finish(e), save.finish(e)),
});

/** События настоящего матча до перерыва: `begin`, блоки (разминка, атаки) и ожидающий тайм — для прямой записи в хранилище. */
export function captured() {
  const blocks: Array<Extract<Effect, { kind: 'block' }>> = [];
  let begin!: Extract<Effect, { kind: 'begin' }>;
  let pending!: PendingSecond;
  const sink: ReadableMatchStore = {
    ...memoryMatchStore(matchRules),
    begin: (e) => void (begin = e),
    block: (e) => void blocks.push(e),
    toBreak: (p) => void (pending = p),
  };
  jumpWith('break', lesson, false, () => sink);
  return { begin, blocks, pending };
}

export type Fx<K extends Effect['kind']> = Extract<Effect, { kind: K }>;
export const beginOf = (lessonId: string, over: Partial<Fx<'begin'>> = {}): Fx<'begin'> =>
  ({ kind: 'begin', lessonId, seed: 7, g: 1, c: 1, attacks: [1, 1], fails: 0, help: 'none', softened: false, replay: false, resumed: false, at: 1, ...over });

/** Итог матча по настоящему вердикту: победа 2:0 (или поражение 0:2), точность — из верных и ошибок. */
export function finishOf(lessonId: string, o: { win?: boolean; correct?: number; errors?: number; help?: Help; fails?: number } = {}): Fx<'finish'> {
  const win = o.win ?? true;
  const correct = o.correct ?? 100;
  const errors = o.errors ?? 0;
  const help = o.help ?? 'none';
  const score = win ? { typed: 2, kick: 0, conceded: 0 } : { typed: 0, kick: 0, conceded: 2 };
  const accuracy = correct / (correct + errors);
  const v = verdict({ score, friendly: false, accuracy, help, softened: false, kind: 'lesson', best: 0 }, matchRules);
  return {
    kind: 'finish', lessonId, league: 'yard', help, softened: false, session: 'match', lessonKind: 'lesson', pending: null, at: 1_800_000_000_000,
    result: { verdict: v, score, outcome: win ? 'win' : 'loss', fails: o.fails ?? (win ? 0 : 1), offer: null, accuracy, correct, errors, cpm: 100 },
  };
}
