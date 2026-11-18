/**
 * Личный рекорд урока в итоге (ТЗ-2.17): скорость с зачётом, при равной — точность. Чистая функция выбора строки;
 * прошлый рекорд хранит отметка урока (`best` — зн/мин, `bestAcc` — точность в тысячных).
 */
export interface RecordValue {
  /** Знаков в минуту. */
  cpm: number;
  /** Точность, тысячные. */
  permille: number;
}

/**
 * `first` — первый матч урока («Рекорд урока: N»); `beaten` — быстрее прошлого на `delta`; `same` — скорость та же, точнее
 * («точнее прошлого», `delta` — разница в тысячных); `kept` — не побит («Рекорд: N»); `none` — рекорда нет вовсе
 * (матч не засчитан и прошлого нет).
 */
export type RecordKind = 'first' | 'beaten' | 'same' | 'kept' | 'none';

export interface RecordView {
  kind: RecordKind;
  /** Насколько побит: зн/мин при `beaten`, тысячные при `same`, иначе 0. */
  delta: number;
  /** Рекорд после матча — его пишет касса. */
  best: RecordValue | null;
}

/** Выбор строки рекорда. Незасчитанный матч рекорд не меняет. */
export function recordOf(prev: RecordValue | null, now: RecordValue, counted: boolean): RecordView {
  if (!counted) return { kind: prev === null ? 'none' : 'kept', delta: 0, best: prev };
  if (prev === null) return { kind: 'first', delta: 0, best: now };
  if (now.cpm > prev.cpm) return { kind: 'beaten', delta: now.cpm - prev.cpm, best: now };
  if (now.cpm === prev.cpm && now.permille > prev.permille) return { kind: 'same', delta: now.permille - prev.permille, best: now };
  return { kind: 'kept', delta: 0, best: prev };
}
