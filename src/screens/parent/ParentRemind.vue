<script setup lang="ts">
/**
 * Плашка напоминания вверху страницы родителя (063 Т12, кадры Э6.83–88, 064 §3.4; правило — `engine/save/remind.ts`, 063-Р9).
 * Показывает страница, когда `remind(...)` сказал «пора»; ребёнок её не видит (страница родителя — только по набранному адресу).
 * `days` — сколько дней назад был файл; `null` — файла ещё не было.
 */
import { ref } from 'vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import { saveFileNow } from './saveFile';

defineProps<{ days: number | null }>();
const emit = defineEmits<{ changed: [] }>();
const p = ru.parent;

const failed = ref(false);
function save(): void {
  failed.value = saveFileNow() === 'fail';
  emit('changed'); // страница перечитывает устройство: после выгрузки плашки нет
}
</script>

<template>
  <aside
    class="pa-remind"
    role="status"
  >
    <p>
      {{ p.remind.lead }}
      {{ days === null ? p.remind.never : `${p.remind.last} ${days} ${plural(days, p.file.ago)}.` }}
    </p>
    <KeyButton
      md
      primary
      @click="save"
    >
      {{ p.file.save }}
    </KeyButton>
    <p
      v-if="failed"
      class="pa-note"
      role="alert"
    >
      {{ p.file.saveFail }}
    </p>
  </aside>
</template>
