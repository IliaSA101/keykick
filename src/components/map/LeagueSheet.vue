<script setup lang="ts">
// Лист лиги (спека 019-Т8, ТЗ-1.8): звёзды N из M; в первой половине лиги — «сделано», со второй — «осталось».
// Альбом, эмблема и права (022/024/026) — одной строкой «появятся позже». Отсюда же — «Путь клуба». Окно ничего не пишет.
import { computed } from 'vue';
import type { MapModel } from '../../engine/map/model';
import { ru } from '../../i18n/ru';
import { fill, secondHalf, sheetLine, sheetRows } from './labels';
import MapDialog from './MapDialog.vue';

const props = defineProps<{ model: MapModel; leagueName: string }>();
const emit = defineEmits<{ close: []; path: [] }>();

const t = ru.map.sheet;
const rows = computed(() => sheetRows(props.model.stars, secondHalf(props.model.points)));
</script>

<template>
  <MapDialog
    labelledby="sheet-title"
    @close="emit('close')"
  >
    <template #default="{ close }">
      <h2 id="sheet-title">
        {{ fill(t.title, { league: leagueName }) }}
      </h2>
      <ul>
        <li
          v-for="r in rows"
          :key="r.id"
          :class="r.kind"
        >
          <span class="what">{{ t.stars }}</span>
          <span class="val">{{ sheetLine(r) }}</span>
        </li>
      </ul>
      <p class="later">
        {{ t.later }}
      </p>
      <div class="actions">
        <button
          type="button"
          class="btn"
          @click="emit('path')"
        >
          {{ t.path }}
        </button>
        <button
          type="button"
          class="btn main"
          data-autofocus
          @click="close"
        >
          {{ t.close }}
        </button>
      </div>
    </template>
  </MapDialog>
</template>

<style scoped>
h2 {
  margin: 0 0 var(--space-3);
  font-size: 1.5rem;
}

ul {
  display: grid;
  gap: var(--space-2);
  margin: 0 0 var(--space-4);
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  gap: var(--space-3);
  align-items: baseline;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: 12px;
  background: var(--accent-soft);
  font-size: 1.15rem;
}

.what {
  font-weight: 800;
}

.val {
  text-align: right;
}

.later {
  margin: 0 0 var(--space-4);
  color: var(--text-muted);
  font-size: 1rem;
}

.actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

.btn {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 2px solid var(--field-border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.btn.main {
  border-color: var(--accent);
  background: var(--accent);
  color: #1b1b1f;
}

.btn:focus-visible {
  outline: 4px solid var(--text);
  outline-offset: 2px;
}
</style>
