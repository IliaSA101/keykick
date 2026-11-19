<script setup lang="ts">
/** Выученные клавиши игрока, из которых берутся буквы над мячом (панель Чеканки, Э4.27–28): ряд плашек-клавиш. */
defineProps<{ keys: string[] }>();
</script>

<template>
  <p class="caps">
    <kbd
      v-for="k in keys"
      :key="k"
    >{{ k.toUpperCase() }}</kbd>
  </p>
</template>

<style scoped>
.caps { margin: 0; display: flex; gap: 6px; flex-wrap: wrap; }
kbd { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px; background: #f4f1e3; color: #1d3a2a; font-size: 22px; font-weight: 800; box-shadow: 0 3px 0 #b9b59a; }
</style>
