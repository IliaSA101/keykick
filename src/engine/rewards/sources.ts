/**
 * Реестр наград (ТЗ-0.3, 065-Т2, страж С1): каждая награда начисляется только своим событием — через кассу
 * `cash.ts`, и вызывает кассу только файл из `callers` этой награды. Страж `tests/guards.test.ts` (С1) сверяет
 * реестр с исходниками: файлы существуют, вызов кассы мимо реестра — красное.
 */

export type RewardId = 'match-coins' | 'minute-coins' | 'penalty-knower' | 'match-fans';

export interface RewardSource {
  id: RewardId;
  /** Событие-источник (английское имя события игры). */
  event: string;
  /** Что именно растёт у игрока. */
  pays: 'wallet.coins' | 'school.knower' | 'stadium.fans';
  /** Файлы (от корня репозитория), которым разрешено звать кассу с этим `id`. */
  callers: readonly string[];
}

/** Единственный писатель раздела `wallet`. */
export const CASH_FILE = 'src/engine/rewards/cash.ts';

export const REWARD_SOURCES: readonly RewardSource[] = [
  { id: 'match-coins', event: 'match-whistle', pays: 'wallet.coins', callers: ['src/engine/match/finish.ts'] },
  { id: 'minute-coins', event: 'coach-minute-end', pays: 'wallet.coins', callers: ['src/engine/match/finish.ts'] },
  { id: 'match-fans', event: 'match-whistle', pays: 'stadium.fans', callers: ['src/engine/match/finish.ts'] },
  { id: 'penalty-knower', event: 'match-penalty-goal', pays: 'school.knower', callers: ['src/engine/match/finish.ts'] },
];
