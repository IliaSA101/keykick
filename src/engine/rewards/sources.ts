/**
 * Реестр наград (ТЗ-0.3, 065-Т2, страж С1): каждая награда начисляется только своим событием — через кассу
 * `cash.ts`, и вызывает кассу только файл из `callers` этой награды. Страж `tests/guards.test.ts` (С1) сверяет
 * реестр с исходниками: файлы существуют, вызов кассы мимо реестра — красное.
 */

export type RewardId = 'match-coins' | 'minute-coins' | 'penalty-knower' | 'match-fans' | 'learn-coins' | 'tour-knower' | 'kicks-knower' | 'lesson-pack';

export interface RewardSource {
  id: RewardId;
  /** Событие-источник (английское имя события игры). */
  event: string;
  /** Что именно растёт у игрока. */
  pays: 'wallet.coins' | 'school.knower' | 'stadium.fans' | 'album.packs';
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
  { id: 'learn-coins', event: 'learn-finish', pays: 'wallet.coins', callers: ['src/engine/learn/finish.ts'] },
  { id: 'lesson-pack', event: 'lesson-first-pass', pays: 'album.packs', callers: ['src/engine/match/finish.ts'] },
  { id: 'tour-knower', event: 'tour-finish', pays: 'school.knower', callers: ['src/engine/school/finish.ts'] },
  { id: 'kicks-knower', event: 'kicks-finish', pays: 'school.knower', callers: ['src/engine/school/finish.ts'] },
];

/**
 * Награды волны 4 (067-Р20, К-А): объявлены, но файлов-вызывающих ещё нет — их пишет Т2 (`learn-coins` и `lesson-pack` уже перенесены). Страж С1 требует, чтобы
 * вызывающий файл существовал и звал кассу с этим `id`, поэтому запись переезжает в `REWARD_SOURCES` вместе с файлом
 * (тот, кто пишет вызов, переносит строку); вызов из неразрешённого файла страж всё равно не пустит.
 */
export const PLANNED_SOURCES: readonly RewardSource[] = [
];

/** Единственный файл, которому разрешено списание (`debit`, ТЗ-3.9): покупка в Лавке. */
export const DEBIT_CALLERS: readonly string[] = ['src/engine/shop/buy.ts'];
