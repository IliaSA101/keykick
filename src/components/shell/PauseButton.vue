<script setup lang="ts">
/** «Пауза Esc» в шапке матча — `pauseBtn` из kit.mjs. Esc ловит экран матча; здесь — щелчок и подсказка клавиши. */
import { ru } from '../../i18n/ru';

defineEmits<{ pause: [] }>();
</script>

<template>
  <button
    type="button"
    class="kb-pause"
    @click="$emit('pause')"
  >
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1"
        width="3.2"
        height="10"
        rx="1"
      />
      <rect
        x="7.3"
        y="1"
        width="3.2"
        height="10"
        rx="1"
      />
    </svg>
    {{ ru.frame.pause }} <kbd>{{ ru.frame.esc }}</kbd>
  </button>
</template>

<style scoped>
.kb-pause {
  font-family: inherit;
  cursor: pointer;
}
</style>
