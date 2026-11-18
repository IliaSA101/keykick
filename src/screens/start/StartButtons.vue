<script setup lang="ts">
/**
 * Пара кнопок окон первого запуска: главная «· Enter» и тихая «· Esc», обе не ниже 44 px (кадры Э6.75–82).
 * Один компонент вместо четырёх одинаковых блоков окна «Клуб пропал?».
 */
import KeyButton from '../../components/kit/KeyButton.vue';
import { ru } from '../../i18n/ru';

defineProps<{ primary: string; quiet: string }>();
defineEmits<{ primary: []; quiet: [] }>();
</script>

<template>
  <div class="btns">
    <KeyButton
      class="tall"
      primary
      :sub="ru.kit.enter"
      @click="$emit('primary')"
    >
      {{ primary }}
    </KeyButton>
    <KeyButton
      class="tall"
      quiet
      md
      :sub="ru.kit.esc"
      @click="$emit('quiet')"
    >
      {{ quiet }}
    </KeyButton>
  </div>
</template>

<style scoped>
/* кнопки окон первого запуска не ниже 44 px, и на 1024 (tall в system.mjs) */
.tall {
  min-height: 44px;
}
</style>
