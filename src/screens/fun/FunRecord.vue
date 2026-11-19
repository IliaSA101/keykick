<script setup lang="ts">
/**
 * Блок рекорда на старте игры на интерес (Чеканка, Мемори; 067-Р221): «Рекорд: <значение>» и «Сегодня: игра N из 2».
 * Значение уже собрано игрой (число и единица или «рекорда ещё нет»).
 */
import { fill } from '../../app/home/texts';
import { ru } from '../../i18n/ru';

defineProps<{ text: string; day: { n: number; of: number } }>();
</script>

<template>
  <div class="rec">
    <span class="k">{{ ru.base.keepy.best }}</span>
    <b>{{ text }}</b>
    <small>{{ fill(ru.base.keepy.today, day) }}</small>
  </div>
</template>

<style scoped>
.rec { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: 10px; background: rgb(255 255 255 / 0.06); }
.rec b { font-size: 18px; line-height: 1.15; white-space: nowrap; }
.rec b::first-letter { text-transform: uppercase; } /* «рекорда ещё нет» (общий текст Базы) — с заглавной */
.k { font-size: 14px; color: var(--text-muted); margin-top: 8px; }
small { font-size: 11px; color: var(--text-muted); }
</style>
