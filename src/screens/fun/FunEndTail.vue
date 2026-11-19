<script setup lang="ts">
/**
 * Низ окна итога игры на интерес в боковой панели (Штрафной; 067-Р221): значок «Новый рекорд!» (если рекорд записан), строка итога и кнопки
 * «Ещё раз» / «На Базу». Заголовок и счёт — слот-свои у игры.
 */
import { isRecord, type FunEnd } from '../../app/base/play';
import { ru } from '../../i18n/ru';
import FunEndButtons from './FunEndButtons.vue';

defineProps<{ end: FunEnd; note: string }>();
defineEmits<{ again: []; out: [] }>();
</script>

<template>
  <b
    v-if="isRecord(end)"
    class="new"
  >{{ ru.result.record.badge }}</b>
  <small>{{ note }}</small>
  <div class="btns">
    <FunEndButtons
      :left="end.left"
      @again="$emit('again')"
      @out="$emit('out')"
    />
  </div>
</template>

<style scoped>
.new { font-size: 22px; color: #6fd89c; }
small { font-size: 11px; color: var(--text-muted); }
.btns { align-self: stretch; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 6px; }
.btns > :first-child { align-self: stretch; }
</style>
