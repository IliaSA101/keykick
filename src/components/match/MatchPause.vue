<script setup lang="ts">
/*
 * Пауза (спека 017, design §1): Esc в любой фазе матча (вне печати — 017-Р54). «Продолжить» (Enter) — назад в ту же фазу, «Выйти» —
 * матч не доигран (design §1.1). Слой на весь экран матча; фокус сразу на «Продолжить», а «Выйти» — только
 * Tab и Enter: случайный Enter не бросает матч. Клавиши Enter и Esc ловит экран матча. Tab ходит по кругу внутри
 * окна (`trapTab`); при закрытии фокус возвращается туда, где был до паузы.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { trapTab } from '../focusTrap';
import { ru } from '../../i18n/ru';

// `fixed` — окно на весь вид, а не на колонку матча (итог, перерыв, пенальти: 017-Р54); `done` — матч уже доигран,
// «Матч не засчитается» не про него.
defineProps<{ fixed?: boolean; done?: boolean }>();
defineEmits<{ resume: []; quit: [] }>();

const t = ru.match2.pause;
const resumeBtn = ref<HTMLButtonElement | null>(null);

const root = ref<HTMLElement | null>(null);
// Где был фокус до паузы (кнопка, ссылка; на печати обычно body — тогда возвращать нечего).
const before = globalThis.document.activeElement;
const onKey = (e: KeyboardEvent): void => {
  if (root.value) trapTab(root.value, e);
};

onMounted(() => {
  globalThis.addEventListener('keydown', onKey);
  void nextTick(() => resumeBtn.value?.focus());
});
onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onKey);
  if (before instanceof HTMLElement && before !== globalThis.document.body && before.isConnected) before.focus();
});
</script>

<template>
  <div
    ref="root"
    class="shade"
    :class="{ fixed }"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pause-title"
  >
    <div class="card">
      <h2
        id="pause-title"
        class="title"
      >
        {{ t.title }}
      </h2>
      <p class="lead">
        {{ t.lead }}
      </p>
      <div class="buttons">
        <button
          ref="resumeBtn"
          type="button"
          class="primary"
          @click="$emit('resume')"
        >
          {{ t.resume }} <small>{{ t.resumeKey }}</small>
        </button>
        <button
          type="button"
          class="quit"
          @click="$emit('quit')"
        >
          {{ t.quit }}
        </button>
      </div>
      <p
        v-if="!done"
        class="note"
      >
        {{ t.quitNote }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.shade {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: rgb(10 20 40 / 0.72);
}

.shade.fixed {
  position: fixed;
  border-radius: 0;
}

.card {
  min-width: 300px;
  padding: var(--space-3) var(--space-5);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  text-align: center;
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
}

.title {
  margin: 0;
  font-size: 1.4rem;
}

.lead {
  margin: var(--space-1) 0 var(--space-3);
  color: var(--text-muted);
}

.buttons {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
}

.primary,
.quit {
  min-height: 44px;
  padding: 6px 18px;
  border-radius: 999px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.primary {
  border: 0;
  background: #ffd84a;
  color: #1a1a1a;
}

.primary small {
  margin-left: 6px;
  opacity: 0.65;
  font-weight: 700;
}

.quit {
  border: 1px solid var(--text-muted);
  background: transparent;
  color: var(--text-muted);
}

.primary:focus-visible,
.quit:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.note {
  margin: var(--space-2) 0 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}
</style>
