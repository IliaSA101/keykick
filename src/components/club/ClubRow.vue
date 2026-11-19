<script setup lang="ts">
/**
 * Строка «подпись — значение» на тёмной плашке — общая у окна «Клуб» (значение — `<b>`, `as="div"`) и «Твой клуб» (поле ввода
 * внутри `label`, по умолчанию). Подпись — `label`, содержимое — слот: `input`, `b`, ярлык.
 */
withDefaults(defineProps<{ label: string; as?: 'label' | 'div' }>(), { as: 'label' });
</script>

<template>
  <component
    :is="as"
    class="row"
  >
    <span>{{ label }}</span>
    <slot />
  </component>
</template>

<style scoped>
/* числа — единицы макета из генераторов Э2К.32 и Э2К.36 (e2k-club.mjs, collection-e.css и collection-e-club.css); множителя нет */
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  border-radius: 10px;
  background: #1a1c45;
  font-size: 14px;
}
.row > span {
  flex: 0 0 108px;
  font-size: 13px;
  color: var(--text-muted);
}
.row :slotted(input) {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font: inherit; /* 14 px, межстрочный 1,5 — строка поля 31, как в кадре (collection-e.css:169) */
  font-weight: 700; /* как <b> в кадре */
}
.row :slotted(input:focus-visible) {
  outline: 2px solid var(--text); /* белая кайма: фокус — не золото на синей плашке */
}
.row :slotted(b) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis; /* длинное имя и город — многоточием (ТЗ-1.13, «Клуб: имя 20 (063-Р30), город 24») */
  white-space: nowrap;
}
</style>
