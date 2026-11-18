<script setup lang="ts">
/** Кнопка-клавиша ЭБ (`btn` в tools/mock-kit/kit.mjs): главная одна на экран, тихая, размер md; состояния — классы или живые :hover/:active. */
const props = defineProps<{
  primary?: boolean;
  quiet?: boolean;
  md?: boolean;
  /** Клавиша под текстом («Enter», «Esc»). */
  sub?: string;
  /** Показ состояния без мыши (лист сверки); 'off' — ещё и disabled. */
  state?: 'hover' | 'down' | 'off' | undefined;
}>();
defineEmits<{ click: [] }>();
const close = (): boolean => props.quiet === true && props.sub === 'Esc';
</script>

<template>
  <button
    type="button"
    class="key-btn"
    :class="[{ primary, quiet, md, close: close() }, state]"
    :disabled="state === 'off'"
    @click="$emit('click')"
  >
    <slot /><small v-if="sub || $slots.sub"><slot name="sub">{{ sub }}</slot></small>
  </button>
</template>
