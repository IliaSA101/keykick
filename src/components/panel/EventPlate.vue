<script setup lang="ts">
/**
 * Плашка-событие («Туман рассеялся», сбой записи) — `eventPlate` из kit.mjs: карточка с каймой, значок слева, мелкая строка снизу.
 * Слоты: по умолчанию — текст, `icon` — значок, `action` — главная кнопка (без `sub` рядом она встаёт по центру плашки).
 * Место — style снаружи.
 */
defineProps<{ sub?: string | undefined }>();
</script>

<template>
  <div
    class="kb-event"
    :class="{ 'ev-center': $slots.action && !sub }"
    role="status"
  >
    <span
      v-if="$slots.icon"
      class="ic"
    ><slot name="icon" /></span>
    <div>
      <p><slot /></p>
      <div
        v-if="$slots.action"
        class="ev-act"
      >
        <slot name="action" />
        <p
          v-if="sub"
          class="sub"
        >
          {{ sub }}
        </p>
      </div>
      <p
        v-else-if="sub"
        class="sub"
      >
        {{ sub }}
      </p>
    </div>
  </div>
</template>
