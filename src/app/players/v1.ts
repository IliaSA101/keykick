/**
 * Следы первой версии (063-Р12, З5): v1 живёт под ключами `keykick.*` (с точкой), v2 — под `keykick2.` / `keykick2-next.`.
 * Читаем только ИМЕНА ключей, никогда значения: сохранение v1 мы не импортируем (059-В2) и не стираем.
 * Нужно карточке «Новый клуб, новый сезон» (после 064): показ — если ключи v1 есть.
 */
import type { KeyValue } from '../save/storage';

/** Префикс ключей v1; `keykick2.` под него не попадает (после «keykick» стоит цифра, а не точка). */
export const V1_PREFIX = 'keykick.';

/** Есть ли в хранилище ключи v1. Недоступное хранилище — «нет» (карточка не нужна, если читать нечего). */
export function hasV1Keys(kv: Pick<KeyValue, 'keys'>): boolean {
  const listed = kv.keys(V1_PREFIX);
  return listed.ok && listed.value.length > 0;
}
