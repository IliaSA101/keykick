<script setup lang="ts">
/*
 * Запас ошибок решающей серии (спека 003, 008): мячи в строке статуса рядом с полоской хода; запас общий
 * на все атаки серии — после 5-й атаки мячи не возвращаются.
 * Яркий мяч — ещё можно ошибиться, блёклый серый в пунктирной лунке — запас истрачен. Мяч — тот же,
 * что летит в ворота (art/ball.webp). Цифр на экране нет (скорость и ошибки вживую не показываем);
 * экранному диктору в v1 — «Запас ошибок: N», в v2 — только подпись (hint).
 */
import { computed } from 'vue';
import { artUrl } from '../art/assets';
import type { ReserveHint } from '../engine/match/score';
import { ru } from '../i18n/ru';
import { reserveHintText } from './match/labels';

const ballUrl = artUrl('ball');

const props = defineProps<{
  /** Сколько ошибок ещё можно (decisiveReserve). */
  left: number;
  /** Весь запас лиги урока (LeagueRules.maxErrors): двор — 2, район и город — 3. */
  total: number;
  /** Без подписи (v1 «Можно ошибиться:», v2 «ещё N — гол твой») — только мячи: место нужно длинному предупреждению рядом. */
  compact?: boolean;
  /**
   * Матч v2 (017-Р13): мячей `c − 1`, ошибка гасит самый левый, первые `goal` мячей — цветом «гол».
   * Без `goal` — как в v1: горят первые `left` мячей, цвета нет.
   */
  goal?: number;
  /** Подпись матча v2 вместо «Можно ошибиться:» (`reserveView.hint`): «ещё N — гол твой» или «дальше без ошибок». */
  hint?: ReserveHint;
}>();

const v2 = computed(() => props.goal !== undefined);
const balls = computed(() =>
  Array.from({ length: props.total }, (_, i) => ({
    // v2: сгоревшие — слева (запас тратится с начала), v1 — справа.
    on: v2.value ? i >= props.total - props.left : i < props.left,
    goal: v2.value && i < (props.goal ?? 0),
  })),
);

const hintText = computed(() => reserveHintText(props.hint));

// Экранному диктору: v2 — только подпись («Можно ошибиться ещё 1 — гол твой»), без «Запас ошибок: N» (017-Р33); v1 — «Запас ошибок: N».
const spoken = computed(() => (v2.value ? hintText.value : `${ru.match.reserve.spoken} ${props.left}`));
</script>

<template>
  <p class="reserve">
    <span
      v-if="!v2 && !compact"
      class="label"
      aria-hidden="true"
    >{{ ru.match.reserve.label }}</span>
    <span
      v-for="(b, i) in balls"
      :key="i"
      class="slot"
      :class="{ on: b.on, goal: b.goal }"
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
      v-if="v2 && hintText && !compact"
      class="label hint-after"
      aria-hidden="true"
    >{{ hintText }}</span>
    <span
      class="spoken"
      role="status"
    >{{ spoken }}</span>
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

.hint-after {
  margin: 0 0 0 4px;
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

/* Мяч «гол» (матч v2): золотое кольцо — пока он горит, ошибка ещё не отнимает гол. */
.slot.goal.on {
  border-color: var(--accent);
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
