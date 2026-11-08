/**
 * Действия цепочек над разделом `match` (017). Итог матча пишется тем же кодом, что и настоящий матч
 * (`engine/match/commit.ts`: блок, пенальти, итог), поэтому цепочка ловит расхождения реальной записи с 018.
 */
import { matchRules } from '../../src/app/match/load';
import { commitBlock, commitFinish, commitKick, type MatchLogCtx } from '../../src/engine/match/commit';
import { section } from '../../src/engine/match/save';
import { verdict, type Help } from '../../src/engine/match/verdict';
import type { Effect } from '../../src/engine/match/view';
import { tasks } from '../../src/app/tasks';
import { edit, oneOf, upTo, type ChainAction } from './types';

type Of<K extends Effect['kind']> = Extract<Effect, { kind: K }>;

export const actions: ChainAction[] = [
  {
    name: 'match.finish',
    rewards: ['coins', 'stars'],
    run: (tx, rnd, ctx) => {
      const league = oneOf(rnd, ctx.leagueIds);
      const lessonId = oneOf(rnd, ctx.lessonIds);
      const correct = 20 + upTo(rnd, 150);
      const errors = upTo(rnd, 12);
      const help: Help = oneOf(rnd, ['none', 'none', 'reserve', 'coach'] as const);
      const keys = matchRules.squad.flatMap((p) => p.keys);
      const log: MatchLogCtx = {
        id: `${ctx.player}.${ctx.step.toString(36)}.m`, lesson: lessonId, league, n: 1 + upTo(rnd, 12), attempt: 1, signs: 0, errors: 0, ms: 0, at: 0, outcome: 'open',
      };
      const block: Of<'block'> = {
        kind: 'block', source: 'attack', correct, errors, keyErrors: { [oneOf(rnd, ['KeyF', 'KeyJ', 'KeyA', 'KeyL'])]: errors }, paid: true, league,
        presses: Array.from({ length: 12 }, () => ({ char: oneOf(rnd, keys), ok: rnd() < 0.7 })), time: ctx.now, at: 2, half: 2, attack: 1,
        outcome: null, ms: 1000 + upTo(rnd, 60_000), score: { typed: 2, kick: 0, conceded: 0 },
      };
      commitBlock(tx, block, log, matchRules);
      if (rnd() < 0.3) commitKick(tx, 1, 1 + upTo(rnd, tasks.length));
      const win = rnd() < 0.8;
      const score = win ? { typed: 2, kick: 0, conceded: upTo(rnd, 2) } : { typed: 0, kick: 0, conceded: 2 };
      const accuracy = correct / (correct + errors);
      const v = verdict({ score, friendly: false, accuracy, help, softened: false, kind: 'lesson', best: 0 }, matchRules);
      const i = ctx.lessonIds.indexOf(lessonId);
      const fin: Of<'finish'> = {
        kind: 'finish', lessonId, league, help, softened: false, session: 'match', lessonKind: 'lesson', pending: null, at: ctx.now,
        result: { verdict: v, score, outcome: win ? 'win' : 'loss', fails: win ? 0 : 1 + upTo(rnd, 3), offer: null, accuracy, correct, errors, cpm: 30 + upTo(rnd, 200) },
      };
      commitFinish(tx, fin, log, { rules: matchRules, next: ctx.lessonIds[i + 1] ?? null, order: ctx.lessonIds });
    },
  },
  {
    // Матч прерван между таймами: ожидающий 2-й тайм и смягчение — не счётчики и не награды.
    name: 'match.break',
    rewards: [],
    run: (tx, rnd, ctx) => {
      const s = edit(tx, section);
      const lessonId = oneOf(rnd, ctx.lessonIds);
      s.half2 = { lessonId, seed: upTo(rnd, 4_294_967_295), started: ctx.now, score: [upTo(rnd, 5), upTo(rnd, 5)], first: { correct: upTo(rnd, 100), errors: upTo(rnd, 10), ms: 1000 + upTo(rnd, 60_000) }, reason: oneOf(rnd, ['break', 'replay'] as const) };
      s.soften = { lessonId, from: oneOf(rnd, ctx.lessonIds) };
      tx.set(section, s);
    },
  },
];
