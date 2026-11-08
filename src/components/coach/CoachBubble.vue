<script setup lang="ts">
// Пузырь тренера (спека 019, design §3, Р3): облик слева, реплика справа. Кнопка — в слоте.
// Показывает карта до первого доигранного матча; сам ничего не решает и не пишет.
import type { CoachInfo } from '../../engine/coach/coach';
import CoachFace from './CoachFace.vue';

defineProps<{ coach: CoachInfo; text: string }>();
</script>

<template>
  <aside
    class="bubble"
    :aria-label="coach.name"
  >
    <CoachFace :coach="coach" />
    <div class="speech panel">
      <p class="who">
        {{ coach.name }}
      </p>
      <p class="text">
        {{ text }}
      </p>
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.bubble {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  color: var(--text);
}

.speech {
  flex: 1;
  min-width: 0;
}

.who {
  margin: 0 0 var(--space-1);
  font-weight: 800;
  color: var(--text-muted);
}

.text {
  margin: 0 0 var(--space-2);
  font-size: 1.15rem;
}
</style>
