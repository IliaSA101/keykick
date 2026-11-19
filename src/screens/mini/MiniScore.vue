<script setup lang="ts">
/** Счёт матча Мини-футбола (Э4.22, Э4.24): наш клуб в своём цвете, счёт, соперник в цветах своей команды. `big` — крупный, на итоге. */
defineProps<{ ours: string; us: string; rival: string; them: string; score: string; big?: boolean }>();
</script>

<template>
  <div
    class="score"
    :class="{ big }"
  >
    <span class="our"><i :style="{ background: ours }" />{{ us }}</span>
    <b>{{ score }}</b>
    <span class="rv"><i :style="{ background: rival, borderColor: '#15181f' }" />{{ them }}</span>
  </div>
</template>

<style scoped>
.score { display: grid; gap: 2px; justify-items: center; font-size: 14px; text-align: center; }
.score b { font-size: 44px; line-height: 1.1; }
.score i { display: inline-block; width: 12px; height: 12px; margin-right: 6px; border-radius: 50%; border: 2px solid #fff; vertical-align: -1px; }
.score.big { font-size: 18px; }
.score.big b { font-size: 52px; }
@media (max-width: 1100px) { .score b { font-size: 34px; } }
</style>
