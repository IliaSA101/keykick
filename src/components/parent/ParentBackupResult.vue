<script setup lang="ts">
/*
 * Итог загрузки файла (спека 014-Т6, Р11, Р13): успех, частичный (загруженные и не влезшие) или отказ с причиной.
 * Только показ: `reloaded` — страница уже обновилась после загрузки (итог пришёл из sessionStorage),
 * иначе добавляется «Страница сейчас обновится».
 */
import type { ApplyReport } from '../../engine/save/backupView';
import { ru } from '../../i18n/ru';

defineProps<{ report: ApplyReport; reloaded: boolean }>();

const t = ru.backup;
</script>

<template>
  <div class="result">
    <template v-if="report.kind === 'done'">
      <p
        class="note"
        role="status"
      >
        {{ t.doneTitle }} {{ report.loaded.join(', ') }}.{{ reloaded ? '' : ` ${t.doneReload}` }}
      </p>
      <p
        v-if="report.skipped.length > 0"
        class="muted"
      >
        {{ t.skipped }} {{ report.skipped.join(', ') }}
      </p>
    </template>
    <template v-else-if="report.kind === 'partial'">
      <p
        class="note"
        role="alert"
      >
        {{ t.partialLoaded }} {{ report.loaded.join(', ') }}; {{ report.reason === 'no-space' ? t.partialLost : t.partialLostOther }} {{ report.lost.join(', ') }}.
        {{ t.reasons[report.reason] }}
      </p>
      <p
        v-if="report.reason === 'no-space'"
        class="muted"
      >
        {{ t.partialHint }}
      </p>
      <p
        v-if="report.skipped.length > 0"
        class="muted"
      >
        {{ t.skipped }} {{ report.skipped.join(', ') }}
      </p>
      <p
        v-if="!reloaded"
        class="muted"
      >
        {{ t.doneReload }}
      </p>
    </template>
    <p
      v-else
      class="note"
      role="alert"
    >
      {{ t.refused }} {{ t.reasons[report.reason] }}
    </p>
  </div>
</template>

<style scoped src="./paper.css"></style>
