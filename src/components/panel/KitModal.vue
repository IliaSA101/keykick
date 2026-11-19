<script setup lang="ts">
/**
 * Модалка по центру — `modal` из kit.mjs: затемнение `.dim` и `.card.panel.kb-modal`.
 * Клавиши: при открытии фокус уходит внутрь (на главную кнопку, иначе на первый элемент), Tab и Shift+Tab ходят по кругу
 * (`cycleIndex`), Esc — `close`, при закрытии фокус возвращается туда, где был. Enter жмёт кнопку в фокусе сам.
 * `enterDelay` > 0 — окно цепочки: Enter не засчитывается, пока не прошла пауза после открытия и пока клавишу держат
 * (быстрый двойной Enter на кнопке прошлого окна не жмёт кнопку этого).
 * Слоты: `head` — справа в строке заголовка (кнопка «Закрыть Esc», `.mhead`), по умолчанию — тело, `buttons` — строка кнопок, `after` — ниже всего. Окно-вопрос — по центру, окно-список (`left`) — слева.
 */
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { cycleIndex, enterAllowed, FOCUSABLE } from './focusCycle';

const props = withDefaults(
  defineProps<{
    title: string;
    lead?: string;
    note?: string;
    left?: boolean;
    width?: number;
    top?: number;
    /** Esc закрывает окно; false — окно держит Esc само. */
    escClose?: boolean;
    role?: 'dialog' | 'alertdialog';
    /** Цвет затемнения, если нужно плотнее обычного (окно сбоя). */
    dimColor?: string;
    /** Пауза после открытия, мс, в которую Enter не засчитывается; 0 — без защиты. */
    enterDelay?: number;
  }>(),
  { lead: '', note: '', width: 500, top: 168, escClose: true, role: 'dialog', dimColor: '', enterDelay: 0 },
);
const emit = defineEmits<{ close: [] }>();

const card = ref<HTMLElement | null>(null);
const titleId = useId(); // читалка экрана называет окно по заголовку, а не по копии строки
let before: Element | null = null;
const openedAt = globalThis.performance.now();

const items = (): HTMLElement[] => (card.value ? [...card.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : []);

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && props.enterDelay > 0 && !enterAllowed({ repeat: e.repeat, openedAt, now: e.timeStamp, delay: props.enterDelay })) {
    e.preventDefault(); // и кнопка, и поле формы Enter не получают
    e.stopPropagation();
    return;
  }
  if (e.key === 'Escape' && props.escClose) {
    e.preventDefault();
    emit('close');
    return;
  }
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const list = items();
  list[cycleIndex(list.length, list.indexOf(globalThis.document.activeElement as HTMLElement), e.shiftKey)]?.focus();
}

onMounted(() => {
  before = globalThis.document.activeElement;
  const list = items();
  // «Закрыть» в заголовке (слот `head`) — не стартовый фокус: двойной Enter не должен закрывать окно
  (list.find((el) => el.classList.contains('primary')) ?? list.find((el) => !el.closest('.mhead')) ?? list[0] ?? card.value)?.focus();
  globalThis.addEventListener('keydown', onKey, true);
});
onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onKey, true);
  if (before instanceof HTMLElement && before.isConnected) before.focus();
});
</script>

<template>
  <div class="kb-layer">
    <div
      class="dim"
      :style="dimColor ? { background: dimColor } : undefined"
    />
    <div
      ref="card"
      class="card panel kb-modal"
      :class="{ left }"
      :style="{ marginLeft: `-${width / 2}px`, width: `${width}px`, top: `${top}px` }"
      :role="role"
      :aria-labelledby="titleId"
      aria-modal="true"
      tabindex="-1"
    >
      <div
        v-if="$slots.head"
        class="mhead"
      >
        <h2 :id="titleId">
          {{ title }}
        </h2>
        <slot name="head" />
      </div>
      <h2
        v-else
        :id="titleId"
      >
        {{ title }}
      </h2>
      <p
        v-if="lead"
        class="lead"
      >
        {{ lead }}
      </p>
      <slot />
      <div
        v-if="$slots.buttons"
        class="btns"
        :style="left ? { justifyContent: 'space-between' } : undefined"
      >
        <slot name="buttons" />
      </div>
      <p
        v-if="note"
        class="note"
      >
        {{ note }}
      </p>
      <slot name="after" />
    </div>
  </div>
</template>

<style scoped>
.kb-layer {
  position: absolute;
  inset: 0;
}
.kb-modal:focus {
  outline: none;
}
.btns {
  margin-top: 4px;
}
</style>
