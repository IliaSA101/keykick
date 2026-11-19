<script setup lang="ts">
/**
 * «Точность» и «Скорость» итога матча (ЭБ.25/27/30): общий блок карточки Э1 и карточки Кубка (068 Т6-2). Корень — `dl` с `display: contents`,
 * чтобы два столбца встали в сетку родителя (`.mid` карточки Э1) или в свой ряд.
 */
import { ru } from '../../i18n/ru';

defineProps<{ stats: { acc: string; cpm: string } }>();
const t = ru.result;
</script>

<template>
  <dl>
    <div>
      <dt>{{ t.acc }}</dt>
      <dd>{{ stats.acc }}</dd>
    </div>
    <div>
      <dt>{{ t.speed }}</dt>
      <dd>{{ stats.cpm }}</dd>
      <dt class="unit">
        {{ t.perMinute }}
      </dt>
    </div>
  </dl>
</template>

<style scoped>
dl { display: contents; margin: 0; }
dl > div { display: flex; flex-direction: column; gap: 1px; }
dt { font-size: 14px; color: var(--text-muted); }
dd { margin: 0; font-size: 28px; font-weight: 700; line-height: 1.1; }
</style>
