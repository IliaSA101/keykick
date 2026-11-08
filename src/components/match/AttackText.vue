<script setup lang="ts">
/*
 * Текст атаки (спека 017, design §1): строки атаки или блока разминки; текущая — в `TypingLine`, пройденные
 * над ней, следующие под ней. Пока ждём (пауза, надпись), строка приглушена — первые буквы не теряются.
 */
import { computed } from 'vue';
import TypingLine from '../TypingLine.vue';
import type { TypingState } from '../../engine/typing';

const props = defineProps<{
  typing: TypingState;
  /** Все строки атаки и номер текущей (с 0). */
  rows: readonly string[];
  row: number;
  waiting?: boolean;
}>();

const before = computed(() => props.rows.slice(0, props.row));
const after = computed(() => props.rows.slice(props.row + 1));
</script>

<template>
  <TypingLine
    :class="{ waiting }"
    :state="typing"
    :before="before"
    :after="after"
  />
</template>

<style scoped>
.waiting {
  opacity: 0.35;
  transition: opacity 0.2s;
}
</style>
