/**
 * Кто может выдавать награды (спека 018 design §8, ТЗ-0.3): награда → касса → файлы, которым разрешено её
 * вызывать. Страж `tests/guards.test.ts` (правит оркестратор) красит вызов кассы вне списка; цепочки
 * `tests/chain/*` берут отсюда `RewardKind`. Чужая касса — строка здесь, в коммите её владельца.
 */

/** Вид награды. */
export type RewardKind = 'coins' | 'stars' | 'steps' | 'emblem';

export interface RewardSource {
  /** Файл кассы; `null` — кассы ещё нет (её заведёт спека-владелец). */
  cash: string | null;
  /** Файлы, которым можно вызывать кассу. */
  callers: readonly string[];
}

export const REWARD_SOURCES: Readonly<Record<RewardKind, RewardSource>> = {
  // Монеты: позже добавятся `src/engine/games/…` (026) и призовые (022).
  coins: { cash: 'src/engine/wallet/wallet.ts', callers: ['src/engine/matchResult/coins.ts'] },
  stars: { cash: null, callers: ['src/engine/match/verdict.ts'] },
  // Шаги и эмблема — строки 019 / 022 / 024, когда появятся кассы.
  steps: { cash: null, callers: [] },
  emblem: { cash: null, callers: [] },
};
