<script setup lang="ts">
/** Медаль ступени (`gm-tier.n` макета Э8): белое кольцо, цвет металла, цифра. Золото не касается синего — кольцо белое (ТАБУ). */
/** tier 0 — клавиша без ступени: пустое белое кольцо (кадры Э4.11–14, «юниор»). */
defineProps<{ tier: 0 | 1 | 2 | 3; size?: number }>();
</script>

<template>
  <i
    class="medal"
    :class="['plain', 'bronze', 'silver', 'gold'][tier]"
    :style="size ? { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size / 2.1)}px`, borderWidth: size > 40 ? '4px' : '2px' } : undefined"
  >{{ tier || '' }}</i>
</template>

<style scoped>
.medal { box-sizing: border-box; display: inline-grid; place-items: center; flex: none; width: 26px; height: 26px; border: 2px solid #fff; border-radius: 50%; font-style: italic; font-size: 14px; font-weight: 900; line-height: 1; color: #2b2438; }
.plain { background: transparent; }
.bronze { background: #c47a3a; }
.silver { background: #c9ced6; }
.gold { background: #f2c230; }
</style>
