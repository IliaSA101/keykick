<script setup lang="ts">
/**
 * Полоса номеров тура (ТЗ-6.10, Э3.39): ярлычки заданий над листом. Решено — зелёный низ и «✓», неверно — красный и «✗»,
 * текущий — рамка. Только показ: номера и пометки приходят снаружи. Стили — `styles/kit/task.css` (`.nums.lg`).
 */
import { ru } from '../../i18n/ru';

export type StripMark = '' | 'ok' | 'bad';

defineProps<{ marks: readonly StripMark[]; /** Номер текущего задания с 1; 0 — нет. */ cur?: number }>();
const t = ru.paper.strip;
const label = (n: number, mark: StripMark, cur: boolean): string =>
  [t.task.replace('{n}', String(n)), mark === 'ok' ? t.ok : mark === 'bad' ? t.bad : '', cur ? t.cur : ''].filter((s) => s !== '').join(', ');
</script>

<template>
  <div
    class="nums lg"
    role="list"
    :aria-label="t.label"
  >
    <span
      v-for="(m, i) in marks"
      :key="i"
      role="listitem"
      :class="[i + 1 === cur ? 'cur' : m]"
      :aria-label="label(i + 1, m, i + 1 === cur)"
      :aria-current="i + 1 === cur ? 'step' : undefined"
    >{{ i + 1 }}<i v-if="m === 'ok' || m === 'bad'">{{ m === 'ok' ? '✓' : '✗' }}</i></span>
  </div>
</template>
