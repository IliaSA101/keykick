/**
 * Список игроков на этом компьютере и кто играет в этой вкладке. При первом запуске новой
 * версии — перенос старого сохранения одного игрока (план — engine/players, planStart).
 * Сохранения игроков читает и пишет app/progress: он же переключает игрока.
 */
import { computed, reactive, ref } from 'vue';
import { planStart, tabPlayer, type PlayersData } from '../engine/players';
import { ru } from '../i18n/ru';
import {
  LEGACY_KEY,
  PLAYERS_KEY,
  SHARED_KEY,
  readJson,
  readTabPlayer,
  removeKey,
  saveKey,
  savedPlayerIds,
  writeJson,
  writeTabPlayer,
} from './storage';

/** «Игрок 2» — для игрока без годного имени. */
export function fallbackName(n: number): string {
  return `${ru.players.fallback} ${n}`;
}

/**
 * Запуск: по плану переносим старое сохранение. Старый ключ удаляется последним и только
 * если всё записалось: иначе следующий запуск перенесёт его ещё раз, ничего не потеряв.
 */
function start(): PlayersData {
  const legacy = readJson(LEGACY_KEY);
  const plan = planStart(
    { list: readJson(PLAYERS_KEY), legacy, shared: readJson(SHARED_KEY), savedIds: savedPlayerIds() },
    fallbackName,
  );
  let ok = true;
  if (plan.moveLegacyTo !== null) ok = writeJson(saveKey(plan.moveLegacyTo), legacy);
  if (plan.shared) ok = writeJson(SHARED_KEY, plan.shared) && ok;
  if (plan.writeList) ok = writeJson(PLAYERS_KEY, plan.data) && ok;
  if (plan.moveLegacyTo !== null && ok) removeKey(LEGACY_KEY);
  return plan.data;
}

const list = reactive<PlayersData>(start());

/** Только чтение: менять — функциями app/progress (создать, выбрать, удалить, переименовать). */
export const players: Readonly<PlayersData> = list;

/** Выбранный в этой вкладке (sessionStorage); null — ещё не выбран. */
const tabId = ref<string | null>(readTabPlayer());

/** Кто играет в этой вкладке; null — игроков двое и больше, а выбора ещё не было. */
export const playingId = computed(() => tabPlayer(list, tabId.value));

/** Имя игрока этой вкладки; null — ещё не выбран. */
export const playerName = computed(() => list.players.find((p) => p.id === playingId.value)?.name ?? null);

/** Нужен экран «Кто играет?»: страж роутера ведёт туда. */
export const needsChoice = computed(() => playingId.value === null);

/** Новый список — в хранилище и на экран. */
export function commitList(next: PlayersData): void {
  list.players = next.players.map((p) => ({ ...p }));
  list.current = next.current;
  list.lastId = next.lastId;
  writeJson(PLAYERS_KEY, { players: list.players, current: list.current, lastId: list.lastId });
}

/** Отметить выбор этой вкладки; null — выбор снят (игрока удалили). */
export function setTabPlayer(id: string | null): void {
  tabId.value = id;
  writeTabPlayer(id);
}
