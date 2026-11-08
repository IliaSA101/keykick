/**
 * Список игроков на этом компьютере и кто играет в этой вкладке (план запуска — engine/players, planStart).
 * Сохранения игроков читает и пишет слой `app/save`; кто играет — `players/active`, перерыв — `players/shared`.
 */
import { computed, reactive, ref } from 'vue';
import { freshPlayers, planStart, tabPlayer, type PlayersData } from '../../engine/players';
import { ru } from '../../i18n/ru';
import { saveStore } from '../save/instance';
import {
  PLAYERS_KEY,
  SHARED_KEY,
  readJson,
  readTabPlayer,
  savedPlayerIds,
  writeJson,
  writeTabPlayer,
} from '../storage';

/** «Игрок 2» — для игрока без годного имени. */
export function fallbackName(n: number): string {
  return `${ru.players.fallback} ${n}`;
}

/** Запуск: по плану пишем недостающее (список, общую часть). Сохранение новее программы — только чтение (design §5, В6). */
function start(): PlayersData {
  const savedIds = savedPlayerIds();
  const readOnly = saveStore.scanNewer(savedIds);
  const plan = planStart({ list: readJson(PLAYERS_KEY), shared: readJson(SHARED_KEY), savedIds }, fallbackName);
  if (readOnly) return plan.data;
  if (plan.shared) writeJson(SHARED_KEY, plan.shared);
  if (plan.writeList) writeJson(PLAYERS_KEY, plan.data);
  return plan.data;
}

const list = reactive<PlayersData>(start());

/** Только чтение: менять — функциями app/roster (создать, выбрать, удалить, переименовать). */
export const players: Readonly<PlayersData> = list;

/** Выбранный в этой вкладке (sessionStorage); null — ещё не выбран. */
const tabId = ref<string | null>(readTabPlayer());

/** Кто играет в этой вкладке; null — игроков двое и больше, а выбора ещё не было. */
export const playingId = computed(() => tabPlayer(list, tabId.value));

/** Имя игрока этой вкладки; null — ещё не выбран. */
export const playerName = computed(() => list.players.find((p) => p.id === playingId.value)?.name ?? null);

/** Нужен экран «Кто играет?»: страж роутера ведёт туда. */
export const needsChoice = computed(() => playingId.value === null);

function setList(next: PlayersData): void {
  list.players = next.players.map((p) => ({ ...p }));
  list.current = next.current;
  list.lastId = next.lastId;
}

/** Свежий список из хранилища; null — читать нечего (ключа нет, он битый или пуст, хранилище недоступно). */
function fresh(): PlayersData | null {
  const data = freshPlayers(readJson(PLAYERS_KEY), fallbackName, savedPlayerIds());
  return data && { ...data, lastId: Math.max(data.lastId, list.lastId) };
}

/**
 * Свежий список из хранилища, без изменения списка вкладки: для проверок (имя занято?), которые
 * зовутся на каждый рендер. Читать нечего — список вкладки.
 */
export function freshList(): Readonly<PlayersData> {
  return fresh() ?? list;
}

/**
 * Перечитать список из хранилища: его мог поменять другой экземпляр игры (вторая вкладка).
 * Каждый писатель списка (app/roster) зовёт это первым и считает новый список от свежего, а не
 * от того, что вкладка помнит с запуска, — иначе запись затёрла бы чужого игрока. lastId не
 * уменьшается и не отстаёт от id сохранений. Ничего не присваивает, если список не изменился:
 * объекты игроков остаются теми же (на них смотрят поля ввода). Читает и в режиме «только чтение».
 */
export function syncList(): void {
  const data = fresh();
  if (data === null) return;
  if (JSON.stringify(data) === JSON.stringify({ players: list.players, current: list.current, lastId: list.lastId })) return;
  setList(data);
}

/**
 * Записать новый список и показать его. Запись не легла (переполнение) или нельзя писать («только
 * чтение») — false, список вкладки как был: правка не применяется (014-Р17), иначе вкладка и
 * хранилище расходятся, и чужие правки затирались бы или номер игрока менялся посреди игры.
 */
export function commitList(next: PlayersData): boolean {
  if (saveStore.status().readOnly) return false;
  const data = { players: next.players.map((p) => ({ ...p })), current: next.current, lastId: next.lastId };
  if (!writeJson(PLAYERS_KEY, data)) return false;
  setList(data);
  return true;
}

/** Отметить выбор этой вкладки; null — выбор снят (игрока удалили). */
export function setTabPlayer(id: string | null): void {
  tabId.value = id;
  writeTabPlayer(id);
}
