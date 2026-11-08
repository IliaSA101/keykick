<script setup lang="ts">
/*
 * Страница родителя: сброс выбранного игрока в два шага — предупреждение и слово «сброс», только потом кнопка удаления.
 * Вызывает app/roster; после сброса сообщает родителю, чтобы он перечитал снимок игрока.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { resetPlayer } from '../../app/roster';
import { ru } from '../../i18n/ru';

const props = defineProps<{ playerId: string; name: string }>();
const emit = defineEmits<{ done: [] }>();

const t = ru.parent;

const resetStep = ref<'idle' | 'confirm' | 'done' | 'failed'>('idle');
const resetInput = ref('');
const wordInput = ref<HTMLInputElement | null>(null);
const resetButton = ref<HTMLButtonElement | null>(null);
const wordOk = computed(() => resetInput.value.trim().toLowerCase() === t.resetWord);
// Выбран другой игрок — шаг сброса прошлого игрока не про него.
watch(
  () => props.playerId,
  () => {
    resetStep.value = 'idle';
  },
);

function askReset(): void {
  resetStep.value = 'confirm';
  resetInput.value = '';
  void nextTick(() => wordInput.value?.focus());
}

/** Отмена: фокус обратно на кнопку сброса, а не в начало страницы. */
function cancelReset(): void {
  resetStep.value = 'idle';
  void nextTick(() => resetButton.value?.focus());
}

function doReset(): void {
  if (!wordOk.value) return;
  // Отказ слоя (копия «до» не легла, сохранение новее, ключ v1 не удалился, хранилище не читается): прогресс цел — об этом и пишем, а не «сброшено».
  const ok = resetPlayer(props.playerId);
  emit('done');
  resetStep.value = ok ? 'done' : 'failed';
}
</script>

<template>
  <section class="block danger">
    <h2>{{ t.reset }}: {{ name }}</h2>
    <p class="muted">
      {{ t.resetHint }}
    </p>
    <button
      v-if="resetStep !== 'confirm'"
      ref="resetButton"
      type="button"
      class="btn"
      @click="askReset"
    >
      {{ t.resetStart }}
    </button>
    <div
      v-else
      class="confirm"
      role="alertdialog"
      aria-labelledby="reset-sure"
    >
      <p
        id="reset-sure"
        class="sure"
      >
        {{ t.resetSure }}
      </p>
      <label class="word">
        {{ t.resetType }} «{{ t.resetWord }}»
        <input
          ref="wordInput"
          v-model="resetInput"
          type="text"
          autocomplete="off"
          @keydown.enter.prevent="doReset"
        >
      </label>
      <div class="row">
        <button
          type="button"
          class="btn red"
          :disabled="!wordOk"
          @click="doReset"
        >
          {{ t.resetConfirm }}
        </button>
        <button
          type="button"
          class="btn"
          @click="cancelReset"
        >
          {{ t.resetCancel }}
        </button>
      </div>
    </div>
    <p
      v-if="resetStep === 'done'"
      class="note"
      role="status"
    >
      {{ t.resetDone }}
    </p>
    <p
      v-if="resetStep === 'failed'"
      class="note"
      role="alert"
    >
      {{ t.resetFailed }}
    </p>
  </section>
</template>

<style scoped src="./paper.css"></style>
<style scoped>
.danger .btn {
  margin-top: var(--space-3);
}

.sure {
  margin: var(--space-3) 0;
  color: var(--paper-wrong);
  font-weight: 700;
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
</style>
