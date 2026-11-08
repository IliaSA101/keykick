/** Действия цепочек над разделом `course` (017): проход урока со звёздами, провал, помощь. */
import { FAILS_MAX, helps, section, type LessonRecord } from '../../src/engine/course/save';
import type { SectionTx } from '../../src/engine/save/section';
import { edit, oneOf, upTo, type ChainAction, type ChainCtx } from './types';

const blank = (): LessonRecord => ({ stars: 0, cpm: 0, acc: 0, fails: 0, help: 'none', back: false });

/** Проход урока так, как пишет матч: звёзды и рекорды только вверх, пройденные без повторов. Возвращает звёзды матча. */
export function passLesson(tx: SectionTx, rnd: () => number, ctx: ChainCtx): number {
  const s = edit(tx, section);
  const id = oneOf(rnd, ctx.lessonIds);
  const r = s.lessons[id] ?? blank();
  const stars = 1 + upTo(rnd, 3);
  s.lessons[id] = { ...r, stars: Math.max(r.stars, stars), cpm: Math.max(r.cpm, 30 + upTo(rnd, 200)), acc: Math.max(r.acc, 700 + upTo(rnd, 301)), fails: 0 };
  if (!s.passed.includes(id)) s.passed.push(id);
  s.lesson = ctx.lessonIds[ctx.lessonIds.indexOf(id) + 1] ?? id;
  tx.set(section, s);
  return stars;
}

export const actions: ChainAction[] = [
  { name: 'course.pass', rewards: ['stars'], run: (tx, rnd, ctx) => void passLesson(tx, rnd, ctx) },
  {
    name: 'course.fail',
    rewards: [],
    run: (tx, rnd, ctx) => {
      const s = edit(tx, section);
      const id = oneOf(rnd, ctx.lessonIds);
      const r = s.lessons[id] ?? blank();
      s.lessons[id] = { ...r, fails: Math.min(FAILS_MAX, r.fails + 1), help: oneOf(rnd, helps), back: rnd() < 0.3 };
      tx.set(section, s);
    },
  },
];
