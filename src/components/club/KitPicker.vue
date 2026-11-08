<script setup lang="ts">
// Выбор формы клуба (спека 019, К8): радиогруппа палитр. Стрелки двигают выбор и фокус, Tab входит одной
// остановкой, Enter — «дальше» (событие `submit`: форма проверяет и отправляет). Ничего не пишет.
import { computed, nextTick, ref } from 'vue';
import { sameColors } from '../../engine/club/kit';
import type { KitColors } from '../../engine/kit';
import { ru } from '../../i18n/ru';
import KitView from '../KitView.vue';

const props = defineProps<{
  /** Выбранная форма (цвета). */
  modelValue: KitColors;
  /** Варианты по порядку; форма из старого сохранения, не из палитр, идёт последней (решает форма). */
  palettes: readonly KitColors[];
}>();
const emit = defineEmits<{ 'update:modelValue': [value: KitColors]; submit: [] }>();

const radios = ref<HTMLButtonElement[]>([]);
const index = computed(() => Math.max(0, props.palettes.findIndex((p) => sameColors(p, props.modelValue))));

function pick(i: number): void {
  const n = props.palettes.length;
  const at = (i + n) % n;
  const kit = props.palettes[at];
  if (kit === undefined) return;
  emit('update:modelValue', kit);
  void nextTick(() => radios.value[at]?.focus());
}
</script>

<template>
  <div
    class="variants"
    role="radiogroup"
    aria-labelledby="club-form-colors"
  >
    <button
      v-for="(p, i) in palettes"
      :key="i"
      ref="radios"
      type="button"
      role="radio"
      class="variant"
      :class="{ chosen: i === index }"
      :aria-checked="i === index"
      :aria-label="`${ru.clubForm.palette} ${i + 1}`"
      :tabindex="i === index ? 0 : -1"
      @click="pick(i)"
      @keydown.enter.prevent="emit('submit')"
      @keydown.right.prevent="pick(i + 1)"
      @keydown.down.prevent="pick(i + 1)"
      @keydown.left.prevent="pick(i - 1)"
      @keydown.up.prevent="pick(i - 1)"
    >
      <KitView :kit="{ id: `palette-${i}`, name: `${ru.clubForm.palette} ${i + 1}`, rarity: 'common', ...p }" />
    </button>
  </div>
</template>

<style scoped>
.variants {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(56px, 1fr));
  gap: var(--space-2);
}

.variant {
  padding: 4px;
  border: 3px solid transparent;
  border-radius: 12px;
  background: rgb(0 0 0 / 0.25);
  cursor: pointer;
}

.variant.chosen {
  border-color: var(--accent);
}

.variant:focus-visible {
  outline: 4px solid var(--text);
  outline-offset: 2px;
}
</style>
