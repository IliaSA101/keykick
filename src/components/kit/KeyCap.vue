<script setup lang="ts">
/**
 * Клавиша-подсказка (`kbd` и `kbd.ar` из kit.mjs): «Enter», «Esc» — текстом слота; `arrow` — стрелка-клавиша (SVG 12 × 12).
 * Не кнопка: подсказка рядом с действием.
 */
defineProps<{ arrow?: 'left' | 'right' }>();
</script>

<template>
  <kbd
    v-if="arrow"
    class="ar"
    :title="arrow === 'left' ? '←' : '→'"
  >
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <path
        :d="arrow === 'left' ? 'M11 6H1.5M5.5 2 1.5 6l4 4' : 'M1 6h9.5M6.5 2l4 4-4 4'"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </kbd>
  <kbd v-else><slot /></kbd>
</template>
