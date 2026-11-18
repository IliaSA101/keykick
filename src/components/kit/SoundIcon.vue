<script setup lang="ts">
/** Значок звука — один на всю игру (`SPK` и `SPK_OFF` в kit.mjs): динамик с волнами; выключен — с крестиком вместо волн. */
defineProps<{ on: boolean }>();
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M3 9v6h4l5 4V5L7 9H3z" />
    <template v-if="on">
      <path
        d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"
        fill="none"
        stroke="var(--text)"
        stroke-width="2"
        stroke-linecap="round"
      />
    </template>
    <path
      v-else
      d="M16 9l6 6M22 9l-6 6"
      fill="none"
      stroke="var(--text)"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  </svg>
</template>
