<script setup lang="ts">
/**
 * Полоса «форма спереди и сзади» на тёмной подложке — общая у окна «Клуб» (Э2К.32) и «Твой клуб» (Э2К.36/37).
 * `back` — имя и номер на спине; `label` — подпись формы спереди для читалки экрана.
 */
import type { ClubKit } from '../../engine/club/section';
import { ru } from '../../i18n/ru';
import ShirtView from './ShirtView.vue';

defineProps<{ kit: ClubKit; back: { name: string; number: number }; label: string }>();
</script>

<template>
  <div class="shirts">
    <div class="big">
      <ShirtView
        :kit="kit"
        :label="label"
      />
    </div>
    <div class="big">
      <ShirtView
        :kit="kit"
        :back="back"
        :label="ru.start.club.backName"
      />
    </div>
  </div>
</template>

<style scoped>
/* числа — единицы макета из генераторов Э2К.32 и Э2К.36 (e2k-club.mjs, collection-e-club.css); множителя нет */
.shirts {
  flex: none; /* ширина, а не flex-basis: в колонке окна «Клуб» basis стал бы высотой 340 и растянул блок */
  width: 340px;
  min-width: 0; /* колонка ровно 340: две формы шире — центрируются и выступают прозрачными краями, колонку не растягивают */
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 10px 24px;
  border-radius: 16px;
  background: radial-gradient(ellipse at 50% 40%, #23265d, #11122c 70%);
}
.big {
  flex: 0 0 150px; /* форма высотой 150 (как img height:150 в кадре); поля холста прозрачные: в раскладке форма занимает 134, как в кадре */
  margin-inline: -8px;
}
</style>
