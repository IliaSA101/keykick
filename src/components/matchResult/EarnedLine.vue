<script setup lang="ts">
/*
 * Заработанное за матч (спека 017-Р34): монеты — крупной строкой со значком монеты; болельщики — значок и число
 * без слова (слово только для экранного диктора). Копилка «Ещё K верных — и монета» — лишь когда монет 0.
 * Порядок на глаз (проигрыш: заработанное сразу под заголовком) задаёт родитель через класс `first`.
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import { earnedLine, fansLabel } from './labels';

const props = defineProps<{
  coins: { paid: boolean; correct: number; coins: number; left: number };
}>();

const line = computed(() => earnedLine(props.coins));
</script>

<template>
  <div class="earned">
    <p
      class="coins"
      :class="line.kind"
    >
      <template v-if="line.kind === 'coins'">
        <img
          :src="artUrl('iconCoin')"
          alt=""
          width="256"
          height="256"
        >
        <b>+{{ line.coins }}</b>&nbsp;{{ line.word }}
      </template>
      <template v-else-if="line.kind === 'piggy'">
        <img
          :src="artUrl('iconCoin')"
          alt=""
          width="256"
          height="256"
        >
        {{ line.text }}
      </template>
      <template v-else>
        {{ line.text }}
      </template>
    </p>
    <p
      v-if="coins.correct > 0"
      class="fans"
      :aria-label="fansLabel(coins.correct)"
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
      >
        <circle
          cx="8"
          cy="8"
          r="3.2"
        />
        <circle
          cx="16.5"
          cy="9"
          r="2.8"
        />
        <path d="M2 20c0-3.6 2.7-6 6-6s6 2.4 6 6z" />
        <path d="M13.5 20c0-2.6 1.4-4.6 3.8-5 2.8-.4 4.7 1.7 4.7 5z" />
      </svg>
      <span aria-hidden="true">+{{ coins.correct }}</span>
    </p>
  </div>
</template>

<style scoped>
.earned {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.coins,
.fans {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin: 0;
}

/* Монеты — крупно: это то, ради чего ребёнок смотрит на итог. */
.coins.coins {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text);
}

.coins b {
  color: var(--accent);
}

.coins img {
  width: 36px;
  height: 36px;
}

/* Копилка и «монет нет» — тише крупной строки. */
.coins.piggy,
.coins.unpaid {
  font-size: 1rem;
  color: var(--text-muted);
}

.coins.piggy img {
  width: 28px;
  height: 28px;
}

.fans {
  font-size: 1.1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.fans svg {
  fill: currentcolor;
}
</style>
