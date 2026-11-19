<script setup lang="ts">
/**
 * Строка статуса серии ударов (068 Т6-2, Э5.30–.33): слово слева («Слово из 6 букв — набрано 2»), событие по центру, палец справа.
 * Положение и цвет строки — `.status` сцены (корень получает её область стилей); здесь — ширина и три ячейки. Вынесено из `MatchScene.vue` (разрез 068 Т6-3).
 */
import { ru } from '../../i18n/ru';

defineProps<{ left: string; centre: string; finger: string }>();
const t = ru.match;
</script>

<template>
  <div class="status ser">
    <span class="l">{{ left }}</span>
    <span class="c">{{ centre }}</span>
    <span class="r"><span
      v-if="finger"
      class="hint"
    >{{ t.status.finger }} <b>{{ finger }}</b></span></span>
  </div>
</template>

<style scoped>
.status.ser { width: 1000px; margin-left: -500px; }
.status.ser > span { flex: 1; min-width: 0; }
.status.ser .c { flex: 1.3; text-align: center; color: #fff; }
.status.ser .r { text-align: right; }
.status.ser b { color: var(--text); }
.status.ser .hint b { color: var(--zone-index); }
</style>
