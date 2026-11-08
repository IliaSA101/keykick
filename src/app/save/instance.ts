/**
 * Единственный слой сохранения приложения: префикс и канал сборки, настоящее хранилище и часы.
 * Отдельно от store.ts — тот чистый (хранилище и часы снаружи) и не знает каталогов контента.
 */
import { courseLessons } from '../course/load';
import { matchRules } from '../match/load';
import { PLAYERS_KEY, listKeys, onAnyKeyChange, readJson, readText, removeKey, writeText } from '../storage';
import { CHANNEL, PREFIX } from '../versions/build';
import { APP_VERSION } from '../version';
import { registry } from './registry';
import { createSaveStore } from './store';

/** id уроков курса v2 по порядку (контент `lessons-*.json`). */
export const lessonIds = courseLessons.map((l) => l.id);

/** Контекст разбора сохранения: что есть в каталогах игры. */
export const saveContext = {
  lessonIds,
  version: APP_VERSION,
  // Ставка монеты из правил матча: остаток нажатий кошелька зажимается до `coinPer − 1` (018 design §3.3, Р20).
  coinPer: matchRules.coinPer,
};

function today(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const saveStore = createSaveStore({
  prefix: PREFIX,
  channel: CHANNEL,
  storage: { read: readText, write: writeText, remove: removeKey, keys: listKeys, onChange: onAnyKeyChange },
  sections: registry,
  now: () => Date.now(),
  today,
  app: APP_VERSION,
  ctx: saveContext,
  // Список читаем свежим: в другой вкладке игрока могли удалить.
  hasPlayer: (id) => {
    const list = (readJson(PLAYERS_KEY) as { players?: unknown } | null | undefined)?.players;
    return !Array.isArray(list) || list.some((p) => (p as { id?: unknown } | null)?.id === id);
  },
});
