/**
 * Матч v2 (спека 017, Т5в): обёртка над `MatchStore`, которая помнит данные до матча и верные нажатия с его начала —
 * итогу нужны «N верных → M монет» и рост формы, а само хранилище хранит только итоговое состояние.
 * Новый матч (`begin`: первый, «Ещё раз», переигровка) начинает счёт заново. Запись — в то же хранилище.
 */
import type { MatchData, ReadableMatchStore } from './store';
import type { MatchTotals } from './context';

export interface TalliedStore extends ReadableMatchStore {
  /** Данные хранилища до текущего матча и верные нажатия его блоков. */
  totals(): MatchTotals;
}

export function tallyStore(inner: ReadableMatchStore): TalliedStore {
  let before: MatchData = inner.read();
  let correct = 0;
  return {
    read: () => inner.read(),
    keys: (k) => inner.keys?.(k),
    soften: (lessonId, from) => inner.soften?.(lessonId, from),
    totals: () => ({ before, correct }),
    begin(e) {
      before = inner.read();
      correct = 0;
      inner.begin(e);
    },
    block(e) {
      correct += e.correct;
      inner.block(e);
    },
    toBreak: (p) => inner.toBreak(p),
    half2Started: () => inner.half2Started(),
    kick: (e) => inner.kick(e),
    abandon: (e) => inner.abandon(e),
    finish: (e) => inner.finish(e),
  };
}
