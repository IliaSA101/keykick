/** Общие типы действий цепочек сохранения (018 design §8): действия разделов лежат рядом, `saveChain.test.ts` берёт их маской. */
import type { RewardKind } from '../../src/engine/save/rewards';
import type { SectionDef, SectionTx } from '../../src/engine/save/section';

export interface ChainCtx {
  /** Часы действия, мс: растут только вперёд (`pause` двигает их на дни). */
  now: number;
  player: string;
  step: number;
  lessonIds: readonly string[];
  leagueIds: readonly string[];
}

export interface ChainAction {
  name: string;
  /** Какие награды действие вправе выдать (ТЗ-0.3): всё остальное в сохранении расти не должно. */
  rewards: RewardKind[];
  /** Счётчики вида `раздел.имя`, которым действие позволено убывать (ТЗ-0.11); обычно — нет. */
  mayDecrease?: string[];
  run(tx: SectionTx, rnd: () => number, ctx: ChainCtx): void;
}

/** Изменяемая копия раздела: `tx.get` отдаёт замороженную. */
export const edit = <T>(tx: SectionTx, def: SectionDef<T>): T => structuredClone(tx.get(def)) as T;

/** Целое в [0, n). */
export const upTo = (rnd: () => number, n: number): number => Math.floor(rnd() * n);

export const oneOf = <T>(rnd: () => number, items: readonly T[]): T => items[upTo(rnd, items.length)] as T;
