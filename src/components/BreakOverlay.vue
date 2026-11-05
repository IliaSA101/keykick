<script setup lang="ts">
// Перерыв поверх игры: спокойная заставка с обратным отсчётом. Нажатия в это время
// до игры не доходят — их держит App.vue.
import { computed } from 'vue';
import { artUrl } from '../art/assets';
import { ru } from '../i18n/ru';

const props = defineProps<{ leftMs: number }>();

const clock = computed(() => {
  const total = Math.ceil(props.leftMs / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
});
</script>

<template>
  <div
    class="break"
    role="dialog"
    aria-modal="true"
    aria-labelledby="break-title"
  >
    <div class="card">
      <img
        class="watch"
        :src="artUrl('iconStopwatch')"
        alt=""
        width="256"
        height="256"
      >
      <h1 id="break-title">
        {{ ru.session.title }}
      </h1>
      <p class="lead">
        {{ ru.session.lead }}
      </p>
      <ul class="tips">
        <li
          v-for="tip in ru.session.tips"
          :key="tip"
        >
          {{ tip }}
        </li>
      </ul>
      <p class="left">
        {{ ru.session.left }}
      </p>
      <p
        class="clock"
        role="timer"
      >
        {{ clock }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Поверх всего, включая верхнюю панель: на перерыве ни во что не нажать. */
.break {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgb(12 12 36 / 0.92);
  overflow-y: auto;
}

/* Перерыв — страница поверх всего: множитель страниц (docs/specs/006-page-scale.md), сам слой
   вне каркаса, поэтому zoom — у карточки. */
.card {
  zoom: var(--page-scale);
  max-width: 560px;
  width: 100%;
  padding: var(--space-5);
  border-radius: 24px;
  background: linear-gradient(160deg, #2f5d4a, #1d3b30);
  box-shadow:
    0 0 0 3px rgb(244 194 74 / 0.5),
    0 16px 40px rgb(0 0 0 / 0.5);
  color: #fff6e0;
  text-align: center;
}

.watch {
  width: 96px;
  height: 96px;
}

h1 {
  margin: var(--space-2) 0;
  font-size: 2.4rem;
}

.lead {
  margin: 0 0 var(--space-3);
  font-size: 1.4rem;
  font-weight: 700;
}

.tips {
  margin: 0 auto var(--space-4);
  padding-left: 1.2em;
  max-width: 420px;
  text-align: left;
  line-height: 1.5;
}

.left {
  margin: 0;
  color: #d8e8de;
}

.clock {
  margin: 0;
  font-size: 3.2rem;
  font-weight: 900;
  color: #f4c24a;
  font-variant-numeric: tabular-nums;
}
</style>
