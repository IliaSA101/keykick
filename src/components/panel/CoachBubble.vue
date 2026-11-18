<script setup lang="ts">
/**
 * Тренер — `coach` из kit.mjs (вариант А, владелец 09.11): круглый портрет в углу и реплика по поводу. Реплика (`text`)
 * закрывается ✕ или Esc (Esc ловит экран-хозяин, здесь — подсказка); щелчок по портрету — «повторить» (`again`).
 * state — 'hover' показывает наведение без мыши (лист сверки). Место — style снаружи.
 */
import { artUrl } from '../../art/assets';
import { ru } from '../../i18n/ru';

withDefaults(defineProps<{ text?: string; name?: string; state?: 'hover' | undefined; width?: number }>(), {
  text: '',
  name: ru.kit.coachName,
  state: undefined,
  width: 300,
});
defineEmits<{ close: []; again: [] }>();
</script>

<template>
  <div
    class="kb-coach"
    :class="state"
  >
    <button
      type="button"
      class="ava-btn"
      :title="name"
      @click="$emit('again')"
    >
      <img
        class="ava"
        :src="artUrl('coachFace')"
        :alt="name"
      >
    </button>
    <div
      v-if="text"
      class="kb-bub"
      :style="{ width: `${width}px` }"
    >
      <button
        type="button"
        class="x"
        :aria-label="ru.kit.close"
        @click="$emit('close')"
      >
        <kbd>{{ ru.kit.esc }}</kbd><i>✕</i>
      </button>
      <b class="nm">{{ name }}</b>
      <p>{{ text }}</p>
    </div>
  </div>
</template>

<style scoped>
.ava-btn {
  display: block;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  border-radius: 50%;
}
.ava-btn:hover .ava {
  box-shadow:
    0 0 0 3px var(--text),
    0 0 14px 4px rgb(255 246 224 / 0.5);
}
.kb-bub .x {
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  cursor: pointer;
}
</style>
