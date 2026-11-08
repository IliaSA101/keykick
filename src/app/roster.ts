/**
 * Действия с игроками: создать, выбрать, переименовать, удалить, сбросить прогресс.
 * Список — app/players/list, активный игрок — app/players/active; здесь они меняются согласованно.
 */
import { ref } from 'vue';
import {
  addPlayer,
  checkPlayerName,
  removePlayer,
  renamePlayer as renameIn,
  selectPlayer,
  type PlayerNameError,
} from '../engine/players';
import { commitList, freshList, players, playingId, setTabPlayer, syncList } from './players/list';
import { activeId, loadPlayer } from './players/active';
import { saveStore } from './save/instance';
import { PLAYERS_KEY, onKeyChange } from './storage';

/** Сколько раз игрока этой вкладки удалили в другой вкладке: роутер уводит вкладку на «Кто играет?» (014-Р18). */
export const tabPlayerRemoved = ref(0);

/** Последнее изменение списка не применено: запись не легла (нет места) или «только чтение» (014-Р17). */
export const writeRefused = ref(false);

/**
 * Список поменяла другая вкладка: подхватываем. Если игрока этой вкладки там удалили — как при
 * своём удалении: выбор снят, прогресс — выбранного или последнего (при нескольких вкладка спросит «Кто играет?»).
 * Идущую игру роутер бросает (`tabPlayerRemoved`): слой сохранения удалённому игроку уже не пишет (014-Р18).
 */
onKeyChange(PLAYERS_KEY, () => {
  syncList();
  const id = activeId();
  if (id === null || players.players.some((p) => p.id === id)) return;
  setTabPlayer(null);
  loadPlayer(playingId.value ?? players.current);
  tabPlayerRemoved.value += 1;
});

/** Играть за игрока id в этой вкладке: прогресс подменяется без перезагрузки страницы. */
export function choosePlayer(id: string): void {
  syncList();
  if (!players.players.some((p) => p.id === id)) return;
  commitList(selectPlayer(players, id));
  setTabPlayer(id);
  if (activeId() !== id) loadPlayer(id);
}

/** Ошибка имени нового игрока; null — годится. */
export function newNameError(name: string): PlayerNameError | null {
  const check = checkPlayerName(name, freshList().players);
  return check.ok ? null : check.error;
}

/**
 * Новый игрок с чистым сохранением. play — сразу играть за него в этой вкладке (экран
 * «Кто играет?»); со страницы родителя — только добавить. Нельзя (полон, имя) — null.
 */
export function createPlayer(name: string, play: boolean): string | null {
  writeRefused.value = false;
  syncList();
  const added = addPlayer(players, name);
  if (!added) return null;
  // Единственный игрок играл в этой вкладке без выбора — со вторым игроком выбор нужен явный,
  // иначе вкладку посреди игры спросят «Кто играет?».
  const playing = playingId.value;
  // Чистое сохранение — до списка: ключ с тем же id от удалённого игрока не воскреснет.
  // Список не лёг (014-Р17) — игрока нет; чистое сохранение без записи в списке пусто и безвредно:
  // его id уже не выдастся снова (savedPlayerIds поднимает lastId), а лишний ключ чинит сброс.
  saveStore.create(added.id);
  if (!commitList(play ? added.data : { ...added.data, current: players.current })) {
    writeRefused.value = true;
    return null;
  }
  if (playing !== null) setTabPlayer(playing);
  if (play) choosePlayer(added.id);
  return added.id;
}

export function renameError(id: string, name: string): PlayerNameError | null {
  const check = checkPlayerName(name, freshList().players, id);
  return check.ok ? null : check.error;
}

export function renamePlayer(id: string, name: string): boolean {
  writeRefused.value = false;
  syncList();
  const next = renameIn(players, id, name);
  if (next === players) return false;
  if (commitList(next)) return true;
  writeRefused.value = true;
  return false;
}

/**
 * Удалить игрока и его сохранение: сначала список, потом ключ. Играл в этой вкладке — выбор
 * снят: при двух и больше оставшихся вкладка спросит «Кто играет?». Последнего не удалить.
 */
export function deletePlayer(id: string): boolean {
  writeRefused.value = false;
  syncList();
  const next = removePlayer(players, id);
  if (next === players) return false;
  const name = players.players.find((p) => p.id === id)?.name;
  const wasPlaying = playingId.value === id;
  // Список не лёг — сохранение не трогаем (014-Р17): игрок остаётся целым.
  if (!commitList(next)) {
    writeRefused.value = true;
    return false;
  }
  saveStore.remove(id, name);
  if (wasPlaying) setTabPlayer(null);
  if (activeId() === id) loadPlayer(playingId.value ?? players.current);
  return true;
}

/** Сброс прогресса игрока: копия «до» и чистый конверт; играет он сейчас — прогресс с чистого листа. false — отказ. */
export function resetPlayer(id: string): boolean {
  // Отказ слоя (копия «до» не легла, сохранение новее, в v1 ключ не удалился, хранилище не читается) — прогресс на месте, ничего не перечитываем.
  if (saveStore.reset(id) === null) return false;
  if (activeId() === id) loadPlayer(id, true);
  return true;
}
