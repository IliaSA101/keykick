<script setup lang="ts">
/*
 * Запас ошибок решающей серии (спека 003, 008): мячи в строке статуса рядом с полоской хода; запас общий
 * на все атаки серии — после 5-й атаки мячи не возвращаются.
 * Яркий мяч — ещё можно ошибиться, блёклый серый в пунктирной лунке — запас истрачен. Мяч — тот же,
 * что летит в ворота (art/ball.webp). Цифр на экране нет (скорость и ошибки вживую не показываем);
 * экранному диктору — «Запас ошибок: N».
 */
import { computed } from 'vue';
import { artUrl } from '../art/assets';
import { ru } from '../i18n/ru';

const ballUrl = artUrl('ball');

const props = defineProps<{
  /** Сколько ошибок ещё можно (decisiveReserve). */
  left: number;
  /** Весь запас лиги урока (LeagueRules.maxErrors): двор — 2, район и город — 3. */
  total: number;
  /** Без подписи «Можно ошибиться:» — только мячи: место нужно длинному предупреждению рядом. */
  compact?: boolean;
}>();

const balls = computed(() => Array.from({ length: props.total }, (_, i) => i < props.left));
</script>

<template>
  <p class="reserve">
    <span
      v-if="!compact"
      class="label"
      aria-hidden="true"
    >{{ ru.match.reserve.label }}</span>
    <span
      v-for="(on, i) in balls"
      :key="i"
      class="slot"
      :class="{ on }"
      aria-hidden="true"
    >
      <img
        class="ball"
        :src="ballUrl"
        alt=""
        width="256"
        height="256"
      >
    </span>
    <span
      class="spoken"
      role="status"
    >{{ ru.match.reserve.spoken }} {{ left }}</span>
  </p>
</template>

<style scoped>
.reserve {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  margin: 0;
  white-space: nowrap;
  /* Мельче подсказки: подпись и мячи не теснят «Бей пальцем: …» на окне 1024. */
  font-size: 0.85em;
  font-weight: 700;
  color: var(--text-muted);
}

/* Лунка под мяч: пунктир виден, когда мяч истрачен. */
.label {
  margin-right: 2px;
}

.slot {
  display: grid;
  place-items: center;
  width: 1.4em;
  height: 1.4em;
  border: 2px dashed var(--text-muted);
  border-radius: 50%;
  box-sizing: border-box;
}

.slot.on {
  border-color: transparent;
}

.ball {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.25;
  filter: grayscale(1);
  transform: scale(0.7);
  transition: opacity 0.2s, filter 0.2s, transform 0.2s;
}

.slot.on .ball {
  opacity: 1;
  filter: none;
  transform: scale(1.15);
}

/* Текст для экранного диктора: на экране — мячи. */
.spoken {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .ball {
    transition: none;
  }
}
</style>
