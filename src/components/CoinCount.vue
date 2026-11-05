<script setup lang="ts">
// Монеты игрока — плашка-табло с монеткой (шкафчик: «Формы» и «Бутсы»).
import { artUrl } from '../art/assets';
import { ru } from '../i18n/ru';

defineProps<{ coins: number }>();
</script>

<template>
  <p
    class="coins"
    :aria-label="`${ru.locker.coins}: ${coins}`"
  >
    <img
      :src="artUrl('iconCoin')"
      alt=""
      width="256"
      height="256"
    >
    <b>{{ coins }}</b>
  </p>
</template>

<style scoped>
.coins {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: 4px 16px 4px 6px;
  border-radius: 999px;
  background: rgb(16 15 44 / 0.75);
  box-shadow: 0 0 0 2px rgb(244 194 74 / 0.6);
  color: #f4c24a;
  font-size: 1.4rem;
  font-variant-numeric: tabular-nums;
}

.coins img {
  width: 36px;
  height: 36px;
}
</style>
