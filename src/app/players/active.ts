/**
 * Ядро игрока: чьё сохранение сейчас в памяти слоя `app/save`, смена игрока без перезагрузки страницы
 * (app/roster) и снимок чужого игрока для карточек и родителя. Данные игрока здесь не лежат: их читают
 * разделы (`readSection`/`sectionRef`) и пишет `updatePlayer` (app/save/sections).
 */
import { ref } from 'vue';
import { players, playingId } from './list';
import { saveStore } from '../save/instance';
import type { Sections } from '../save/types';

/**
 * Чей прогресс в памяти: выбранный в этой вкладке, а пока выбора нет (игроков двое и больше) —
 * последний выбранный. Экраны игры до выбора не открываются (страж роутера).
 */
const activeRef = ref<string | null>(playingId.value ?? players.current);
// Загрузка в слой при старте: она же узнаёт «сохранение новее» и чинит битое (карантин).
if (activeRef.value !== null) saveStore.load(activeRef.value);

/** Чьё сохранение сейчас активно; null — игроков нет. */
export function activeId(): string | null {
  return activeRef.value;
}

/** Разделы игрока из хранилища без записи и миграций; нет или битое — чистые. Для карточек «Кто играет?» и родителя. */
export function peekSave(id: string): Sections {
  return saveStore.peek(id);
}

/** Разделы для родителя: у играющего в этой вкладке — то, что держит слой в памяти (запись могла не лечь), у других — лежащее. */
export function viewSave(id: string): Sections {
  return (id === activeRef.value ? saveStore.memory(id) : undefined) ?? saveStore.peek(id);
}

/** Подписчики на чужую запись активного игрока (слой разделов: `save/sections` освежает `sectionRef`; без цикла импортов). */
const activeSaveListeners: Array<() => void> = [];
export function onActiveSave(cb: () => void): void {
  activeSaveListeners.push(cb);
}

/** Следить за ключом активного игрока: другая вкладка записала — слой уже взял лежащее в память. */
function followActive(): void {
  saveStore.follow(activeRef.value, () => {
    for (const cb of activeSaveListeners) cb();
  });
}
followActive();

/**
 * Сделать активным игрока id (смена игрока, удаление; app/roster) и загрузить его разделы в слой.
 * fresh — чистый лист, не читая хранилище (сброс: ключ мог и не удалиться): слой берёт то, что уже держит.
 */
export function loadPlayer(id: string | null, fresh = false): void {
  activeRef.value = id;
  if (id !== null && !fresh) saveStore.load(id);
  followActive();
  // Показ (`sectionRef`) берёт лежащее заново: после сброса или удаления он иначе держал бы прежнее до F5.
  for (const cb of activeSaveListeners) cb();
}
