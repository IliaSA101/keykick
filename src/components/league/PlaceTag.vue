<script setup lang="ts">
/**
 * Ярлык места (ЭБ.11, ЭБ.29) — `placeTag` из tools/mock-kit/kit.mjs: одна часть на Дом и Карту. kind — состояние (ref, lock, go, near, done, cur, home),
 * x, y — центр верхней кромки в px сцены; rows — подписи; head — строка над именем (новость стадиона), слот `head` — метка статуса над именем (ворота Района, «Ты здесь»); mark — метка на кромке («новое»), dot — точка вместо пилюли. Нажимаемый (`go`) — кнопка; «›» после имени — у `go`, если не задан `noArrow` (на Карте кнопка без стрелки, как в кадре Э2).
 */
withDefaults(defineProps<{ kind?: string; x: number; y: number; name: string; go?: boolean; noArrow?: boolean; rows?: string[]; mark?: string; dot?: boolean; head?: string }>(), {
  kind: 'ref',
  go: false,
  noArrow: false,
  rows: () => [],
  mark: '',
  dot: false,
  head: '',
});
defineEmits<{ click: [] }>();
</script>

<template>
  <component
    :is="go ? 'button' : 'div'"
    :type="go ? 'button' : undefined"
    class="kb-place"
    :class="kind"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click="go && $emit('click')"
  >
    <slot name="head" />
    <em
      v-if="head"
      class="news"
    >{{ head }}</em>
    <b class="nm"><slot name="icon" />{{ name }}<i
      v-if="go && !noArrow"
      class="go"
    >›</i></b>
    <span
      v-for="(r, k) in rows"
      :key="k"
      class="sub"
    >{{ r }}</span>
    <slot />
    <i
      v-if="mark && dot"
      class="dot"
      :title="mark"
    />
    <i
      v-else-if="mark"
      class="kb-tag solid new"
    >{{ mark }}</i>
  </component>
</template>

<style scoped>
button.kb-place {
  border: 0;
  font-family: inherit;
  color: inherit;
  cursor: pointer;
}
</style>
