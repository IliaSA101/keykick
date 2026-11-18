<script setup lang="ts">
/** Метка статуса — `tag` из kit.mjs: без вида — золото (контрольный), ok — зелёная, bad — красная, nt — нейтральная, solid — «новое». */
defineProps<{ kind?: 'ok' | 'bad' | 'nt' | 'solid' }>();
</script>

<template>
  <span
    class="kb-tag"
    :class="kind"
  ><slot /></span>
</template>
