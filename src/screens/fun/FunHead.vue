<script setup lang="ts">
/**
 * Шапка экрана игры на интерес (Чеканка, Мемори, Вратарь, Мини-футбол; 067-Р221): «Тренировочная база · <игра>», подсказка выхода во время игры
 * и «На Базу · Esc» (на итоге выход — в окне итога). Позиция — базовые px сцены 1024×640, как на кадрах Э4.
 */
import { ru } from '../../i18n/ru';
import KitChip from '../../components/kit/KitChip.vue';

defineProps<{ name: string; playing: boolean; ended: boolean }>();
defineEmits<{ out: [] }>();
</script>

<template>
  <div class="hd">
    <h1>{{ ru.home.houses.base }} · {{ name }}</h1>
    <span
      v-if="playing"
      class="hint"
    >{{ ru.base.keepy.exit }}</span>
    <KitChip
      v-if="!ended"
      class="out"
      @click="$emit('out')"
    >
      {{ ru.learn.end.base }} · {{ ru.kit.esc }}
    </KitChip>
  </div>
</template>

<style scoped>
.hd { position: absolute; left: 16px; right: 16px; top: 50px; height: 40px; display: flex; align-items: center; gap: 14px; }
.hd h1 { margin: 0; font-size: 22px; white-space: nowrap; text-shadow: 0 1px 6px rgb(8 8 24 / 0.9); }
.hint { margin-left: auto; font-size: 12px; white-space: nowrap; color: var(--text-muted); text-shadow: 0 1px 6px rgb(8 8 24 / 0.9); }
.out { margin-left: auto; }
.hint + .out { margin-left: 0; }
/* на 1024 подсказка 12 px (065-Р184) вместе с длинным названием не умещается в строку — заголовок чуть мельче (067 Т22) */
@media (max-width: 1100px) { .hd { gap: 10px; } .hd h1 { font-size: 21px; } }
</style>
