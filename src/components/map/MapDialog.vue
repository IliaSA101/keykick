<script setup lang="ts">
// Окно поверх карты (спека 019-Т8): лист лиги, «Что нового», правка клуба. Общая рамка: затемнение, Esc закрывает
// (слушаем окно, а не окно-элемент: после щелчка внутри фокус может уйти на body), фокус при открытии — на первый
// элемент (или на `data-autofocus`). Закрывается один раз, сколько бы событий ни пришло. Что под окном — `inert`
// на стороне экрана; возвращает фокус тоже экран (он знает, откуда окно открыли).
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{ labelledby: string; wide?: boolean; backdrop?: boolean; enterCloses?: boolean; belowTabs?: boolean }>(), {
  wide: false,
  belowTabs: false,
  backdrop: true,
  enterCloses: false,
});
const emit = defineEmits<{ close: [] }>();

const box = ref<HTMLElement | null>(null);
let closed = false;

function close(): void {
  if (closed) return;
  closed = true;
  emit('close');
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }
  // Фокус потерян (щелчок по пустому месту окна): Enter закрывает окно-сообщение, на кнопке сработает и сам.
  if (props.enterCloses && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
    e.preventDefault();
    if (!e.repeat) close();
  }
}

onMounted(() => {
  globalThis.addEventListener('keydown', onKey);
  const el = box.value;
  if (el && !el.contains(globalThis.document.activeElement)) {
    el.querySelector<HTMLElement>('[data-autofocus], button, input, a[href]')?.focus();
  }
});
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <div
    class="dim"
    :class="{ 'below-tabs': belowTabs }"
    @click.self="backdrop && close()"
  >
    <section
      ref="box"
      class="dialog panel"
      :class="{ wide }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="labelledby"
    >
      <slot :close="close" />
    </section>
  </div>
</template>

<style scoped>
.dim {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  /* Дорожки не шире и не выше экрана (minmax(0, …)): иначе широкое содержимое окна раздвигало дорожку сетки,
     окно заходило за левый край, а процентная высота не срабатывала. Отступ от края экрана — padding. */
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  place-items: center;
  box-sizing: border-box;
  padding: var(--space-4);
  background: rgb(10 9 30 / 0.7);
}

/* Окно ниже вкладок верхней панели (66 px): вкладки остаются видны и не накрыты окном (ребёнок-критик, 019-Р39). */
.dim.below-tabs {
  padding-top: calc(66px + var(--space-1));
}

/* Окно не выше экрана: длинное содержимое прокручивается внутри, а не уводит кнопки за край.
   Вторая граница высоты — страховка от окна, выше которого процент не считается; vh делим на масштаб страницы. */
.dialog {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: min(560px, 100%);
  min-width: 0;
  max-height: min(100%, calc(100vh / var(--ui-scale) - 2 * var(--space-4)));
  overflow-y: auto;
  color: var(--text);
}

.dialog.wide {
  width: min(1100px, 100%);
}
</style>
