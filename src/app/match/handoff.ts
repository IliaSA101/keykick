/**
 * Обмен итогом матча с экраном итога (065 Т9 → Т10): экран матча кладёт сюда результат `finishRun`, экран итога забирает
 * его один раз (`takeFinished`). Перезагрузка страницы посреди — пусто: итог уже записан в сохранение, экран итога идёт в Дом.
 * Рядом лежит, чей это матч (`takeMeta`): id урока для «переиграть» и номер урока для имени соперника.
 */
import { shallowRef } from 'vue';
import type { Finished } from './finish';

/** Чей матч: id урока (для «переиграть» — `/match?lesson=<id>`) и его номер в курсе Двора (улица соперника). */
export interface FinishedMeta {
  lesson: string;
  no: number;
}

export const finished = shallowRef<Finished>({ kind: 'none' });
const meta = shallowRef<FinishedMeta>({ lesson: '', no: 1 });

export function putFinished(f: Finished, m?: FinishedMeta): void {
  finished.value = f;
  if (m) meta.value = m;
}

/** Забрать итог и очистить: второй показ того же итога невозможен. */
export function takeFinished(): Finished {
  const f = finished.value;
  finished.value = { kind: 'none' };
  return f;
}

/** Забрать пометку матча (после `takeFinished`). */
export function takeMeta(): FinishedMeta {
  const m = meta.value;
  meta.value = { lesson: '', no: 1 };
  return m;
}
