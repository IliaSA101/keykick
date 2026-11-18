<script setup lang="ts">
/** Переключатель со значком звука — `toggle` из kit.mjs. Состояние снаружи (`on`), щелчок или Enter — `toggle`. */
import SoundIcon from './SoundIcon.vue';

defineProps<{ on: boolean }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    class="toggle"
    :class="{ off: !on }"
    role="switch"
    :aria-checked="on"
    @click="$emit('toggle')"
  >
    <span class="ic"><SoundIcon :on="on" /></span>
    <span><slot /></span>
    <i />
  </button>
</template>

<style scoped>
.toggle {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}
.ic {
  display: grid;
  width: 22px;
  height: 22px;
}
</style>
