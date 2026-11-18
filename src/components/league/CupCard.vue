<script setup lang="ts">
/** Карточка «Кубок двора» (ТЗ-1.5, ЭБ.13/.14) — `cupCard` из kit.mjs: вход в сетку Кубка. state — итог раунда, sub — соперник; место — style снаружи;
 *  значок Кубка слева от заголовка (`CUP`, 065-Р160) — картинка кубка Двора. */
import { artUrl } from '../../art/assets';

defineProps<{ name: string; state: string; sub: string }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="card panel soft kb-cupcard"
    @click="$emit('click')"
  >
    <p class="cc-lk">
      <img
        class="ic"
        :src="artUrl('cupYard')"
        alt=""
      >{{ name }}<i>›</i>
    </p>
    <b>{{ state }}</b>
    <span>{{ sub }}</span>
  </button>
</template>

<style scoped>
.kb-cupcard {
  position: static;
  width: 248px;
  text-align: left;
  font-family: inherit;
  color: inherit;
  border: 0; /* карточка — кнопка: без рамки браузера «outset», как в кадре Э2.01 (065-Р164) */
  cursor: pointer;
}
</style>
