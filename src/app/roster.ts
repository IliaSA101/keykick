/**
 * Действия с игроками: создать, выбрать, переименовать, удалить, сбросить прогресс.
 * Список — app/players, прогресс в памяти — app/progress; здесь они меняются согласованно.
 */
import {
  addPlayer,
  checkPlayerName,
  removePlayer,
  renamePlayer as renameIn,
  selectPlayer,
  type PlayerNameError,
} from '../engine/players';
import { emptySave } from '../engine/save';
import { commitList, players, playingId, setTabPlayer } from './players';
import { activeId, loadPlayer } from './progress';
import { removeKey, saveKey, writeJson } from './storage';

/** Играть за игрока id в этой вкладке: прогресс подменяется без перезагрузки страницы. */
export function choosePlayer(id: string): void {
  if (!players.players.some((p) => p.id === id)) return;
  commitList(selectPlayer(players, id));
  setTabPlayer(id);
  if (activeId() !== id) loadPlayer(id);
}

/** Ошибка имени нового игрока; null — годится. */
export function newNameError(name: string): PlayerNameError | null {
  const check = checkPlayerName(name, players.players);
  return check.ok ? null : check.error;
}

/**
 * Новый игрок с чистым сохранением. play — сразу играть за него в этой вкладке (экран
 * «Кто играет?»); со страницы родителя — только добавить. Нельзя (полон, имя) — null.
 */
export function createPlayer(name: string, play: boolean): string | null {
  const added = addPlayer(players, name);
  if (!added) return null;
  // Единственный игрок играл в этой вкладке без выбора — со вторым игроком выбор нужен явный,
  // иначе вкладку посреди игры спросят «Кто играет?».
  const playing = playingId.value;
  if (playing !== null) setTabPlayer(playing);
  // Чистое сохранение — до списка: ключ с тем же id от удалённого игрока не воскреснет.
  writeJson(saveKey(added.id), emptySave());
  commitList(play ? added.data : { ...added.data, current: players.current });
  if (play) choosePlayer(added.id);
  return added.id;
}

export function renameError(id: string, name: string): PlayerNameError | null {
  const check = checkPlayerName(name, players.players, id);
  return check.ok ? null : check.error;
}

export function renamePlayer(id: string, name: string): boolean {
  const next = renameIn(players, id, name);
  if (next === players) return false;
  commitList(next);
  return true;
}

/**
 * Удалить игрока и его сохранение: сначала список, потом ключ. Играл в этой вкладке — выбор
 * снят: при двух и больше оставшихся вкладка спросит «Кто играет?». Последнего не удалить.
 */
export function deletePlayer(id: string): boolean {
  const next = removePlayer(players, id);
  if (next === players) return false;
  const wasPlaying = playingId.value === id;
  commitList(next);
  removeKey(saveKey(id));
  if (wasPlaying) setTabPlayer(null);
  if (activeId() === id) loadPlayer(playingId.value ?? players.current);
  return true;
}

/** Сброс прогресса игрока: ключ сохранения удаляется; играет он сейчас — прогресс с чистого листа. */
export function resetPlayer(id: string): void {
  removeKey(saveKey(id));
  if (activeId() === id) loadPlayer(id, true);
}
