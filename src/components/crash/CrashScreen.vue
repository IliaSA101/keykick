<script setup lang="ts">
/**
 * Экран сбоя (спека 014-Т5): отдельное приложение Vue в своём узле, поэтому сломанный рендер игры его не уносит.
 * Состояния: сбой, «Игра обновилась», «Позови папу» (повтор, миграция), карточка «хранилище переполнено».
 * Ничего не знает ни о роутере, ни о прогрессе: действия приходят свойствами.
 */
import { computed, onMounted, ref } from 'vue';
import { ru } from '../../i18n/ru';

const props = defineProps<{
  kind: 'error' | 'newer' | 'migrate' | 'full';
  /** Повтор: кнопок «На главную» и «Обновить» нет. */
  again: boolean;
  /** Собрать и отдать файл (журнал игры ждёт до 3 с); false — не вышло. */
  save: () => boolean | Promise<boolean>;
}>();
const emit = defineEmits<{ home: []; update: []; close: [] }>();

const t = ru.crash;
const saved = ref<'idle' | 'ok' | 'fail'>('idle');
/** Файл собирается (ждём журнал): вторая кнопка не жмётся, пока первая не закончила. */
const busy = ref(false);
const first = ref<HTMLButtonElement | null>(null);

const view = computed(() => {
  if (props.kind === 'newer') {
    return props.again ? { title: t.again.title, text: t.newer.again } : { title: t.newer.title, text: t.newer.text };
  }
  if (props.kind === 'migrate') return t.migrate;
  if (props.kind === 'full') return t.full;
  return props.again ? t.again : { title: t.title, text: t.text };
});

async function saveFile(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    // Повторное нажатие после ответа отдаёт ещё один свежий файл; отказ повтор не блокирует.
    saved.value = (await props.save()) ? 'ok' : 'fail';
  } catch {
    saved.value = 'fail';
  } finally {
    busy.value = false;
  }
}

const fileButton = ref<HTMLButtonElement | null>(null);

// Без главной кнопки (повтор за 30 с) фокус — на «Сохранить файл для папы»: иначе первый Tab уходит под экран (014-Т7).
onMounted(() => (first.value ?? fileButton.value)?.focus());
</script>

<template>
  <div
    class="crash"
    role="alertdialog"
    aria-labelledby="crash-title"
    aria-describedby="crash-text"
    :data-kind="kind"
  >
    <div class="card">
      <h1 id="crash-title">
        {{ view.title }}
      </h1>
      <p id="crash-text">
        {{ view.text }}
      </p>
      <div class="buttons">
        <button
          v-if="kind === 'full'"
          ref="first"
          class="main"
          type="button"
          @click="emit('close')"
        >
          {{ t.full.button }}
        </button>
        <button
          v-else-if="kind === 'newer' && !again"
          ref="first"
          class="main"
          type="button"
          @click="emit('update')"
        >
          {{ t.newer.button }}
        </button>
        <button
          v-else-if="kind === 'error' && !again"
          ref="first"
          class="main"
          type="button"
          @click="emit('home')"
        >
          {{ t.home }}
        </button>
        <button
          v-if="kind !== 'full'"
          ref="fileButton"
          class="ghost"
          type="button"
          :disabled="busy"
          @click="saveFile"
        >
          {{ t.saveFile }}
        </button>
      </div>
      <p
        v-if="saved !== 'idle'"
        class="note"
        role="status"
      >
        {{ saved === 'ok' ? t.saved : t.saveFailed }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.crash {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  padding: var(--space-4, 16px);
  background: var(--bg, #15143a);
  color: var(--text, #fff6e0);
  font-family: var(--font, system-ui, sans-serif);
  font-size: var(--font-size, 18px);
}
/* Карточка поверх игры (хранилище переполнено): игру видно сквозь затемнение. */
.crash[data-kind='full'] {
  background: rgb(21 20 58 / 0.72);
}
.card {
  max-width: 34rem;
  padding: var(--space-5, 24px);
  background: var(--surface, #24235a);
  border: 2px solid var(--border, #4a4990);
  border-radius: var(--radius, 10px);
  text-align: center;
}
h1 {
  margin: 0 0 var(--space-3, 12px);
  font-size: 1.6rem;
}
p {
  margin: 0 0 var(--space-4, 16px);
  line-height: 1.4;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3, 12px);
  justify-content: center;
}
button {
  min-height: 48px;
  padding: 0 var(--space-5, 24px);
  font: inherit;
  color: inherit;
  background: transparent;
  border: 2px solid var(--border, #4a4990);
  border-radius: var(--radius, 10px);
  cursor: pointer;
}
button.main {
  color: #1a1a1a;
  background: var(--accent, #f4c24a);
  border-color: var(--accent, #f4c24a);
  font-weight: 700;
}
button:focus-visible {
  outline: 3px solid var(--accent, #f4c24a);
  outline-offset: 3px;
}
.note {
  margin: var(--space-4, 16px) 0 0;
  color: var(--text-muted, #c9c6ec);
}
</style>
