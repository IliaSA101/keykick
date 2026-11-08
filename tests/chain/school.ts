/** Действия цепочек над разделом `school`: разобранные задачи битами и счёт «Знатока». */
import { section } from '../../src/engine/school/save';
import { addSolved } from '../../src/engine/school/solved';
import { TASK_NO_MAX } from '../../src/engine/tasks';
import { edit, upTo, type ChainAction } from './types';

export const actions: ChainAction[] = [
  {
    name: 'school.solve',
    rewards: [],
    run: (tx, rnd) => {
      const s = edit(tx, section);
      s.solved = addSolved(s.solved, 1 + upTo(rnd, TASK_NO_MAX));
      s.expert += 1;
      tx.set(section, s);
    },
  },
];
