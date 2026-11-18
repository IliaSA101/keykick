<script setup lang="ts">
/**
 * Кнопка звука в шапке — `soundBtn` из kit.mjs; состояние общее (`soundOn`), выключенный — с крестиком и красной каймой.
 * `show` — показ состояния без переключения (лист сверки: «включён» и «выключен» рядом); щелчок тогда ничего не меняет.
 */
import { computed } from 'vue';
import { ru } from '../../i18n/ru';
import SoundIcon from '../kit/SoundIcon.vue';
import { soundOn, toggleSound } from './sound';

const props = defineProps<{ show?: 'on' | 'off' }>();
const on = computed(() => (props.show ? props.show === 'on' : soundOn.value));
const label = computed(() => (on.value ? ru.frame.soundOn : ru.frame.soundOff));
function click(): void {
  if (!props.show) toggleSound();
}
</script>

<template>
  <button
    type="button"
    class="kb-snd"
    :class="{ off: !on }"
    :title="label"
    :aria-label="label"
    :aria-pressed="!on"
    @click="click"
  >
    <SoundIcon :on="on" />
  </button>
</template>

<style scoped>
.kb-snd {
  padding: 0;
  color: var(--text);
  cursor: pointer;
}
</style>
