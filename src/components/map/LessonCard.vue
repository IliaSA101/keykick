<script setup lang="ts">
// Карточка урока на карте (спека 019, design §5.3): имя, звёзды, рекорд, кольцо «вернуться за звёздами» и главная
// кнопка — «Играть» / «Ещё раз за звёздами» / «Продолжить 2-й тайм». Enter на точке нажимает её же (решает экран);
// компонент ничего не пишет и никуда не ходит — только сообщает `play`.
import { computed } from 'vue';
import type { MapPoint } from '../../engine/map/model';
import { ru } from '../../i18n/ru';
import { cardAction, fill, starsGlyphs } from './labels';

const props = defineProps<{ point: MapPoint; name: string; cpm: number; busy: boolean }>();
const emit = defineEmits<{ play: [] }>();

const t = ru.map.card;

const label = computed(() => {
  const p = props.point;
  const what = cardAction(p);
  if (what === 'resume') return fill(t.resume, { a: p.resume?.[0] ?? 0, b: p.resume?.[1] ?? 0 });
  return t[what];
});
const badge = computed(() => (props.point.badge === 'friendly' ? t.friendly : props.point.badge === 'control' ? t.control : ''));
const showStars = computed(() => props.point.state === 'passed');
</script>

<template>
  <section
    class="lesson-card panel"
    aria-live="polite"
    :aria-label="fill(t.lesson, { n: point.n })"
  >
    <p class="head">
      <span class="no">{{ fill(t.lesson, { n: point.n }) }}</span>
      <span
        v-if="badge"
        class="badge"
      >{{ badge }}</span>
      <span
        v-if="showStars"
        class="stars"
        role="img"
        :aria-label="fill(ru.map.point.starsOf, { n: point.stars })"
      >{{ starsGlyphs(point.stars) }}</span>
    </p>
    <h2
      id="lesson-card-name"
      class="name"
    >
      {{ name }}
    </h2>
    <p
      v-if="cpm > 0"
      class="note"
    >
      {{ fill(t.record, { n: cpm }) }}
    </p>
    <p
      v-if="point.back"
      class="note back"
    >
      {{ t.back }}
    </p>
    <!-- Tab сюда не заходит: клавиатуре — Enter на точке, мыши — кнопка. -->
    <button
      id="lesson-card-play"
      type="button"
      class="play"
      tabindex="-1"
      :disabled="busy"
      @click="emit('play')"
    >
      <span>{{ label }}</span>
      <span
        class="enter"
        aria-hidden="true"
      >⏎</span>
    </button>
  </section>
</template>

<style scoped>
.lesson-card {
  padding: var(--space-3) var(--space-4);
  color: var(--text);
}

.head {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.no {
  font-weight: 800;
}

.badge {
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--text);
  font-weight: 700;
}

.stars {
  margin-left: auto;
  color: var(--accent);
  font-size: 1.05rem;
  letter-spacing: 1px;
}

.name {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.25;
}

.note {
  margin: var(--space-1) 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.play {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  margin-top: var(--space-2);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: 12px;
  background: var(--accent);
  color: #1b1b1f;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}

.play:disabled {
  opacity: 0.6;
  cursor: default;
}

.enter {
  font-size: 0.9rem;
  opacity: 0.7;
}
</style>
