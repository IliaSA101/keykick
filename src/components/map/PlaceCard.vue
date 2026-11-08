<script setup lang="ts">
// Карточка места на карте (спека 019-Т8, design §5.3): флажок кубка, здание, ворота — заголовок и строки
// («после урока 9», замок, что строится). Урок — своя карточка (`LessonCard`). Ничего не нажимает: Esc и фокус
// решает экран. `aria-live`: диктор читает карточку при смене фокуса.
import type { PlaceInfo } from './labels';

defineProps<{ info: PlaceInfo }>();
</script>

<template>
  <section
    class="place panel"
    :class="info.kind"
    aria-live="polite"
  >
    <h2>{{ info.title }}</h2>
    <p
      v-for="line in info.lines"
      :key="line"
    >
      {{ line }}
    </p>
  </section>
</template>

<style scoped>
.place {
  padding: var(--space-3) var(--space-4);
  color: var(--text);
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

p {
  margin: var(--space-1) 0 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}
</style>
