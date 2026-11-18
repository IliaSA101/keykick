<script setup lang="ts">
/**
 * Ярлык-кнопка («Лист лиги», «сегодня») и подсказка наведения (`tip`) — `chip` и `tipChip` из tools/mock-kit/kit.mjs.
 * open — окно ярлыка открыто (золотом над затемнением); on — выбран; sm — мелкий. Подсказка — не кнопка: строки колонкой.
 */
defineProps<{ sm?: boolean; on?: boolean; open?: boolean; tip?: string[] }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <div
    v-if="tip"
    class="kb-chip tip"
  >
    <span
      v-for="(line, i) in tip"
      :key="i"
      class="ln"
    >{{ line }}</span>
  </div>
  <button
    v-else
    type="button"
    class="kb-chip"
    :class="{ sm, on, open }"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>
