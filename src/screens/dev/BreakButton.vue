<script setup lang="ts">
/**
 * «Сломать»: бросает ошибку из обработчика, чтобы проверить окно сбоя (К6). Только для листа сверки: импортируется
 * из `KitSheet.vue`, а тот — динамически из dev-маршрута под `import.meta.env.DEV` (страж С5), в выпускную сборку не попадает.
 */
import KeyButton from '../../components/kit/KeyButton.vue';
import { ru } from '../../i18n/ru';

function breakNow(): never {
  throw new Error('dev: crash window check');
}
</script>

<template>
  <KeyButton
    quiet
    md
    @click="breakNow"
  >
    {{ ru.kit.sheet.breakNow }}
  </KeyButton>
</template>
