<script setup lang="ts">
/** Заглушка экрана лиги: вёрстку делают волны 2–5 (спека 063); здесь — только маршрут и подпись. */
import { ru } from '../../i18n/ru';

defineProps<{ title: string }>();
</script>

<template>
  <main class="stub">
    <h1>{{ title }}</h1>
    <p>{{ ru.frame.stubHint }}</p>
  </main>
</template>

<style scoped>
.stub {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: var(--space-3);
  text-align: center;
}
</style>
