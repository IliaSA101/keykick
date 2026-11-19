/**
 * «Штрафные» (ТЗ-6.14): после остальных матчей дня — 3 задачи знакомых видов, идут в «Знатока» (ТЗ-6.6), монет нет;
 * «Дальше» пропускает — ничего не списывается (`finishKicks` просто не зовут). Шаг ответа — тот же `step` тура.
 * Какое звено показать после матча — `engine/day/chain.ts`.
 */
import cfg from '../../content/school.json';
import { createRandom } from '../random';
import { KINDS, REPEAT_KIND, kindOf, lastNumbered } from './order';
import { pickTasks, poolOf, type Tour } from './tour';
import type { School } from './section';
import type { Task } from './tasks';

export const KICKS_KIND = 'kicks';

/** Знакомые виды: виды пройденных туров нумерации и текущий вид; туров ещё не было — первый вид. */
function knownAnswers(school: School): string[] {
  const seen = new Set(school.tours.filter((t) => t.kind !== REPEAT_KIND).map((t) => t.kind));
  seen.add(kindOf(Math.max(1, lastNumbered(school))).id);
  return KINDS.filter((k) => seen.has(k.id) || k.id === KINDS[0]?.id).flatMap((k) => k.answers);
}

/** План «штрафных»: `kicks.size` задач знакомых видов, нерешённые раньше; зерно и выученные буквы — снаружи.
 * Задач нет — `null`: цепочка дня пропускает звено. */
export function kicksPlan(school: School, tasks: readonly Task[], grade: number | null, seed: number, letters?: string): Tour | null {
  const pool = poolOf(tasks, knownAnswers(school), grade, letters);
  const picked = pickTasks(pool, cfg.kicks.size, school, createRandom(seed >>> 0));
  if (picked.tasks.length === 0) return null;
  return { n: 0, kind: KICKS_KIND, repeat: false, waiting: null, trainer: null, hint: false, retake: false, cap: null, sid: seed >>> 0, line: picked.line, tasks: picked.tasks, i: 0, firsts: [], fixed: [] };
}
