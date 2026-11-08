<script setup lang="ts">
// Облик тренера (спека 019, design §10): место 160×160 px (карта сужает через `--face-size`), проп `coach`. Здесь — заглушка: круг с первой буквой
// имени. Рисованные облики тренеров — спека 020; незнакомый `coach` показывается тренером по умолчанию снаружи (`coachOf`).
import { computed } from 'vue';
import type { CoachInfo } from '../../engine/coach/coach';

const props = defineProps<{ coach: CoachInfo }>();

/** Первая буква последнего слова имени («Тренер Макс» → «М»). */
const initial = computed(() => (props.coach.name.trim().split(/\s+/).pop() ?? '').charAt(0).toUpperCase());
</script>

<template>
  <div
    class="face"
    role="img"
    :aria-label="coach.name"
    :data-coach="coach.id"
  >
    <span aria-hidden="true">{{ initial }}</span>
  </div>
</template>

<style scoped>
.face {
  display: grid;
  place-items: center;
  width: var(--face-size, 160px);
  height: var(--face-size, 160px);
  border: 4px solid var(--accent);
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--text);
  font-size: calc(var(--face-size, 160px) * 0.4);
  font-weight: 800;
}
</style>
