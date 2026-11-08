/**
 * Замки карты (спека 019, design §5.2, ТЗ-1.9): условие открытия и его описание для интерфейса.
 * Текст и склонение («ещё N матчей») — в `i18n`; здесь только ключ и число.
 */
export type LockCond = { lesson: number } | { matches: number } | { nextTime: true } | { soon: true };

export interface LockText {
  key: 'lesson' | 'matches' | 'nextTime' | 'soon';
  n?: number;
}

/** Описание замка: ключ надписи и число для склонения (`plural`) — у `lesson` и `matches`. */
export function lockText(cond: LockCond): LockText {
  if ('lesson' in cond) return { key: 'lesson', n: cond.lesson };
  if ('matches' in cond) return { key: 'matches', n: cond.matches };
  if ('nextTime' in cond) return { key: 'nextTime' };
  return { key: 'soon' };
}
