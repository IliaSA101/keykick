<script setup lang="ts">
/**
 * Старт игры на интерес в боковой панели (Мемори, Вратарь; кадры Э4.31, Э4.37): заголовок, правила (слот), блок рекорда,
 * подсказка и «Играть». Корней несколько — дети встают прямо в колонку панели игры, раскладку (gap, ширину) задаёт она.
 */
import KeyButton from '../../components/kit/KeyButton.vue';
import { ru } from '../../i18n/ru';
import FunRecord from './FunRecord.vue';

defineProps<{ title: string; best: string; day: { n: number; of: number }; hint?: string; /** Без строки «монет за игру нет» (Мини-футбол: на кадре Э4.21 её нет). */ quiet?: boolean }>();
defineEmits<{ begin: [] }>();
</script>

<template>
  <h2>{{ title }}</h2>
  <slot />
  <FunRecord
    :text="best"
    :day="day"
  />
  <small v-if="!quiet">{{ hint }} {{ ru.base.fun.noCoins }}</small>
  <div class="btns">
    <KeyButton
      primary
      md
      :sub="ru.kit.enter"
      @click="$emit('begin')"
    >
      {{ ru.learn.start.play }}
    </KeyButton>
  </div>
</template>

<style scoped>
h2 { margin: 0; font-size: 20px; font-weight: 800; }
small { font-size: 11px; color: var(--text-muted); }
.btns { align-self: stretch; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 6px; }
.btns > :first-child { align-self: stretch; }
</style>
