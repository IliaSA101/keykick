<script setup lang="ts">
/** Панель — `panel` из kit.mjs: soft — спокойная кайма (карточка на экране), иначе светлая (окно, карточка матча). Место — style снаружи. */
defineProps<{ soft?: boolean }>();
</script>

<template>
  <div
    class="card panel"
    :class="{ soft }"
  >
    <slot />
  </div>
</template>
