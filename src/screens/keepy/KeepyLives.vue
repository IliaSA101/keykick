<script setup lang="ts">
import { computed } from 'vue';
/** Мячи-«жизни» Чеканки (панель Э4.28; число — `keepy.lives` из контента): целый — ещё можно промахнуться, перечёркнутый красным — промах. Рисунок — как мяч макета (`ballSvg`). */
const props = defineProps<{ misses: number; lives: number }>();
const balls = computed(() => Array.from({ length: props.lives }, (_, i) => i));
</script>

<template>
  <div class="balls">
    <svg
      v-for="i in balls"
      :key="i"
      :class="{ miss: i < misses }"
      width="30"
      height="30"
      viewBox="-17 -17 34 34"
      aria-hidden="true"
    >
      <circle
        r="14"
        fill="#fff"
        stroke="#15181f"
        stroke-width="2"
      />
      <polygon
        points="0,-5.88 5.59,-1.82 3.46,4.76 -3.46,4.76 -5.59,-1.82"
        fill="#15181f"
      />
      <path
        d="M0 -5.88V-12.88M5.59 -1.82L12.25 -3.98M3.46 4.76L7.57 10.42M-3.46 4.76L-7.57 10.42M-5.59 -1.82L-12.25 -3.98"
        stroke="#15181f"
        stroke-width="2"
      />
      <path
        v-if="i < misses"
        d="M-14 -14L14 14M14 -14L-14 14"
        stroke="#ff6b6b"
        stroke-width="4"
        stroke-linecap="round"
      />
    </svg>
  </div>
</template>

<style scoped>
.balls { display: flex; gap: 6px; }
.miss { opacity: 0.6; }
</style>
