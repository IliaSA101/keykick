<script setup lang="ts">
/*
 * Игроки на странице родителя: чей прогресс смотреть (v-model — id игрока), переименовать,
 * добавить, удалить в два шага (предупреждение и имя игрока или слово «удалить»).
 * Выбор здесь не меняет, кто играет во вкладке, — только чей прогресс показан ниже.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { players, playingId } from '../app/players';
import { createPlayer, deletePlayer, newNameError, renameError, renamePlayer } from '../app/roster';
import { PLAYERS_MAX, PLAYER_NAME_MAX } from '../engine/players';
import { ru } from '../i18n/ru';

const viewId = defineModel<string>({ required: true });
const t = ru.parent;
const errors = ru.players.nameErrors;

const viewed = computed(() => players.players.find((p) => p.id === viewId.value) ?? null);

// Сообщение о сделанном — одно на блок; новое действие или другой игрок его снимает.
const done = ref<string | null>(null);
watch(viewId, () => {
  done.value = null;
});

// Переименовать выбранного.
const newName = ref('');
watch(
  viewed,
  (p) => {
    newName.value = p?.name ?? '';
  },
  { immediate: true },
);
const renameMsg = computed(() => {
  const e = renameError(viewId.value, newName.value);
  return e === null || newName.value.trim() === viewed.value?.name ? null : errors[e];
});

function doRename(): void {
  done.value = null;
  if (renamePlayer(viewId.value, newName.value)) done.value = t.renameDone;
}

// Добавить.
const addName = ref('');
const addTouched = ref(false);
const addMsg = computed(() => {
  if (!addTouched.value) return null;
  const e = newNameError(addName.value);
  return e === null ? null : errors[e];
});

function doAdd(): void {
  done.value = null;
  addTouched.value = true;
  if (newNameError(addName.value) !== null) return;
  if (createPlayer(addName.value, false) === null) return;
  addName.value = '';
  addTouched.value = false;
  done.value = t.addDone;
}

// Удалить — в два шага.
const removing = ref(false);
const removeInput = ref('');
const removeField = ref<HTMLInputElement | null>(null);
const removeButton = ref<HTMLButtonElement | null>(null);
const canRemove = computed(() => players.players.length > 1);
const removeOk = computed(() => {
  const typed = removeInput.value.trim().toLowerCase();
  return typed === t.removeWord || typed === viewed.value?.name.toLowerCase();
});

function askRemove(): void {
  removing.value = true;
  removeInput.value = '';
  done.value = null;
  void nextTick(() => removeField.value?.focus());
}

function cancelRemove(): void {
  removing.value = false;
  void nextTick(() => removeButton.value?.focus());
}

function doRemove(): void {
  if (!removeOk.value) return;
  const id = viewId.value;
  if (!deletePlayer(id)) return;
  removing.value = false;
  viewId.value = playingId.value ?? players.current ?? players.players[0]?.id ?? id;
  done.value = t.removeDone;
}
</script>

<template>
  <section class="block">
    <h2>{{ t.players }}</h2>
    <p class="muted">
      {{ t.playersHint }}
    </p>
    <fieldset>
      <legend>{{ t.viewing }}</legend>
      <label
        v-for="p in players.players"
        :key="p.id"
        class="choice"
      >
        <input
          v-model="viewId"
          type="radio"
          name="viewed-player"
          :value="p.id"
        >
        <b>{{ p.name }}</b>
        <span
          v-if="p.id === playingId"
          class="muted-inline"
        >({{ t.playingNow }})</span>
      </label>
    </fieldset>

    <form
      class="line"
      @submit.prevent="doRename"
    >
      <label class="word">
        {{ t.rename }}
        <input
          v-model="newName"
          type="text"
          :maxlength="PLAYER_NAME_MAX + 4"
          autocomplete="off"
        >
      </label>
      <button
        type="submit"
        class="btn"
        :disabled="renameMsg !== null || newName.trim() === viewed?.name"
      >
        {{ t.renameSave }}
      </button>
    </form>
    <p
      v-if="renameMsg"
      class="bad"
    >
      {{ renameMsg }}
    </p>

    <form
      v-if="players.players.length < PLAYERS_MAX"
      class="line"
      @submit.prevent="doAdd"
    >
      <label class="word">
        {{ t.addName }}
        <input
          v-model="addName"
          type="text"
          :maxlength="PLAYER_NAME_MAX + 4"
          autocomplete="off"
        >
      </label>
      <button
        type="submit"
        class="btn"
      >
        {{ t.addPlayer }}
      </button>
    </form>
    <p
      v-else
      class="muted"
    >
      {{ ru.players.full }}
    </p>
    <p
      v-if="addMsg"
      class="bad"
    >
      {{ addMsg }}
    </p>

    <div
      v-if="canRemove"
      class="remove"
    >
      <p class="muted">
        {{ t.removeHint }}
      </p>
      <button
        v-if="!removing"
        ref="removeButton"
        type="button"
        class="btn"
        @click="askRemove"
      >
        {{ t.remove }}: {{ viewed?.name }}
      </button>
      <div
        v-else
        class="confirm"
        role="alertdialog"
        aria-labelledby="remove-sure"
      >
        <p
          id="remove-sure"
          class="sure"
        >
          {{ t.removeSure }}
        </p>
        <label class="word">
          {{ t.removeType }} «{{ t.removeWord }}»
          <input
            ref="removeField"
            v-model="removeInput"
            type="text"
            autocomplete="off"
            @keydown.enter.prevent="doRemove"
          >
        </label>
        <div class="line">
          <button
            type="button"
            class="btn red"
            :disabled="!removeOk"
            @click="doRemove"
          >
            {{ t.removeConfirm }}: {{ viewed?.name }}
          </button>
          <button
            type="button"
            class="btn"
            @click="cancelRemove"
          >
            {{ t.resetCancel }}
          </button>
        </div>
      </div>
    </div>
    <p
      v-if="done"
      class="note"
      role="status"
    >
      {{ done }}
    </p>
  </section>
</template>

<style scoped>
/* Облик — как у остальной страницы родителя (ParentScreen.vue). */
.block {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--paper-border);
}

h2 {
  margin: 0 0 var(--space-3);
  font-size: 1.2rem;
}

.muted {
  margin: var(--space-2) 0 0;
  color: #555;
}

.muted-inline {
  color: #555;
}

fieldset {
  margin: var(--space-3) 0 0;
  padding: var(--space-2) var(--space-3) var(--space-3);
  border: 1px solid var(--paper-border);
  border-radius: var(--radius);
}

.choice {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  gap: var(--space-1);
  min-height: 44px;
  margin-right: var(--space-4);
}

input[type='radio'] {
  width: 20px;
  height: 20px;
  accent-color: var(--paper-button);
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.word {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 320px;
}

.word input {
  min-height: 40px;
  padding: 0 var(--space-2);
  border: 1px solid var(--paper-border);
  border-radius: 8px;
  background: var(--paper-field);
  color: var(--paper-text);
  font: inherit;
}

.btn {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--paper-border);
  border-radius: var(--radius);
  background: var(--paper-field);
  color: var(--paper-text);
  font: inherit;
  cursor: pointer;
}

.btn.red {
  border-color: var(--paper-wrong);
  background: var(--paper-wrong);
  color: #fff;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn:focus-visible,
input:focus-visible {
  outline: 3px solid var(--paper-focus);
  outline-offset: 2px;
}

.remove .btn {
  margin-top: var(--space-3);
}

.bad,
.sure {
  margin: var(--space-2) 0 0;
  color: var(--paper-wrong);
  font-weight: 700;
}

.note {
  margin: var(--space-3) 0 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--paper-note);
  font-weight: 700;
}
</style>
