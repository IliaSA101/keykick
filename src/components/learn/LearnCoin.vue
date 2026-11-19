<script setup lang="ts">
/** Монета учебных игр (`gm-brk-coin` макета): круглая, золотая, без подписи — рядом всегда стоит число или слово. */
defineProps<{ size?: number }>();
</script>

<template>
  <i
    class="coin"
    :style="size ? { width: `${size}px`, height: `${size}px` } : undefined"
    aria-hidden="true"
  />
</template>

<style scoped>
.coin { display: inline-block; flex: none; vertical-align: middle; width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff1b0, var(--accent) 55%, #b58516); box-shadow: 0 0 0 1.5px #8a6410; }
</style>
