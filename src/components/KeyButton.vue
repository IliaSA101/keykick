<script setup lang="ts">
// Крупная кнопка-«клавиша», как на главной: ссылка, если задан to, иначе обычная кнопка.
import { RouterLink } from 'vue-router';

defineProps<{ to?: string; primary?: boolean; disabled?: boolean }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="key-btn"
    :class="{ primary }"
  >
    <slot />
  </RouterLink>
  <button
    v-else
    type="button"
    class="key-btn"
    :class="{ primary }"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<style scoped>
/* Цвета свои, а не из темы: кнопка одинаково яркая на светлом и тёмном фоне. */
.key-btn {
  display: inline-block;
  min-width: 200px;
  text-align: center;
  padding: 14px 24px;
  border: 0;
  border-radius: 16px;
  font: inherit;
  font-weight: 800;
  font-size: 1.15rem;
  text-decoration: none;
  cursor: pointer;
  color: #1b3a12;
  background: linear-gradient(#ffffff, #e4ecd9);
  box-shadow:
    0 6px 0 #9fb58a,
    0 10px 20px rgb(0 0 0 / 0.3);
  transition:
    transform 0.08s,
    box-shadow 0.08s;
}

.key-btn.primary {
  font-size: 1.4rem;
  padding: 16px 28px;
  color: #ffffff;
  background: linear-gradient(#6fd34a, #2f9a27);
  box-shadow:
    0 7px 0 #1d6b18,
    0 0 0 3px #f4c24a,
    0 12px 26px rgb(0 0 0 / 0.35);
  text-shadow: 0 2px 0 #1d6b18;
}

.key-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.key-btn:active:not(:disabled) {
  transform: translateY(5px);
  box-shadow: 0 1px 0 #9fb58a;
}

.key-btn.primary:active:not(:disabled) {
  box-shadow:
    0 2px 0 #1d6b18,
    0 0 0 3px #f4c24a;
}

.key-btn:disabled {
  cursor: not-allowed;
  filter: grayscale(0.8);
  opacity: 0.6;
}

.key-btn:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .key-btn {
    transition: none;
  }
}
</style>
