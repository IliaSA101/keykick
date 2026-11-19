<script setup lang="ts">
/**
 * «Что выросло» поражения (ТЗ-2.12): болельщики, монеты и пальцы, у которых вырос ранг. Общий блок карточки Э1 и карточки Кубка (068 Т6-2);
 * готовые строки приходят от модели карточки, блок только показывает.
 */
import { artUrl } from '../../art/assets';
import { ru } from '../../i18n/ru';
import FansIcon from './FansIcon.vue';

defineProps<{ fans: string; coins: string; grew: readonly string[] }>();
</script>

<template>
  <div class="grewblk">
    <b class="grew-title">{{ ru.result.purse.grewTitle }}</b>
    <span class="fans"><FansIcon />{{ fans }}</span>
    <span class="coin-line">{{ coins }} <img
      :src="artUrl('iconCoin')"
      alt=""
    ></span>
    <span
      v-for="g in grew"
      :key="g"
      class="grew"
    >{{ g }}</span>
  </div>
</template>

<style scoped>
.grewblk { display: flex; align-items: center; gap: 20px; font-size: 22px; font-weight: 700; white-space: nowrap; }
.grew-title { font-size: 22px; }
.fans { display: inline-flex; align-items: center; gap: 6px; font-size: 22px; }
.fans svg { width: 22px; height: 22px; fill: var(--text-muted); }
.coin-line { display: inline-flex; align-items: center; gap: 6px; }
.coin-line img { width: 22px; height: 22px; }
.grew { color: #fff; }
</style>
