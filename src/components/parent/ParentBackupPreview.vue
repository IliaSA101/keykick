<script setup lang="ts">
/*
 * Превью загрузки файла (спека 014-Т6, design §8): таблица «сейчас / в файле» по игроку и два решения.
 * Только показ и два события: `confirm` и `cancel` (Esc — тоже отмена). Фокус по умолчанию — на «Отмена»
 * (014-Т7б); родитель зовёт `focusDefault()` после появления блока.
 */
import { ref } from 'vue';
import type { PreviewCell, PreviewRow } from '../../engine/save/backupView';
import { ru } from '../../i18n/ru';

defineProps<{ rows: PreviewRow[]; loadable: boolean; fileDate: string; app: string }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

const t = ru.backup;
const cancelButton = ref<HTMLButtonElement | null>(null);

function cellText(c: PreviewCell): string {
  return `${t.lesson} ${c.lesson} · ${t.coins} ${c.coins} · ${c.lastPlayed === '' ? t.noDate : `${t.played} ${c.lastPlayed}`}`;
}

defineExpose({
  focusDefault(): void {
    // Всегда «Отмена»: «Загрузить» заменяет данные, и случайный Enter не должен их заменить (014-Т7б, тестировщик).
    cancelButton.value?.focus();
  },
});
</script>

<template>
  <div
    class="preview"
    role="group"
    aria-labelledby="backup-preview"
    @keydown.esc.stop="emit('cancel')"
  >
    <h3 id="backup-preview">
      {{ t.previewTitle }}
    </h3>
    <p class="muted">
      <template v-if="fileDate !== ''">
        {{ t.fileFrom }} {{ fileDate }} ·
      </template>
      {{ t.fileVersion }} {{ app }}
    </p>
    <table v-if="rows.length > 0">
      <thead>
        <tr>
          <th scope="col">
            {{ t.colPlayer }}
          </th>
          <th scope="col">
            {{ t.colNow }}
          </th>
          <th scope="col">
            {{ t.colFile }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rows"
          :key="r.id"
        >
          <th scope="row">
            {{ r.name }}
          </th>
          <td>{{ r.now === null ? t.nowNone : cellText(r.now) }}</td>
          <td v-if="r.broken">
            {{ t.fileBroken }}
          </td>
          <td v-else>
            {{ r.inFile === null ? t.nowNone : cellText(r.inFile) }}
            <span
              v-if="r.isNew"
              class="new"
            >{{ t.isNew }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p
      v-if="!loadable"
      class="note"
      role="alert"
    >
      {{ t.nothing }}
    </p>
    <div class="row actions">
      <button
        type="button"
        class="btn red"
        :disabled="!loadable"
        @click="emit('confirm')"
      >
        {{ t.confirm }}
      </button>
      <button
        ref="cancelButton"
        type="button"
        class="btn"
        @click="emit('cancel')"
      >
        {{ t.cancel }}
      </button>
    </div>
  </div>
</template>

<style scoped src="./paper.css"></style>
<style scoped>
.preview {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--paper-border);
  border-radius: var(--radius);
}

h3 {
  margin: 0;
  font-size: 1.05rem;
}

table {
  width: 100%;
  margin-top: var(--space-3);
  border-collapse: collapse;
}

th,
td {
  padding: var(--space-2);
  border-top: 1px solid var(--paper-border);
  text-align: left;
  vertical-align: top;
}

thead th {
  color: #555;
  font-size: 0.9rem;
}

tbody th {
  white-space: nowrap;
}

.new {
  display: block;
  color: #555;
  font-size: 0.9rem;
}

.actions {
  margin-top: var(--space-3);
}
</style>
